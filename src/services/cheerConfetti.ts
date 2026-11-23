import confetti from 'canvas-confetti';

/**
 * Palet warna kembang api canvas-confetti sesuai tipe sorak
 * Disesuaikan agar cerah, berkilau, dan ringan (party fireworks)
 */
export function getCheerFireworkColors(type: string): string[] {
  switch (type) {
    case 'sawer': // SAWER DULU (Emas & Kuning Kemilau)
      return ['#FDE047', '#FBBF24', '#F59E0B', '#FEF08A', '#FFFBEB'];
    case 'hormat': // KASIH HORMAT (Biru Langit & Cyan Komando)
      return ['#38BDF8', '#7DD3FC', '#0284C7', '#BAE6FD', '#F0F9FF'];
    case 'cheer': // SORAK GEMBIRA (Hijau Mint & Zamrud)
      return ['#34D399', '#6EE7B7', '#10B981', '#A7F3D0', '#ECFDF5'];
    case 'applause': // TEPUK TANGAN (Pesta Multi-Warna Spektakuler)
      return ['#FACC15', '#F43F5E', '#38BDF8', '#A855F7', '#FFFFFF'];
    case 'boo': // KASIH HUUU (Mawar Merah Lembut)
      return ['#FB7185', '#F43F5E', '#FDA4AF', '#FFE4E6', '#FFFFFF'];
    case 'laugh': // KETAWA NGAKAK (Oranye Ceria)
      return ['#FB923C', '#FDBA74', '#EA580C', '#FED7AA', '#FFF7ED'];
    case 'airhorn': // TEROMPET DJ (Ungu & Magenta Neon)
      return ['#C084FC', '#A855F7', '#E879F9', '#F0ABFC', '#FAF5FF'];
    case 'telor': // LEMPAR TELUR (Kuning Telur & Amber)
      return ['#F59E0B', '#FCD34D', '#FBBF24', '#FEF3C7', '#FFFFFF'];
    default:
      return ['#38BDF8', '#FDE047', '#34D399', '#F43F5E', '#A855F7'];
  }
}

interface TriggerConfettiOptions {
  /** Posisi asal kembang api (0 - 1) */
  origin?: { x: number; y: number };
  /** Skala ukuran partikel (default 0.75 - ringan & elegan) */
  scalar?: number;
  /** Jumlah partikel per ledakan (default 24 - ringan dan tidak menutupi layar) */
  particleCount?: number;
  /** Intensitas / variasi burst */
  mode?: 'surround' | 'single';
}

/**
 * Memicu ledakan kembang api menggunakan canvas-confetti di sekitar teks sorak.
 * Efek dirancang:
 * - Sangat transparan & ringan (partikel kecil, tidak menutupi layar atau video)
 * - Meledak di beberapa titik di sekitar teks sorak (kiri, kanan, atas)
 * - Menggunakan bentuk bintang dan lingkaran seperti percikan kembang api asli
 */
export function triggerCheerConfetti(
  confettiInstance: confetti.CreateTypes | null,
  type: string,
  options: TriggerConfettiOptions = {}
): void {
  const fire = confettiInstance || confetti;
  const colors = getCheerFireworkColors(type);
  const baseOrigin = options.origin || { x: 0.5, y: 0.42 };
  const particleCount = options.particleCount ?? 26;
  const scalar = options.scalar ?? 0.75;

  if (options.mode === 'single') {
    // Satu semburan kembang api terarah
    fire({
      particleCount,
      angle: 90,
      spread: 65,
      startVelocity: 28,
      origin: baseOrigin,
      colors,
      shapes: ['circle', 'star'],
      scalar,
      ticks: 130,
      gravity: 0.75,
      disableForReducedMotion: true,
    });
    return;
  }

  // Multi-burst di sekeliling teks sorak (kiri teks, tengah atas, kanan teks)
  // Menghasilkan efek kembang api pesta di sekeliling teks tanpa menutupi tulisan maupun layar
  const bursts = [
    {
      origin: { x: Math.max(0.15, baseOrigin.x - 0.16), y: baseOrigin.y - 0.04 },
      delay: 0,
      angle: 75,
      spread: 55,
      velocity: 30,
    },
    {
      origin: { x: baseOrigin.x, y: Math.max(0.15, baseOrigin.y - 0.1) },
      delay: 90,
      angle: 90,
      spread: 70,
      velocity: 32,
    },
    {
      origin: { x: Math.min(0.85, baseOrigin.x + 0.16), y: baseOrigin.y - 0.04 },
      delay: 180,
      angle: 105,
      spread: 55,
      velocity: 30,
    },
    {
      origin: { x: baseOrigin.x, y: Math.min(0.85, baseOrigin.y + 0.08) },
      delay: 260,
      angle: 90,
      spread: 60,
      velocity: 24,
    },
  ];

  bursts.forEach(({ origin, delay, angle, spread, velocity }) => {
    setTimeout(() => {
      try {
        fire({
          particleCount,
          angle,
          spread,
          startVelocity: velocity,
          origin,
          colors,
          shapes: ['circle', 'star'],
          scalar,
          ticks: 140,
          gravity: 0.72,
          disableForReducedMotion: true,
        });
      } catch (err) {
        console.warn('Gagal memicu confetti burst:', err);
      }
    }, delay);
  });
}
