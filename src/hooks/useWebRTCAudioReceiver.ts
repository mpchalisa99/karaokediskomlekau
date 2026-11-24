import { useState, useRef, useCallback, useEffect } from 'react';
import { optimizeSdpForUltraLowLatency } from './useWebRTCMicrophone';
import { getOptimalRtcConfig, isLocalHostCandidate } from '../services/signaling';

export interface ActiveWirelessMic {
  senderId: string;
  senderName: string;
  stream?: MediaStream | null;
  volume: number; // 0 - 150% (defaults to 100%)
  echo: number;   // 0 - 100% (defaults to 0%)
  isMuted?: boolean;
  audioLevel: number; // 0 - 100% live VU meter
  addedAt: number;
  lastActive: number;
  mode: 'webrtc' | 'relay';
}

export interface UseWebRTCAudioReceiverOptions {
  socketRef: React.MutableRefObject<WebSocket | null>;
  roomId: string;
}

interface WebAudioNodes {
  source?: MediaStreamAudioSourceNode | null;
  // Professional Anti-Storing & Studio Vocal DSP Chain
  highpass: BiquadFilterNode;
  notch1: BiquadFilterNode;
  notch2: BiquadFilterNode;
  notch3: BiquadFilterNode;
  deMud: BiquadFilterNode;
  presenceBoost: BiquadFilterNode;
  airShelf: BiquadFilterNode;
  antiSqueal: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  dryGain: GainNode;
  delayNode: DelayNode;
  feedbackGain: GainNode;
  echoBandpass: BiquadFilterNode;
  wetGain: GainNode;
  clientGain: GainNode; // Individual volume & mute for this specific mic
  masterGain: GainNode; // Global master mic bus
  clientVolume: number;
  clientEcho: number;
  clientMuted: boolean;
  nextScheduledTime: number; // For scheduling WebSocket audio chunks smoothly
  analyser: AnalyserNode;
  analyserDataArray: Uint8Array;
  analyserTimeArray: Uint8Array;
}

