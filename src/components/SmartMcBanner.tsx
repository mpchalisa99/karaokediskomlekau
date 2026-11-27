import React, { useEffect, useState } from 'react';
import { useKaraoke } from '../context/KaraokeContext';
import {
  MC_WANITA_TNI_AU_BIRU_DATA_URL,
  MC_WANITA_TNI_AU_LORENG_DATA_URL,
} from '../assets/mcCharacterAsset';
import { McUniformType } from '../types/karaoke';

/**
 * Fallback SVG Avatar MC Wanita TNI AU jika asset gambar utama gagal dimuat
 */
const McWanitaSvgFallback: React.FC<{ uniform: McUniformType }> = ({ uniform }) => {
  const isBiru = uniform === 'biru';
  return (
    <svg
      viewBox="0 0 180 220"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-label={isBiru ? 'MC Wanita TNI AU Seragam Biru Langit' : 'MC Wanita TNI AU Seragam Loreng'}
    >
      <defs>
        <linearGradient id={isBiru ? 'mcBiruGrad' : 'mcLorengGrad'} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isBiru ? '#38bdf8' : '#3f6212'} />
          <stop offset="50%" stopColor={isBiru ? '#0284c7' : '#14532d'} />
          <stop offset="100%" stopColor={isBiru ? '#0369a1' : '#365314'} />
        </linearGradient>
        <linearGradient id="mcSkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f5cba7" />
        </linearGradient>
      </defs>
      <ellipse
        cx="90"
        cy="120"
        rx="75"
        ry="90"
        fill={isBiru ? 'rgba(56, 189, 248, 0.18)' : 'rgba(220, 38, 38, 0.18)'}
      />
      <path d="M52,65 C52,32 128,32 128,65 L126,95 L54,95 Z" fill="#1e1b18" />
      <ellipse cx="90" cy="68" rx="26" ry="30" fill="url(#mcSkinGrad)" />
      <path d="M62,56 C70,40 112,38 122,56 C108,47 78,48 62,56 Z" fill="#171412" />
      <circle cx="80" cy="67" r="2.8" fill="#1c1917" />
      <circle cx="100" cy="67" r="2.8" fill="#1c1917" />
      <path d="M82,81 Q90,87 98,81" stroke="#b91c1c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="81" y="95" width="18" height="16" rx="5" fill="#f5cba7" />
      <path
        d="M38,218 L48,122 C52,110 70,106 90,106 C110,106 128,110 132,122 L142,218 Z"
        fill={`url(#${isBiru ? 'mcBiruGrad' : 'mcLorengGrad'})`}
        stroke={isBiru ? '#7dd3fc' : '#84cc16'}
        strokeWidth="1.5"
      />
      <rect x="102" y="132" width="24" height="10" rx="2" fill="#1c1917" stroke="#facc15" strokeWidth="0.8" />
      <text x="114" y="139.5" textAnchor="middle" fill="#fde047" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
        TNI AU
      </text>
      <rect x="47" y="136" width="12" height="5" fill="#dc2626" />
      <rect x="47" y="141" width="12" height="5" fill="#ffffff" />
    </svg>
  );
};

/**
 * Komponen Papan Pantun & Karakter MC Wanita TNI AU DISKOMLEKAU
 * Panel pantun hanya menampilkan teks Sampiran dan Isi Komando dengan ukuran font sangat besar dan jelas,
 * sementara karakter MC tampil bergantian antara Seragam Biru Langit dan Seragam Loreng di sisi kanan.
 */
