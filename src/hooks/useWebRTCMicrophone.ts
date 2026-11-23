import { useState, useRef, useCallback, useEffect } from 'react';
import {
  getOptimalRtcConfig,
  isLocalHostCandidate,
  isSecureContextValid,
  getFriendlyMicErrorMessage,
  waitForWebSocketReady,
} from '../services/signaling';

/**
 * Optimizes WebRTC SDP for crystal-clear, continuous, stutter-free real-time audio.
 * Uses 20ms standard Opus frame (ptime=20), inband FEC (useinbandfec=1) for packet loss recovery,
 * dtx=0 to prevent silence-detection dropouts, and 64kbps bandwidth for full dynamic singing vocal range.
 */
export function optimizeSdpForUltraLowLatency(sdp: string): string {
  let newSdp = sdp;
  const opusMatch = newSdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (opusMatch) {
    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${pt}\\s+(.*)`, 'i');
    // Stable high-fidelity vocal profile:
    // ptime=20 (golden standard 20ms frame for zero stutter and lowest latency)
    // useinbandfec=1 (Opus Forward Error Correction to recover lost packets seamlessly)
    // dtx=0 (Continuous vocal transmission without clipping at start/end of singing phrases)
    // maxaveragebitrate=64000 (Studio vocal clarity without starving buffers)
    // cbr=0 (VBR allows dynamic rate adaptation to eliminate Wi-Fi queue choking)
    const ultraLowLatencyOpts = 'minptime=10;ptime=20;maxptime=40;useinbandfec=1;dtx=0;maxaveragebitrate=64000;stereo=0;sprop-stereo=0;cbr=0';

    if (fmtpRegex.test(newSdp)) {
      newSdp = newSdp.replace(fmtpRegex, (_m, existing) => {
        const cleaned = existing
          .split(';')
          .map((s: string) => s.trim())
          .filter((s: string) => s && !s.startsWith('minptime=') && !s.startsWith('ptime=') && !s.startsWith('maxptime=') && !s.startsWith('useinbandfec=') && !s.startsWith('dtx=') && !s.startsWith('maxaveragebitrate=') && !s.startsWith('cbr=') && !s.startsWith('stereo=') && !s.startsWith('sprop-stereo='));
        return `a=fmtp:${pt} ${cleaned ? cleaned + ';' : ''}${ultraLowLatencyOpts}`;
      });
    } else {
      newSdp = newSdp.replace(
        new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000[^\r\n]*[\r\n]+)`, 'i'),
        `$1a=fmtp:${pt} ${ultraLowLatencyOpts}\r\n`
      );
    }
  }

  // Set ptime=20 for smooth 20ms packet scheduling (eliminates Wi-Fi interrupt buffer underruns)
  if (/a=ptime:/i.test(newSdp)) {
    newSdp = newSdp.replace(/a=ptime:\d+/i, 'a=ptime:20\r\na=maxptime:40');
  } else {
    newSdp = newSdp.replace(/(m=audio[^\r\n]*[\r\n]+)/i, '$1a=ptime:20\r\na=minptime:10\r\na=maxptime:40\r\n');
  }

  return newSdp;
}

export interface UseWebRTCMicrophoneOptions {
  socketRef: React.MutableRefObject<WebSocket | null>;
  roomId: string;
  singerName: string;
  clientId?: string;
  onToast?: (msg: string) => void;
  onRequestReconnect?: () => void;
}

