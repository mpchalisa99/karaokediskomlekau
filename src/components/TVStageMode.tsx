import React, { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Mic,
  Zap,
  Radio,
  Minimize2,
  Maximize2,
  ListMusic,
  ChevronRight,
  Tv,
  CheckCircle2,
  Play,
  Sparkles,
  QrCode,
  X,
} from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { getScoreQuote } from '../types/karaoke';
import { fetchServerNetworkInfo, getUniversalBarcodeUrl, NetworkInfo } from '../services/network';
import {
  enterFullScreen,
  toggleFullScreen,
  isFullScreenActive,
  addFullScreenChangeListener,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  autoTriggerSmartTvFullscreen,
} from '../utils/fullscreen';
import { getCheerText } from './CheerCharacterOverlay';
import { DiskomlekLeadershipBadge } from './DiskomlekLeadershipBadges';
import { SmartMcBanner } from './SmartMcBanner';
import { MemoizedTvYouTubeEmbed } from './MemoizedYouTubePlayer';

interface TVStageModeProps {
  standalone?: boolean;
}

export const TVStageMode: React.FC<TVStageModeProps> = ({ standalone = false }) => {
  const {
    isTvMode,
    setIsTvMode,
    currentSong,
    queue,
    playSongNow,
    removeFromQueue,
    roomId,
    remoteConnectedDevices,
    activeWirelessMics,
    activeReactions,
    isPlaying,
    setIsPlaying,
    togglePlayPause,
    defaultSingerName,
    evaluateCurrentSong,
    notifyPlaybackTime,
    handlePlayerEnded,
    skipNextSong,
    isScoreModalOpen,
    setIsScoreModalOpen,
    currentScoreData,
    isAudioSuspended,
    resumeAudio,
    audioVolume,
    isMuted,
    triggerSmartMc,
    dismissSmartMc,
    isSmartMcVisible,
    connectionStatus,
    unlockTvAudio,
  } = useKaraoke();

  const [tvQrUrl, setTvQrUrl] = useState<string>('');
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isFullScreenActive());
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  // Auto trigger native Fullscreen & Screen Wake Lock immediately on mount for Samsung Smart TV (Tizen OS)
  useEffect(() => {
    let cleanup = () => {};
    try {
      cleanup = autoTriggerSmartTvFullscreen();
    } catch {}
    try {
      requestScreenWakeLock()
        .then((locked) => setWakeLockActive(locked))
        .catch(() => {});
    } catch {}
    return () => {
      try {
        cleanup();
      } catch {}
    };
  }, []);

  // Fetch server detected IP/hostname on mount
  useEffect(() => {
    fetchServerNetworkInfo()
      .then((info) => {
        if (info) setNetworkInfo(info);
      })
      .catch(() => {});
  }, []);

  // Monitor fullscreen state across TV vendor prefixes (WebKit / Tizen / webOS)
  useEffect(() => {
    try {
      setIsFullscreen(isFullScreenActive());
      return addFullScreenChangeListener((active) => {
        setIsFullscreen(active);
      });
    } catch {
      return () => {};
    }
  }, []);

  // Ensure TV mode CSS classes on document element and body
  useEffect(() => {
    try {
      document.documentElement.classList.add('tv-mode-active');
      document.body.classList.add('tv-mode-active');
    } catch {}
    return () => {
      try {
        document.documentElement.classList.remove('tv-mode-active');
        document.body.classList.remove('tv-mode-active');
        releaseScreenWakeLock();
      } catch {}
    };
  }, []);

  // Re-acquire Screen Wake Lock when window gains focus
  useEffect(() => {
    const handleVisibility = () => {
      try {
        if (document.visibilityState === 'visible') {
          requestScreenWakeLock()
            .then((locked) => setWakeLockActive(locked))
            .catch(() => {});
        }
      } catch {}
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Animasi partikel canvas-confetti dimatikan di layar TV Tizen OS agar GPU TV tidak drop FPS saat video berputar
  const prevTvReactionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeReactions.length > 0) {
      const latestRx = activeReactions[activeReactions.length - 1];
      if (latestRx && latestRx.id !== prevTvReactionIdRef.current) {
        prevTvReactionIdRef.current = latestRx.id;
      }
    }
  }, [activeReactions]);

  const handleExit = useCallback(() => {
    try {
      releaseScreenWakeLock();
    } catch {}
    if (standalone) {
      window.location.href = `/?room=${encodeURIComponent(roomId)}`;
    } else {
      setIsTvMode(false);
    }
  }, [standalone, roomId, setIsTvMode]);

  // TV Remote key listener (Samsung Tizen, WebKit, standard keys)
  useEffect(() => {
    if (!isTvMode && !standalone) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      try {
        unlockTvAudio();
      } catch {}
      const keyCode = e.keyCode || e.which;
      const key = e.key;

      const isEnterOrOk = keyCode === 13 || keyCode === 23 || key === 'Enter';
      const isReturnOrBack =
        keyCode === 10009 ||
        keyCode === 4 ||
        key === 'Escape' ||
        key === 'Backspace' ||
        keyCode === 10182;
      const isPlayPause = keyCode === 10252 || keyCode === 415 || keyCode === 19 || keyCode === 32 || key === ' ';

      // Jika popup kartu Smart MC sedang tampil di TV, tekan Back/Escape/OK/Enter langsung menutupnya
      if (isSmartMcVisible) {
        if (isReturnOrBack || isEnterOrOk) {
          e.preventDefault();
          e.stopPropagation();
          dismissSmartMc();
          return;
        }
      }

      if (isReturnOrBack) {
        handleExit();
      } else if (isPlayPause) {
        togglePlayPause(true);
      } else if (isEnterOrOk || key === 'f' || key === 'F') {
        try {
          toggleFullScreen();
        } catch {}
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTvMode, standalone, togglePlayPause, handleExit, unlockTvAudio, isSmartMcVisible, dismissSmartMc]);

  // Deteksi event lagu & progres playback dari YouTube iframe untuk auto-scoring 60 detik & auto-play di TV
  useEffect(() => {
    const handleTvMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          const parsed = JSON.parse(event.data);
          if (
            (parsed.event === 'onStateChange' && (parsed.info === 0 || parsed.data === 0)) ||
            (parsed.event === 'infoDelivery' && parsed.info?.playerState === 0)
          ) {
            handlePlayerEnded();
            return;
          }

          // Otomatis tangani jika video dibatasi embed (Error 150/101/100) agar TV tidak macet
          if (
            parsed.event === 'onError' ||
            parsed.info === 150 ||
            parsed.info === 101 ||
            parsed.data === 150 ||
            parsed.data === 101 ||
            parsed.info === 100 ||
            parsed.data === 100
          ) {
            console.warn('YouTube embed restriction detected, skipping:', parsed);
            skipNextSong();
            return;
          }

          if (parsed.event === 'infoDelivery' && parsed.info) {
            const curTime = parsed.info.currentTime;
            const dur = parsed.info.duration;
            if (typeof curTime === 'number' && curTime > 0) {
              notifyPlaybackTime(curTime, dur);
            }
          }
        }
      } catch {}
    };
    window.addEventListener('message', handleTvMessage);
    return () => window.removeEventListener('message', handleTvMessage);
  }, [handlePlayerEnded, notifyPlaybackTime, skipNextSong]);

  const clientUrl = getUniversalBarcodeUrl(roomId, networkInfo);

  // Instant fallback QR code URL so it never renders blank
  const instantFallbackQr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    clientUrl
  )}&color=000000&bgcolor=ffffff&margin=2`;

  // High-definition local QRCode generation
  useEffect(() => {
    if (!isTvMode && !standalone) return;
    let isMounted = true;

    QRCode.toDataURL(clientUrl, {
      width: 280,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) setTvQrUrl(url);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isTvMode, standalone, clientUrl]);

  if (!isTvMode && !standalone) return null;

  const currentQrImage = tvQrUrl || instantFallbackQr;
  const isMicLive = activeWirelessMics && activeWirelessMics.length > 0;
  const activeMicCount = activeWirelessMics?.length || 0;

  // Marquee running ticker texts di sudut bawah layar
  const marqueeItems = [
    '✨ DISKOMLEK KARAOKE FAMILY ROOM',
    '🎖️ "Prajurit yang pantang mundur walau suara hancur"',
    `📱 Remote & Mic HP: Scan QR Code di pojok kanan bawah [KODE ROOM: ${roomId}]`,
    '🎤 Selamat bernyanyi dan nikmati momen kebersamaan!',
    '⭐ Pilih lagu, atur volume, dan kirim reaksi suara langsung dari smartphone Anda',
  ];
  const marqueeText = marqueeItems.join('     ✦     ');

  // Video ID untuk komponen MemoizedTvYouTubeEmbed yang terisolasi dari re-render state lain
  const videoId = currentSong?.id || '';

  return (
    <div
      className={`tv-stage-root ${isFullscreen ? 'tv-fullscreen-mode' : ''}`}
      onClick={() => unlockTvAudio()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000000',
        color: '#ffffff',
        zIndex: 999999,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Tombol banner mengambang jika browser Smart TV belum layar penuh */}
      {!isFullscreen && (
        <div
          onClick={() => {
            try {
              enterFullScreen().catch(() => false);
            } catch {}
          }}
          style={{
            position: 'fixed',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000000,
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '6px 20px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            border: '2px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
          title="Klik di sini atau tekan tombol [OK] pada remote TV untuk Layar Penuh"
        >
          <Maximize2 style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <span>TEKAN [OK] ATAU KLIK UNTUK LAYAR PENUH (SEMBUNYIKAN BILAH BROWSER)</span>
        </div>
      )}

      {/* Audio Unlock floating button on TV if browser autoplay policy suspended audio */}
      {isAudioSuspended && activeWirelessMics.length > 0 && (
        <div
          onClick={() => resumeAudio()}
          style={{
            position: 'fixed',
            top: isFullscreen ? '12px' : '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000000,
            backgroundColor: '#d97706',
            color: '#ffffff',
            padding: '8px 24px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 900,
            cursor: 'pointer',
            border: '2px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
          title="Klik di sini untuk mengaktifkan suara mikrofon HP ke speaker TV"
        >
          <Mic style={{ width: '18px', height: '18px', flexShrink: 0 }} />
          <span>KLIK / SENTUH LAYAR UNTUK AKTIFKAN SUARA MIC HP KE SPEAKER</span>
        </div>
      )}

      {/* QR Code Enlarged Modal on TV */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.88)',
            padding: '16px',
            cursor: 'pointer',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '24px',
              borderRadius: '24px',
              backgroundColor: '#091838',
              border: '2px solid #38bdf8',
              textAlign: 'center',
              maxWidth: '360px',
              width: '100%',
              cursor: 'default',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
                marginBottom: '16px',
              }}
            >
              <span style={{ fontWeight: 'bold', color: '#bae6fd', fontSize: '14px' }}>Scan Remote &amp; Mic HP</span>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(12, 74, 110, 0.6)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div style={{ borderRadius: '16px', backgroundColor: '#ffffff', padding: '12px', border: '4px solid #fbbf24' }}>
              <img
                src={currentQrImage}
                alt={`QR Code Ruang ${roomId}`}
                style={{ width: '220px', height: '220px', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Arahkan kamera smartphone ke kode di atas</span>
              <div
                style={{
                  marginTop: '8px',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid rgba(251, 191, 36, 0.6)',
                  color: '#fcd34d',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 900,
                }}
              >
                KODE: {roomId}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          BAGIAN 1: HEADER ATAS LAYAR YOUTUBE (FOTO PIMPINAN DISKOMLEK & JUDUL BESAR)
          Dioptimalkan khusus untuk Samsung 65" UA65CU7000KXXD (Tizen OS)
         ========================================================================= */}
      <header
        className="tv-stage-header"
        style={{
          width: '100%',
          height: '92px',
          minHeight: '92px',
          maxHeight: '92px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#040f25',
          borderBottom: '2px solid rgba(56, 189, 248, 0.6)',
          padding: '0 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
          zIndex: 30,
        }}
        aria-label="Panel Atas Layar TV Master"
      >
        <div
          style={{
            width: '100%',
            height: '84px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Sisi Kiri: Logo Resmi TNI AU (Swa Bhuwana Paksa - Fit Batas Garis) */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: '84px' }}>
            <DiskomlekLeadershipBadge role="kadiskomlek" />
          </div>

          {/* Tengah: Judul Sistem VOCAL SIMULATION SYSTEM DISKOMLEKAU */}
          <div
            style={{
              flex: '1 1 0%',
              height: '84px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '84px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(56, 189, 248, 0.85)',
                borderRadius: '12px',
                backgroundColor: '#062138',
                padding: '4px 14px',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <svg
                viewBox="0 0 980 62"
                preserveAspectRatio="xMidYMid meet"
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: '74px',
                  display: 'block',
                  userSelect: 'none',
                }}
                role="heading"
                aria-label="VOCAL SIMULATION SYSTEM DISKOMLEKAU"
              >
                <text
                  x="490"
                  y="47"
                  textAnchor="middle"
                  textLength="956"
                  lengthAdjust="spacingAndGlyphs"
                  fontFamily="'Arial Black', 'Outfit', 'Segoe UI', Roboto, sans-serif"
                  fontWeight="900"
                  fontSize="50"
                >
                  <tspan
                    fill="#7dd3fc"
                    stroke="#02163b"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                  >
                    VOCAL SIMULATION&#160;
                  </tspan>
                  <tspan
                    fill="#ffffff"
                    stroke="#dc2626"
                    strokeWidth="4.5"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                  >
                    SYSTEM DISKOMLEKAU
                  </tspan>
                </text>
              </svg>
            </div>
          </div>

          {/* Sisi Kanan: Logo Resmi Korps Elektro (DISKOMLEKAU - Fit Batas Garis) */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: '84px' }}>
            <DiskomlekLeadershipBadge role="sesdiskomlek" />
          </div>
        </div>
      </header>

      {/* =========================================================================
          BAGIAN 2: AREA UTAMA (VIDEO YOUTUBE KIRI + SIDEBAR VERTIKAL KANAN)
         ========================================================================= */}
      <div
        className="tv-stage-body"
        style={{
          flex: '1 1 0%',
          width: '100%',
          height: 'calc(100vh - 136px)',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          backgroundColor: '#000000',
          boxSizing: 'border-box',
        }}
      >
        {/* BAGIAN KIRI: LAYAR YOUTUBE TERISOLASI (React.memo) ATAU STANDBY SCREEN */}
        <main
          className="tv-stage-video-main"
          style={{
            flex: '1 1 0%',
            height: '100%',
            position: 'relative',
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {videoId ? (
            <>
              <MemoizedTvYouTubeEmbed
                videoId={videoId}
                isPlaying={isPlaying}
                audioVolume={audioVolume}
                isMuted={isMuted}
              />

              {/* TULISAN BESAR DI LAYAR BERUPA QUOTE SESUAI PENILAIAN SAAT 1 MENIT SEBELUM LAGU BERAKHIR */}
              {isScoreModalOpen && currentScoreData && (() => {
                const stageVotes =
                  currentScoreData.juryVotes && currentScoreData.juryVotes.length > 0
                    ? currentScoreData.juryVotes
                    : ['iwan', 'rudi', 'rojikan', 'tomas', 'awan'].map((name, idx) => ({
                        clientId: `default-stage-${idx + 1}`,
                        juryName: name,
                        score: currentScoreData.totalScore,
                        songId: currentScoreData.song?.id || '',
                        songTitle: currentScoreData.song?.title || '',
                        submittedAt: Date.now(),
                      }));
                const stageSum = stageVotes.reduce((acc, v) => acc + v.score, 0);
                const stageAvg = Math.round(stageSum / stageVotes.length);
                const stageQuote = getScoreQuote(stageAvg, currentScoreData.evaluatedAt);

                return (
                  <div
                    onClick={() => setIsScoreModalOpen(false)}
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 50,
                      width: '90%',
                      maxWidth: '920px',
                      padding: '14px 24px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(15, 23, 42, 0.92)',
                      border: '3px solid #fbbf24',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    title="Klik untuk menutup Quote penilaian"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        style={{
                          padding: '3px 12px',
                          borderRadius: '9999px',
                          backgroundColor: '#fbbf24',
                          color: '#020617',
                          fontSize: '14px',
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          letterSpacing: '0.06em',
                        }}
                      >
                        SKOR RATA-RATA JURI: {stageAvg}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 'clamp(22px, 3vw, 38px)',
                        fontWeight: 900,
                        color: '#fef08a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        lineHeight: 1.15,
                      }}
                    >
                      &ldquo;{stageQuote}&rdquo;
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            /* STANDBY COMMAND SCREEN - ZERO LAG & NO YOUTUBE BANDWIDTH USAGE */
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle at center, #071c3d 0%, #030c1c 65%, #00040a 100%)',
                color: '#ffffff',
                padding: '28px',
                textAlign: 'center',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Radar Grid Circles Background */}
              <div
                style={{
                  position: 'absolute',
                  width: '440px',
                  height: '440px',
                  borderRadius: '50%',
                  border: '1.5px dashed rgba(56, 189, 248, 0.25)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '260px',
                  height: '260px',
                  borderRadius: '50%',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  pointerEvents: 'none',
                }}
              />

              {/* Status Header Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 18px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(12, 74, 110, 0.85)',
                  border: '1.5px solid rgba(56, 189, 248, 0.85)',
                  marginBottom: '18px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 10px #10b981',
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    letterSpacing: '0.12em',
                    color: '#e0f2fe',
                    textTransform: 'uppercase',
                  }}
                >
                  PUSKODAL DISKOMLEKAU // SISTEM STANDBY
                </span>
              </div>

              {/* Main Headline */}
              <h1
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  margin: '0 0 12px 0',
                  textShadow: '0 4px 16px rgba(0, 0, 0, 0.9), 0 0 20px rgba(56, 189, 248, 0.4)',
                  lineHeight: 1.2,
                }}
              >
                SISTEM SIMULASI VOKAL SIAP TEMPUR
              </h1>

              {/* Subtitle / Instructions */}
              <p
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#93c5fd',
                  maxWidth: '700px',
                  margin: '0 0 26px 0',
                  lineHeight: 1.5,
                }}
              >
                Silakan scan barcode QR di samping kanan menggunakan kamera HP / Tablet atau pilih lagu favorit prajurit untuk memulai bernyanyi.
              </p>

              {/* 3 Step Instruction Badges */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  flexWrap: 'wrap',
                  marginBottom: '28px',
                }}
              >
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(6, 26, 56, 0.85)',
                    border: '1px solid rgba(250, 204, 21, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#fef08a',
                  }}
                >
                  <span style={{ backgroundColor: '#facc15', color: '#000', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>1</span>
                  Scan Barcode di Layar
                </div>
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(6, 26, 56, 0.85)',
                    border: '1px solid rgba(56, 189, 248, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#bae6fd',
                  }}
                >
                  <span style={{ backgroundColor: '#38bdf8', color: '#000', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>2</span>
                  Cari / Pilih Lagu di HP
                </div>
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(6, 26, 56, 0.85)',
                    border: '1px solid rgba(52, 211, 153, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#a7f3d0',
                  }}
                >
                  <span style={{ backgroundColor: '#34d399', color: '#000', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>3</span>
                  Lagu Otomatis Berputar
                </div>
              </div>

              {/* Room Code Callout */}
              <div
                style={{
                  padding: '8px 24px',
                  borderRadius: '12px',
                  backgroundColor: '#021329',
                  border: '2px dashed rgba(250, 204, 21, 0.85)',
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#facc15',
                  letterSpacing: '0.1em',
                  boxShadow: '0 4px 18px rgba(0, 0, 0, 0.7)',
                }}
              >
                KODE ROOM TV: <span style={{ color: '#ffffff' }}>{roomId}</span>
              </div>
            </div>
          )}
        </main>

        {/* BAGIAN KANAN: NOW PLAYING, ANTREAN LAGU, & SCAN BARCODE */}
        <aside
          className="tv-stage-sidebar"
          style={{
            width: '250px',
            minWidth: '230px',
            maxWidth: '270px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(to bottom, #061229, #040c1d, #020713)',
            borderLeft: '1px solid rgba(56, 189, 248, 0.3)',
            flexShrink: 0,
            boxSizing: 'border-box',
            zIndex: 20,
            overflow: 'hidden',
          }}
          aria-label="Panel Vertikal Now Playing dan Antrean Lagu"
        >
          {/* 1. SEKSI ATAS: NOW PLAYING */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '4px',
                marginBottom: '4px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399', display: 'inline-block' }} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  NOW PLAYING
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '10px' }}>
                <span style={{ width: '2px', height: '6px', backgroundColor: '#38bdf8', borderRadius: '2px' }} />
                <span style={{ width: '2px', height: '10px', backgroundColor: '#fcd34d', borderRadius: '2px' }} />
                <span style={{ width: '2px', height: '4px', backgroundColor: '#34d399', borderRadius: '2px' }} />
              </div>
            </div>

            {currentSong ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h2
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#ffffff',
                    lineHeight: 1.25,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={currentSong.title}
                >
                  {currentSong.title}
                </h2>
                {currentSong.channelTitle && (
                  <p style={{ fontSize: '9px', color: '#7dd3fc', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentSong.channelTitle}
                  </p>
                )}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '2px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(8, 47, 73, 0.9)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#fcd34d',
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    fontWeight: 700,
                    width: 'fit-content',
                  }}
                >
                  <Mic style={{ width: '10px', height: '10px', color: '#fbbf24' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {defaultSingerName || 'Vokalis Bintang'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '4px 0', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>Belum ada lagu</p>
                <p style={{ fontSize: '8px', color: '#64748b', margin: 0 }}>Pilih via HP</p>
              </div>
            )}
          </div>

          {/* 2. SEKSI TENGAH: ANTREAN LAGU */}
          <div
            style={{
              flex: '1 1 0%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* Header Antrean */}
            <div
              style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <ListMusic style={{ width: '12px', height: '12px', color: '#fbbf24' }} />
                <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ffffff' }}>
                  ANTREAN
                </span>
                <span
                  style={{
                    padding: '0 4px',
                    borderRadius: '9999px',
                    backgroundColor: '#fbbf24',
                    color: '#000000',
                    fontSize: '9px',
                    fontWeight: 900,
                  }}
                >
                  {queue.length}
                </span>
              </div>
              <span style={{ fontSize: '8px', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                NEXT
              </span>
            </div>

            {/* Daftar Antrean Lagu */}
            <div style={{ flex: '1 1 0%', overflowY: 'auto', padding: '4px', boxSizing: 'border-box' }}>
              {queue.length > 0 ? (
                queue.map((item, idx) => {
                  const isNext = idx === 0;
                  return (
                    <div
                      key={item.queueId}
                      onClick={() => {
                        playSongNow(item.song, item.singerName);
                        removeFromQueue(item.queueId);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '4px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        backgroundColor: isNext ? 'rgba(69, 26, 3, 0.65)' : 'rgba(0, 0, 0, 0.5)',
                        border: isNext ? '1px solid rgba(251, 191, 36, 0.8)' : '1px solid rgba(255, 255, 255, 0.15)',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out',
                      }}
                      title="Klik untuk langsung memutar lagu ini di panggung"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '3px',
                            fontFamily: 'monospace',
                            fontSize: '9px',
                            fontWeight: 900,
                            backgroundColor: isNext ? '#fbbf24' : '#082f49',
                            color: isNext ? '#000000' : '#7dd3fc',
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: '10px', fontWeight: 700, color: '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.song.title}
                          </h4>
                          <div style={{ marginTop: '1px', fontSize: '8px', color: '#fcd34d', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.singerName}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSongNow(item.song, item.singerName);
                          removeFromQueue(item.queueId);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          border: 'none',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          fontSize: '8px',
                          fontWeight: 900,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        title="Putar sekarang"
                      >
                        ▶ Putar
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px', color: '#94a3b8', gap: '4px', border: '1px dashed rgba(56, 189, 248, 0.3)', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', boxSizing: 'border-box' }}>
                  <ListMusic style={{ width: '20px', height: '20px', color: 'rgba(56, 189, 248, 0.5)' }} />
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>Antrean Kosong</p>
                  <p style={{ fontSize: '8px', color: '#94a3b8', margin: 0 }}>Scan Barcode HP</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. SEKSI PALING BAWAH: SCAN BARCODE (DI BAWAH DAFTAR ANTREAN LAGU) */}
          <div
            style={{
              padding: '6px 8px',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              borderTop: '1px solid rgba(56, 189, 248, 0.3)',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              boxSizing: 'border-box',
            }}
          >
            {/* ==============================================================
                KOTAK PENILAIAN & SORAK TV DI ATAS BARCODE (UKURAN SEBESAR BARCODE)
                Layar YouTube 100% bersih tanpa ada elemen yang menutupi!
               ============================================================== */}
            {isScoreModalOpen && currentScoreData ? (
              /* KOTAK PENILAIAN: Tepat di atas barcode dengan daftar akumulasi nilai dewan juri */
              (() => {
                const tvVotes =
                  currentScoreData.juryVotes && currentScoreData.juryVotes.length > 0
                    ? currentScoreData.juryVotes
                    : ['iwan', 'rudi', 'rojikan', 'tomas', 'awan'].map((name, idx) => ({
                        clientId: `default-tv-${idx + 1}`,
                        juryName: name,
                        score: currentScoreData.totalScore,
                        songId: currentScoreData.song?.id || '',
                        songTitle: currentScoreData.song?.title || '',
                        submittedAt: Date.now(),
                      }));
                const tvSum = tvVotes.reduce((acc, v) => acc + v.score, 0);
                const tvAvg = Math.round(tvSum / tvVotes.length);
                const tvExpr = tvVotes.map((v) => v.score).join('+');
                const tvQuote = getScoreQuote(tvAvg, currentScoreData.evaluatedAt);

                return (
                  <div
                    onClick={() => setIsScoreModalOpen(false)}
                    title="Skor Dewan Juri Prajurit (Klik untuk menutup)"
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px 7px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(8, 20, 45, 0.98), rgba(4, 12, 29, 0.98))',
                      border: '1.5px solid rgba(251, 191, 36, 0.9)',
                      boxShadow: '0 0 16px rgba(251, 191, 36, 0.45)',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '8px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#fcd34d',
                        lineHeight: 1.1,
                        marginBottom: '2px',
                        textAlign: 'center',
                      }}
                    >
                      ⚖️ DEWAN JURI PRAJURIT ({tvVotes.length} JURI)
                    </div>
                    <div
                      style={{
                        fontSize: '26px',
                        fontWeight: 900,
                        lineHeight: 1,
                        color: '#fef08a',
                        textShadow: '0 0 15px rgba(250, 204, 21, 0.8)',
                        fontFamily: 'monospace',
                        marginBottom: '3px',
                      }}
                    >
                      {tvAvg}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        padding: '3px 5px',
                        marginBottom: '4px',
                        borderRadius: '5px',
                        backgroundColor: 'rgba(251, 191, 36, 0.18)',
                        border: '1px solid rgba(251, 191, 36, 0.75)',
                        fontSize: '9.5px',
                        fontWeight: 900,
                        color: '#fef08a',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        boxSizing: 'border-box',
                      }}
                    >
                      &ldquo;{tvQuote}&rdquo;
                    </div>
                    <div
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(2, 6, 23, 0.75)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        borderRadius: '5px',
                        padding: '4px 5px',
                        boxSizing: 'border-box',
                        fontFamily: 'monospace',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '8px',
                          fontWeight: 900,
                          color: '#fcd34d',
                          marginBottom: '2px',
                          lineHeight: 1.1,
                        }}
                      >
                        dewan juri :
                      </div>
                      <div style={{ maxHeight: '64px', overflowY: 'auto' }}>
                        {tvVotes.map((v, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '8px',
                              fontWeight: 700,
                              color: '#f1f5f9',
                              lineHeight: 1.25,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {idx + 1}. {v.juryName.toLowerCase()} penilaian :{' '}
                            <span style={{ color: '#fbbf24', fontWeight: 900 }}>{v.score}</span>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          fontSize: '8px',
                          fontWeight: 900,
                          color: '#34d399',
                          borderTop: '1px solid rgba(56, 189, 248, 0.3)',
                          marginTop: '3px',
                          paddingTop: '2px',
                          lineHeight: 1.2,
                          wordBreak: 'break-all',
                        }}
                      >
                        skor total {tvExpr}={tvSum}:{tvVotes.length}= <span style={{ color: '#fef08a' }}>{tvAvg}</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : activeReactions.length > 0 ? (
              /* SORAK TV: Tepat di atas barcode, ukuran sebesar barcode, dengan nama sorak & kembang api */
              (() => {
                const latestRx = activeReactions[activeReactions.length - 1];
                const cheerName = getCheerText(latestRx.type, latestRx.label);
                return (
                  <div
                    style={{
                      width: '100%',
                      height: '84px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 6px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(12, 35, 75, 0.96), rgba(6, 18, 41, 0.98))',
                      border: '1.5px solid rgba(56, 189, 248, 0.85)',
                      boxShadow: '0 0 16px rgba(56, 189, 248, 0.35)',
                      boxSizing: 'border-box',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Efek Kembang Api Mini / Sparkle Particles di dalam Kotak Sorak */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background: 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, transparent 70%)',
                      }}
                    />
                    <div
                      style={{
                        fontSize: '8px',
                        fontWeight: 900,
                        color: '#38bdf8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        lineHeight: 1,
                        marginBottom: '3px',
                        zIndex: 1,
                      }}
                    >
                      <Sparkles style={{ width: '9px', height: '9px', color: '#fcd34d' }} />
                      <span>SORAK PENONTON</span>
                      <Sparkles style={{ width: '9px', height: '9px', color: '#fcd34d' }} />
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        color: '#ffffff',
                        letterSpacing: '0.05em',
                        textAlign: 'center',
                        lineHeight: 1.1,
                        textShadow: '0 0 10px rgba(56, 189, 248, 0.8), 0 0 20px rgba(250, 204, 21, 0.6)',
                        zIndex: 1,
                      }}
                    >
                      {cheerName}
                    </div>
                    <div
                      style={{
                        fontSize: '7px',
                        fontWeight: 700,
                        color: '#fcd34d',
                        marginTop: '3px',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '90%',
                        zIndex: 1,
                      }}
                    >
                      Dari: {latestRx.senderName || 'Penonton'}
                    </div>
                  </div>
                );
              })()
            ) : null}

            {/* Status Room & Mic Standby / ON (Tepat di Atas Barcode) */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4px',
                marginBottom: '2px',
              }}
            >
              {/* Room Code & Jumlah HP */}
              <div
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(8, 47, 73, 0.95)',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  color: '#fcd34d',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: 900,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{roomId}</span>
                <span style={{ color: '#34d399', fontWeight: 'bold' }}>({remoteConnectedDevices} HP)</span>
              </div>

              {/* Status Mic HP Standby / ON */}
              {isMicLive ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(6, 78, 59, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.7)',
                    color: '#6ee7b7',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Mic style={{ width: '11px', height: '11px', color: '#34d399' }} />
                  <span>Mic ON ({activeMicCount})</span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(71, 85, 105, 0.8)',
                    color: '#94a3b8',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Radio style={{ width: '11px', height: '11px', color: '#64748b' }} />
                  <span>Mic Standby</span>
                </div>
              )}
            </div>

            <div
              onClick={() => setShowQrModal(true)}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#000000',
                border: '1px solid #38bdf8',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              title="Scan Barcode untuk Remote & Mic HP (Klik untuk memperbesar)"
            >
              <img
                src={currentQrImage}
                alt={`Scan Barcode Room ${roomId}`}
                style={{ width: '60px', height: '60px', minWidth: '60px', minHeight: '60px', objectFit: 'contain', backgroundColor: '#ffffff' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '2px', lineHeight: 1 }}>
                <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', color: '#082f49', letterSpacing: '0.05em' }}>
                  SCAN BARCODE
                </span>
                <span style={{ fontSize: '7px', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>
                  Remote &amp; Mic HP
                </span>
              </div>
            </div>

            {/* Kode Room */}
            <div
              style={{
                width: '100%',
                textAlign: 'center',
                padding: '2px 4px',
                borderRadius: '4px',
                backgroundColor: 'rgba(8, 47, 73, 0.9)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#fcd34d',
                fontFamily: 'monospace',
                fontSize: '9px',
                fontWeight: 900,
                letterSpacing: '0.05em',
                boxSizing: 'border-box',
              }}
            >
              KODE: {roomId}
            </div>
          </div>
        </aside>
      </div>

      {/* =========================================================================
          BAGIAN 3: FOOTER BAWAH LAYAR YOUTUBE (TICKER & KONTROL TV)
         ========================================================================= */}
      <footer
        className="tv-stage-footer"
        style={{
          width: '100%',
          height: '44px',
          minHeight: '44px',
          maxHeight: '44px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#000000',
          borderTop: '1px solid rgba(56, 189, 248, 0.35)',
          padding: '0 16px',
          boxSizing: 'border-box',
          flexShrink: 0,
          zIndex: 20,
        }}
        aria-label="Running Text Ticker & Kontrol TV"
      >
        {/* Indikator Live & Status Koneksi di Kiri */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fcd34d', fontFamily: 'monospace', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', paddingRight: '12px', borderRight: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <Radio style={{ width: '14px', height: '14px', color: '#38bdf8' }} />
          <span>DISKOMLEK LIVE</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              borderRadius: '6px',
              backgroundColor:
                connectionStatus === 'connected'
                  ? 'rgba(6, 78, 59, 0.85)'
                  : connectionStatus === 'reconnecting'
                  ? 'rgba(120, 53, 15, 0.85)'
                  : 'rgba(136, 19, 55, 0.85)',
              color:
                connectionStatus === 'connected'
                  ? '#6ee7b7'
                  : connectionStatus === 'reconnecting'
                  ? '#fde68a'
                  : '#fda4af',
              fontSize: '9.5px',
              fontWeight: 800,
              textTransform: 'none',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor:
                  connectionStatus === 'connected'
                    ? '#34d399'
                    : connectionStatus === 'reconnecting'
                    ? '#fbbf24'
                    : '#f43f5e',
                display: 'inline-block',
              }}
            />
            {connectionStatus === 'connected'
              ? 'Terhubung'
              : connectionStatus === 'reconnecting'
              ? 'Menyambung Ulang'
              : 'Terputus'}
          </span>
        </div>

        {/* Running Text Marquee */}
        <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', height: '100%', padding: '0 16px', position: 'relative' }}>
          <div className="animate-marquee-tv" style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.03em' }}>
            <span style={{ margin: '0 24px' }}>{marqueeText}</span>
            <span style={{ margin: '0 24px' }}>{marqueeText}</span>
          </div>
        </div>

        {/* Kontrol Layar di Kanan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, fontSize: '11px' }}>
          <button
            id="tv-btn-pantun-mc"
            tabIndex={0}
            onClick={() =>
              triggerSmartMc({
                singerName: defaultSingerName,
                songTitle: currentSong?.title,
                isManual: true,
                broadcast: true,
              })
            }
            onKeyDown={(e) => {
              const code = e.keyCode || e.which;
              if (code === 13 || code === 23 || e.key === 'Enter') {
                e.preventDefault();
                triggerSmartMc({
                  singerName: defaultSingerName,
                  songTitle: currentSong?.title,
                  isManual: true,
                  broadcast: true,
                });
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#020617',
              backgroundColor: '#fbbf24',
              border: '2px solid #fef08a',
              cursor: 'pointer',
              padding: '3px 10px',
              borderRadius: '6px',
              fontWeight: 900,
              fontSize: '11px',
              outline: 'none',
            }}
            title="Panggil Pantun Smart MC Diskomlekau (Tekan OK/Enter pada Remote TV)"
          >
            <span>🎙️ Pantun MC</span>
          </button>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <button
            onClick={() => toggleFullScreen()}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#7dd3fc', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}
            title="Layar Penuh TV"
          >
            {isFullscreen ? <Minimize2 style={{ width: '12px', height: '12px' }} /> : <Maximize2 style={{ width: '12px', height: '12px' }} />}
            <span>{isFullscreen ? 'Kecilkan' : 'Fullscreen'}</span>
          </button>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <button
            onClick={handleExit}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}
            title="Kembali ke Konsol Tablet (ESC)"
          >
            <span>Keluar (ESC)</span>
          </button>
          {wakeLockActive && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span style={{ fontSize: '10px', color: '#34d399', fontFamily: 'monospace' }}>WakeLock ON</span>
            </>
          )}
        </div>
      </footer>

      {/* Smart MC Diskomlekau Banner (HANYA muncul otomatis saat lagu ENDED / transisi antrean, atau dipicu manual dari HP) */}
      <SmartMcBanner />
    </div>
  );
};
