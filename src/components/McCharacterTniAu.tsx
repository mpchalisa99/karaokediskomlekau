import React from 'react';

interface McCharacterTniAuProps {
  isSpeaking: boolean;
  compact?: boolean;
}

/**
 * Karakter MC Wanita TNI AU berseragam Biru Langit (PDH/PDU TNI AU)
 * Dibangun dengan SVG inline beresolusi vektor penuh agar:
 * - Tidak pernah gagal load di Smart TV Samsung Tizen OS, Android 13, PC, maupun HP
 * - Latar belakang 100% transparan sehingga menyatu mulus di samping Papan Pantun
 * - Animasi ringan hanya menggunakan transform (GPU compositor friendly)
 */
export const McCharacterTniAu: React.FC<McCharacterTniAuProps> = ({
  isSpeaking,
  compact = false,
}) => {
  return (
    <div
      className={`mc-tni-au-wrapper ${isSpeaking ? 'mc-tni-au-speaking' : 'mc-tni-au-idle'}`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: compact ? 'clamp(96px, 14vw, 148px)' : 'clamp(124px, 15.5vw, 204px)',
        flexShrink: 0,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {/* Aura Cahaya Biru Langit Lembut di Belakang Karakter (Tanpa backdrop-filter/blur berat) */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '86%',
          height: '82%',
          borderRadius: '50%',
          background: isSpeaking
            ? 'radial-gradient(circle, rgba(56, 189, 248, 0.34) 0%, rgba(14, 165, 233, 0.12) 55%, transparent 78%)'
            : 'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />

      {/* Ilustrasi Vektor MC Wanita TNI AU Berseragam Biru Langit */}
      <svg
        viewBox="0 0 220 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          position: 'relative',
          zIndex: 2,
          filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.72))',
        }}
      >
        <defs>
          {/* Gradasi Seragam Biru Langit TNI AU */}
          <linearGradient id="tniAuSkyJacket" x1="110" y1="108" x2="110" y2="275" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60c5f7" />
            <stop offset="48%" stopColor="#38a9e6" />
            <stop offset="100%" stopColor="#1b79b8" />
          </linearGradient>
          <linearGradient id="tniAuSkySleeve" x1="0" y1="115" x2="0" y2="245" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5cc2f5" />
            <stop offset="100%" stopColor="#1d7cb9" />
          </linearGradient>
          <linearGradient id="tniAuLapel" x1="110" y1="112" x2="110" y2="176" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          {/* Warna Kulit Hangat Natural */}
          <linearGradient id="mcSkinTone" x1="110" y1="36" x2="110" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde0cc" />
            <stop offset="100%" stopColor="#f3bda0" />
          </linearGradient>
          {/* Rambut Bob Gelap Rapi */}
          <linearGradient id="mcHairDark" x1="110" y1="14" x2="110" y2="105" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#090f1d" />
          </linearGradient>
          {/* Emas Brevet & Pangkat */}
          <linearGradient id="goldInsignia" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
        </defs>

        {/* Rambut Belakang */}
        <path
          d="M66 56C63 82 65 106 74 114H146C155 106 157 82 154 56C150 28 133 18 110 18C87 18 70 28 66 56Z"
          fill="#0b1222"
        />

        {/* Leher */}
        <path d="M97 98H123V122C123 128 97 128 97 122V98Z" fill="#e8ae8e" />
        <path d="M97 104C104 109 116 109 123 104V99H97V104Z" fill="#d99a78" opacity="0.6" />

        {/* Kemeja Dalam Biru Muda & Dasi TNI AU */}
        <path d="M89 116L110 174L131 116H89Z" fill="#bae6fd" />
        <path d="M94 116L110 129L126 116H94Z" fill="#e0f2fe" />
        {/* Dasi Gelap */}
        <path d="M105 125H115L113 134H107L105 125Z" fill="#0f294a" />
        <path d="M107 134H113L115 169L110 176L105 169L107 134Z" fill="#102a4e" />

        {/* Badan Jas Seragam Biru Langit TNI AU */}
        <path
          d="M52 130C55 119 67 113 84 111L110 176L136 111C153 113 165 119 168 130L178 198L165 274H55L42 198L52 130Z"
          fill="url(#tniAuSkyJacket)"
          stroke="#0e5b8f"
          strokeWidth="1.6"
        />

        {/* Garis Jahitan Pinggang & Saku */}
        <path d="M77 180L72 268" stroke="#16679e" strokeWidth="1.3" opacity="0.55" />
        <path d="M143 180L148 268" stroke="#16679e" strokeWidth="1.3" opacity="0.55" />
        <path d="M110 176V274" stroke="#13598a" strokeWidth="1.6" opacity="0.7" />

        {/* Kerah Jas (Lapels) Biru Langit Terang */}
        <path d="M84 111L67 133L86 144L78 153L110 178L94 115L84 111Z" fill="url(#tniAuLapel)" stroke="#1b79b8" strokeWidth="1.2" />
        <path d="M136 111L153 133L134 144L142 153L110 178L126 115L136 111Z" fill="url(#tniAuLapel)" stroke="#1b79b8" strokeWidth="1.2" />

        {/* Kancing Emas Jas Tengah */}
        <circle cx="110" cy="190" r="3.8" fill="url(#goldInsignia)" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="110" cy="215" r="3.8" fill="url(#goldInsignia)" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="110" cy="240" r="3.8" fill="url(#goldInsignia)" stroke="#92400e" strokeWidth="0.8" />

        {/* Pangkat Bahu (Epaulettes) Biru Tua + Balok Emas */}
        <g>
          <path d="M55 120L80 112L82 121L56 128L55 120Z" fill="#0c2544" stroke="#facc15" strokeWidth="1" />
          <rect x="61" y="118" width="4" height="7" rx="1" transform="rotate(-14 61 118)" fill="#facc15" />
          <rect x="68" y="116" width="4" height="7" rx="1" transform="rotate(-14 68 116)" fill="#facc15" />
          <circle cx="77" cy="117" r="2" fill="#fef08a" />

          <path d="M165 120L140 112L138 121L164 128L165 120Z" fill="#0c2544" stroke="#facc15" strokeWidth="1" />
          <rect x="155" y="118" width="4" height="7" rx="1" transform="rotate(14 155 118)" fill="#facc15" />
          <rect x="148" y="116" width="4" height="7" rx="1" transform="rotate(14 148 116)" fill="#facc15" />
          <circle cx="143" cy="117" r="2" fill="#fef08a" />
        </g>

        {/* Papan Nama Dada Kanan (Sisi Kiri Viewer) */}
        <rect x="65" y="160" width="26" height="8" rx="1.5" fill="#0b172a" stroke="#e2e8f0" strokeWidth="0.9" />
        <rect x="68" y="163" width="20" height="2" rx="1" fill="#f8fafc" />

        {/* Brevet Sayap TNI AU & Pita Jasa Dada Kiri (Sisi Kanan Viewer) */}
        <g transform="translate(128, 144)">
          {/* Wing Emas TNI AU */}
          <path d="M0 6L11 3L14 0L17 3L28 6L23 9L14 11L5 9L0 6Z" fill="url(#goldInsignia)" stroke="#78350f" strokeWidth="0.6" />
          <circle cx="14" cy="6" r="2.3" fill="#fef08a" stroke="#78350f" strokeWidth="0.6" />
        </g>
        {/* Pita Jasa */}
        <g transform="translate(129, 158)">
          <rect x="0" y="0" width="26" height="6" rx="1" fill="#1e3a8a" stroke="#0f172a" strokeWidth="0.6" />
          <rect x="4" y="0.5" width="4" height="5" fill="#dc2626" />
          <rect x="11" y="0.5" width="4" height="5" fill="#facc15" />
          <rect x="18" y="0.5" width="4" height="5" fill="#38bdf8" />
        </g>

        {/* Saku Dada Bawah */}
        <rect x="62" y="176" width="32" height="19" rx="2.5" fill="#2c96d4" stroke="#156396" strokeWidth="1" />
        <path d="M62 178L78 184L94 178" stroke="#156396" strokeWidth="1" fill="#4cb5ef" />
        <rect x="126" y="176" width="32" height="19" rx="2.5" fill="#2c96d4" stroke="#156396" strokeWidth="1" />
        <path d="M126 178L142 184L158 178" stroke="#156396" strokeWidth="1" fill="#4cb5ef" />

        {/* Lengan Kanan MC (Lurus ke bawah di sisi kanan layar) */}
        <path
          d="M166 126C177 132 183 148 186 178L192 246L171 250L164 186L158 148L166 126Z"
          fill="url(#tniAuSkySleeve)"
          stroke="#0e5b8f"
          strokeWidth="1.5"
        />
        {/* Patch Bendera di Lengan */}
        <rect x="169" y="148" width="11" height="7" rx="1" transform="rotate(6 169 148)" fill="#dc2626" stroke="#facc15" strokeWidth="0.6" />
        <rect x="168.5" y="151.5" width="11" height="3.5" rx="0.5" transform="rotate(6 168.5 151.5)" fill="#ffffff" />

        {/* Lengan Kiri MC Menunjuk ke Papan Pantun */}
        <g className={isSpeaking ? 'mc-hand-gesture-speaking' : 'mc-hand-gesture-idle'}>
          <path
            d="M54 128C40 137 33 158 37 181C40 194 49 197 65 190L94 174L87 159L62 171C56 164 56 150 61 138L54 128Z"
            fill="url(#tniAuSkySleeve)"
            stroke="#0e5b8f"
            strokeWidth="1.5"
          />
          {/* Tangan Menunjuk Elegan */}
          <path
            d="M90 160L109 156C112 155.5 113.5 158 111 160L99 164C103 165 104 168 100 169L94 171C96 173 94 175 90 175L84 173L87 161L90 160Z"
            fill="url(#mcSkinTone)"
            stroke="#d49372"
            strokeWidth="0.9"
          />
        </g>

        {/* Kepala & Wajah Ramah Profesional */}
        <path
          d="M77 58C77 36 91 25 110 25C129 25 143 36 143 58C143 81 132 103 110 105C88 103 77 81 77 58Z"
          fill="url(#mcSkinTone)"
        />
        {/* Rona Pipi Lembut */}
        <ellipse cx="90" cy="78" rx="6.5" ry="3.5" fill="#f48b7b" opacity="0.28" />
        <ellipse cx="130" cy="78" rx="6.5" ry="3.5" fill="#f48b7b" opacity="0.28" />

        {/* Mata & Alis Ekspresif */}
        <path d="M86 58C91 54.5 98 54.5 102 57" stroke="#1e293b" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M118 57C122 54.5 129 54.5 134 58" stroke="#1e293b" strokeWidth="2.4" strokeLinecap="round" />

        {/* Mata Kiri */}
        <ellipse cx="94" cy="65" rx="6.5" ry="4.8" fill="#ffffff" />
        <circle cx="95" cy="65" r="3.7" fill="#1e1b18" />
        <circle cx="96.5" cy="63.6" r="1.2" fill="#ffffff" />
        <path d="M87.5 64C90.5 60.5 97.5 60.5 100.5 63.5" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />

        {/* Mata Kanan */}
        <ellipse cx="126" cy="65" rx="6.5" ry="4.8" fill="#ffffff" />
        <circle cx="125" cy="65" r="3.7" fill="#1e1b18" />
        <circle cx="126.5" cy="63.6" r="1.2" fill="#ffffff" />
        <path d="M119.5 63.5C122.5 60.5 129.5 60.5 132.5 64" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />

        {/* Hidung Halus */}
        <path d="M110 66V77C110 78.8 112.5 79.5 113.5 79" stroke="#d49372" strokeWidth="1.6" strokeLinecap="round" />

        {/* Senyum / Mulut Berbicara */}
        {isSpeaking ? (
          <g>
            <path
              d="M99 86C104 92 116 92 121 86C117 85 103 85 99 86Z"
              fill="#9f1239"
              stroke="#be123c"
              strokeWidth="1.2"
            />
            <path d="M102 86.2H118" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ) : (
          <path
            d="M100 86C105 90.5 115 90.5 120 86"
            stroke="#be4c56"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        )}

        {/* Anting Mutiara Kecil */}
        <circle cx="77" cy="76" r="2.4" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.6" />
        <circle cx="143" cy="76" r="2.4" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.6" />

        {/* Rambut Depan / Poni Samping (Bob Rapi TNI AU) */}
        <path
          d="M66 56C66 28 84 14 110 14C136 14 154 28 154 56C155 76 151 98 143 107C143 91 144 68 139 50C132 39 119 34 103 38C91 41 81 51 77 65C75 79 76 96 77 107C69 98 65 76 66 56Z"
          fill="url(#mcHairDark)"
        />
        {/* Kilau Rambut Halus */}
        <path d="M84 28C96 22 116 21 131 27" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

        {/* Headset / Clip Mic MC Profesional di Pipi Kiri */}
        <path d="M142 74C142 83 132 88 122 87" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="121" cy="87" r="2.3" fill="#38bdf8" stroke="#0f172a" strokeWidth="0.8" />
      </svg>

      {/* Badge & Gelombang Suara MC Aktif di Bagian Bawah Karakter */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          marginTop: '-10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 10px',
          borderRadius: '8px',
          backgroundColor: isSpeaking ? 'rgba(6, 78, 59, 0.96)' : 'rgba(15, 23, 42, 0.96)',
          border: isSpeaking ? '1.5px solid #34d399' : '1.5px solid #38bdf8',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: isSpeaking ? '#34d399' : '#38bdf8',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontSize: 'clamp(9px, 0.95vw, 11px)',
            fontWeight: 900,
            fontFamily: 'monospace',
            letterSpacing: '0.06em',
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          {isSpeaking ? 'MC ON AIR' : 'MC TNI AU'}
        </span>
        {isSpeaking && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              height: '12px',
            }}
          >
            <span className="mc-wave-bar mc-wave-bar-1" />
            <span className="mc-wave-bar mc-wave-bar-2" />
            <span className="mc-wave-bar mc-wave-bar-3" />
          </span>
        )}
      </div>
    </div>
  );
};
