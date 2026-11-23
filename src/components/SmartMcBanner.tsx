import React from 'react';
import { Mic, Volume2, RefreshCw, X, Radio } from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';

export const SmartMcBanner: React.FC = () => {
  const {
    activeMcAnnouncement,
    isMcSpeaking,
    isPlaying,
    isPlayerEnded,
    triggerSmartMc,
    replaySmartMcSpeech,
    dismissSmartMc,
  } = useKaraoke();

  if (!activeMcAnnouncement) return null;
  // Larangan Mutlak di Tengah Lagu: Sembunyikan Smart MC otomatis selama lagu sedang diputar (status bukan ENDED)
  if (isPlaying && !isPlayerEnded && !activeMcAnnouncement.isManual) return null;

  const { badge, pantunLines, commentary, singerName, songTitle, score, tier, nextSongTitle } =
    activeMcAnnouncement;

  const tierBorderHex =
    tier === 'high' ? '#34d399' : tier === 'low' ? '#fb7185' : '#fbbf24';

  const tierBadgeBgHex =
    tier === 'high'
      ? 'rgba(16, 185, 129, 0.22)'
      : tier === 'low'
      ? 'rgba(244, 63, 94, 0.22)'
      : 'rgba(251, 191, 36, 0.22)';

  const tierBadgeTextHex =
    tier === 'high' ? '#a7f3d0' : tier === 'low' ? '#fecdd3' : '#fde68a';

  return (
    <aside
      role="region"
      aria-label="Smart MC Diskomlekau Pantun Banner"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80%',
        maxWidth: '820px',
        zIndex: 1000005,
        overflow: 'hidden',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        border: `2px solid ${tierBorderHex}`,
        borderRadius: '14px',
        padding: '12px 18px',
        color: '#ffffff',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}
    >
      {/* Top Bar: Identity, Tier Badge & Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          paddingBottom: '8px',
          marginBottom: '8px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
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
          <div
            style={{
              position: 'relative',
              display: 'flex',
              height: '34px',
              width: '34px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              backgroundColor: '#f59e0b',
              color: '#020617',
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            <Mic style={{ width: '18px', height: '18px' }} />
            {isMcSpeaking && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '1.5px solid #ffffff',
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
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#fcd34d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Radio
                  style={{
                    width: '14px',
                    height: '14px',
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
                  backgroundColor: tierBadgeBgHex,
                  color: tierBadgeTextHex,
                  border: `1px solid ${tierBorderHex}`,
                }}
              >
                {badge}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: '#bae6fd',
                fontFamily: 'monospace',
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span>
                Vokalis: <strong style={{ color: '#fcd34d' }}>{singerName}</strong>
              </span>
              <span>|</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Lagu: <strong style={{ color: '#ffffff' }}>{songTitle}</strong>
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

        {/* Action Buttons */}
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
            onClick={() => replaySmartMcSpeech()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 800,
              border: '1px solid #38bdf8',
              cursor: 'pointer',
            }}
            title="Bacakan ulang pantun dengan suara Bahasa Indonesia"
          >
            <Volume2 style={{ width: '13px', height: '13px' }} />
            <span>Suara</span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerSmartMc({
                singerName,
                songTitle,
                score,
                forceTier: tier,
                isManual: Boolean(activeMcAnnouncement.isManual),
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
              backgroundColor: '#f59e0b',
              color: '#020617',
              fontSize: '11px',
              fontWeight: 900,
              border: '1px solid #fcd34d',
              cursor: 'pointer',
            }}
            title="Ganti pantun MC berikutnya"
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
              justifyContent: 'center',
              height: '28px',
              width: '28px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #475569',
              cursor: 'pointer',
            }}
            title="Tutup Smart MC"
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>

      {/* Pantun 4 Baris (Sampiran & Isi) - Flexbox sederhana agar kompatibel penuh di Tizen OS */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '10px',
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          borderRadius: '10px',
          padding: '10px 12px',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: '1 1 260px',
            minWidth: 0,
            textAlign: 'left',
            paddingRight: '8px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#38bdf8',
              marginBottom: '3px',
            }}
          >
            SAMPIRAN PANTUN:
          </div>
          <p
            style={{
              margin: '0 0 2px 0',
              fontSize: '13px',
              fontWeight: 700,
              color: '#e2e8f0',
              fontStyle: 'italic',
              lineHeight: 1.35,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{pantunLines[0]}&rdquo;
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 700,
              color: '#e2e8f0',
              fontStyle: 'italic',
              lineHeight: 1.35,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{pantunLines[1]}&rdquo;
          </p>
        </div>

        <div
          style={{
            flex: '1 1 260px',
            minWidth: 0,
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#fcd34d',
              marginBottom: '3px',
            }}
          >
            ISI KOMANDO:
          </div>
          <p
            style={{
              margin: '0 0 2px 0',
              fontSize: '14px',
              fontWeight: 900,
              color: '#fcd34d',
              lineHeight: 1.35,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{pantunLines[2]}&rdquo;
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 900,
              color: '#fef08a',
              lineHeight: 1.35,
              wordWrap: 'break-word',
            }}
          >
            &ldquo;{pantunLines[3]}&rdquo;
          </p>
        </div>
      </div>

      {/* Komentar MC Militer TNI AU / Korps Elektronika */}
      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          textAlign: 'left',
          backgroundColor: 'rgba(8, 47, 73, 0.65)',
          borderRadius: '10px',
          padding: '7px 12px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 900,
            color: '#6ee7b7',
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
            lineHeight: 1.4,
            wordWrap: 'break-word',
          }}
        >
          {commentary}
        </p>
      </div>
    </aside>
  );
};
