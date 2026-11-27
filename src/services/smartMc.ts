import { McUniformType, SmartMcAnnouncement, SmartMcTier } from '../types/karaoke';
import { audioFx } from './audioFx';

interface PantunTemplate {
  id: string;
  tier: SmartMcTier;
  badge: string;
  pantunLines: [string, string, string, string];
  commentaryTemplate: string;
}

/**
 * Daftar Puluhan Pantun Jenaka & Komentar MC Militer TNI AU / Korps Elektronika (DISKOMLEKAU)
 * 100% Lokal di dalam kode (Tanpa API Key Eksternal, Tanpa OpenRouter/Gemini).
 * Dioptimalkan dengan karakter UTF-8 bersih agar bebas karakter acak di Samsung Smart TV (Tizen OS).
 * Mendukung variabel dinamis: {singer}, {song}, {score}
 */
export const SMART_MC_TEMPLATES: PantunTemplate[] = [
  // ============================================================================
  // KATEGORI 1: NILAI RENDAH (< 60) - SUPER PENDEK, KOCAK, PANTANG MUNDUR
  // ============================================================================
  {
    id: 'low-1',
    tier: 'low',
    badge: 'RADAR JAMMING // NILAI < 60',
    pantunLines: [
      'Layar radar berkedip hijau,',
      'Sinyal masuk dari angkasa.',
      'Walau suara agak kacau,',
      '{singer} tetap juara!',
    ],
    commentaryTemplate:
      'Laporan Puskodal Diskomlekau! Lagu "{song}" selesai oleh {singer} dengan skor {score}. Pantang mundur walau suara hancur!',
  },
  {
    id: 'low-2',
    tier: 'low',
    badge: 'PANTANG MUNDUR // NILAI < 60',
    pantunLines: [
      'Rudal siap di peluncur,',
      'Target terkunci tepat sasaran.',
      'Pantang mundur walau hancur,',
      'Nada meleset tetap bertahan!',
    ],
    commentaryTemplate:
      'Skor {score} untuk {singer} di lagu "{song}". Mikrofon sempat siaga satu, tapi mental juara tetap kokoh!',
  },
  {
    id: 'low-3',
    tier: 'low',
    badge: 'MENTAL PAHLAWAN // NILAI < 60',
    pantunLines: [
      'Pesawat tempur terbang rendah,',
      'Manuver tajam membelah awan.',
      'Suara fals bukan masalah,',
      'Yang penting mental pahlawan!',
    ],
    commentaryTemplate:
      'Luar biasa jiwa korsa {singer}! Skor {score} di lagu "{song}", fals dikit anggap manuver hindari radar!',
  },
  {
    id: 'low-4',
    tier: 'low',
    badge: 'SIAGA KALIBRASI // NILAI < 60',
    pantunLines: [
      'Radar Thomson berputar terang,',
      'Pantau langit siang malam.',
      'Walau nada meleset terbang,',
      '{singer} tampil tetap tenang!',
    ],
    commentaryTemplate:
      'Nilai {score} untuk {singer} pada lagu "{song}"! Segera lapor bengkel avionik untuk kalibrasi pita suara!',
  },
  {
    id: 'low-5',
    tier: 'low',
    badge: 'TEMPO KILAT // NILAI < 60',
    pantunLines: [
      'Rudal melesat secepat kilat,',
      'Asap putih tinggalkan jejak.',
      'Tempo lagu agak terlambat,',
      '{singer} gaspol terus menanjak!',
    ],
    commentaryTemplate:
      'Skor {score} berhasil diamankan {singer} lewat "{song}". Semangat tempurnya bintang lima!',
  },
  {
    id: 'low-6',
    tier: 'low',
    badge: 'LAGU BARU // NILAI < 60',
    pantunLines: [
      'Pesawat angkut mendarat mulus,',
      'Bawa logistik tepat waktu.',
      'Niat {singer} sudah tulus,',
      'Fals dikit anggap lagu baru!',
    ],
    commentaryTemplate:
      'Terima kasih {singer} untuk aksi "{song}" dengan nilai {score}. Duta Pantang Mundur Diskomlekau!',
  },

  // ============================================================================
  // KATEGORI 2: NILAI SEDANG (60 - 80) - SUPER PENDEK, STABIL, MANTAP
  // ============================================================================
  {
    id: 'med-1',
    tier: 'medium',
    badge: 'FREKUENSI JERNIH // NILAI 60 - 80',
    pantunLines: [
      'Antena komlek berdiri tegak,',
      'Frekuensi jernih tanpa gangguan.',
      'Suara {singer} mantap bergerak,',
      'Skor {score} jadi kebanggaan!',
    ],
    commentaryTemplate:
      'Frekuensi terkunci rapi! {singer} membawakan "{song}" dan meraih nilai {score} dari Dewan Juri!',
  },
  {
    id: 'med-2',
    tier: 'medium',
    badge: 'GAYA BERKELAS // NILAI 60 - 80',
    pantunLines: [
      'F-16 lepas landas pagi,',
      'Suara mesin menggelegar keras.',
      '{singer} tampil penuh energi,',
      'Skor {score} gaya berkelas!',
    ],
    commentaryTemplate:
      'Penampilan solid dari {singer}! Skor {score} di lagu "{song}" bikin ruangan makin hangat!',
  },
  {
    id: 'med-3',
    tier: 'medium',
    badge: 'DRONE PANTAU // NILAI 60 - 80',
    pantunLines: [
      'Drone quadcopter terbang melayang,',
      'Kamera fokus pantau lapangan.',
      '{singer} paling disayang,',
      'Nilai {score} resmi di tangan!',
    ],
    commentaryTemplate:
      'Dewan Juri mencatat skor {score} untuk {singer} pada lagu "{song}". Mantap komando!',
  },
  {
    id: 'med-4',
    tier: 'medium',
    badge: 'RADAR BERSIH // NILAI 60 - 80',
    pantunLines: [
      'Sinyal radar bersih sekali,',
      'Tak ada gangguan di monitor.',
      '{singer} nyanyi memikat hati,',
      'Skor {score} makin gacor!',
    ],
    commentaryTemplate:
      'Monitor utama menampilkan skor {score} untuk {singer} di lagu "{song}". Siap lanjut lagu berikutnya!',
  },
  {
    id: 'med-5',
    tier: 'medium',
    badge: 'STANDAR KOMANDAN // NILAI 60 - 80',
    pantunLines: [
      'Radio taktis ganti frekuensi,',
      'Laporan masuk dari pos depan.',
      '{singer} tampil penuh aksi,',
      'Skor {score} standar komandan!',
    ],
    commentaryTemplate:
      'Kerja bagus {singer}! Membawakan "{song}" dengan nilai {score} tanpa interferensi!',
  },
  {
    id: 'med-6',
    tier: 'medium',
    badge: 'RUDAL HANUD // NILAI 60 - 80',
    pantunLines: [
      'Rudal hanud tegak siaga,',
      'Jaga langit ibu pertiwi.',
      'Skor {score} bikin bangga,',
      '{singer} sukses menghibur kami!',
    ],
    commentaryTemplate:
      'Nilai {score} diraih {singer} pada lagu "{song}". Tetap semangat keluarga besar Diskomlekau!',
  },

  // ============================================================================
  // KATEGORI 3: NILAI TINGGI (> 80) - SUPER PENDEK, SUPERSONIK, JENDERAL VOKAL
  // ============================================================================
  {
    id: 'high-1',
    tier: 'high',
    badge: 'SUPERSONIK // NILAI > 80',
    pantunLines: [
      'Radar GCI sapu angkasa,',
      'Deteksi dini musuh mendekat.',
      '{singer} luar biasa,',
      'Skor {score} bikin terpikat!',
    ],
    commentaryTemplate:
      'LUAR BIASA! {singer} membawakan "{song}" dan meraih nilai fantastis {score}!',
  },
  {
    id: 'high-2',
    tier: 'high',
    badge: 'SUKHOI MACH 2 // NILAI > 80',
    pantunLines: [
      'Sukhoi terbang belah awan,',
      'Manuver tajam penuh gaya.',
      'Skor {score} sangat menawan,',
      '{singer} penyanyi kelas dunia!',
    ],
    commentaryTemplate:
      'Hormat komando untuk {singer}! Lagu "{song}" ditaklukkan dengan nilai tinggi {score}!',
  },
  {
    id: 'high-3',
    tier: 'high',
    badge: 'BATERAI RUDAL // NILAI > 80',
    pantunLines: [
      'Baterai rudal posisi siaga,',
      'Komando tembak tunggu perintah.',
      '{singer} tampil bangga,',
      'Skor {score} bikin meriah!',
    ],
    commentaryTemplate:
      'Rekor panggung terguncang! {singer} mencetak skor {score} di lagu "{song}"!',
  },
  {
    id: 'high-4',
    tier: 'high',
    badge: 'SATELIT EMAS // NILAI > 80',
    pantunLines: [
      'Satelit komlek pancar data,',
      'Jaringan kuat tembus samudra.',
      '{singer} meraih skor {score},',
      'Satu ruangan bersorak gembira!',
    ],
    commentaryTemplate:
      'Kejernihan vokal Ultra-HD dari {singer}! Skor {score} mutlak dari Dewan Juri Prajurit!',
  },
  {
    id: 'high-5',
    tier: 'high',
    badge: 'RADAR GM-403 // NILAI > 80',
    pantunLines: [
      'Radar GM-403 kunci sasaran,',
      'Deteksi jauh tanpa celah.',
      '{singer} dapat {score} gemilang,',
      'Bikin juri langsung menyerah!',
    ],
    commentaryTemplate:
      'Akurasi nada seakurat radar GM-403! Selamat untuk {singer} dengan nilai {score}!',
  },
  {
    id: 'high-6',
    tier: 'high',
    badge: 'MAESTRO DISKOMLEKAU // NILAI > 80',
    pantunLines: [
      'Korps Elektronika penuh inovasi,',
      'Teknologi canggih jadi andalan.',
      '{singer} nilai {score} tinggi,',
      'Panggung Diskomlekau jadi panutan!',
    ],
    commentaryTemplate:
      'Maestro vokal Korps Elektronika! {singer} menutup "{song}" dengan nilai {score}!',
  },

  // ============================================================================
  // KATEGORI 4: PANTUN UTAMA SUPER PENDEK (AWAL LAGU & TOMBOL "PANTUN MC")
  // 20 Pantun Basis Utama + 10 Tambahan Sukhoi/T-50/Thomson/GM-403/Hanud/Satelit
  // ============================================================================
  {
    id: 'man-1',
    tier: 'manual',
    badge: 'RADAR HIJAU // SMART MC',
    pantunLines: [
      'Layar radar berkedip hijau,',
      'Sinyal masuk dari angkasa.',
      'Walau suara agak kacau,',
      '{singer} tetap juara!',
    ],
    commentaryTemplate:
      'Smart MC Diskomlekau memanggil {singer} di lagu "{song}". Tetap semangat juara!',
  },
  {
    id: 'man-2',
    tier: 'manual',
    badge: 'PANTANG MUNDUR // SMART MC',
    pantunLines: [
      'Rudal siap di peluncur,',
      'Target terkunci tepat sasaran.',
      'Pantang mundur walau hancur,',
      'Nada meleset tetap bertahan!',
    ],
    commentaryTemplate:
      'Semboyan komando untuk {singer} di lagu "{song}": pantang mundur walau nada meleset!',
  },
  {
    id: 'man-3',
    tier: 'manual',
    badge: 'MENTAL PAHLAWAN // SMART MC',
    pantunLines: [
      'Pesawat tempur terbang rendah,',
      'Manuver tajam membelah awan.',
      'Suara fals bukan masalah,',
      'Yang penting mental pahlawan!',
    ],
    commentaryTemplate:
      'Ayo {singer}, hajar lagu "{song}" dengan mental pahlawan TNI Angkatan Udara!',
  },
  {
    id: 'man-4',
    tier: 'manual',
    badge: 'DRONE INTAI // SMART MC',
    pantunLines: [
      'Drone intai terbang tinggi,',
      'Kirim data ke ruang kendali.',
      'Mic digenggam sepenuh hati,',
      'Lagu selesai tepuk tangan beri!',
    ],
    commentaryTemplate:
      'Seluruh penonton siapkan tepuk tangan paling meriah untuk {singer} di lagu "{song}"!',
  },
  {
    id: 'man-5',
    tier: 'manual',
    badge: 'ANTENA KOMLEK // SMART MC',
    pantunLines: [
      'Antena komlek berdiri tegak,',
      'Frekuensi jernih tanpa gangguan.',
      'Tarik napas jangan mendadak,',
      'Nada tinggi jangan dipaksakan!',
    ],
    commentaryTemplate:
      'Pesan hangat Smart MC untuk {singer}: santai saja menaklukkan nada tinggi "{song}"!',
  },
  {
    id: 'man-6',
    tier: 'manual',
    badge: 'RADAR GCI // SMART MC',
    pantunLines: [
      'Radar GCI sapu angkasa,',
      'Deteksi dini musuh mendekat.',
      '{singer} luar biasa,',
      'Suara berat bikin terpikat!',
    ],
    commentaryTemplate:
      'Radar GCI mengunci penampilan memikat {singer} pada lagu "{song}"!',
  },
  {
    id: 'man-7',
    tier: 'manual',
    badge: 'RUDAL KILAT // SMART MC',
    pantunLines: [
      'Rudal melesat secepat kilat,',
      'Asap putih tinggalkan jejak.',
      'Tempo lagu agak terlambat,',
      'Tetap gaspol jangan menginjak!',
    ],
    commentaryTemplate:
      'Gaspol terus {singer} kejar ketukan lagu "{song}"!',
  },
  {
    id: 'man-8',
    tier: 'manual',
    badge: 'F-16 FIGHTING // SMART MC',
    pantunLines: [
      'F-16 lepas landas pagi,',
      'Suara mesin menggelegar keras.',
      'Kalah merdu tak usah rugi,',
      'Yang penting gaya paling berkelas!',
    ],
    commentaryTemplate:
      'Gaya panggung {singer} di lagu "{song}" resmi paling berkelas malam ini!',
  },
  {
    id: 'man-9',
    tier: 'manual',
    badge: 'SATELIT ORBIT // SMART MC',
    pantunLines: [
      'Satelit orbit jaga jaringan,',
      'Komando nyambung seluruh nusantara.',
      'Pegang mic kayak pegang senapan,',
      'Bidik nada jangan sampai cedera!',
    ],
    commentaryTemplate:
      'Bidik setiap nada "{song}" dengan presisi tinggi, semangat {singer}!',
  },
  {
    id: 'man-10',
    tier: 'manual',
    badge: 'DRONE QUADCOPTER // SMART MC',
    pantunLines: [
      'Drone quadcopter terbang melayang,',
      'Kamera fokus pantau lapangan.',
      '{singer} paling disayang,',
      'Walau lirik sering ketinggalan!',
    ],
    commentaryTemplate:
      'Kamera drone menyorot {singer}! Jangan berkedip baca lirik "{song}"!',
  },
  {
    id: 'man-11',
    tier: 'manual',
    badge: 'TAMBAH LAGI // SMART MC',
    pantunLines: [
      'Sinyal radar bersih sekali,',
      'Tak ada gangguan di monitor.',
      'Nyanyi satu lagu kurang kali,',
      'Tambah lagi biar makin gacor!',
    ],
    commentaryTemplate:
      'Habis lagu "{song}", langsung masukkan lagu baru dari HP biar makin gacor!',
  },
  {
    id: 'man-12',
    tier: 'manual',
    badge: 'RUDAL JARAK JAUH // SMART MC',
    pantunLines: [
      'Rudal jarak jauh siap siaga,',
      'Menjaga langit ibu pertiwi.',
      'Suara serak tetap terjaga,',
      'Diskomlekau selalu di hati!',
    ],
    commentaryTemplate:
      'Salam Swa Bhuwana Paksa! Bersama {singer} di lagu "{song}", Diskomlekau selalu di hati!',
  },
  {
    id: 'man-13',
    tier: 'manual',
    badge: 'PESAWAT ANGKUT // SMART MC',
    pantunLines: [
      'Pesawat angkut mendarat mulus,',
      'Bawa logistik tepat waktu.',
      'Niat menghibur sudah tulus,',
      'Fals dikit anggap lagu baru!',
    ],
    commentaryTemplate:
      'Yang penting niat menghibur! Lanjutkan aksi {singer} di lagu "{song}"!',
  },
  {
    id: 'man-14',
    tier: 'manual',
    badge: 'RADIO TAKTIS // SMART MC',
    pantunLines: [
      'Radio taktis ganti frekuensi,',
      'Laporan masuk dari pos depan.',
      '{singer} penuh aksi,',
      'Suara emas standar komandan!',
    ],
    commentaryTemplate:
      'Transmisi jernih dari {singer} membawakan "{song}" berstandar komandan!',
  },
  {
    id: 'man-15',
    tier: 'manual',
    badge: 'GELOMBANG RADAR // SMART MC',
    pantunLines: [
      'Gelombang radar berputar cepat,',
      'Memantau batas wilayah udara.',
      'Jangan takut nada melompat,',
      'Semua prajurit siap gembira!',
    ],
    commentaryTemplate:
      'Mari bergembira bersama {singer} pada lagu "{song}"!',
  },
  {
    id: 'man-16',
    tier: 'manual',
    badge: 'TEKNISI KOMLEK // SMART MC',
    pantunLines: [
      'Teknisi komlek cek kabel,',
      'Semua sistem dalam kondisi siap.',
      'Suara tinggi bikin sebel,',
      'Turunin oktaf tetap mantap!',
    ],
    commentaryTemplate:
      'Taktik jitu untuk {singer}: nada tinggi tinggal turunin satu oktaf di "{song}"!',
  },
  {
    id: 'man-17',
    tier: 'manual',
    badge: 'SONIC BOOM // SMART MC',
    pantunLines: [
      'Tempuh udara kecepatan tinggi,',
      'Sonic boom pecahkan sunyi.',
      'Ayo prajurit jangan berhenti,',
      'Goyang santai ikut bernyanyi!',
    ],
    commentaryTemplate:
      'Semua prajurit ayo ikut goyang santai menemani {singer} di lagu "{song}"!',
  },
  {
    id: 'man-18',
    tier: 'manual',
    badge: 'BATERAI RUDAL // SMART MC',
    pantunLines: [
      'Baterai rudal posisi siaga,',
      'Komando tembak tunggu perintah.',
      '{singer} tampil bangga,',
      'Suara menggelegar bikin meriah!',
    ],
    commentaryTemplate:
      'Suasana makin meriah bersama {singer} di lagu "{song}"!',
  },
  {
    id: 'man-19',
    tier: 'manual',
    badge: 'DRONE MALAM // SMART MC',
    pantunLines: [
      'Drone malam nyalakan sensor,',
      'Terbang senyap di atas awan.',
      'Jangan ragu tarik suara,',
      'Kaca aman takkan bergetar!',
    ],
    commentaryTemplate:
      'Kaca ruangan aman terkendali! Tarik suara penuh {singer} di "{song}"!',
  },
  {
    id: 'man-20',
    tier: 'manual',
    badge: 'KORPS ELEKTRONIKA // SMART MC',
    pantunLines: [
      'Korps Elektronika penuh inovasi,',
      'Teknologi canggih jadi andalan.',
      'Panggung karaoke siap beraksi,',
      '{singer} jadi panutan!',
    ],
    commentaryTemplate:
      'Panggung Diskomlekau siap beraksi! Beri semangat untuk panutan kita {singer}!',
  },

  // --- 10 Pantun Tambahan Super Pendek (Sukhoi, T-50, Thomson, GM-403, Hanud, Satelit) ---
  {
    id: 'man-21',
    tier: 'manual',
    badge: 'SUKHOI SU-30 // SMART MC',
    pantunLines: [
      'Sukhoi terbang belah awan,',
      'Manuver tajam penuh gaya.',
      '{singer} tampil bak pahlawan,',
      'Fals dikit tetap percaya!',
    ],
    commentaryTemplate:
      'Kecepatan Sukhoi mengawal {singer} menaklukkan lagu "{song}"!',
  },
  {
    id: 'man-22',
    tier: 'manual',
    badge: 'JET T-50I // SMART MC',
    pantunLines: [
      'Jet T-50 melesat cepat,',
      'Menari lincah di angkasa.',
      '{singer} nyanyi penuh semangat,',
      'Tetap menghibur semua pemirsa!',
    ],
    commentaryTemplate:
      'Manuver lincah ala T-50i dari {singer} pada lagu "{song}"!',
  },
  {
    id: 'man-23',
    tier: 'manual',
    badge: 'RADAR THOMSON // SMART MC',
    pantunLines: [
      'Radar Thomson berputar terang,',
      'Pantau langit siang malam.',
      'Suara {singer} makin lantang,',
      'Semua hadirin ikut tentram!',
    ],
    commentaryTemplate:
      'Radar Thomson menangkap gelombang merdu dari {singer} di lagu "{song}"!',
  },
  {
    id: 'man-24',
    tier: 'manual',
    badge: 'RADAR GM-403 // SMART MC',
    pantunLines: [
      'Radar GM-403 kunci sasaran,',
      'Deteksi jauh tanpa celah.',
      'Mic dipegang penuh harapan,',
      '{singer} nyanyi tak kenal lelah!',
    ],
    commentaryTemplate:
      'Jangkauan vokal {singer} di "{song}" setara ketajaman radar GM-403!',
  },
  {
    id: 'man-25',
    tier: 'manual',
    badge: 'RUDAL HANUD // SMART MC',
    pantunLines: [
      'Rudal hanud tegak siaga,',
      'Jaga langit ibu pertiwi.',
      'Suara {singer} bikin bangga,',
      'Mari joget sampai pagi!',
    ],
    commentaryTemplate:
      'Pertahanan udara solid, panggung pun heboh bersama {singer}!',
  },
  {
    id: 'man-26',
    tier: 'manual',
    badge: 'KOMUNIKASI SATELIT // SMART MC',
    pantunLines: [
      'Satelit komlek pancar data,',
      'Jaringan kuat tembus samudra.',
      '{singer} nyanyi penuh cinta,',
      'Bikin goyang satu tentara!',
    ],
    commentaryTemplate:
      'Sinyal satelit Diskomlekau memancarkan lagu "{song}" bersama {singer}!',
  },
  {
    id: 'man-27',
    tier: 'manual',
    badge: 'SUKHOI COBRA // SMART MC',
    pantunLines: [
      'Sukhoi manuver di atas awan,',
      'Suara jet menggelegar keras.',
      'Gaya {singer} paling menawan,',
      'Nada tinggi sikat tuntas!',
    ],
    commentaryTemplate:
      'Manuver Cobra vokal dari {singer} melibas nada tinggi "{song}"!',
  },
  {
    id: 'man-28',
    tier: 'manual',
    badge: 'FORMASI T-50 // SMART MC',
    pantunLines: [
      'Jet T-50i siap mengudara,',
      'Terbang formasi sangat rapi.',
      'Jangan malu tarik suara,',
      '{singer} pasti bikin happy!',
    ],
    commentaryTemplate:
      'Formasi tempur vokal siap mengudara bersama {singer}!',
  },
  {
    id: 'man-29',
    tier: 'manual',
    badge: 'SINYAL GM-403 // SMART MC',
    pantunLines: [
      'Radar GM-403 tangkap sinyal,',
      'Monitor nyala sangat terang.',
      'Suara {singer} tetap spesial,',
      'Walau tempo kadang menghilang!',
    ],
    commentaryTemplate:
      'Spesial tanpa batas untuk {singer} di tembang "{song}"!',
  },
  {
    id: 'man-30',
    tier: 'manual',
    badge: 'SATELIT & HANUD // SMART MC',
    pantunLines: [
      'Sinyal satelit tembus angkasa,',
      'Rudal hanud siap menjaga.',
      '{singer} tampil luar biasa,',
      'Satu panggung ikut bangga!',
    ],
    commentaryTemplate:
      'Seluruh keluarga besar Diskomlekau bangga menyaksikan aksi {singer}!',
  },
];