export function useWebRTCAudioReceiver({ socketRef, roomId }: UseWebRTCAudioReceiverOptions) {
  const [activeMics, setActiveMics] = useState<ActiveWirelessMic[]>([]);
  const [masterMicVolume, setMasterMicVolume] = useState<number>(75); // 0 - 150% (default 75% sesuai permintaan pengguna)
  const [masterMicEcho, setMasterMicEcho] = useState<number>(0); // 0 - 100% (default 0% studio dry vocal)
  const [isMasterMicMuted, setIsMasterMicMuted] = useState<boolean>(false);
  const [isAudioSuspended, setIsAudioSuspended] = useState<boolean>(false);

  // TV Vocal Sync Delay Buffer / Music Delay (0ms - 250ms, default 0ms untuk zero delay murni)
  const [musicDelayMs, setMusicDelayMsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('karaoke_music_delay_ms_v1');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return Math.max(0, Math.min(250, val));
      }
    } catch {}
    return 0; // 0ms default: zero delay murni tanpa lag
  });

  // PeerConnections and Audio Elements indexed by senderId
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Web Audio Context for zero-latency (<15ms) sound playback & real-time karaoke echo effect
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<Map<string, WebAudioNodes>>(new Map());
  const masterVolumeRef = useRef<number>(100);
  const masterEchoRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Send signaling messages via both WebSocket (network devices) and BroadcastChannel (same-screen/local tabs)
  const sendSignalingBack = useCallback(
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

  // Web Audio API DelayNode + Loudness Boost + Limiter for TV Music Sync & Ducking
  const musicDelayNodeRef = useRef<DelayNode | null>(null);
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const musicCompressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const musicBoostMultiplierRef = useRef<number>(1.45);
  const connectedMusicElementsRef = useRef<WeakSet<HTMLMediaElement>>(new WeakSet());
  const musicDelayMsRef = useRef<number>(70);

  useEffect(() => {
    musicDelayMsRef.current = musicDelayMs;
  }, [musicDelayMs]);

  useEffect(() => {
    masterVolumeRef.current = masterMicVolume;
  }, [masterMicVolume]);

  useEffect(() => {
    masterEchoRef.current = masterMicEcho;
  }, [masterMicEcho]);

  useEffect(() => {
    isMutedRef.current = isMasterMicMuted;
  }, [isMasterMicMuted]);

  const ensureMusicAudioGraph = useCallback((ctx: AudioContext) => {
    if (!musicDelayNodeRef.current || !musicGainNodeRef.current) {
      const delay = ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(musicDelayMsRef.current / 1000, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(musicBoostMultiplierRef.current, ctx.currentTime);

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-8, ctx.currentTime);
      compressor.knee.setValueAtTime(12, ctx.currentTime);
      compressor.ratio.setValueAtTime(6, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      delay.connect(gain);
      gain.connect(compressor);
      compressor.connect(ctx.destination);

      musicDelayNodeRef.current = delay;
      musicGainNodeRef.current = gain;
      musicCompressorNodeRef.current = compressor;
    }
  }, []);

  // Initialize or retrieve shared AudioContext with minimum hardware latency hint
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        let ctx: AudioContext;
        try {
          ctx = new AudioCtx({ latencyHint: 0 });
        } catch {
          ctx = new AudioCtx({ latencyHint: 'interactive' });
        }
        audioContextRef.current = ctx;

        // Initialize dedicated Music DelayNode + Gain Boost + Limiter pipeline
        try {
          ensureMusicAudioGraph(ctx);
        } catch (e) {
          console.warn('[WebAudio] DelayNode init error:', e);
        }
      }
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        setIsAudioSuspended(true);
        audioContextRef.current.resume().then(() => {
          setIsAudioSuspended(false);
        }).catch(() => {});
      } else {
        setIsAudioSuspended(false);
      }
    }

    return audioContextRef.current;
  }, [ensureMusicAudioGraph]);

  // Smoothly adjust music loudness boost / ducking multiplier (1.45 normal, ~0.35 when MC speaks)
  const setMusicBoostMultiplier = useCallback((multiplier: number) => {
    const clamped = Math.max(0.05, Math.min(2.0, multiplier));
    musicBoostMultiplierRef.current = clamped;
    const ctx = audioContextRef.current;
    const gainNode = musicGainNodeRef.current;
    if (ctx && gainNode) {
      try {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(clamped, now + 0.18);
      } catch {
        gainNode.gain.value = clamped;
      }
    }
  }, []);

  // Update Music Delay with smooth Web Audio DelayNode parameter ramping
  const setMusicDelayMs = useCallback(
    (newDelay: number, broadcast = true) => {
      const clamped = Math.max(0, Math.min(250, Math.round(newDelay)));
      setMusicDelayMsState(clamped);
      musicDelayMsRef.current = clamped;

      try {
        localStorage.setItem('karaoke_music_delay_ms_v1', String(clamped));
      } catch {}

      const ctx = audioContextRef.current;
      if (ctx && musicDelayNodeRef.current) {
        try {
          const targetSec = clamped / 1000;
          musicDelayNodeRef.current.delayTime.cancelScheduledValues(ctx.currentTime);
          musicDelayNodeRef.current.delayTime.setValueAtTime(targetSec, ctx.currentTime);
        } catch (e) {
          console.warn('[WebAudio] Error setting delayTime:', e);
        }
      }

      // Broadcast update across WebSocket room
      if (broadcast && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(
            JSON.stringify({
              type: 'MUSIC_SYNC_DELAY',
              roomId,
              payload: { delayMs: clamped },
              timestamp: Date.now(),
            })
          );
        } catch {}
      }
    },
    [roomId, socketRef]
  );

  // Connect any HTMLMediaElement (audio/video music player) through TV Music DelayNode + Gain Boost + Limiter
  const connectMusicMediaElement = useCallback(
    (mediaElem: HTMLMediaElement) => {
      if (!mediaElem) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        ensureMusicAudioGraph(ctx);

        if (musicDelayNodeRef.current && !connectedMusicElementsRef.current.has(mediaElem)) {
          const source = ctx.createMediaElementSource(mediaElem);
          source.connect(musicDelayNodeRef.current);
          connectedMusicElementsRef.current.add(mediaElem);
          console.log('[WebAudio TV] Music media element routed through Boost+Limiter+DelayNode successfully');
        }
      } catch (err) {
        console.warn('[WebAudio TV] connectMusicMediaElement:', err);
      }
    },
    [ensureMusicAudioGraph, getAudioContext]
  );

  // Explicit user unlock action (e.g. clicking "Aktifkan Audio" or touching screen)
  const resumeAudio = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        setIsAudioSuspended(false);
      } catch {}
    } else if (ctx && ctx.state === 'running') {
      setIsAudioSuspended(false);
    }
    // Also resume all hardware audio elements
    audioElementsRef.current.forEach((el) => {
      try {
        if (el.paused) el.play().catch(() => {});
      } catch {}
    });
  }, [getAudioContext]);

  // Unlock AudioContext and Audio Elements on any master user interaction
  useEffect(() => {
    const handleUnlock = () => {
      resumeAudio();
    };
    window.addEventListener('click', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    window.addEventListener('touchstart', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };
  }, [resumeAudio]);

  // Real-time Master Sound Level Indicator (VU Meter) monitoring loop
  // Directly reads hardware audio amplitude from AnalyserNode of each connected microphone
  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;

    const readAudioLevels = () => {
      const now = performance.now();
      if (now - lastUpdate >= 30) {
        lastUpdate = now;
        const levelsMap = new Map<string, number>();

        audioNodesRef.current.forEach((nodes, senderId) => {
          if (nodes.analyser && nodes.analyserDataArray && nodes.analyserTimeArray) {
            nodes.analyser.getByteFrequencyData(nodes.analyserDataArray as any);
            nodes.analyser.getByteTimeDomainData(nodes.analyserTimeArray as any);

            // 1. Time-domain peak transient measurement
            let maxDiff = 0;
            const timeLen = nodes.analyserTimeArray.length;
            for (let i = 0; i < timeLen; i++) {
              const diff = Math.abs(nodes.analyserTimeArray[i] - 128);
              if (diff > maxDiff) maxDiff = diff;
            }

            // 2. Frequency vocal energy
            let freqSum = 0;
            const freqLen = nodes.analyserDataArray.length;
            for (let i = 0; i < freqLen; i++) {
              freqSum += nodes.analyserDataArray[i];
            }
            const avgFreq = freqSum / freqLen;

            // Highly responsive and natural VU meter scaling
            const timeLvl = (maxDiff / 70) * 100;
            const freqLvl = (avgFreq / 55) * 100;
            const raw = Math.max(timeLvl, freqLvl);
            const level = nodes.clientMuted || isMutedRef.current ? 0 : Math.min(100, Math.round(raw));
            levelsMap.set(senderId, level);
          }
        });

        if (levelsMap.size > 0) {
          setActiveMics((prev) => {
            let changed = false;
            const next = prev.map((m) => {
              const measuredLevel = levelsMap.get(m.senderId);
              if (measuredLevel !== undefined) {
                // Instant attack, smooth analog decay
                const current = m.audioLevel || 0;
                let target = measuredLevel;
                if (target < current) {
                  target = Math.max(0, Math.round(current * 0.82));
                }
                if (target !== current) {
                  changed = true;
                  return { ...m, audioLevel: target, lastActive: measuredLevel > 4 ? Date.now() : m.lastActive };
                }
              }
              return m;
            });
            return changed ? next : prev;
          });
        }
      }

      animId = requestAnimationFrame(readAudioLevels);
    };

    animId = requestAnimationFrame(readAudioLevels);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Create or retrieve per-client Web Audio node pipeline
  const getOrCreateClientAudioNodes = useCallback(
    (senderId: string): WebAudioNodes | null => {
      let nodes = audioNodesRef.current.get(senderId);
      if (nodes) return nodes;

      const audioCtx = getAudioContext();
      if (!audioCtx) return null;

      try {
        // 1. Anti-Rumble Subsonic High-Pass Filter at 110Hz (Q: 0.8)
        // Cuts stage thump, plosives (pops), handling rumble, and subwoofer feedback
        const highpass = audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(110, audioCtx.currentTime);
        highpass.Q.setValueAtTime(0.8, audioCtx.currentTime);

        // 2. Anti-Storing Notch Filters (targets acoustic feedback resonance frequencies)
        // Notch 1: 240Hz (Cuts boomy low-mid room resonance & body feedback)
        const notch1 = audioCtx.createBiquadFilter();
        notch1.type = 'peaking';
        notch1.frequency.setValueAtTime(240, audioCtx.currentTime);
        notch1.Q.setValueAtTime(3.5, audioCtx.currentTime);
        notch1.gain.setValueAtTime(-4.0, audioCtx.currentTime);

        // Notch 2: 1750Hz (Cuts nasal acoustic coupling resonance)
        const notch2 = audioCtx.createBiquadFilter();
        notch2.type = 'peaking';
        notch2.frequency.setValueAtTime(1750, audioCtx.currentTime);
        notch2.Q.setValueAtTime(4.0, audioCtx.currentTime);
        notch2.gain.setValueAtTime(-3.5, audioCtx.currentTime);

        // Notch 3: 3150Hz (Targets high-pitch storing whistle / feedback howl)
        const notch3 = audioCtx.createBiquadFilter();
        notch3.type = 'peaking';
        notch3.frequency.setValueAtTime(3150, audioCtx.currentTime);
        notch3.Q.setValueAtTime(4.5, audioCtx.currentTime);
        notch3.gain.setValueAtTime(-4.5, audioCtx.currentTime);

        // 3. Professional Studio Vocal Equalizer: De-Mud + Presence + Air Sheen
        // De-Mud: removes boxy hollow resonance typical of mobile phone electret microphones
        const deMud = audioCtx.createBiquadFilter();
        deMud.type = 'peaking';
        deMud.frequency.setValueAtTime(360, audioCtx.currentTime);
        deMud.Q.setValueAtTime(1.4, audioCtx.currentTime);
        deMud.gain.setValueAtTime(-3.0, audioCtx.currentTime);

        // Presence Boost: 3.8kHz golden frequency for crisp vocal intelligibility and articulation
        const presenceBoost = audioCtx.createBiquadFilter();
        presenceBoost.type = 'peaking';
        presenceBoost.frequency.setValueAtTime(3800, audioCtx.currentTime);
        presenceBoost.Q.setValueAtTime(1.2, audioCtx.currentTime);
        presenceBoost.gain.setValueAtTime(3.8, audioCtx.currentTime);

        const nyquist = audioCtx.sampleRate / 2;

        // Air Shelf: smooth polish & presence (clamped below Nyquist)
        const airShelf = audioCtx.createBiquadFilter();
        airShelf.type = 'highshelf';
        airShelf.frequency.setValueAtTime(Math.min(7000, nyquist - 100), audioCtx.currentTime);
        airShelf.gain.setValueAtTime(2.2, audioCtx.currentTime);

        // Anti-Squeal: steep lowpass to eliminate high-frequency microphone squeals (clamped below Nyquist)
        const antiSqueal = audioCtx.createBiquadFilter();
        antiSqueal.type = 'lowpass';
        antiSqueal.frequency.setValueAtTime(Math.min(7500, nyquist - 50), audioCtx.currentTime);
        antiSqueal.Q.setValueAtTime(0.707, audioCtx.currentTime);

        // 4. Vocal Dynamics Compressor (smooth dynamic leveling)
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
        compressor.knee.setValueAtTime(10, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(3.5, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.12, audioCtx.currentTime);

        // 5. Studio Brickwall Peak Limiter (prevents digital clipping/distortions on loud singing)
        const limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-2.5, audioCtx.currentTime);
        limiter.knee.setValueAtTime(2, audioCtx.currentTime);
        limiter.ratio.setValueAtTime(20, audioCtx.currentTime);
        limiter.attack.setValueAtTime(0.001, audioCtx.currentTime);
        limiter.release.setValueAtTime(0.05, audioCtx.currentTime);

        // 6. Individual Client Gain Node (controls this specific phone's volume & mute - Default 75%)
        const clientGain = audioCtx.createGain();
        clientGain.gain.setValueAtTime(0.75, audioCtx.currentTime);

        // Master Gain Node for global master volume control across all mics
        const masterGain = audioCtx.createGain();
        const targetMasterVol = isMutedRef.current ? 0 : Math.min(1.5, Math.max(0, (masterVolumeRef.current || 75) / 100));
        masterGain.gain.setValueAtTime(targetMasterVol, audioCtx.currentTime);

        // Dry path (Direct Instant Voice - zero latency straight to output)
        const dryGain = audioCtx.createGain();
        dryGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        // 7. Echo / Reverb Path (Defaults to 0% - completely OFF and muted for zero storing)
        const delayNode = audioCtx.createDelay(1.0);
        delayNode.delayTime.setValueAtTime(0.085, audioCtx.currentTime); // 85ms tight subtle spatial ambience

        // Safe vocal bandpass filter for echo loop (prevents resonance accumulation)
        const echoBandpass = audioCtx.createBiquadFilter();
        echoBandpass.type = 'bandpass';
        echoBandpass.frequency.setValueAtTime(1400, audioCtx.currentTime);
        echoBandpass.Q.setValueAtTime(1.0, audioCtx.currentTime);

        const feedbackGain = audioCtx.createGain();
        const initialEcho = masterEchoRef.current;
        // Strictly 0 when echo is 0%; capped at 0.18 when echo is active to guarantee no runaway feedback loop
        const targetFeedback = initialEcho > 0 ? Math.min(0.18, (initialEcho / 100) * 0.18) : 0;
        feedbackGain.gain.setValueAtTime(targetFeedback, audioCtx.currentTime);

        const wetGain = audioCtx.createGain();
        const targetWet = initialEcho > 0 ? (initialEcho / 100) * 0.35 : 0;
        wetGain.gain.setValueAtTime(targetWet, audioCtx.currentTime);

        // DIRECT ZERO-LATENCY DRY AUDIO ROUTING:
        // Input -> highpass (80Hz rumble cut) -> dryGain -> clientGain -> masterGain -> destination
        // Jalur vokal murni melewati langsung tanpa lookahead compressor/limiter buffer delay!
        highpass.connect(dryGain);
        dryGain.connect(clientGain);

        // Jalur Echo / Gema Ruang (Hanya aktif jika echo slider dinaikkan di atas 0%)
        highpass.connect(delayNode);
        delayNode.connect(echoBandpass);
        echoBandpass.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        echoBandpass.connect(wetGain);
        wetGain.connect(clientGain);

        // Mix into Master Output Bus
        clientGain.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        // AnalyserNode for live sound level indicator & VU meter
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.2;
        clientGain.connect(analyser);
        const analyserDataArray = new Uint8Array(analyser.frequencyBinCount);
        const analyserTimeArray = new Uint8Array(analyser.fftSize);

        nodes = {
          source: null,
          highpass,
          notch1,
          notch2,
          notch3,
          deMud,
          presenceBoost,
          airShelf,
          antiSqueal,
          compressor,
          limiter,
          dryGain,
          delayNode,
          echoBandpass,
          feedbackGain,
          wetGain,
          clientGain,
          masterGain,
          clientVolume: 75,
          clientEcho: initialEcho,
          clientMuted: false,
          nextScheduledTime: audioCtx.currentTime,
          analyser,
          analyserDataArray,
          analyserTimeArray,
        };

        audioNodesRef.current.set(senderId, nodes);
        return nodes;
      } catch (err) {
        console.warn('[WebAudio] Node creation error:', err);
        return null;
      }
    },
    [getAudioContext]
  );

  // Broadcast volume & echo parameter updates to mobile client
  const broadcastMicParams = useCallback(
    (volume: number, echo: number, targetClientId?: string) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(
            JSON.stringify({
              type: 'RTC_MIC_PARAMS',
              roomId,
              payload: {
                targetClientId,
                volume,
                echo,
              },
              timestamp: Date.now(),
            })
          );
        } catch {}
      }
    },
    [roomId, socketRef]
  );

  // Incremental control functions (+ and -) for Master Volume and Echo
  const increaseVolume = useCallback(() => {
    setMasterMicVolume((prev) => {
      const next = Math.min(150, prev + 5);
      broadcastMicParams(next, masterMicEcho);
      return next;
    });
  }, [broadcastMicParams, masterMicEcho]);

  const decreaseVolume = useCallback(() => {
    setMasterMicVolume((prev) => {
      const next = Math.max(0, prev - 5);
      broadcastMicParams(next, masterMicEcho);
      return next;
    });
  }, [broadcastMicParams, masterMicEcho]);

  const increaseEcho = useCallback(() => {
    setMasterMicEcho((prev) => {
      const next = Math.min(100, prev + 5);
      broadcastMicParams(masterMicVolume, next);
      return next;
    });
  }, [broadcastMicParams, masterMicVolume]);

  const decreaseEcho = useCallback(() => {
    setMasterMicEcho((prev) => {
      const next = Math.max(0, prev - 5);
      broadcastMicParams(masterMicVolume, next);
      return next;
    });
  }, [broadcastMicParams, masterMicVolume]);

  // Individual client mic controls (for Master screen adjusting specific singer)
  const setClientMicVolume = useCallback(
    (senderId: string, volume: number) => {
      const clamped = Math.min(150, Math.max(0, volume));
      const nodes = audioNodesRef.current.get(senderId);
      if (nodes) {
        nodes.clientVolume = clamped;
        const ctx = audioContextRef.current;
        const target = nodes.clientMuted ? 0 : clamped / 100;
        if (ctx) nodes.clientGain.gain.setValueAtTime(target, ctx.currentTime);
        else nodes.clientGain.gain.value = target;
      }
      // Update hardware audio element directly for zero-latency volume scaling
      const audioEl = audioElementsRef.current.get(senderId);
      if (audioEl) {
        const isMuted = isMutedRef.current || (nodes ? nodes.clientMuted : false);
        audioEl.muted = isMuted;
        audioEl.volume = isMuted ? 0 : Math.min(1, Math.max(0, (masterVolumeRef.current / 100) * (clamped / 100)));
      }
      setActiveMics((prev) =>
        prev.map((m) => (m.senderId === senderId ? { ...m, volume: clamped } : m))
      );
      broadcastMicParams(clamped, nodes ? nodes.clientEcho : 0, senderId);
    },
    [broadcastMicParams]
  );

  const setClientMicEcho = useCallback(
    (senderId: string, echo: number) => {
      const clamped = Math.min(100, Math.max(0, echo));
      const nodes = audioNodesRef.current.get(senderId);
      if (nodes) {
        nodes.clientEcho = clamped;
        const ctx = audioContextRef.current;
        const wetTarget = clamped > 0 ? (clamped / 100) * 0.35 : 0;
        const feedbackTarget = clamped > 0 ? Math.min(0.18, (clamped / 100) * 0.18) : 0;
        if (ctx) {
          nodes.wetGain.gain.setValueAtTime(wetTarget, ctx.currentTime);
          nodes.feedbackGain.gain.setValueAtTime(feedbackTarget, ctx.currentTime);
        } else {
          nodes.wetGain.gain.value = wetTarget;
          nodes.feedbackGain.gain.value = feedbackTarget;
        }
      }
      setActiveMics((prev) =>
        prev.map((m) => (m.senderId === senderId ? { ...m, echo: clamped } : m))
      );
      broadcastMicParams(nodes ? nodes.clientVolume : 75, clamped, senderId);
    },
    [broadcastMicParams]
  );

  const toggleClientMicMute = useCallback((senderId: string) => {
    const nodes = audioNodesRef.current.get(senderId);
    if (nodes) {
      nodes.clientMuted = !nodes.clientMuted;
      const ctx = audioContextRef.current;
      const target = nodes.clientMuted ? 0 : nodes.clientVolume / 100;
      if (ctx) nodes.clientGain.gain.setValueAtTime(target, ctx.currentTime);
      else nodes.clientGain.gain.value = target;

      // Update hardware audio element directly
      const audioEl = audioElementsRef.current.get(senderId);
      if (audioEl) {
        const isMuted = isMutedRef.current || nodes.clientMuted;
        audioEl.muted = isMuted;
        audioEl.volume = isMuted ? 0 : Math.min(1, Math.max(0, (masterVolumeRef.current / 100) * (nodes.clientVolume / 100)));
      }

      setActiveMics((prev) =>
        prev.map((m) => (m.senderId === senderId ? { ...m, isMuted: nodes.clientMuted } : m))
      );
    }
  }, []);

  // Attach received MediaStream to both the low-latency Web Audio pipeline and a non-muted active audio tag
  const attachAudioStream = useCallback(
    (senderId: string, senderName: string, stream: MediaStream) => {
      const audioCtx = getAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      // 1. HTML5 <audio> element ensures Chrome decodes incoming WebRTC RTP track
      let audioEl = audioElementsRef.current.get(senderId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `webrtc-audio-${senderId}`;
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        audioElementsRef.current.set(senderId, audioEl);
      }
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.srcObject = stream;
      audioEl.muted = true; // Mute raw HTML audio so Web Audio API provides full studio EQ, volume scaling up to 150%, and reverb
      audioEl.play().catch(() => {});

      // 2. Web Audio API routes vocal with highpass rumble-cut, volume gain, echo, and VU meter
      const nodes = getOrCreateClientAudioNodes(senderId);
      try {
        if (audioCtx && nodes) {
          if (nodes.source) {
            try {
              nodes.source.disconnect();
            } catch {}
          }
          const source = audioCtx.createMediaStreamSource(stream);
          nodes.source = source;

          // Route source into highpass filter -> dryGain (1.0) -> clientGain -> masterGain -> destination (Speakers)
          // Also automatically splits into delayNode -> echoBandpass -> wetGain -> clientGain
          source.connect(nodes.highpass);
          nodes.dryGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

          // Sambungkan ke Analyser untuk live VU Meter
          source.connect(nodes.analyser);

          console.log(`[WebRTC Master] Audio stream attached to studio Web Audio pipeline for ${senderName} (${senderId})`);
        }
      } catch (err) {
        console.warn('[WebRTC Master] Web Audio stream attach error:', err);
      }

      setActiveMics((prev) => {
        const filtered = prev.filter((m) => m.senderId !== senderId);
        return [
          ...filtered,
          {
            senderId,
            senderName,
            stream,
            volume: 75,
            echo: masterEchoRef.current,
            isMuted: false,
            audioLevel: 0,
            addedAt: Date.now(),
            lastActive: Date.now(),
            mode: 'webrtc',
          },
        ];
      });
    },
    [getAudioContext, getOrCreateClientAudioNodes]
  );

  // Play real-time audio PCM chunk received via WebSocket (Fail-safe relay for 4G/firewall networks)
  const playRelayAudioChunk = useCallback(
    (senderId: string, senderName: string, base64Pcm: string, sampleRate: number, level: number) => {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      try {
        // Decode base64 to 16-bit PCM samples
        const binary = atob(base64Pcm);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const pcm16 = new Int16Array(bytes.buffer);
        const samplesCount = pcm16.length;
        if (samplesCount === 0) return;

        // Convert to Float32Array
        const float32 = new Float32Array(samplesCount);
        for (let i = 0; i < samplesCount; i++) {
          float32[i] = pcm16[i] / (pcm16[i] < 0 ? 32768 : 32767);
        }

        // Create AudioBuffer (supports 24kHz studio wideband vocal)
        const buffer = audioCtx.createBuffer(1, samplesCount, sampleRate || 24000);
        buffer.copyToChannel(float32, 0);

        const nodes = getOrCreateClientAudioNodes(senderId);
        if (nodes) {
          // Check if direct WebRTC P2P is currently connected AND playing audio
          const pc = peerConnectionsRef.current.get(senderId);
          const isWebRTCConnected =
            pc &&
            (pc.connectionState === 'connected' ||
              pc.iceConnectionState === 'connected' ||
              pc.iceConnectionState === 'completed');

          const isWebRTCActivelyPlaying = Boolean(isWebRTCConnected && nodes.source);

          // If direct WebRTC P2P is not actively streaming audio, play relay chunk seamlessly through Web Audio
          if (!isWebRTCActivelyPlaying) {
            // Restore dryGain to 1.0 for relay playback
            nodes.dryGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

            const sourceNode = audioCtx.createBufferSource();
            sourceNode.buffer = buffer;
            // Route through highpass so filters, VU analyser, and echo work in relay mode too!
            sourceNode.connect(nodes.highpass);

            // Schedule seamless playback with dynamic adaptive Jitter Buffer
            // Absorbs Wi-Fi packet jitter smoothly without artificial dropouts or gaps
            const currentTime = audioCtx.currentTime;
            const JITTER_BUFFER_LEAD = 0.050; // 50ms initial lead buffer
            const MAX_DRIFT_AHEAD = 0.280;    // 280ms threshold to catch up after background pauses
            const MAX_SLIGHT_LATE = 0.120;    // 120ms window for minor packet delay

            let startTime = nodes.nextScheduledTime;
            if (!startTime || startTime > currentTime + MAX_DRIFT_AHEAD || currentTime - startTime > MAX_SLIGHT_LATE) {
              // Fresh burst or recovery from large gap: initialize with gentle lead
              startTime = currentTime + JITTER_BUFFER_LEAD;
            } else if (startTime < currentTime) {
              // Arrived only slightly late (within 120ms): play immediately with tiny sub-frame offset (8ms)
              // to eliminate gap without waiting for another full 50ms lead!
              startTime = currentTime + 0.008;
            }

            sourceNode.start(startTime);
            nodes.nextScheduledTime = startTime + buffer.duration;
          }
        }

        // Update activeMics state with live visualizer level
        const pc = peerConnectionsRef.current.get(senderId);
        const isWebRTCMode =
          pc &&
          (pc.connectionState === 'connected' ||
            pc.iceConnectionState === 'connected' ||
            pc.iceConnectionState === 'completed');

        setActiveMics((prev) => {
          const existing = prev.find((m) => m.senderId === senderId);
          if (existing) {
            return prev.map((m) =>
              m.senderId === senderId
                ? {
                    ...m,
                    audioLevel: level || m.audioLevel,
                    lastActive: Date.now(),
                    mode: isWebRTCMode ? 'webrtc' : 'relay',
                  }
                : m
            );
          } else {
            return [
              ...prev,
              {
                senderId,
                senderName,
                volume: 75,
                echo: masterEchoRef.current,
                isMuted: false,
                audioLevel: level || 0,
                addedAt: Date.now(),
                lastActive: Date.now(),
                mode: isWebRTCMode ? 'webrtc' : 'relay',
              },
            ];
          }
        });
      } catch (e) {
        console.warn('[WebAudio] Relay chunk decode error:', e);
      }
    },
    [getAudioContext, getOrCreateClientAudioNodes]
  );

  // Clean up a specific sender's peer connection, audio element, and Web Audio nodes
  const cleanupSender = useCallback((senderId: string) => {
    // 1. Clean Web Audio nodes
    const nodes = audioNodesRef.current.get(senderId);
    if (nodes) {
      try {
        nodes.masterGain.disconnect();
        nodes.clientGain.disconnect();
        nodes.wetGain.disconnect();
        nodes.dryGain.disconnect();
        nodes.feedbackGain.disconnect();
        nodes.echoBandpass.disconnect();
        nodes.delayNode.disconnect();
        nodes.limiter.disconnect();
        nodes.compressor.disconnect();
        nodes.antiSqueal.disconnect();
        nodes.airShelf.disconnect();
        nodes.presenceBoost.disconnect();
        nodes.deMud.disconnect();
        nodes.notch3.disconnect();
        nodes.notch2.disconnect();
        nodes.notch1.disconnect();
        nodes.highpass.disconnect();
        if (nodes.source) nodes.source.disconnect();
      } catch {}
      audioNodesRef.current.delete(senderId);
    }

    // 2. Close and remove audio element
    const audioEl = audioElementsRef.current.get(senderId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        if (audioEl.parentNode) {
          audioEl.parentNode.removeChild(audioEl);
        }
      } catch {}
      audioElementsRef.current.delete(senderId);
    }

    // 3. Close peer connection
    const pc = peerConnectionsRef.current.get(senderId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      } catch {}
      peerConnectionsRef.current.delete(senderId);
    }

    pendingCandidatesRef.current.delete(senderId);

    setActiveMics((prev) => prev.filter((m) => m.senderId !== senderId));
  }, []);

  // Update volume & echo of all active mic streams dynamically
  useEffect(() => {
    const masterVolPercent = masterMicVolume / 100;
    const vol = isMasterMicMuted ? 0 : Math.min(1.5, Math.max(0, masterVolPercent));
    // Strictly 0 when echo is 0%; capped at 0.18 when echo is dialed in to avoid feedback howl
    const echoWet = masterMicEcho > 0 ? (masterMicEcho / 100) * 0.35 : 0;
    const echoFeedback = masterMicEcho > 0 ? Math.min(0.18, (masterMicEcho / 100) * 0.18) : 0;

    const ctx = audioContextRef.current;
    audioNodesRef.current.forEach((nodes, senderId) => {
      if (ctx) {
        nodes.masterGain.gain.setValueAtTime(vol, ctx.currentTime);
        nodes.wetGain.gain.setValueAtTime(echoWet, ctx.currentTime);
        nodes.feedbackGain.gain.setValueAtTime(echoFeedback, ctx.currentTime);
      } else {
        nodes.masterGain.gain.value = vol;
        nodes.wetGain.gain.value = echoWet;
        nodes.feedbackGain.gain.value = echoFeedback;
      }

      // Synchronize native hardware audio element volume (zero delay)
      const audioEl = audioElementsRef.current.get(senderId);
      if (audioEl) {
        const isClientMuted = isMasterMicMuted || nodes.clientMuted;
        const targetVol = isClientMuted
          ? 0
          : Math.min(1, Math.max(0, masterVolPercent * (nodes.clientVolume / 100)));
        audioEl.muted = isClientMuted;
        audioEl.volume = targetVol;
      }
    });
  }, [masterMicVolume, masterMicEcho, isMasterMicMuted]);

  // Handle incoming signaling messages from HP Broadcaster(s)
  const handleSignalingMessage = useCallback(
    async (data: any) => {
      if (!data || !data.type) return;

      const { senderId, senderName, offer, candidate, isMicOn, volume, echo, pcm, sampleRate, level } =
        data.payload || {};

      // 1. Process RTC_OFFER from HP Client
      if (data.type === 'RTC_OFFER' && senderId && offer) {
        try {
          // Clean previous connection for this sender if any
          const existingPc = peerConnectionsRef.current.get(senderId);
          if (existingPc) {
            try {
              existingPc.close();
            } catch {}
          }

          const rtcConfig = getOptimalRtcConfig();
          const pc = new RTCPeerConnection(rtcConfig);
          peerConnectionsRef.current.set(senderId, pc);

          // Handle incoming audio track with ultra-low latency playout hints
          pc.ontrack = (event) => {
            const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);

            if (event.receiver) {
              // Playout delay hint 0.05s (50ms) gives the optimal buffer to absorb Wi-Fi burst jitter completely without perceptible latency
              if ('playoutDelayHint' in event.receiver) {
                (event.receiver as any).playoutDelayHint = 0.05;
              }
              if ('jitterBufferTarget' in event.receiver) {
                (event.receiver as any).jitterBufferTarget = 50; // 50ms
              }
            }
            if (event.track && 'playoutDelayHint' in event.track) {
              try {
                (event.track as any).playoutDelayHint = 0.05;
              } catch {}
            }

            if (stream) {
              attachAudioStream(senderId, senderName || 'Prajurit (HP)', stream);
            }
          };

          // Relay ICE candidates back to sender (direct local host candidate priority)
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              const cand = event.candidate;
              const isLocal = isLocalHostCandidate(cand);
              sendSignalingBack({
                type: 'RTC_ICE_CANDIDATE',
                roomId,
                payload: {
                  targetClientId: senderId,
                  candidate: cand,
                  isHostCandidate: isLocal,
                },
                timestamp: Date.now(),
              });
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log(`[WebRTC Master] PeerConnection ${pc.connectionState} for ${senderId}`);
              // Note: Do not clean up immediately if WebSocket relay is still transmitting!
            }
          };

          // Set remote description (the offer)
          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          // Apply pending candidates if any
          const pending = pendingCandidatesRef.current.get(senderId) || [];
          while (pending.length > 0) {
            const cand = pending.shift();
            if (cand) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
          pendingCandidatesRef.current.delete(senderId);

          // Create answer with ultra-low latency SDP optimizations
          const rawAnswer = await pc.createAnswer();
          const optimizedAnswer = {
            type: rawAnswer.type,
            sdp: optimizeSdpForUltraLowLatency(rawAnswer.sdp || ''),
          };

          await pc.setLocalDescription(optimizedAnswer);

          // Send answer back to sender via WebSocket & BroadcastChannel
          sendSignalingBack({
            type: 'RTC_ANSWER',
            roomId,
            payload: {
              targetClientId: senderId,
              answer: optimizedAnswer,
            },
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error('[WebRTC Master] Error processing RTC_OFFER:', err);
        }
      }

      // 2. Process RTC_ICE_CANDIDATE
      else if (data.type === 'RTC_ICE_CANDIDATE' && senderId && candidate) {
        const pc = peerConnectionsRef.current.get(senderId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[WebRTC Master] Error adding ICE candidate:', e);
          }
        } else {
          const current = pendingCandidatesRef.current.get(senderId) || [];
          current.push(candidate);
          pendingCandidatesRef.current.set(senderId, current);
        }
      }

      // 3. Process RTC_MIC_STATUS
      else if (data.type === 'RTC_MIC_STATUS' && senderId) {
        if (!isMicOn) {
          cleanupSender(senderId);
        } else {
          setActiveMics((prev) => {
            const existing = prev.find((m) => m.senderId === senderId);
            if (existing) {
              return prev.map((m) => (m.senderId === senderId ? { ...m, isMuted: false, lastActive: Date.now() } : m));
            }
            return [
              ...prev,
              {
                senderId,
                senderName: senderName || 'Prajurit (HP)',
                volume: 75,
                echo: masterEchoRef.current,
                isMuted: false,
                audioLevel: 0,
                addedAt: Date.now(),
                lastActive: Date.now(),
                mode: 'webrtc',
              },
            ];
          });
        }
      }

      // 4. Process RTC_MIC_PARAMS (Volume & Echo sync from HP client)
      else if (data.type === 'RTC_MIC_PARAMS') {
        if (typeof volume === 'number') {
          setMasterMicVolume(Math.min(150, Math.max(0, volume)));
        }
        if (typeof echo === 'number') {
          setMasterMicEcho(Math.min(100, Math.max(0, echo)));
        }
      }

      // 5. Process CLIENT_MIC_AUDIO_DATA (Real-time WebSocket audio relay)
      else if (data.type === 'CLIENT_MIC_AUDIO_DATA' && senderId && pcm) {
        playRelayAudioChunk(senderId, senderName || 'Prajurit (HP)', pcm, sampleRate || 24000, level || 0);
      }

      // 6. Process RTC_MIC_LEVEL (Live VU meter update)
      else if (data.type === 'RTC_MIC_LEVEL') {
        const lvl = typeof level === 'number' ? level : 0;
        setActiveMics((prev) => {
          if (senderId) {
            return prev.map((m) => (m.senderId === senderId ? { ...m, audioLevel: lvl, lastActive: lvl > 4 ? Date.now() : m.lastActive } : m));
          } else if (prev.length === 1) {
            return [{ ...prev[0], audioLevel: lvl, lastActive: lvl > 4 ? Date.now() : prev[0].lastActive }];
          }
          return prev;
        });
      }

      // 7. Process MUSIC_SYNC_DELAY (Vocal sync adjustment from HP)
      else if (data.type === 'MUSIC_SYNC_DELAY') {
        const { delayMs } = data.payload || {};
        if (typeof delayMs === 'number') {
          setMusicDelayMs(delayMs, false);
        }
      }
    },
    [attachAudioStream, cleanupSender, playRelayAudioChunk, roomId, setMusicDelayMs, sendSignalingBack]
  );

  // Instant local signaling bridge for on-screen simulator and local tabs via BroadcastChannel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && roomId) {
      try {
        const bc = new BroadcastChannel(`karaoke_channel_${roomId.trim().toUpperCase()}`);
        broadcastChannelRef.current = bc;
        bc.onmessage = (event) => {
          if (event.data && typeof event.data === 'object') {
            const data = event.data;
            if (
              data.type === 'RTC_OFFER' ||
              data.type === 'RTC_ICE_CANDIDATE' ||
              data.type === 'CLIENT_MIC_AUDIO_DATA' ||
              data.type === 'RTC_MIC_STATUS' ||
              data.type === 'RTC_MIC_LEVEL' ||
              data.type === 'RTC_MIC_PARAMS'
            ) {
              handleSignalingMessage(data);
            }
          }
        };
        return () => {
          bc.close();
          broadcastChannelRef.current = null;
        };
      } catch {}
    }
  }, [roomId, handleSignalingMessage]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      peerConnectionsRef.current.clear();

      audioNodesRef.current.forEach((nodes) => {
        try {
          nodes.masterGain.disconnect();
          nodes.clientGain.disconnect();
          nodes.wetGain.disconnect();
          nodes.dryGain.disconnect();
          nodes.feedbackGain.disconnect();
          nodes.echoBandpass.disconnect();
          nodes.delayNode.disconnect();
          nodes.limiter.disconnect();
          nodes.compressor.disconnect();
          nodes.antiSqueal.disconnect();
          nodes.airShelf.disconnect();
          nodes.presenceBoost.disconnect();
          nodes.deMud.disconnect();
          nodes.notch3.disconnect();
          nodes.notch2.disconnect();
          nodes.notch1.disconnect();
          nodes.highpass.disconnect();
          if (nodes.source) nodes.source.disconnect();
        } catch {}
      });
      audioNodesRef.current.clear();

      if (musicCompressorNodeRef.current) {
        try {
          musicCompressorNodeRef.current.disconnect();
        } catch {}
        musicCompressorNodeRef.current = null;
      }
      if (musicDelayNodeRef.current) {
        try {
          musicDelayNodeRef.current.disconnect();
        } catch {}
        musicDelayNodeRef.current = null;
      }
      if (musicGainNodeRef.current) {
        try {
          musicGainNodeRef.current.disconnect();
        } catch {}
        musicGainNodeRef.current = null;
      }

      audioElementsRef.current.forEach((audioEl) => {
        try {
          audioEl.pause();
          audioEl.srcObject = null;
          if (audioEl.parentNode) {
            audioEl.parentNode.removeChild(audioEl);
          }
        } catch {}
      });
      audioElementsRef.current.clear();

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    activeMics,
    masterMicVolume,
    setMasterMicVolume,
    masterMicEcho,
    setMasterMicEcho,
    isMasterMicMuted,
    setIsMasterMicMuted,
    isAudioSuspended,
    resumeAudio,
    increaseVolume,
    decreaseVolume,
    increaseEcho,
    decreaseEcho,
    setClientMicVolume,
    setClientMicEcho,
    toggleClientMicMute,
    broadcastMicParams,
    handleSignalingMessage,
    attachAudioStream,
    cleanupSender,
    musicDelayMs,
    setMusicDelayMs,
    connectMusicMediaElement,
    setMusicBoostMultiplier,
  };
}
