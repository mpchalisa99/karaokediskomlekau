import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ScreenReaction } from '../types/karaoke';
import { triggerCheerConfetti } from '../services/cheerConfetti';

interface CheerCharacterOverlayProps {
  reactions: ScreenReaction[];
  /** Mode tampilan: 'tv' untuk layar panggung TV, 'compact' untuk player desktop/mobile */
  variant?: 'tv' | 'compact';
}

/**
 * Mendapatkan nama teks sorak sesuai arahan pengguna:
 * Contoh: "KASIH HORMAT", "SAWER DULU", "TEPUK TANGAN", dsb.
 */
export function getCheerText(type: string, fallbackLabel?: string): string {
  switch (type) {
    case 'hormat':
      return 'KASIH HORMAT';
    case 'sawer':
      return 'SAWER DULU';
    case 'applause':
      return 'TEPUK TANGAN';
    case 'cheer':
      return 'SORAK GEMBIRA';
    case 'boo':
      return 'KASIH HUUU';
    case 'laugh':
      return 'KETAWA NGAKAK';
    case 'airhorn':
      return 'TEROMPET DJ';
    case 'ding':
      return 'LEMPAR KURSI';
    case 'rimshot':
      return 'DRUM ROLL';
    case 'telor':
      return 'LEMPAR TELUR';
    default:
      if (fallbackLabel) {
        return fallbackLabel.replace(/[!✨🎉👏📢😂🔔🥁💸🫡🥚👎🪑].*$/g, '').trim().toUpperCase();
      }
      return type.toUpperCase();
  }
}

/**
 * Konfigurasi palet warna kembang api dan tulisan ultra-transparan
 * (Latar belakang video panggung dan lirik tetap tembus pandang dan terlihat jelas)
 */
function getCheerTheme(type: string): {
  color: string;
  stroke: string;
  glow: string;
  fireworkColors: string[];
} {
  switch (type) {
    case 'sawer':
      return {
        color: 'rgba(251, 191, 36, 0.18)',
        stroke: 'rgba(253, 224, 71, 0.65)',
        glow: 'rgba(245, 158, 11, 0.35)',
        fireworkColors: ['#FDE047', '#FBBF24', '#F59E0B', '#FEF08A', '#FFFBEB'],
      };
    case 'hormat':
      return {
        color: 'rgba(56, 189, 248, 0.18)',
        stroke: 'rgba(125, 211, 252, 0.65)',
        glow: 'rgba(14, 165, 233, 0.35)',
        fireworkColors: ['#38BDF8', '#7DD3FC', '#0284C7', '#BAE6FD', '#F0F9FF'],
      };
    case 'cheer':
      return {
        color: 'rgba(52, 211, 153, 0.18)',
        stroke: 'rgba(110, 231, 183, 0.65)',
        glow: 'rgba(16, 185, 129, 0.35)',
        fireworkColors: ['#34D399', '#6EE7B7', '#10B981', '#A7F3D0', '#ECFDF5'],
      };
    case 'applause':
      return {
        color: 'rgba(250, 204, 21, 0.18)',
        stroke: 'rgba(253, 224, 71, 0.65)',
        glow: 'rgba(234, 179, 8, 0.35)',
        fireworkColors: ['#FACC15', '#F43F5E', '#38BDF8', '#A855F7', '#FFFFFF'],
      };
    case 'boo':
      return {
        color: 'rgba(244, 63, 94, 0.18)',
        stroke: 'rgba(251, 113, 133, 0.65)',
        glow: 'rgba(225, 29, 72, 0.35)',
        fireworkColors: ['#FB7185', '#F43F5E', '#FDA4AF', '#FFE4E6', '#FFFFFF'],
      };
    case 'laugh':
      return {
        color: 'rgba(251, 146, 60, 0.18)',
        stroke: 'rgba(253, 186, 116, 0.65)',
        glow: 'rgba(234, 88, 12, 0.35)',
        fireworkColors: ['#FB923C', '#FDBA74', '#EA580C', '#FED7AA', '#FFF7ED'],
      };
    case 'airhorn':
      return {
        color: 'rgba(168, 85, 247, 0.18)',
        stroke: 'rgba(216, 180, 254, 0.65)',
        glow: 'rgba(147, 51, 234, 0.35)',
        fireworkColors: ['#C084FC', '#A855F7', '#E879F9', '#F0ABFC', '#FAF5FF'],
      };
    case 'telor':
      return {
        color: 'rgba(245, 158, 11, 0.18)',
        stroke: 'rgba(251, 191, 36, 0.65)',
        glow: 'rgba(217, 119, 6, 0.35)',
        fireworkColors: ['#F59E0B', '#FCD34D', '#FBBF24', '#FEF3C7', '#FFFFFF'],
      };
    case 'ding':
      return {
        color: 'rgba(245, 158, 11, 0.22)',
        stroke: 'rgba(251, 191, 36, 0.75)',
        glow: 'rgba(245, 158, 11, 0.45)',
        fireworkColors: ['#F59E0B', '#FBBF24', '#FCD34D', '#F97316', '#FEF3C7'],
      };
    default:
      return {
        color: 'rgba(255, 255, 255, 0.18)',
        stroke: 'rgba(255, 255, 255, 0.65)',
        glow: 'rgba(255, 255, 255, 0.3)',
        fireworkColors: ['#FFFFFF', '#E2E8F0', '#CBD5E1', '#F8FAFC', '#FDE047'],
      };
  }
}