// Riwayat ID pantun terakhir agar tidak mengulang pantun yang sama berturut-turut
const recentTemplateIds: string[] = [];

// Pelacak seragam MC bergantian (biru langit <-> loreng) agar tampilan selalu bervariasi
let lastGeneratedMcUniform: McUniformType = 'loreng';

export function getNextMcUniform(): McUniformType {
  lastGeneratedMcUniform = lastGeneratedMcUniform === 'biru' ? 'loreng' : 'biru';
  return lastGeneratedMcUniform;
}

export function getTierFromScore(score?: number | null): SmartMcTier {
  if (typeof score !== 'number' || isNaN(score)) return 'manual';
  if (score < 60) return 'low';
  if (score <= 80) return 'medium';
  return 'high';
}

export interface GenerateSmartMcOptions {
  singerName?: string;
  songTitle?: string;
  score?: number | null;
  forceTier?: SmartMcTier;
  mcUniform?: McUniformType;
  triggeredBy?: string;
  isManual?: boolean;
  nextSongTitle?: string;
}

export function generateSmartMcAnnouncement(options: GenerateSmartMcOptions = {}): SmartMcAnnouncement {
  const cleanSinger = (options.singerName || 'Prajurit Diskomlekau').trim();
  const rawCleanSong =
    (options.songTitle || 'Lagu Pilihan Prajurit')
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\b(official|music\s*video|video\s*klip|mv|karaoke|instrumental|no\s*vocal|vokal|hd|4k|lyrics?|lirik|full\s*album|audio|cover)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Lagu Favorit';
  const cleanSong = rawCleanSong.length > 48 ? rawCleanSong.slice(0, 48).trim() : rawCleanSong;

  const numericScore =
    typeof options.score === 'number' && !isNaN(options.score)
      ? Math.max(0, Math.min(100, Math.round(options.score)))
      : 85;

  const tier: SmartMcTier = options.forceTier || getTierFromScore(options.score);

  const pool = SMART_MC_TEMPLATES.filter((t) => t.tier === tier);
  const available = pool.filter((t) => !recentTemplateIds.includes(t.id));
  const lastId = recentTemplateIds[recentTemplateIds.length - 1];
  const nonImmediateRepeat = pool.filter((t) => t.id !== lastId);
  const candidates =
    available.length > 0 ? available : nonImmediateRepeat.length > 0 ? nonImmediateRepeat : pool;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)] || SMART_MC_TEMPLATES[0];

  recentTemplateIds.push(chosen.id);
  const maxHistory = Math.max(8, Math.min(29, pool.length - 1));
  while (recentTemplateIds.length > maxHistory) {
    recentTemplateIds.shift();
  }

  const interpolate = (text: string) =>
    text
      .replace(/\{singer\}/g, cleanSinger)
      .replace(/\{song\}/g, cleanSong)
      .replace(/\{score\}/g, String(numericScore));

  const pantunLines = chosen.pantunLines.map(interpolate) as [string, string, string, string];
  const commentary = chosen.commentaryTemplate ? interpolate(chosen.commentaryTemplate) : '';
  const sampiran: [string, string] = [pantunLines[0], pantunLines[1]];
  const isi: [string, string] = [pantunLines[2], pantunLines[3]];

  // Narasi audio MC ringkas: HANYA vokalis yang memilih lagu, judul lagu, dan pantun
  const fullSpeechText = `Vokalis ${cleanSinger}, lagu ${cleanSong}. ${pantunLines.join(', ')}.`;
  const resolvedUniform: McUniformType = options.mcUniform || getNextMcUniform();

  return {
    id: `mc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tier,
    badge: chosen.badge,
    mcUniform: resolvedUniform,
    pantunLines,
    sampiran,
    isi,
    komentar: commentary,
    namaVokalis: cleanSinger,
    judulLagu: cleanSong,
    commentary,
    fullSpeechText,
    singerName: cleanSinger,
    songTitle: cleanSong,
    score: typeof options.score === 'number' ? numericScore : undefined,
    triggeredBy: options.triggeredBy || 'Smart MC',
    isManual: Boolean(options.isManual),
    nextSongTitle: options.nextSongTitle,
    timestamp: Date.now(),
  };
}

// Referensi global untuk elemen HTML5 <audio> Smart MC, session lock & timer penyelesaian
let activeMcAudioRef: HTMLAudioElement | null = null;
let unlockedAudioPoolEl: HTMLAudioElement | null = null;
let fallbackSpeechTimerRef: ReturnType<typeof setTimeout> | null = null;
let isMcAudioUnlocked = false;
let isPlaybackActive = false;
let activePlaybackSessionId = 0;

// Tiny silent WAV data URI for unlocking HTML5 <audio> on Samsung Tizen OS / Android TV / iOS
const SILENT_UNLOCK_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * Mengecek secara sinkron apakah Smart MC masih sedang membacakan pantun
 */
export function isSmartMcPlaying(): boolean {
  return isPlaybackActive;
}

/**
 * Mengecek dengan aman apakah Web Speech API browser sedang membacakan suara
 */
export function isBrowserSpeechSpeaking(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if ('speechSynthesis' in window && window.speechSynthesis) {
      return Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Menghitung durasi tampil minimum papan pantun secara dinamis berdasarkan panjang teks pantun lengkap
 * (sampiran, isi komando, komentar MC, vokalis, dan judul lagu) sehingga papan tidak cepat hilang
 * saat TTS tidak tersedia atau terblokir autoplay. Minimum 18 detik, maksimum aman 40 detik.
 */
export function calculateSmartMcDisplayDurationMs(
  announcement?: SmartMcAnnouncement | string | null
): number {
  let fullReadableText = '';

  if (typeof announcement === 'string') {
    fullReadableText = announcement;
  } else if (announcement) {
    if (announcement.fullSpeechText && announcement.fullSpeechText.trim()) {
      fullReadableText = announcement.fullSpeechText.trim();
    } else {
      const parts = [
        announcement.namaVokalis || announcement.singerName || '',
        announcement.judulLagu || announcement.songTitle || '',
        ...(announcement.pantunLines || [...(announcement.sampiran || []), ...(announcement.isi || [])]),
      ]
        .map((s) => (s || '').trim())
        .filter(Boolean);
      fullReadableText = parts.join(' ');
    }
  }

  const charCount = fullReadableText.replace(/\s+/g, ' ').trim().length;
  const wordCount = fullReadableText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  // Hitung estimasi waktu baca wajar pada kecepatan 1.28x (sekitar 55ms/karakter atau 400ms/kata + jeda visual HUD)
  const charBasedMs = 5000 + charCount * 55;
  const wordBasedMs = 5000 + wordCount * 400;
  const computedMs = Math.max(charBasedMs, wordBasedMs);

  // Minimum 11 detik agar pantun pendek terbaca nyaman, maksimum aman 28 detik
  return Math.max(11000, Math.min(28000, Math.round(computedMs)));
}

/**
 * Membuka kunci policy autoplay HTML5 <audio> saat interaksi pertama di layar TV Samsung / Android TV / browser.
 * Menggunakan elemen HTMLAudioElement persisten agar pemanggilan async (WebSocket/PeerJS) tetap berbunyi.
 */
export function unlockSmartMcAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!unlockedAudioPoolEl) {
      unlockedAudioPoolEl = new Audio();
      unlockedAudioPoolEl.preload = 'auto';
    }
    if (isMcAudioUnlocked) return;
    unlockedAudioPoolEl.src = SILENT_UNLOCK_WAV;
    unlockedAudioPoolEl.volume = 0.01;
    const p = unlockedAudioPoolEl.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        isMcAudioUnlocked = true;
      }).catch(() => {});
    } else {
      isMcAudioUnlocked = true;
    }
  } catch {
    // Abaikan jika browser belum mengizinkan
  }
}

/**
 * File MP3 lokal yang tersedia di /public/sounds/ sebagai cadangan offline.
 */
export const SMART_MC_OFFLINE_FALLBACK_FILES: Record<SmartMcTier, string[]> = {
  high: ['/sounds/mc-high.mp3', '/sounds/mc-pantun.mp3', '/sounds/cheer.mp3', '/sounds/applause.mp3'],
  medium: ['/sounds/mc-medium.mp3', '/sounds/mc-pantun.mp3', '/sounds/applause.mp3', '/sounds/cheer.mp3'],
  low: ['/sounds/mc-low.mp3', '/sounds/mc-pantun.mp3', '/sounds/boo.mp3', '/sounds/cheer.mp3'],
  manual: ['/sounds/mc-pantun.mp3', '/sounds/hormat.mp3', '/sounds/cheer.mp3', '/sounds/applause.mp3'],
};

function isTizenBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /tizen|smart-tv|smarttv|samsung/i.test(navigator.userAgent || '');
}

function tryBrowserSpeechFallback(
  text: string,
  sessionId: number,
  onDone: () => void,
  onFailed: () => void
): boolean {
  if (
    typeof window === 'undefined' ||
    isTizenBrowser() ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.28;
    utterance.pitch = 1.12;
    utterance.volume = 1.0;

    let voices: SpeechSynthesisVoice[] = [];
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch {
      voices = [];
    }
    const indoFemale =
      voices.find((v) => /id[-_]?id/i.test(v.lang) && /female|wanita|gadis|damayanti|putri|google/i.test(v.name)) ||
      voices.find((v) => /id[-_]?id/i.test(v.lang));
    if (indoFemale) {
      utterance.voice = indoFemale;
    }

    let settled = false;
    const finishSpeech = () => {
      if (settled || sessionId !== activePlaybackSessionId) return;
      settled = true;
      onDone();
    };

    utterance.onend = finishSpeech;
    utterance.onerror = () => {
      if (settled || sessionId !== activePlaybackSessionId) return;
      settled = true;
      onFailed();
    };
    window.speechSynthesis.speak(utterance);

    // Fallback check in case speechSynthesis silently drops on Android WebView
    setTimeout(() => {
      try {
        if (
          !settled &&
          sessionId === activePlaybackSessionId &&
          !window.speechSynthesis.speaking &&
          !window.speechSynthesis.pending
        ) {
          settled = true;
          onFailed();
        }
      } catch {
        if (!settled && sessionId === activePlaybackSessionId) {
          settled = true;
          onFailed();
        }
      }
    }, 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Menghentikan pemutaran audio Smart MC yang sedang berjalan
 */
export function stopSmartMcSpeech(): void {
  activePlaybackSessionId += 1;
  isPlaybackActive = false;

  if (fallbackSpeechTimerRef) {
    clearTimeout(fallbackSpeechTimerRef);
    fallbackSpeechTimerRef = null;
  }
  if (activeMcAudioRef) {
    try {
      activeMcAudioRef.onended = null;
      activeMcAudioRef.onerror = null;
      activeMcAudioRef.onloadedmetadata = null;
      activeMcAudioRef.onplaying = null;
      activeMcAudioRef.pause();
      if (activeMcAudioRef !== unlockedAudioPoolEl) {
        activeMcAudioRef.src = '';
      }
    } catch {
      // Abaikan error saat menghentikan audio di Tizen OS
    }
    activeMcAudioRef = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Memutar suara MC Wanita yang merdu & ramah menggunakan HTML5 <audio> (`/api/tts` terlebih dahulu)
 * lalu fallback ke Web Speech API (non-Tizen) dan file MP3 lokal di `/public/sounds/`.
 * Callback `onEnd(usedRealSpeech)` memberi tahu pemanggil apakah narasi suara benar-benar selesai dibacakan
 * atau hanya memutar efek cadangan/blocked sehingga papan pantun tidak cepat menghilang.
 */
export function playSmartMcAudio(
  tierOrText: SmartMcTier | string = 'manual',
  onStart?: () => void,
  onEnd?: (usedRealSpeech?: boolean) => void,
  speechText?: string
): void {
  // Cegah pantun lain sebelum pantun pertama selesai berbicara!
  if (isPlaybackActive) {
    return;
  }

  activePlaybackSessionId += 1;
  const sessionId = activePlaybackSessionId;
  isPlaybackActive = true;

  if (fallbackSpeechTimerRef) {
    clearTimeout(fallbackSpeechTimerRef);
    fallbackSpeechTimerRef = null;
  }

  const isTier =
    tierOrText === 'low' || tierOrText === 'medium' || tierOrText === 'high' || tierOrText === 'manual';
  const resolvedTier: SmartMcTier = isTier ? tierOrText : 'manual';
  const resolvedText =
    (speechText && speechText.trim()) ||
    (!isTier && tierOrText.trim()) ||
    'Vokalis Prajurit Diskomlekau, mari bernyanyi bersama.';

  let hasCompleted = false;
  const finishOnce = (usedRealSpeech = false) => {
    if (hasCompleted || sessionId !== activePlaybackSessionId) return;
    hasCompleted = true;
    isPlaybackActive = false;
    if (fallbackSpeechTimerRef) {
      clearTimeout(fallbackSpeechTimerRef);
      fallbackSpeechTimerRef = null;
    }
    if (activeMcAudioRef) {
      try {
        activeMcAudioRef.onended = null;
        activeMcAudioRef.onerror = null;
        activeMcAudioRef.onloadedmetadata = null;
        activeMcAudioRef.onplaying = null;
      } catch {}
      activeMcAudioRef = null;
    }
    onEnd?.(usedRealSpeech);
  };

  if (typeof window === 'undefined') {
    finishOnce(false);
    return;
  }

  try {
    if (!unlockedAudioPoolEl) {
      unlockedAudioPoolEl = new Audio();
      unlockedAudioPoolEl.preload = 'auto';
    }
  } catch {}

  onStart?.();

  // Prioritaskan langsung endpoint /api/tts suara Indonesia agar tidak buang user-gesture pada file 404
  const ttsEndpoint = `/api/tts?text=${encodeURIComponent(resolvedText.slice(0, 260))}&tier=${encodeURIComponent(resolvedTier)}`;
  const offlineFallbacks = SMART_MC_OFFLINE_FALLBACK_FILES[resolvedTier] || SMART_MC_OFFLINE_FALLBACK_FILES.manual;
  const candidateFiles = [ttsEndpoint, ...offlineFallbacks];

  // Safety timer dinamis disesuaikan dengan kecepatan baca 1.28x
  const dynamicAudioLimitMs = Math.min(36000, Math.max(15000, resolvedText.length * 105 + 5500));
  const startedAt = Date.now();
  const scheduleSafetyTimer = (delayMs: number) => {
    if (fallbackSpeechTimerRef) {
      clearTimeout(fallbackSpeechTimerRef);
    }
    fallbackSpeechTimerRef = setTimeout(() => {
      if (hasCompleted || sessionId !== activePlaybackSessionId) return;
      const elapsed = Date.now() - startedAt;
      const stillSpeakingHtmlAudio = Boolean(
        activeMcAudioRef && !activeMcAudioRef.paused && !activeMcAudioRef.ended
      );
      const stillSpeakingWebSpeech = isBrowserSpeechSpeaking();

      // Jika suara TTS masih aktif membaca dan belum melewati batas maksimal 50 detik, tunggu sebentar lagi
      if ((stillSpeakingHtmlAudio || stillSpeakingWebSpeech) && elapsed < 50000) {
        scheduleSafetyTimer(3000);
        return;
      }
      finishOnce(stillSpeakingHtmlAudio || stillSpeakingWebSpeech);
    }, delayMs);
  };

  scheduleSafetyTimer(dynamicAudioLimitMs);

  let speechAttempted = false;

  const tryPlayCandidate = (index: number) => {
    if (hasCompleted || sessionId !== activePlaybackSessionId) return;

    // Jika /api/tts gagal, coba Web Speech API (bahasa Indonesia) terlebih dahulu sebelum jingle MP3
    if (index === 1 && !speechAttempted) {
      speechAttempted = true;
      const startedSpeech = tryBrowserSpeechFallback(
        resolvedText,
        sessionId,
        () => finishOnce(true),
        () => tryPlayCandidate(1)
      );
      if (startedSpeech) {
        return;
      }
    }

    if (index >= candidateFiles.length) {
      try {
        audioFx.playSmartMc(resolvedTier);
      } catch {}
      setTimeout(() => finishOnce(false), 2000);
      return;
    }

    const src = candidateFiles[index];
    const isTtsOrVoiceMp3 = index === 0 || src.includes('/sounds/mc-');
    let attemptSettled = false;

    try {
      const audio = index === 0 && unlockedAudioPoolEl ? unlockedAudioPoolEl : new Audio();
      const targetRate = isTtsOrVoiceMp3 ? 1.28 : 1.0;
      const applyVoiceSpeed = () => {
        try {
          audio.defaultPlaybackRate = targetRate;
          audio.playbackRate = targetRate;
          if ('preservesPitch' in audio) (audio as any).preservesPitch = true;
          if ('mozPreservesPitch' in audio) (audio as any).mozPreservesPitch = true;
          if ('webkitPreservesPitch' in audio) (audio as any).webkitPreservesPitch = true;
        } catch {}
      };

      audio.onended = null;
      audio.onerror = null;
      audio.onloadedmetadata = applyVoiceSpeed;
      audio.onplaying = applyVoiceSpeed;
      audio.src = src;
      audio.preload = 'auto';
      audio.volume = 1.0;
      applyVoiceSpeed();
      activeMcAudioRef = audio;

      const advanceToNext = () => {
        if (attemptSettled || hasCompleted || sessionId !== activePlaybackSessionId) return;
        attemptSettled = true;
        try {
          audio.onended = null;
          audio.onerror = null;
          audio.onloadedmetadata = null;
          audio.onplaying = null;
          audio.pause();
        } catch {}
        if (activeMcAudioRef === audio) {
          activeMcAudioRef = null;
        }
        tryPlayCandidate(index + 1);
      };

      audio.onended = () => {
        if (attemptSettled || hasCompleted || sessionId !== activePlaybackSessionId) return;
        attemptSettled = true;
        finishOnce(isTtsOrVoiceMp3);
      };

      audio.onerror = advanceToNext;

      const playPromise = audio.play();
      applyVoiceSpeed();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(applyVoiceSpeed).catch(advanceToNext);
      }
    } catch {
      if (!attemptSettled) {
        attemptSettled = true;
        tryPlayCandidate(index + 1);
      }
    }
  };

  tryPlayCandidate(0);
}

/**
 * Alias kompatibilitas untuk pemanggilan Smart MC di KaraokeContext
 */
export function speakSmartMcIndonesian(
  tierOrText: SmartMcTier | string,
  onStart?: () => void,
  onEnd?: (usedRealSpeech?: boolean) => void,
  speechText?: string
): void {
  playSmartMcAudio(tierOrText, onStart, onEnd, speechText);
}

