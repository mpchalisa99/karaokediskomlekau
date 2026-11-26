import React, { useEffect, useRef } from 'react';

interface MemoizedTvYouTubeEmbedProps {
  videoId: string;
  isPlaying: boolean;
  audioVolume: number;
  isMuted: boolean;
}

/**
 * Komponen pemutar YouTube TV yang terisolasi penuh dengan React.memo.
 * Komponen iframe TIDAK pernah di-render ulang ketika state Smart MC, antrean lagu,
 * timer, reaksi sorak, atau skor Dewan Juri berubah.
 * Iframe hanya berganti ketika videoId lagu berubah.
 * Dioptimalkan untuk koneksi data video lancar tanpa lag/re-buffering (Adaptive Bitrate alami + GPU layer).
 */
const TvYouTubeEmbedComponent: React.FC<MemoizedTvYouTubeEmbedProps> = ({
  videoId,
  isPlaying,
  audioVolume,
  isMuted,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioVolumeRef = useRef<number>(audioVolume);
  const isMutedRef = useRef<boolean>(isMuted);
  const isPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    audioVolumeRef.current = audioVolume;
  }, [audioVolume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const videoOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  // Parameter YouTube embed ringan tanpa memaksa vq=hd720 agar Adaptive Bitrate menyesuaikan bandwidth tanpa lag
  const iframeSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&iv_load_policy=3&playsinline=1&controls=0&modestbranding=1&origin=${encodeURIComponent(
        videoOrigin
      )}`
    : '';

  // Sinkronisasi play/pause via postMessage tanpa memicu re-render DOM iframe
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: isPlaying ? 'playVideo' : 'pauseVideo',
          args: [],
        }),
        '*'
      );
    } catch {}
  }, [isPlaying]);

  // Sinkronisasi volume & mute via postMessage tanpa memicu re-render DOM iframe
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: isMuted ? 'mute' : 'unMute',
          args: [],
        }),
        '*'
      );
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'setVolume',
          args: [audioVolume],
        }),
        '*'
      );
    } catch {}
  }, [audioVolume, isMuted]);

  // Registrasi listener & autoplay satu kali aman tanpa spam postMessage / paksa setPlaybackQuality
  useEffect(() => {
    if (!videoId) return;

    const sendSingleSafetyInit = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
        win.postMessage(
          JSON.stringify({ event: 'command', func: isMutedRef.current ? 'mute' : 'unMute', args: [] }),
          '*'
        );
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [audioVolumeRef.current] }),
          '*'
        );
        if (isPlayingRef.current) {
          win.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
        }
      } catch {}
    };

    const safetyTimer = setTimeout(sendSingleSafetyInit, 750);
    return () => {
      clearTimeout(safetyTimer);
    };
  }, [videoId]);

  if (!videoId || !iframeSrc) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#000000',
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    >
      <iframe
        ref={iframeRef}
        key={videoId}
        src={iframeSrc}
        loading="eager"
        className="tv-stage-iframe"
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
          backgroundColor: '#000000',
          position: 'relative',
          zIndex: 1,
          transform: 'translateZ(0)',
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title="DISKOMLEK KARAOKE Video Player"
        onLoad={() => {
          try {
            const win = iframeRef.current?.contentWindow;
            if (win) {
              win.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
              win.postMessage(
                JSON.stringify({ event: 'command', func: isMutedRef.current ? 'mute' : 'unMute', args: [] }),
                '*'
              );
              win.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [audioVolumeRef.current] }),
                '*'
              );
              if (isPlayingRef.current) {
                win.postMessage(
                  JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                  '*'
                );
              }
            }
          } catch {}
        }}
      />
    </div>
  );
};

export const MemoizedTvYouTubeEmbed = React.memo(
  TvYouTubeEmbedComponent,
  (prev, next) =>
    prev.videoId === next.videoId &&
    prev.isPlaying === next.isPlaying &&
    prev.audioVolume === next.audioVolume &&
    prev.isMuted === next.isMuted
);

/**
 * Container DOM target untuk YouTube IFrame API di tampilan Master Cockpit.
 * Dibungkus React.memo agar node DOM iframe YouTube tidak pernah disentuh ulang oleh React reconciliation.
 */
export const MemoizedMasterYouTubeTarget = React.memo(
  ({ hidden }: { hidden: boolean }) => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: hidden ? 'none' : 'block',
        backgroundColor: '#000000',
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    >
      <div id="karaoke-yt-iframe-target" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />
    </div>
  ),
  (prev, next) => prev.hidden === next.hidden
);