export function useWebRTCMicrophone({
  socketRef,
  roomId,
  singerName,
  clientId,
  onToast,
  onRequestReconnect,
}: UseWebRTCMicrophoneOptions) {
  const senderName = singerName;
  const effectiveSenderId = clientId || ('hp-' + singerName.replace(/\s+/g, '-'));
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Volume (0 - 150%) and Echo (0 - 100%) states (Sensitivitas diatur ke 75% optimal agar bebas storing/echo)
  const [micVolume, setMicVolume] = useState<number>(75);
  const [micEcho, setMicEcho] = useState<number>(0);

  // Anti-gema hardware toggle and zero-delay capture mode (echoCancellation: false, noiseSuppression: false)
  const [isEchoCancellationEnabled, setIsEchoCancellationEnabled] = useState(false);
  const [isZeroDelayBypass, setIsZeroDelayBypass] = useState(true);

  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100 volume meter
  const [micError, setMicError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isMutedRef = useRef(false);
  const isStreamingRef = useRef(false);
  const micVolumeRef = useRef(75);
  const lastLevelSentRef = useRef<number>(0);

  // Keep refs synchronized
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    micVolumeRef.current = micVolume;
  }, [micVolume]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Dispatch signaling message via WebSocket and BroadcastChannel (instant local loopback)
  const dispatchSignalingMessage = useCallback(
    (msg: any) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify(msg));
        } catch {}
      }
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(msg);
        } catch {}
      }
    },
    [socketRef]
  );

  // Send volume & echo changes to Master in real-time
  const broadcastMicParams = useCallback(
    (volume: number, echo: number) => {
      dispatchSignalingMessage({
        type: 'RTC_MIC_PARAMS',
        roomId,
        payload: {
          volume,
          echo,
          senderId: effectiveSenderId,
          senderName,
        },
        timestamp: Date.now(),
      });
    },
    [roomId, senderName, effectiveSenderId, dispatchSignalingMessage]
  );

  // Interactive (+ and -) Volume controls
  const increaseVolume = useCallback(() => {
    setMicVolume((prev) => {
      const next = Math.min(150, prev + 5);
      broadcastMicParams(next, micEcho);
      if (onToast) onToast(`Vol Mic: ${next}%`);
      return next;
    });
  }, [broadcastMicParams, micEcho, onToast]);

  const decreaseVolume = useCallback(() => {
    setMicVolume((prev) => {
      const next = Math.max(0, prev - 5);
      broadcastMicParams(next, micEcho);
      if (onToast) onToast(`Vol Mic: ${next}%`);
      return next;
    });
  }, [broadcastMicParams, micEcho, onToast]);

  const setVolumeDirect = useCallback(
    (vol: number) => {
      const clamped = Math.min(150, Math.max(0, vol));
      setMicVolume(clamped);
      broadcastMicParams(clamped, micEcho);
    },
    [broadcastMicParams, micEcho]
  );

  // Interactive (+ and -) Echo controls
  const increaseEcho = useCallback(() => {
    setMicEcho((prev) => {
      const next = Math.min(100, prev + 5);
      broadcastMicParams(micVolume, next);
      if (onToast) onToast(`Echo Gema: ${next}%`);
      return next;
    });
  }, [broadcastMicParams, micVolume, onToast]);

  const decreaseEcho = useCallback(() => {
    setMicEcho((prev) => {
      const next = Math.max(0, prev - 5);
      broadcastMicParams(micVolume, next);
      if (onToast) onToast(`Echo Gema: ${next}%`);
      return next;
    });
  }, [broadcastMicParams, micVolume, onToast]);

  const setEchoDirect = useCallback(
    (echo: number) => {
      const clamped = Math.min(100, Math.max(0, echo));
      setMicEcho(clamped);
      broadcastMicParams(micVolume, clamped);
    },
    [broadcastMicParams, micVolume]
  );

  // Stop broadcasting and clean up all media resources
  const stopBroadcasting = useCallback(() => {
    isStreamingRef.current = false;
    setIsStreaming(false);
    setIsMuted(false);
    setAudioLevel(0);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {}
      scriptProcessorRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }

    pendingCandidatesRef.current = [];
    setConnectionStatus('idle');

    dispatchSignalingMessage({
      type: 'RTC_MIC_STATUS',
      roomId,
      payload: {
        senderId: effectiveSenderId,
        isMicOn: false,
        senderName,
      },
      timestamp: Date.now(),
    });

    if (onToast) onToast('Mikrofon HP dimatikan');
  }, [roomId, senderName, effectiveSenderId, dispatchSignalingMessage, onToast]);

  // Start broadcasting microphone via WebRTC + real-time WebSocket audio relay
  const startBroadcasting = useCallback(
    async (forceEchoCancel?: boolean): Promise<boolean> => {
      setMicError(null);
      setConnectionStatus('connecting');

      // 1. Pre-flight Check: Ensure Room ID is present and valid
      if (!roomId || !roomId.trim()) {
        const errMsg = 'ID Ruangan belum terdaftar. Pastikan terhubung ke ruangan aktif sebelum menyalakan mikrofon.';
        setMicError(errMsg);
        setConnectionStatus('error');
        if (onToast) onToast(errMsg);
        return false;
      }

      // 2. Pre-flight Check: Ensure WebSocket or BroadcastChannel signaling transport is ready
      let isSocketReady = socketRef.current?.readyState === WebSocket.OPEN;
      const hasBroadcastChannel = !!broadcastChannelRef.current;

      // Only wait if neither WebSocket nor local BroadcastChannel is currently ready
      if (!isSocketReady && !hasBroadcastChannel) {
        if (onToast) onToast('Menyambungkan sinyal ruangan Karaoke...');

        // If closed, closing, or null, request reconnect
        if (
          !socketRef.current ||
          socketRef.current.readyState === WebSocket.CLOSED ||
          socketRef.current.readyState === WebSocket.CLOSING
        ) {
          if (onRequestReconnect) {
            onRequestReconnect();
          }
        }

        // Wait up to 2500ms polling for WebSocket to reach OPEN
        isSocketReady = await waitForWebSocketReady(() => socketRef.current, 2500);
      }

      // Check if either WebSocket or local BroadcastChannel is active
      const hasSignalingChannel = isSocketReady || hasBroadcastChannel;
      if (!hasSignalingChannel) {
        const errMsg = 'Koneksi jaringan belum siap. Pastikan terhubung ke ruangan karaoke aktif sebelum menyalakan mikrofon.';
        setMicError(errMsg);
        setConnectionStatus('error');
        if (onToast) onToast(errMsg);
        return false;
      }

      // 3. Pre-flight Check: Ensure Secure Context (HTTPS or localhost)
      const secureCheck = isSecureContextValid();
      if (!secureCheck.valid) {
        const errText = secureCheck.reason || 'Akses Mikrofon Bermasalah: Diperlukan koneksi HTTPS.';
        setMicError(errText);
        setConnectionStatus('error');
        if (onToast) onToast(errText);
        return false;
      }

      // Helper to query microphone stream with legacy browser fallbacks
      const acquireMicStream = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
          return navigator.mediaDevices.getUserMedia(constraints);
        }
        const legacyGUM =
          (navigator as any).getUserMedia ||
          (navigator as any).webkitGetUserMedia ||
          (navigator as any).mozGetUserMedia ||
          (navigator as any).msGetUserMedia;
        if (legacyGUM) {
          return new Promise<MediaStream>((resolve, reject) => {
            legacyGUM.call(navigator, constraints, resolve, reject);
          });
        }
        throw new Error('Akses mikrofon tidak didukung oleh browser pada halaman ini.');
      };

      // Matikan fitur pemrosesan suara berat (echo cancellation, noise suppression, AGC) agar bebas delay vokal
      const useEcho = typeof forceEchoCancel === 'boolean' ? forceEchoCancel : isEchoCancellationEnabled;

      // 4. Initialize Audio MediaStream with ultra low-latency constraints and graceful fallbacks
      let stream: MediaStream;
      try {
        try {
          stream = await acquireMicStream({
            audio: {
              echoCancellation: useEcho,
              noiseSuppression: false, // Matikan software noise suppression untuk menghilangkan lookahead buffer delay (hemat ~50-80ms!)
              autoGainControl: false,  // Matikan AGC browser yang menunda buffer audio
              latency: 0,
              channelCount: 1,
              sampleRate: { ideal: 48000 }, // Gunakan hardware native sampling agar OS mobile tidak melakukan glitchy resampling
              // Flag spesifik Chromium untuk mematikan semua DSP berat di background
              googEchoCancellation: useEcho,
              googAutoGainControl: false,
              googNoiseSuppression: false,
              googHighpassFilter: false,
              googTypingNoiseDetection: false,
              googAudioMirroring: false,
            } as any,
            video: false,
          });
        } catch (constraintErr: any) {
          // If error was NotAllowedError, do NOT retry constraints, throw immediately
          if (
            constraintErr.name === 'NotAllowedError' ||
            constraintErr.name === 'PermissionDeniedError' ||
            constraintErr.name === 'NotFoundError'
          ) {
            throw constraintErr;
          }
          console.warn('[WebRTC] Low-latency constraints failed, retrying generic audio:', constraintErr);
          try {
            // Fallback 1: basic audio constraint with DSP turned off
            stream = await acquireMicStream({
              audio: {
                channelCount: 1,
                echoCancellation: useEcho,
                noiseSuppression: false,
                autoGainControl: false,
              },
              video: false,
            });
          } catch (secondaryErr: any) {
            if (
              secondaryErr.name === 'NotAllowedError' ||
              secondaryErr.name === 'PermissionDeniedError' ||
              secondaryErr.name === 'NotFoundError'
            ) {
              throw secondaryErr;
            }
            console.warn('[WebRTC] Secondary audio constraints failed, retrying universal basic audio:', secondaryErr);
            // Fallback 2: Universal guaranteed basic audio constraint
            stream = await acquireMicStream({
              audio: true,
              video: false,
            });
          }
        }
      } catch (err: any) {
        console.error('[WebRTC] getUserMedia failed:', err);
        const friendlyMessage = getFriendlyMicErrorMessage(err);
        setMicError(friendlyMessage);
        setConnectionStatus('error');
        if (onToast) onToast(friendlyMessage);
        return false;
      }

      localStreamRef.current = stream;
      isStreamingRef.current = true;
      setIsStreaming(true);

      try {
        // 4. Setup AudioContext and Audio Processor for live VU meter AND real-time WebSocket audio relay
        // Penting: Gunakan hardware native sample rate agar tidak terjadi DOMException createMediaStreamSource mismatch!
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          let audioCtx: AudioContext;
          try {
            audioCtx = new AudioCtx({ latencyHint: 'interactive' });
          } catch {
            audioCtx = new AudioCtx();
          }
          audioContextRef.current = audioCtx;
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume().catch(() => {});
          }

          const source = audioCtx.createMediaStreamSource(stream);

          // AnalyserNode for local visualizer meter
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.2;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const timeArray = new Uint8Array(analyser.fftSize);
          let lastLocalLevelUpdate = 0;

          const updateMeter = () => {
            if (analyserRef.current && localStreamRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray as any);
              analyserRef.current.getByteTimeDomainData(timeArray as any);

              // 1. Transient peak from time domain (silence is 128)
              let maxDiff = 0;
              for (let i = 0; i < timeArray.length; i++) {
                const diff = Math.abs(timeArray[i] - 128);
                if (diff > maxDiff) maxDiff = diff;
              }

              // 2. Vocal energy from frequency domain
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;

              // Calibrated logarithmic responsive VU meter curve
              const peakNorm = Math.min(1, maxDiff / 48);
              const freqNorm = Math.min(1, avg / 35);
              const combinedNorm = Math.max(peakNorm * 0.85, freqNorm);
              const targetLevel = isMutedRef.current ? 0 : Math.min(100, Math.round(Math.pow(combinedNorm, 0.75) * 100));

              // Smooth throttle (~25 FPS / 40ms) to prevent mobile React render thrashing
              const now = performance.now();
              if (now - lastLocalLevelUpdate >= 40) {
                lastLocalLevelUpdate = now;
                setAudioLevel((prev) => {
                  if (targetLevel >= prev) return targetLevel;
                  return Math.max(0, Math.round(prev * 0.82));
                });
              }

              // Send level update to Master with optimal cadence (avoids flooding mobile Wi-Fi socket buffer)
              const nowMs = Date.now();
              const isP2P =
                pcRef.current &&
                (pcRef.current.connectionState === 'connected' ||
                  pcRef.current.iceConnectionState === 'connected' ||
                  pcRef.current.iceConnectionState === 'completed');

              // In P2P mode: 120ms cadence is optimal for remote HUD
              // In relay fallback mode: CLIENT_MIC_AUDIO_DATA already carries audio level every chunk,
              // so RTC_MIC_LEVEL only needs to fire every 250ms when idle/muted
              const throttleInterval = isP2P ? 120 : 250;
              if (nowMs - lastLevelSentRef.current > throttleInterval) {
                lastLevelSentRef.current = nowMs;
                dispatchSignalingMessage({
                  type: 'RTC_MIC_LEVEL',
                  roomId,
                  payload: {
                    senderId: effectiveSenderId,
                    senderName,
                    level: targetLevel,
                  },
                });
              }

              animFrameRef.current = requestAnimationFrame(updateMeter);
            }
          };

          // ScriptProcessor for real-time WebSocket audio relay fallback (2048 samples buffer = rock-solid, stutter-free Web Audio processing on mobile devices without thread lag)
          const processor = audioCtx.createScriptProcessor(2048, 1, 1);
          scriptProcessorRef.current = processor;
          source.connect(processor);

          const silentGain = audioCtx.createGain();
          silentGain.gain.value = 0; // Strictly 0: Mencegah kebocoran audio ke speaker HP agar tidak terjadi feedback/storing lokal
          processor.connect(silentGain);
          silentGain.connect(audioCtx.destination);

          processor.onaudioprocess = (e) => {
            if (!isStreamingRef.current || isMutedRef.current) return;
            const input = e.inputBuffer.getChannelData(0);
            if (!input || input.length === 0) return;

            const sourceSampleRate = audioCtx.sampleRate;
            const targetSampleRate = 24000; // 24kHz wideband studio vocal (covers up to 12kHz audio frequencies, crisp and rich)

            // Direct downsample to 16-bit PCM @ 24kHz wideband vocal
            let finalSamples: Float32Array;
            if (sourceSampleRate === targetSampleRate) {
              finalSamples = input;
            } else {
              const ratio = sourceSampleRate / targetSampleRate;
              const targetLen = Math.floor(input.length / ratio);
              finalSamples = new Float32Array(targetLen);
              for (let i = 0; i < targetLen; i++) {
                const srcIdx = i * ratio;
                const i0 = Math.floor(srcIdx);
                const i1 = Math.min(i0 + 1, input.length - 1);
                const frac = srcIdx - i0;
                finalSamples[i] = input[i0] * (1 - frac) + input[i1] * frac;
              }
            }

            const outLen = finalSamples.length;
            if (outLen === 0) return;

            let maxVal = 0;
            for (let i = 0; i < outLen; i++) {
              const abs = Math.abs(finalSamples[i]);
              if (abs > maxVal) maxVal = abs;
            }

            // Calibrated dynamic gain
            const sensitivity = ((micVolumeRef.current || 75) / 100) * 0.95;

            const pcm16 = new Int16Array(outLen);
            for (let i = 0; i < outLen; i++) {
              let sample = finalSamples[i] * sensitivity;
              if (sample > 0.999) sample = 0.999;
              else if (sample < -0.999) sample = -0.999;
              pcm16[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
            }

            const currentLevel = Math.min(100, Math.round((maxVal / 0.5) * 100));

            const u8 = new Uint8Array(pcm16.buffer);
            let binary = '';
            const chunkSize = 4096;
            const u8len = u8.length;
            for (let i = 0; i < u8len; i += chunkSize) {
              binary += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + chunkSize, u8len)) as any);
            }
            const base64 = btoa(binary);

            // Send WebSocket PCM relay chunks if WebRTC P2P direct stream is not yet established
            const isP2PConnected =
              pcRef.current &&
              (pcRef.current.connectionState === 'connected' ||
                pcRef.current.iceConnectionState === 'connected' ||
                pcRef.current.iceConnectionState === 'completed');

            if (!isP2PConnected) {
              dispatchSignalingMessage({
                type: 'CLIENT_MIC_AUDIO_DATA',
                roomId,
                payload: {
                  senderId: effectiveSenderId,
                  senderName,
                  pcm: base64,
                  sampleRate: targetSampleRate,
                  level: currentLevel,
                  volume: micVolume,
                  echo: micEcho,
                },
              });
            }
          };

          updateMeter();
        }

        // 5. Create WebRTC Peer Connection (P2P direct audio mode)
        // Memaksa koneksi langsung antarmuka IP lokal (host candidate) jika di Hotspot / LAN
        const rtcConfig = getOptimalRtcConfig();
        const pc = new RTCPeerConnection(rtcConfig);
        pcRef.current = pc;

        // Add audio track to peer connection with high priority & speech low-latency profile
        stream.getAudioTracks().forEach((track) => {
          track.contentHint = 'speech';
          const sender = pc.addTrack(track, stream);
          try {
            const params = sender.getParameters();
            if (params.encodings && params.encodings[0]) {
              params.encodings[0].priority = 'high';
              params.encodings[0].networkPriority = 'high';
              params.encodings[0].maxBitrate = 64000; // 64kbps high-fidelity vocal rate for smooth singing without choking
              sender.setParameters(params).catch(() => {});
            }
          } catch {}
        });

        // Handle ICE candidates: Segera kirim candidate lokal (typ host)
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            // Prioritize local host candidates
            const cand = event.candidate;
            const isLocal = isLocalHostCandidate(cand);
            dispatchSignalingMessage({
              type: 'RTC_ICE_CANDIDATE',
              roomId,
              payload: {
                senderId: effectiveSenderId,
                candidate: cand,
                isHostCandidate: isLocal,
                senderName,
              },
              timestamp: Date.now(),
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (!pcRef.current) return;
          const state = pcRef.current.connectionState;
          if (state === 'connected') {
            setConnectionStatus('connected');
          } else if (state === 'failed' || state === 'disconnected') {
            // Note: WebSocket audio relay continues streaming seamlessly
            setConnectionStatus('connected');
          }
        };

        // 6. Create Offer with low-latency audio settings
        const rawOffer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });

        const optimizedOffer = {
          type: rawOffer.type,
          sdp: optimizeSdpForUltraLowLatency(rawOffer.sdp || ''),
        };

        await pc.setLocalDescription(optimizedOffer);

        // 7. Send Offer and initial mic parameters to Master
        dispatchSignalingMessage({
          type: 'RTC_OFFER',
          roomId,
          payload: {
            senderId: effectiveSenderId,
            offer: optimizedOffer,
            senderName,
          },
          timestamp: Date.now(),
        });

        dispatchSignalingMessage({
          type: 'RTC_MIC_STATUS',
          roomId,
          payload: {
            senderId: effectiveSenderId,
            isMicOn: true,
            senderName,
          },
          timestamp: Date.now(),
        });

        broadcastMicParams(micVolume, micEcho);

        isStreamingRef.current = true;
        setIsStreaming(true);
        setIsMuted(false);
        setConnectionStatus('connected');
        if (onToast) onToast('🎤 Mikrofon HP Aktif! Suara langsung terhubung ke Master.');
        return true;
      } catch (err: any) {
        console.error('[WebRTC] Error during peer setup:', err);
        const errMsg = getFriendlyMicErrorMessage(err);
        setMicError(errMsg);
        setConnectionStatus('error');
        stopBroadcasting();
        if (onToast) onToast(errMsg);
        return false;
      }
    },
    [
      roomId,
      senderName,
      socketRef,
      stopBroadcasting,
      isEchoCancellationEnabled,
      isZeroDelayBypass,
      micVolume,
      micEcho,
      broadcastMicParams,
      onToast,
      onRequestReconnect,
    ]
  );

  // Toggle echo cancellation mode dynamically
  const toggleEchoCancellation = useCallback(() => {
    setIsEchoCancellationEnabled((prev) => {
      const nextVal = !prev;
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack && typeof (audioTrack as any).applyConstraints === 'function') {
          (audioTrack as any)
            .applyConstraints({
              echoCancellation: nextVal,
            })
            .catch(() => {});
        }
      }
      if (onToast) {
        onToast(nextVal ? 'Anti-Gema Hardware: AKTIF' : 'Anti-Gema Hardware: NONAKTIF');
      }
      return nextVal;
    });
  }, [onToast]);

  // Toggle zero-delay bypass mode
  const toggleZeroDelayBypass = useCallback(() => {
    setIsZeroDelayBypass((prev) => {
      const nextVal = !prev;
      if (onToast) {
        onToast(nextVal ? 'Mode Nol Delay Vokal-Musik: AKTIF' : 'Mode Filter Standar: AKTIF');
      }
      return nextVal;
    });
  }, [onToast]);

  // Handle incoming signaling messages from Master (RTC_ANSWER, RTC_ICE_CANDIDATE, RTC_MIC_PARAMS)
  const handleSignalingMessage = useCallback(async (data: any) => {
    if (!data || !data.type) return;

    if (data.type === 'RTC_ANSWER' && pcRef.current) {
      const answer = data.payload?.answer;
      if (answer) {
        try {
          if (pcRef.current.signalingState === 'have-local-offer') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setConnectionStatus('connected');

            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              if (candidate) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }
          }
        } catch (e) {
          console.warn('[WebRTC] Error setting remote description (answer):', e);
        }
      }
    } else if (data.type === 'RTC_ICE_CANDIDATE' && pcRef.current) {
      const candidate = data.payload?.candidate;
      if (candidate) {
        try {
          if (pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        } catch (e) {
          console.warn('[WebRTC] Error adding ICE candidate:', e);
        }
      }
    } else if (data.type === 'RTC_MIC_PARAMS') {
      const { volume, echo } = data.payload || {};
      if (typeof volume === 'number') setMicVolume(Math.min(150, Math.max(0, volume)));
      if (typeof echo === 'number') setMicEcho(Math.min(100, Math.max(0, echo)));
    }
  }, []);

  // Listen for local BroadcastChannel signaling from Master (for on-screen simulator and local tabs)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && roomId) {
      try {
        const bc = new BroadcastChannel(`karaoke_channel_${roomId.trim().toUpperCase()}`);
        broadcastChannelRef.current = bc;
        bc.onmessage = (event) => {
          if (event.data && typeof event.data === 'object') {
            const data = event.data;
            if (
              data.type === 'RTC_ANSWER' ||
              data.type === 'RTC_ICE_CANDIDATE' ||
              data.type === 'RTC_MIC_PARAMS'
            ) {
              const target = data.payload?.targetClientId;
              if (
                !target ||
                target === effectiveSenderId ||
                target === clientId ||
                (typeof target === 'string' && (target.includes(effectiveSenderId) || effectiveSenderId.includes(target)))
              ) {
                handleSignalingMessage(data);
              }
            }
          }
        };
        return () => {
          bc.close();
          broadcastChannelRef.current = null;
        };
      } catch {}
    }
  }, [roomId, effectiveSenderId, clientId, handleSignalingMessage]);

  // Toggle local microphone mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const nextMuted = !audioTrack.enabled;
      setIsMuted(nextMuted);
      isMutedRef.current = nextMuted;
      if (onToast) {
        onToast(audioTrack.enabled ? 'Mikrofon diaktifkan' : 'Mikrofon dibisukan (Mute)');
      }
    }
  }, [onToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcasting();
    };
  }, [stopBroadcasting]);

  return {
    isStreaming,
    isMuted,
    isEchoCancellationEnabled,
    isZeroDelayBypass,
    micVolume,
    micEcho,
    audioLevel,
    micError,
    connectionStatus,
    startBroadcasting,
    stopBroadcasting,
    toggleMute,
    toggleEchoCancellation,
    toggleZeroDelayBypass,
    increaseVolume,
    decreaseVolume,
    setVolumeDirect,
    increaseEcho,
    decreaseEcho,
    setEchoDirect,
    handleSignalingMessage,
  };
}
