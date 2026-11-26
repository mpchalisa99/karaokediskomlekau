import React from 'react';
import { Mic, Volume2, RefreshCw, X, Radio } from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';

/**
 * Komponen Popup Kartu SMART MC DISKOMLEKAU
 * Dioptimalkan untuk kompatibilitas penuh dan keterbacaan tinggi di browser Smart TV Android 13
 * dan Samsung Tizen OS (Solid Background rgba(10, 15, 28, 0.96), Border tegas 2px solid #eab308, z-index 99999).
 */
export const SmartMcBanner: React.FC = () => {
  const {
    activeMcAnnouncement,
    isSmartMcVisible,
    isMcSpeaking,
    triggerSmartMc,
    replaySmartMcSpeech,
    dismissSmartMc,
  } = useKaraoke();

  if (!isSmartMcVisible || !activeMcAnnouncement) return null;

  const {
    badge,
    pantunLines,
    commentary,
    komentar,
    singerName,
    namaVokalis,
    songTitle,
    judulLagu,
    score,
    tier,
    nextSongTitle,
  } = activeMcAnnouncement;

  const displaySinger = namaVokalis || singerName || 'Prajurit Diskomlekau';
  const displaySong = judulLagu || songTitle || 'Lagu Pilihan';
  const displayCommentary = komentar || commentary || '';

  const sampiran1 = (activeMcAnnouncement.sampiran && activeMcAnnouncement.sampiran[0]) || pantunLines[0] || '';
  const sampiran2 = (activeMcAnnouncement.sampiran && activeMcAnnouncement.sampiran[1]) || pantunLines[1] || '';
  const isi1 = (activeMcAnnouncement.isi && activeMcAnnouncement.isi[0]) || pantunLines[2] || '';
  const isi2 = (activeMcAnnouncement.isi && activeMcAnnouncement.isi[1]) || pantunLines[3] || '';

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Smart MC Diskomlekau Pantun Card"
      id="smart-mc-tv-card"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '85%',
        maxWidth: '860px',
        zIndex: 99999,
        overflow: 'hidden',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        backgroundColor: 'rgba(10, 15, 28, 0.96)',
        border: '2px solid #eab308',
        borderRadius: '16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(234, 179, 8, 0.35)',
        padding: '14px 18px',
        color: '#ffffff',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Baris Atas: Identitas MC, Vokalis, Lagu & Tombol Kontrol */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(234, 179, 8, 0.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: 0,
            flex: '1 1 auto',
          }}
        >
          {/* Icon Mic dengan Indikator Suara Aktif */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              height: '36px',
              width: '36px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              backgroundColor: '#eab308',
              color: '#020617',
              fontWeight: 900,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(234, 179, 8, 0.4)',
            }}
          >
            <Mic style={{ width: '20px', height: '20px' }} />
            {isMcSpeaking && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '2px solid #ffffff',
                }}
              />
            )}
          </div>

          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#facc15',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Radio
                  style={{
                    width: '15px',
                    height: '15px',
                    color: isMcSpeaking ? '#34d399' : '#38bdf8',
                  }}
                />
                <span>SMART MC DISKOMLEKAU</span>
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  color: '#fef08a',
                  border: '1px solid #eab308',
                }}
              >
                {badge}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                  marginLeft: 'auto',
                }}
              >
                Auto-tutup 10s • Remote [OK / Back]
              </span>
            </div>

            {/* Nama Vokalis & Judul Lagu */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#bae6fd',
                fontFamily: 'monospace',
                marginTop: '3px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span>
                Vokalis: <strong style={{ color: '#fde047' }}>{displaySinger}</strong>
              </span>
              <span>|</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Lagu: <strong style={{ color: '#ffffff' }}>{displaySong}</strong>
              </span>
              {typeof score === 'number' && (
                <>
                  <span>|</span>
                  <span>
                    Skor: <strong style={{ color: '#6ee7b7' }}>{score}/100</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tombol Aksi Smart MC */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          {nextSongTitle && (
            <button
              type="button"
              onClick={() => dismissSmartMc()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 900,
                border: '1px solid #34d399',
                cursor: 'pointer',
              }}
              title={`Putar lagu berikutnya: ${nextSongTitle}`}
            >
              <span>Lanjut Lagu</span>
            </button>
          )}

          <button
            type="button"
            disabled={isMcSpeaking}
            onClick={() => replaySmartMcSpeech()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '8px',
              backgroundColor: isMcSpeaking ? '#0369a1' : '#0284c7',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800,
              border: '1px solid #38bdf8',
              cursor: isMcSpeaking ? 'not-allowed' : 'pointer',
              opacity: isMcSpeaking ? 0.55 : 1,
            }}
            title={isMcSpeaking ? 'Tunggu pantun MC selesai dibacakan' : 'Bacakan ulang pantun'}
          >
            <Volume2 style={{ width: '13px', height: '13px' }} />
            <span>{isMcSpeaking ? 'Berbicara...' : 'Suara'}</span>
          </button>

          <button
            type="button"
            disabled={isMcSpeaking}
            onClick={() =>
              triggerSmartMc({
                singerName: displaySinger,
                songTitle: displaySong,
                score,
                forceTier: tier,
                isManual: true,
                nextSongTitle,
                broadcast: true,
              })
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '8px',
              backgroundColor: isMcSpeaking ? '#b45309' : '#eab308',
              color: '#020617',
              fontSize: '11px',
              fontWeight: 900,
              border: '1px solid #fde047',
              cursor: isMcSpeaking ? 'not-allowed' : 'pointer',
              opacity: isMcSpeaking ? 0.55 : 1,
            }}
            title={isMcSpeaking ? 'Tunggu pantun pertama selesai dulu' : 'Ganti pantun MC berikutnya'}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            <span>Pantun Lain</span>
          </button>

          <button
            type="button"
            onClick={() => dismissSmartMc()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              fontSize: '11px',
              fontWeight: 800,
              border: '1px solid #64748b',
              cursor: 'pointer',
            }}
            title="Tutup Smart MC (Tombol OK / Back pada Remote TV)"
          >
            <X style={{ width: '13px', height: '13px' }} />
            <span>Tutup (OK)</span>
          </button>
        </div>
      </div>

      {/* Bagian Pantun 4 Baris: SAMPIRAN PANTUN & ISI KOMANDO */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#040916',
          borderRadius: '12px',
          padding: '12px 14px',
          border: '1px solid rgba(234, 179, 8, 0.4)',
          boxSizing: 'border-box',
        }}
      >
        {/* SAMPIRAN PANTUN (2 Baris Pertama) */}
        <div
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#38bdf8',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>📜</span>
            <span>SAMPIRAN PANTUN:</span>
          </div>
          <p
            style={{
              margin: '0 0 3px 0',
              fontSize: '14px',
              fontWeight: 700,
              color: '#e2e8f0',
              fontStyle: 'italic',
              lineHeight: 1.4,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{sampiran1}&rdquo;
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 700,
              color: '#e2e8f0',
              fontStyle: 'italic',
              lineHeight: 1.4,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{sampiran2}&rdquo;
          </p>
        </div>

        {/* ISI KOMANDO (2 Baris Penutup Pantun) */}
        <div
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#eab308',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>⚡</span>
            <span>ISI KOMANDO:</span>
          </div>
          <p
            style={{
              margin: '0 0 3px 0',
              fontSize: '15px',
              fontWeight: 900,
              color: '#facc15',
              lineHeight: 1.4,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{isi1}&rdquo;
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 900,
              color: '#fef08a',
              lineHeight: 1.4,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{isi2}&rdquo;
          </p>
        </div>
      </div>

      {/* Bagian KOMENTAR MC DISKOMLEKAU */}
      {Boolean(displayCommentary && displayCommentary.trim()) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            textAlign: 'left',
            backgroundColor: '#07162c',
            borderRadius: '10px',
            padding: '8px 12px',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 900,
              color: '#34d399',
              flexShrink: 0,
              fontFamily: 'monospace',
            }}
          >
            [KOMENTAR MC]:
          </span>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              fontWeight: 700,
              color: '#e0f2fe',
              lineHeight: 1.45,
              wordWrap: 'break-word',
            }}
          >
            {displayCommentary}
          </p>
        </div>
      )}
    </aside>
  );
};