export const SmartMcBanner: React.FC = () => {
  const {
    activeMcAnnouncement,
    isSmartMcVisible,
    isMcSpeaking,
    isTvMode,
  } = useKaraoke();

  const [imgStage, setImgStage] = useState<'dataurl' | 'public' | 'svg'>('dataurl');
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const uniform: McUniformType = activeMcAnnouncement?.mcUniform === 'biru' ? 'biru' : 'loreng';

  useEffect(() => {
    setImgStage('dataurl');
  }, [activeMcAnnouncement?.id, uniform]);

  if (!isSmartMcVisible || !activeMcAnnouncement) return null;

  const { pantunLines } = activeMcAnnouncement;

  const sampiran1 = (activeMcAnnouncement.sampiran && activeMcAnnouncement.sampiran[0]) || pantunLines[0] || '';
  const sampiran2 = (activeMcAnnouncement.sampiran && activeMcAnnouncement.sampiran[1]) || pantunLines[1] || '';
  const isi1 = (activeMcAnnouncement.isi && activeMcAnnouncement.isi[0]) || pantunLines[2] || '';
  const isi2 = (activeMcAnnouncement.isi && activeMcAnnouncement.isi[1]) || pantunLines[3] || '';

  const isBiruUniform = uniform === 'biru';
  const dataUrlSrc = isBiruUniform ? MC_WANITA_TNI_AU_BIRU_DATA_URL : MC_WANITA_TNI_AU_LORENG_DATA_URL;
  const publicFallbackSrc = isBiruUniform ? '/images/mc-wanita-tniau-biru.png' : '/images/mc-wanita-tniau.png';
  const mcLabelText = isBiruUniform ? 'MC BIRU LANGIT • ON AIR' : 'MC LORENG • ON AIR';

  const isSmallMobile = viewportWidth < 560;
  const isCompactLayout = viewportWidth < 900;
  const mcWidthPx = isSmallMobile ? 74 : isCompactLayout ? 130 : isTvMode ? 200 : 172;

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Papan Pantun Smart MC Diskomlekau"
      id="smart-mc-tv-card"
      style={
        isTvMode
          ? {
              position: 'fixed',
              bottom: '50px',
              left: '16px',
              right: '276px',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }
          : {
              position: 'fixed',
              bottom: isSmallMobile ? '12px' : '18px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100vw - 24px)',
              maxWidth: '960px',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }
      }
    >
      {/* PANEL PANTUN: Hanya memuat teks Sampiran dan Isi Komando dengan font sangat besar & jelas */}
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          pointerEvents: 'auto',
          backgroundColor: 'rgba(84, 9, 14, 0.96)',
          background:
            'linear-gradient(135deg, rgba(118, 15, 22, 0.97) 0%, rgba(74, 8, 13, 0.97) 58%, rgba(48, 4, 8, 0.98) 100%)',
          border: '2px solid #ef4444',
          borderRadius: '14px',
          boxShadow: '0 12px 34px rgba(0, 0, 0, 0.9)',
          padding: isSmallMobile ? '12px 14px' : isCompactLayout ? '15px 20px' : '16px 34px 16px 26px',
          color: '#ffffff',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
          gap: isSmallMobile ? '7px' : '9px',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        {/* Sampiran Pantun */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <p
            style={{
              margin: 0,
              fontSize: isSmallMobile
                ? 'clamp(18px, 4.8vw, 23px)'
                : isCompactLayout
                ? 'clamp(23px, 3vw, 30px)'
                : 'clamp(27px, 2.65vw, 37px)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.22,
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
            }}
          >
            {sampiran1}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: isSmallMobile
                ? 'clamp(18px, 4.8vw, 23px)'
                : isCompactLayout
                ? 'clamp(23px, 3vw, 30px)'
                : 'clamp(27px, 2.65vw, 37px)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.22,
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
            }}
          >
            {sampiran2}
          </p>
        </div>

        {/* Isi Komando */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <p
            style={{
              margin: 0,
              fontSize: isSmallMobile
                ? 'clamp(20px, 5.4vw, 26px)'
                : isCompactLayout
                ? 'clamp(26px, 3.4vw, 34px)'
                : 'clamp(30px, 2.95vw, 42px)',
              fontWeight: 900,
              color: '#fef08a',
              lineHeight: 1.2,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)',
            }}
          >
            {isi1}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: isSmallMobile
                ? 'clamp(20px, 5.4vw, 26px)'
                : isCompactLayout
                ? 'clamp(26px, 3.4vw, 34px)'
                : 'clamp(30px, 2.95vw, 42px)',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.2,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)',
            }}
          >
            {isi2}
          </p>
        </div>
      </div>

      {/* KARAKTER MC WANITA TNI AU DI SISI KANAN PAPAN PANTUN (BERGANTIAN BIRU LANGIT <-> LORENG) */}
      <div
        style={{
          width: `${mcWidthPx}px`,
          flexShrink: 0,
          marginLeft: isSmallMobile ? '4px' : '-20px',
          marginBottom: '-2px',
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        <div
          className={isMcSpeaking ? 'mc-character-speaking' : 'mc-character-float'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          {imgStage !== 'svg' ? (
            <img
              key={`${activeMcAnnouncement.id}-${uniform}-${imgStage}`}
              src={imgStage === 'dataurl' ? dataUrlSrc : publicFallbackSrc}
              alt={isBiruUniform ? 'MC Wanita TNI AU Seragam Biru Langit' : 'MC Wanita TNI AU Seragam Loreng'}
              onError={() => {
                setImgStage((prev) => (prev === 'dataurl' ? 'public' : 'svg'));
              }}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                filter: isBiruUniform
                  ? 'drop-shadow(0 6px 16px rgba(14, 165, 233, 0.45))'
                  : 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.85))',
                userSelect: 'none',
              }}
            />
          ) : (
            <McWanitaSvgFallback uniform={uniform} />
          )}
        </div>

        {/* Indikator Kecil Status & Seragam MC */}
        <div
          style={{
            marginTop: isSmallMobile ? '-4px' : '-8px',
            position: 'relative',
            zIndex: 3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: isSmallMobile ? '2px 6px' : '3px 9px',
            borderRadius: '9999px',
            backgroundColor: isBiruUniform ? 'rgba(8, 47, 73, 0.96)' : 'rgba(5, 46, 22, 0.96)',
            border: isBiruUniform ? '1.5px solid #38bdf8' : '1.5px solid #4ade80',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.85)',
            color: isBiruUniform ? '#e0f2fe' : '#dcfce7',
            fontSize: isSmallMobile ? '7.5px' : isCompactLayout ? '9px' : '10px',
            fontWeight: 900,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}
        >
          <span
            className={isMcSpeaking ? 'mc-hud-pulse-dot' : undefined}
            style={{
              width: isSmallMobile ? '5px' : '7px',
              height: isSmallMobile ? '5px' : '7px',
              borderRadius: '50%',
              backgroundColor: isBiruUniform ? '#38bdf8' : '#4ade80',
              flexShrink: 0,
            }}
          />
          <span>{mcLabelText}</span>
        </div>
      </div>
    </aside>
  );
};