/** Partikel kembang api transparan */
interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
  twinkle: boolean;
}

/** Gelombang cincin ledakan kembang api (shockwave) */
interface FireworkRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

/**
 * CheerCharacterOverlay
 *
 * Sesuai Permintaan User:
 * 1. Tulisan Sorak Sesuai Nama Sorak (contoh: KASIH HORMAT, SAWER DULU).
 * 2. Ukuran Tulisan 5 KALI LEBIH BESAR (monumental skala panggung).
 * 3. Efek Kembang Api saat tulisan muncul.
 * 4. SEMUA TRANSPARAN & TIDAK MENUTUPI LAYAR UTAMA (latar belakang video & lirik tetap terlihat jelas).
 */
export const CheerCharacterOverlay: React.FC<CheerCharacterOverlayProps> = ({
  reactions,
  variant = 'tv',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiInstanceRef = useRef<confetti.CreateTypes | null>(null);
  const particlesRef = useRef<FireworkParticle[]>([]);
  const ringsRef = useRef<FireworkRing[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const knownReactionIdsRef = useRef<Set<string>>(new Set());

  // Inisialisasi canvas-confetti instance pada canvas lokal saat elemen siap
  useEffect(() => {
    if (canvasRef.current && !confettiInstanceRef.current) {
      try {
        confettiInstanceRef.current = confetti.create(canvasRef.current, {
          resize: true,
          useWorker: false,
        });
      } catch (err) {
        console.warn('Inisialisasi canvas-confetti lokal gagal, fallback ke global:', err);
      }
    }
  }, []);

  // Fungsi memicu ledakan kembang api canvas-confetti di sekitar teks sorak
  const triggerFireworkBurst = (type: string) => {
    // 1. Picu animasi kembang api canvas-confetti yang sangat transparan dan ringan di sekitar teks sorak
    triggerCheerConfetti(confettiInstanceRef.current, type, {
      origin: { x: 0.5, y: variant === 'tv' ? 0.38 : 0.42 },
      scalar: variant === 'tv' ? 0.8 : 0.72,
      particleCount: variant === 'tv' ? 26 : 22,
      mode: 'surround',
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    const theme = getCheerTheme(type);
    const colors = theme.fireworkColors;

    // 4 titik semburan kembang api di sekitar teks sorak (kiri, tengah atas, kanan, tengah bawah)
    const burstCenters = [
      { x: width * 0.28, y: height * 0.38 },
      { x: width * 0.5, y: height * 0.28 },
      { x: width * 0.72, y: height * 0.38 },
      { x: width * 0.5, y: height * 0.5 },
    ];

    burstCenters.forEach((center, cIdx) => {
      // Ring shockwave transparan
      ringsRef.current.push({
        x: center.x,
        y: center.y,
        radius: 6,
        maxRadius: 100 + Math.random() * 50,
        alpha: 0.55,
        color: colors[cIdx % colors.length],
      });

      // Partikel kembang api memancar radial
      const particleCount = variant === 'tv' ? 36 : 24;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
        const speed = 2.5 + Math.random() * 6.5;
        const color = colors[Math.floor(Math.random() * colors.length)];

        particlesRef.current.push({
          x: center.x,
          y: center.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8, // dorongan sedikit ke atas
          alpha: 0.85,
          decay: 0.012 + Math.random() * 0.016, // bertahan ~1.8 - 2.5 detik
          color,
          size: 2.2 + Math.random() * 2.6,
          trail: [],
          twinkle: Math.random() > 0.4,
        });
      }
    });

    // Mulai loop animasi jika belum berjalan
    if (!animFrameRef.current) {
      startAnimationLoop();
    }
  };

  // Loop rendering canvas kembang api (60 FPS, ultra-transparan, non-blocking)
  const startAnimationLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Bersihkan canvas secara transparan penuh agar layar video di belakangnya 100% terlihat
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const hasParticles = particlesRef.current.length > 0;
      const hasRings = ringsRef.current.length > 0;

      if (!hasParticles && !hasRings) {
        animFrameRef.current = null;
        return; // Hentikan loop saat tidak ada partikel aktif (hemat CPU/GPU)
      }

      // 1. Gambar cincin ledakan kembang api (shockwaves)
      for (let i = ringsRef.current.length - 1; i >= 0; i--) {
        const ring = ringsRef.current[i];
        ring.radius += 4;
        ring.alpha -= 0.022;

        if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
          ringsRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = Math.max(0, ring.alpha * 0.6); // tetap sangat transparan
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      }

      // 2. Gambar partikel kembang api
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];

        // Simpan jejak ekor partikel
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 4) {
          p.trail.shift();
        }

        // Fisika partikel: gerak, hambatan udara, sedikit gravitasi halus
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.975;
        p.vy *= 0.975;
        p.vy += 0.045; // gravitasi halus seperti kembang api asli
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        // Gambar jejak ekor
        if (p.trail.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha * 0.4);
          ctx.lineWidth = p.size * 0.6;
          ctx.stroke();
          ctx.restore();
        }

        // Gambar titik partikel berkilau
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        const currentAlpha = p.twinkle && Math.random() > 0.5 ? p.alpha * 0.5 : p.alpha;
        ctx.globalAlpha = Math.max(0, Math.min(0.85, currentAlpha));
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
  };

  // Sesuaikan ukuran resolusi canvas dengan kontainer layar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth || window.innerWidth;
        canvas.height = parent.clientHeight || window.innerHeight;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Deteksi reaksi sorak baru dan picu efek kembang api
  useEffect(() => {
    if (!reactions || reactions.length === 0) return;

    reactions.forEach((rx) => {
      if (!knownReactionIdsRef.current.has(rx.id)) {
        knownReactionIdsRef.current.add(rx.id);
        triggerFireworkBurst(rx.type);
      }
    });

    // Batasi ukuran set cache ID
    if (knownReactionIdsRef.current.size > 50) {
      const recentIds = new Set(reactions.map((r) => r.id));
      knownReactionIdsRef.current = recentIds;
    }
  }, [reactions]);

  if (!reactions || reactions.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-20 flex items-center justify-center select-none"
      aria-hidden="true"
    >
      {/* Canvas Efek Kembang Api (Transparan Penuh, Latar Belakang Video & Lirik Tetap Jelas) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10 w-full h-full"
        style={{ mixBlendMode: 'screen', opacity: 0.72 }}
      />

      {/* Render Tulisan Sorak Sesuai Nama Sorak (5 Kali Lebih Besar & Ultra Transparan) */}
      {reactions.slice(-2).map((rx, idx, arr) => {
        const cheerTitle = getCheerText(rx.type, rx.label);
        const theme = getCheerTheme(rx.type);

        // Posisi tengah atas (agar lirik karaoke di bagian bawah tidak tertutup)
        const offsetIndex = idx - (arr.length - 1); // 0 untuk yang terbaru, -1 untuk sebelumnya
        const topPercent = 42 + offsetIndex * 14;

        // Ukuran 5 KALI LEBIH BESAR:
        // Variant TV: rentang 6rem hingga 22rem (~240px - 350px di TV/layar lebar)
        // Variant Compact: rentang 4rem hingga 14rem (~140px - 220px)
        const fontSizeClamp =
          variant === 'tv'
            ? 'clamp(5.5rem, 17vw, 24rem)'
            : 'clamp(3.8rem, 13vw, 15rem)';

        const strokeWidth = variant === 'tv' ? '3.2px' : '2.2px';

        return (
          <div
            key={rx.id}
            className="absolute left-1/2 animate-cheer-text-pop select-none pointer-events-none text-center max-w-[96vw] px-4"
            style={{
              top: `${topPercent}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 25 + idx,
            }}
          >
            {/* Sparkle Ring visual tambahan di balik teks saat meletup */}
            <div
              className="absolute inset-0 -m-8 pointer-events-none -z-10 rounded-full animate-ping opacity-25"
              style={{
                background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
                animationDuration: '1.2s',
              }}
            />

            {/* Tulisan Besar yang Sangat Transparan - Tembus Pandang Penuh */}
            <h2
              className="font-black uppercase tracking-wider leading-none transition-all duration-300 drop-shadow-sm"
              style={{
                fontSize: fontSizeClamp,
                color: theme.color,
                WebkitTextStroke: `${strokeWidth} ${theme.stroke}`,
                textShadow: `0 0 35px ${theme.glow}, 0 0 75px ${theme.glow}, 0 2px 10px rgba(0, 0, 0, 0.45)`,
                fontFamily: 'var(--font-display, system-ui, -apple-system, sans-serif)',
                letterSpacing: '0.06em',
                lineHeight: 0.95,
              }}
            >
              {cheerTitle}
            </h2>
          </div>
        );
      })}
    </div>
  );
};
