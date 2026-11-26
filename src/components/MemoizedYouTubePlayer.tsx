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
 */
const TvYouTubeEmbedComponent: React.FC<MemoizedTvYouTubeEmbedProps> = ({
  videoId,
  isPlaying,
  audioVolume,
  isMuted,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const videoOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  // Parameter YouTube embed ringan khusus Smart TV Samsung Tizen OS (iv_load_policy=3, rel=0, modestbranding=1, vq=hd720, wmode=opaque)
  const iframeSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&iv_load_policy=3&playsinline=1&controls=0&modestbranding=1&vq=hd720&wmode=opaque&origin=${encodeURIComponent(
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

  // Jaminan autoplay instan & kunci kualitas stabil 720p saat videoId baru dimuat di TV Tizen OS
  useEffect(() => {
    if (!videoId) return;

    const triggerTvAutoplayAnd720p = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd720'] }),
          '*'
        );
        win.postMessage(
          JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
          '*'
        );
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [audioVolume] }),
          '*'
        );
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      } catch {}
    };

    triggerTvAutoplayAnd720p();
    const t1 = setTimeout(triggerTvAutoplayAnd720p, 200);
    const t2 = setTimeout(triggerTvAutoplayAnd720p, 600);
    const t3 = setTimeout(triggerTvAutoplayAnd720p, 1300);
    const t4 = setTimeout(triggerTvAutoplayAnd720p, 2200);

    // Heartbeat listening agar YouTube iframe mengirimkan infoDelivery ke window
    const listeningInterval = setInterval(() => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
      } catch {}
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearInterval(listeningInterval);
    };
  }, [videoId]);

  if (!videoId || !iframeSrc) return null;

  return (
    <iframe
      ref={iframeRef}
      key={videoId}
      src={iframeSrc}
      className="tv-stage-iframe"
      style={{
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
        backgroundColor: '#000000',
        position: 'relative',
        zIndex: 1,
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
              JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd720'] }),
              '*'
            );
            win.postMessage(
              JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
              '*'
            );
            win.postMessage(
              JSON.stringify({ event: 'command', func: 'setVolume', args: [audioVolume] }),
              '*'
            );
            win.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          }
        } catch {}
      }}
    />
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
      }}
    >
      <div id="karaoke-yt-iframe-target" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />
    </div>
  ),
  (prev, next) => prev.hidden === next.hidden
);
