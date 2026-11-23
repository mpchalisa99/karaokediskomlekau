import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Radio,
  Smartphone,
  Trophy,
  Tv,
  Zap,
} from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { CheerCharacterOverlay } from './CheerCharacterOverlay';
import { MemoizedMasterYouTubeTarget } from './MemoizedYouTubePlayer';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const Player: React.FC = () => {
  const {
    currentSong,
    queue,
    isPlaying,
    setIsPlaying,
    togglePlayPause,
    audioVolume,
    setAudioVolume,
    isMuted,
    setIsMuted,
    skipNextSong,
    replayCurrentSong,
    evaluateCurrentSong,
    handlePlayerEnded,
    playerRef,
    triggerSoundFx,
    setIsTvMode,
    remoteConnectedDevices,
    roomId,
    activeReactions,
    musicDelayMs,
    setMusicDelayMs,
    notifyPlaybackTime,
    isScoreModalOpen,
    triggerSmartMc,
    defaultSingerName,
  } = useKaraoke();

  const internalPlayerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Load YouTube IFrame API script
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      initPlayer();
      return;
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevOnReady) prevOnReady();
      initPlayer();
    };
  }, []);

  // Initialize YT.Player
  const initPlayer = useCallback(() => {
    if (!window.YT || !window.YT.Player || internalPlayerRef.current || !currentSong?.id) return;

    try {
      const playerInstance = new window.YT.Player('karaoke-yt-iframe-target', {
        height: '100%',
        width: '100%',
        videoId: currentSong.id,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          fs: 1,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setIsPlayerReady(true);
            playerRef.current = event.target;
            internalPlayerRef.current = event.target;
            try {
              event.target.setPlaybackQuality?.('hd720');
              if (isMuted) {
                event.target.mute();
              } else {
                event.target.unMute();
                event.target.setVolume(audioVolume);
              }
              event.target.playVideo();
              setIsPlaying(true);
            } catch {}
          },
          onStateChange: (event: any) => {
            if (event.data === 0) {
              handlePlayerEnded();
            } else if (event.data === 1) {
              try {
                event.target.setPlaybackQuality?.('hd720');
              } catch {}
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
          },
          onError: (event: any) => {
            console.warn('YouTube Player error code:', event.data);
            const errCode = event.data;
            let errMsg = 'Video ini dibatasi atau tidak dapat disematkan oleh pengunggah.';
            if (errCode === 101 || errCode === 150) {
              errMsg = 'Pemilik video YouTube membatasi pemutaran embed (Error 150/101). Otomatis melanjutkan ke lagu berikutnya dalam antrean...';
            } else if (errCode === 100 || errCode === 2) {
              errMsg = 'Video tidak ditemukan atau format ID tidak valid.';
            }
            setPlayerError(errMsg);
            // Otomatis lewati ke lagu berikutnya agar sesi karaoke tidak terhenti
            setTimeout(() => {
              skipNextSong();
            }, 3000);
          },
        },
      });
    } catch (err) {
      console.error('Error instantiating YT player:', err);
    }
  }, [currentSong?.id, audioVolume, isMuted, handlePlayerEnded, setIsPlaying, playerRef, skipNextSong]);

  // Load new video when currentSong changes
  useEffect(() => {
    if (currentSong?.id) {
      if (!internalPlayerRef.current) {
        initPlayer();
      } else if (isPlayerReady) {
        try {
          setPlayerError(null);
          internalPlayerRef.current.loadVideoById({
            videoId: currentSong.id,
            startSeconds: 0,
            suggestedQuality: 'hd720',
          });
          internalPlayerRef.current.setPlaybackQuality?.('hd720');
          if (!isMuted) {
            internalPlayerRef.current.unMute?.();
            internalPlayerRef.current.setVolume?.(audioVolume);
          }
          internalPlayerRef.current.playVideo?.();
          setIsPlaying(true);
        } catch (e) {
          try {
            internalPlayerRef.current.loadVideoById(currentSong.id);
            internalPlayerRef.current.playVideo?.();
            setIsPlaying(true);
          } catch {}
        }
      }
    } else {
      if (internalPlayerRef.current && isPlayerReady) {
        try {
          internalPlayerRef.current.stopVideo?.();
        } catch {}
      }
    }
  }, [currentSong?.id, isPlayerReady, setIsPlaying, initPlayer, audioVolume, isMuted]);

  // Sync volume with player
  useEffect(() => {
    if (internalPlayerRef.current && isPlayerReady) {
      try {
        if (isMuted) {
          internalPlayerRef.current.mute();
        } else {
          internalPlayerRef.current.unMute();
          internalPlayerRef.current.setVolume(audioVolume);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [audioVolume, isMuted, isPlayerReady]);

  // Synchronize internal YouTube player with remote play/pause state
  useEffect(() => {
    if (!internalPlayerRef.current || !isPlayerReady) return;
    try {
      const state = internalPlayerRef.current.getPlayerState?.();
      if (isPlaying && state !== 1 && state !== 3) {
        internalPlayerRef.current.playVideo?.();
      } else if (!isPlaying && state === 1) {
        internalPlayerRef.current.pauseVideo?.();
      }
    } catch (e) {
      // ignore
    }
  }, [isPlaying, isPlayerReady]);

  // Periodic playback progress reporter for 60-second auto-scoring trigger
  useEffect(() => {
    if (!isPlaying || !isPlayerReady || !internalPlayerRef.current) return;

    const interval = setInterval(() => {
      try {
        const cur = internalPlayerRef.current.getCurrentTime?.();
        const dur = internalPlayerRef.current.getDuration?.();
        if (typeof cur === 'number' && cur > 0) {
          notifyPlaybackTime(cur, dur);
        }
      } catch (e) {}
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, isPlayerReady, notifyPlaybackTime]);

  const nextInQueue = queue.length > 0 ? queue[0] : null;

  return (
    <div className="flex flex-col rounded-2xl border-2 border-sky-900/80 bg-[#07132c] overflow-hidden hud-corner">
      {/* Cockpit / Tactical Top Bar Indicator */}
      <div className="px-3 sm:px-4 py-2 bg-[#050e22] border-b border-sky-900/60 flex items-center justify-between text-[11px] font-mono text-sky-400 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="font-bold tracking-widest text-sky-300">SUBDIS RUDAL DISKOMLEKAU // MONITOR UTAMA</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Fixed Room Code & Connection Info (No Popup) */}
          <div className="flex items-center gap-1.5 rounded-lg bg-[#07132c] px-2.5 py-1 text-[10px] font-mono font-bold text-sky-200 border border-sky-700/70">
            <Smartphone className="h-3 w-3 text-sky-400" />
            <span>ROOM: <strong className="text-amber-300">{roomId}</strong></span>
            <span className="text-emerald-400">({remoteConnectedDevices} HP)</span>
          </div>

          <span className="hidden md:inline text-sky-500 font-mono">FREQ: 124.85 MHz</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            STANDBY
          </span>
        </div>
      </div>

      {/* Video Screen Container (16:9 Aspect Ratio) - Terisolasi dengan MemoizedMasterYouTubeTarget */}
      <div className="relative aspect-video w-full bg-black overflow-hidden group">
        <MemoizedMasterYouTubeTarget hidden={!currentSong} />

        {/* Standby View when No Song is Selected */}
        {!currentSong && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#051126] p-6 text-center z-10">
            <div className="relative flex items-center justify-center mb-4">
              <div className="absolute h-28 w-28 rounded-full border border-dashed border-sky-400/30" />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-950 border border-sky-400/50">
                <Radio className="h-7 w-7 text-sky-400" />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-950 px-3.5 py-1 text-xs font-mono font-bold tracking-wider text-sky-300 border border-sky-500/40 mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              STATUS: STANDBY // SIAP TEMPUR
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-wide mb-2">
              VOCAL SIMULATION SYSTEM DISKOMLEKAU
            </h2>
            <p className="text-xs sm:text-sm text-sky-200/80 max-w-lg mb-4">
              Silakan pilih lagu dari katalog rekomendasi di bawah atau gunakan kolom pencarian untuk memulai bernyanyi.
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-[#061430] border border-amber-400/60 px-4 py-2 font-mono text-xs font-bold text-amber-300">
              <Smartphone className="h-4 w-4 text-amber-400" />
              <span>KODE ROOM: <strong className="text-white font-black text-sm">{roomId}</strong></span>
            </div>
          </div>
        )}

        {/* Video Overlays if Error */}
        {playerError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
            <Radio className="h-10 w-10 text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-amber-300">{playerError}</p>
            <p className="text-xs text-sky-200/80 mt-1 max-w-md">
              Tekan tombol lewati untuk melanjutkan ke lagu giliran prajurit berikutnya di antrean.
            </p>
            <button
              onClick={() => skipNextSong()}
              className="mt-4 rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-500 border border-sky-400/30"
            >
              Lewati ke Lagu Berikutnya &rarr;
            </button>
          </div>
        )}

        {/* Floating Ticker: Current Song & Next Up (Tanpa backdrop-blur & animate-ping agar ringan di GPU TV) */}
        <div className="absolute top-0 left-0 right-0 z-10 p-3 pointer-events-none">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Current Playing Marquee */}
            <div className="flex items-center gap-2 max-w-full sm:max-w-md bg-[#07132c]/95 rounded-full px-3 py-1 border border-sky-500/40">
              <span className="flex h-2 w-2 rounded-full bg-sky-400" />
              <span className="font-bold text-sky-300 text-[11px] uppercase tracking-wider">
                SEDANG MENGUDARA:
              </span>
              <span className="truncate font-semibold text-white text-[13px]">
                {currentSong ? currentSong.title : 'Pilih lagu untuk memulai'}
              </span>
            </div>

            {/* Next Up Singer Announcement */}
            {nextInQueue && (
              <div className="hidden sm:flex items-center gap-2 bg-[#091838]/95 rounded-full px-3 py-1 border border-amber-500/40 text-slate-200">
                <span className="text-amber-400 font-bold text-[11px]">SIAP-SIAP:</span>
                <span className="font-semibold text-white truncate max-w-[180px]">
                  {nextInQueue.song.title}
                </span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-extrabold border border-amber-500/30">
                  {nextInQueue.singerName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time On-Screen Reaction Banners (Tanpa backdrop-blur berat) */}
        {activeReactions.length > 0 && (
          <div className="absolute top-14 inset-x-4 z-20 flex flex-col items-center pointer-events-none space-y-2">
            {activeReactions.map((rx) => {
              const isHuuu = rx.type === 'boo';
              return (
                <div
                  key={rx.id}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border text-left max-w-sm ${
                    isHuuu
                      ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
                      : 'bg-slate-900/90 border-sky-400/40 text-white'
                  }`}
                >
                  <span className="text-2xl shrink-0">{rx.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-extrabold truncate ${isHuuu ? 'text-amber-300' : 'text-sky-300'}`}>
                      {rx.label}
                    </p>
                    <p className="text-[10px] text-slate-200 truncate">
                      Dari: <span className="font-bold text-amber-300 underline decoration-sky-400">{rx.senderName} (HP)</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Animasi Karakter Sorak Sorai Transparan (disembunyikan saat kotak penilaian muncul) */}
        {!isScoreModalOpen && <CheerCharacterOverlay reactions={activeReactions} variant="compact" />}
      </div>

      {/* Control Deck & Soundboard */}
      <div className="p-3.5 sm:p-4 bg-[#050e22] border-t border-sky-900/60 flex flex-col gap-3">
        {/* Playback Controls & Volume */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Controls: Replay, Play/Pause, Next */}
          <div className="flex items-center gap-2">
            <button
              onClick={replayCurrentSong}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b1c3e] border border-sky-900/70 text-sky-200 hover:bg-sky-900/50 hover:text-white transition active:scale-95"
              title="Ulangi Lagu Dari Awal"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              onClick={() => togglePlayPause()}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-700 text-white shadow-lg shadow-sky-500/30 hover:brightness-110 active:scale-95 transition border border-sky-400/40"
              title={isPlaying ? 'Jeda Lagu' : 'Putar Lagu'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => skipNextSong()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b1c3e] border border-sky-900/70 text-sky-200 hover:bg-sky-900/50 hover:text-white transition active:scale-95"
              title="Lagu Berikutnya (Skip Next)"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Scoring Button */}
            <button
              onClick={evaluateCurrentSong}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-600/30 to-amber-700/40 px-3 py-2 text-xs font-bold text-amber-300 hover:from-amber-600 hover:to-amber-700 hover:text-white transition active:scale-95 shadow-sm ml-1 cursor-pointer"
              title="Nilai nyanyian sekarang & tampilkan skor juri Subdis Rudal"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>Nilai Lagu</span>
            </button>

            {/* Smart MC Pantun Button */}
            <button
              onClick={() =>
                triggerSmartMc({
                  singerName: defaultSingerName,
                  songTitle: currentSong?.title,
                  isManual: true,
                  broadcast: true,
                })
              }
              className="flex items-center gap-1.5 rounded-xl border border-emerald-400/70 bg-gradient-to-r from-emerald-600/40 to-teal-700/50 px-3 py-2 text-xs font-black text-emerald-200 hover:from-emerald-500 hover:to-teal-600 hover:text-white transition active:scale-95 shadow-sm cursor-pointer"
              title="Panggil Smart MC Diskomlekau untuk membacakan Pantun & Komentar Militer"
            >
              <span>🎙️ Pantun MC</span>
            </button>
          </div>

          {/* Unified Volume Control */}
          <div className="flex items-center gap-2 bg-[#091838] px-3 py-1.5 rounded-xl border border-sky-900/60">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-sky-300 hover:text-white transition"
              title={isMuted ? 'Buka Suara' : 'Bisukan Suara'}
            >
              {isMuted || audioVolume === 0 ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : audioVolume}
              onChange={(e) => {
                setAudioVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-20 sm:w-28 accent-sky-400 h-1.5 bg-[#0b1c3e] rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-sky-300 w-8 text-right">
              {isMuted ? '0%' : `${audioVolume}%`}
            </span>
          </div>
        </div>

        {/* Vocal Sync Delay / Music Buffer Adjuster (0 - 250ms) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-900/40 bg-[#040e24]/70 p-2 rounded-xl">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>SINKRONISASI MUSIK (DELAY BUFFER):</span>
            <span className="font-mono text-amber-200 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 text-[11px]">
              +{musicDelayMs}ms
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMusicDelayMs(Math.max(0, musicDelayMs - 5))}
              className="h-6 w-7 rounded bg-amber-950 hover:bg-amber-800 text-amber-200 font-bold text-xs flex items-center justify-center border border-amber-500/50"
              title="Kurangi Delay (-5ms)"
            >
              -
            </button>
            <input
              type="range"
              min="0"
              max="250"
              step="5"
              value={musicDelayMs}
              onChange={(e) => setMusicDelayMs(Number(e.target.value))}
              className="w-24 sm:w-32 accent-amber-400 h-1.5 bg-[#0b1c3e] rounded-lg cursor-pointer"
            />
            <button
              onClick={() => setMusicDelayMs(Math.min(250, musicDelayMs + 5))}
              className="h-6 w-7 rounded bg-amber-950 hover:bg-amber-800 text-amber-200 font-bold text-xs flex items-center justify-center border border-amber-500/50"
              title="Tambah Delay (+5ms)"
            >
              +
            </button>
            <div className="hidden lg:flex items-center gap-1 text-[10px]">
              {[0, 60, 75, 100].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setMusicDelayMs(preset)}
                  className={`px-1.5 py-0.5 rounded font-mono text-[9px] border transition ${
                    musicDelayMs === preset
                      ? 'bg-amber-500 text-black border-amber-300 font-bold'
                      : 'bg-black/40 text-slate-400 hover:text-white border-slate-700'
                  }`}
                >
                  {preset}ms
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Compact Tactical Soundboard */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-sky-900/40 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-300 uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Efek Suara:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => triggerSoundFx('hormat')}
              className="flex items-center gap-1 rounded-lg bg-[#0a1a3a] hover:bg-sky-900/50 border border-sky-400/60 px-2.5 py-1 text-xs text-sky-200 hover:text-white transition active:scale-95 shadow-sm"
              title="Beri Hormat (KASIH HORMAT)"
            >
              <span>🫡</span>
              <span className="font-semibold text-[11px]">Hormat</span>
            </button>

            <button
              onClick={() => triggerSoundFx('sawer')}
              className="flex items-center gap-1 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/60 px-2.5 py-1 text-xs text-amber-200 hover:text-white transition active:scale-95 shadow-sm"
              title="Sawer Dulu (SAWER DULU)"
            >
              <span>💸</span>
              <span className="font-semibold text-[11px]">Sawer</span>
            </button>

            <button
              onClick={() => triggerSoundFx('applause')}
              className="flex items-center gap-1 rounded-lg bg-[#0a1a3a] hover:bg-sky-900/50 border border-sky-800/80 px-2.5 py-1 text-xs text-sky-200 hover:text-white transition active:scale-95"
              title="Tepuk Tangan"
            >
              <span>👏</span>
              <span className="font-semibold text-[11px]">Tepuk Tangan</span>
            </button>

            <button
              onClick={() => triggerSoundFx('cheer')}
              className="flex items-center gap-1 rounded-lg bg-[#0a1a3a] hover:bg-sky-900/50 border border-sky-800/80 px-2.5 py-1 text-xs text-sky-200 hover:text-white transition active:scale-95"
              title="Sorak Komando"
            >
              <span>🎉</span>
              <span className="font-semibold text-[11px]">Sorak Komando</span>
            </button>

            <button
              onClick={() => triggerSoundFx('airhorn')}
              className="flex items-center gap-1 rounded-lg bg-[#0a1a3a] hover:bg-sky-900/50 border border-sky-800/80 px-2.5 py-1 text-xs text-sky-200 hover:text-white transition active:scale-95"
              title="Sirine"
            >
              <span>📢</span>
              <span className="font-semibold text-[11px]">Sirine</span>
            </button>

            <button
              onClick={() => triggerSoundFx('ding')}
              className="flex items-center gap-1 rounded-lg bg-[#0a1a3a] hover:bg-sky-900/50 border border-sky-800/80 px-2.5 py-1 text-xs text-sky-200 hover:text-white transition active:scale-95"
              title="Lempar Kursi (Aksi Panggung Lucu)"
            >
              <span>🪑</span>
              <span className="font-semibold text-[11px]">Lempar Kursi</span>
            </button>

            <button
              onClick={() => triggerSoundFx('boo')}
              className="flex items-center gap-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/70 px-2.5 py-1 text-xs text-rose-200 font-bold hover:text-white transition active:scale-95"
              title="Sorak Huuu (Lucu: Suara Hancur)"
            >
              <span>👎</span>
              <span className="text-[11px]">HUUU!</span>
            </button>

            <button
              onClick={() => triggerSoundFx('laugh')}
              className="flex items-center gap-1 rounded-lg bg-[#0a1a3a] hover:bg-sky-900/50 border border-sky-800/80 px-2.5 py-1 text-xs text-amber-300 hover:text-white transition active:scale-95"
              title="Tawa"
            >
              <span>😂</span>
              <span className="font-semibold text-[11px]">Tawa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
