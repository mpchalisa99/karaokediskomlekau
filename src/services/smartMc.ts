import { SmartMcAnnouncement, SmartMcTier } from '../types/karaoke';
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
  // KATEGORI 1: NILAI RENDAH (< 60) - LUCU, KOMANDO, PANTANG MUNDUR WALAU HANCUR
  // ============================================================================
  {
    id: 'low-1',
    tier: 'low',
    badge: 'FREKUENSI MELENCENG // NILAI < 60',
    pantunLines: [
      'Pasang antena di atas menara,',
      'Sinyal terputus terkena badai.',
      '{singer} bernyanyi penuh gelora,',
      'Walau nadanya lari ke pantai!',
    ],
    commentaryTemplate:
      'Laporan Puskodal Diskomlekau! Lagu "{song}" dibawakan oleh {singer} dengan skor {score}. Meskipun radar nada sempat jamming, semangat tempur prajurit tetap pantang mundur walau suara hancur!',
  },
  {
    id: 'low-2',
    tier: 'low',
    badge: 'RADAR VOKAL JAMMING // NILAI < 60',
    pantunLines: [
      'Kapal selam menyelam di lautan,',
      'Pesawat tempur terbang ke awan.',
      'Musik mengarah ke arah selatan,',
      'Suara {singer} belok ke kanan!',
    ],
    commentaryTemplate:
      'Perhatian seluruh jajaran Korps Elektronika! Skor Dewan Juri menunjukkan angka {score} untuk {singer} pada lagu "{song}". Mikrofon sempat minta izin pensiun dini, tapi keberaniannya patut diberi hormat!',
  },
  {
    id: 'low-3',
    tier: 'low',
    badge: 'PANTANG MUNDUR // NILAI < 60',
    pantunLines: [
      'Solder komponen di meja kerja,',
      'Kabel tersambung lampu menyala.',
      'Skor {score} janganlah berkecil dada,',
      'Yang penting {singer} tampil menggila!',
    ],
    commentaryTemplate:
      'Luar biasa jiwa korsa {singer}! Menyanyikan "{song}" dengan nilai {score}. Di Diskomlekau tidak ada kata menyerah, nada meleset anggap saja manuver penghindaran radar musuh!',
  },
  {
    id: 'low-4',
    tier: 'low',
    badge: 'KALIBRASI DARURAT // NILAI < 60',
    pantunLines: [
      'Cek frekuensi pakai osiloskop,',
      'Gelombang naik turun tak tentu.',
      '{singer} nyanyi mirip suara helikopter,',
      'Untung dewan juri masih kasih {score}!',
    ],
    commentaryTemplate:
      'Hasil telemetri vokal untuk {singer} di lagu "{song}" tercatat {score} poin! Segera lapor ke bengkel Avionik dan Elektronika untuk kalibrasi pita suara sebelum lagu berikutnya!',
  },
  {
    id: 'low-5',
    tier: 'low',
    badge: 'OVERLOAD TRANSMITTER // NILAI < 60',
    pantunLines: [
      'Beli baterai di pasar minggu,',
      'Dipakai untuk radio komunikasi.',
      'Lagu "{song}" terdengar haru,',
      'Tetangga panik kirain sirene evakuasi!',
    ],
    commentaryTemplate:
      'Skor akhir {score} untuk komandan vokal kita {singer}! Walaupun pitch control sedang gangguan atmosfer, gaya panggungnya tetap bintang lima TNI Angkatan Udara!',
  },
  {
    id: 'low-6',
    tier: 'low',
    badge: 'MENTAL BAJA // NILAI < 60',
    pantunLines: [
      'Radar berputar mencari sasaran,',
      'Sasaran terkunci di ujung barat.',
      'Suara {singer} memang penuh kejutan,',
      'Skor {score} tetap disambut hangat!',
    ],
    commentaryTemplate:
      'Salut untuk {singer} yang baru saja menuntaskan operasi lagu "{song}" dengan nilai {score}! Semboyan kita jelas: Suara fals itu seni, yang penting mental baja Korps Elektronika!',
  },
  {
    id: 'low-7',
    tier: 'low',
    badge: 'MIC MINTA RESIGN // NILAI < 60',
    pantunLines: [
      'Terbang tinggi pesawat Sukhoi,',
      'Melintas cepat di atas landasan.',
      '{singer} tarik nada tinggi aduhai,',
      'Speaker TV langsung minta ampunan!',
    ],
    commentaryTemplate:
      'Dewan Juri Prajurit memberikan nilai rata-rata {score} untuk {singer} pada lagu "{song}". Jangan lupa minum air hangat agar transistor tenggorokan kembali stabil!',
  },
  {
    id: 'low-8',
    tier: 'low',
    badge: 'SINYAL KRESEK-KRESEK // NILAI < 60',
    pantunLines: [
      'Pagi-pagi apel di lapangan,',
      'Siang hari merakit pemancar.',
      'Walau "{song}" penuh rintangan,',
      '{singer} tetap bernyanyi dengan tegar!',
    ],
    commentaryTemplate:
      'Nilai {score} berhasil diamankan oleh {singer}! Sebuah penampilan yang menguji ketahanan mental dan gendang telinga seluruh prajurit di ruangan ini. Komando!',
  },
  {
    id: 'low-9',
    tier: 'low',
    badge: 'SIAGA DAMKAR VOKAL // NILAI < 60',
    pantunLines: [
      'Kabel serat optik panjang membentang,',
      'Menghubungkan markas sampai ke pangkalan.',
      '{singer} bernyanyi sangatlah lantang,',
      'Sayang nadanya lupa dibawa sekalian!',
    ],
    commentaryTemplate:
      'Lagu "{song}" selesai dieksekusi oleh {singer} dengan skor {score}! Mari kita beri tepuk tangan paling meriah untuk keberanian tanpa batas ini!',
  },
  {
    id: 'low-10',
    tier: 'low',
    badge: 'WAJIB TUNE-UP VOKAL // NILAI < 60',
    pantunLines: [
      'Naik Hercules membawa logistik,',
      'Mendarat mulus di pagi hari.',
      'Gaya {singer} sudah sangat asyik,',
      'Walau skor {score} bikin juri senyum sendiri!',
    ],
    commentaryTemplate:
      'Terima kasih {singer} atas hiburan spektakuler di lagu "{song}"! Dengan nilai {score}, Anda resmi dinobatkan sebagai Duta Pantang Mundur Diskomlekau!',
  },

  // ============================================================================
  // KATEGORI 2: NILAI SEDANG (60 - 80) - MANTAP, STABIL, LOLOS AUDISI SKUADRON
  // ============================================================================
  {
    id: 'med-1',
    tier: 'medium',
    badge: 'FREKUENSI STABIL // NILAI 60 - 80',
    pantunLines: [
      'Satelit mengorbit di angkasa raya,',
      'Memancarkan data ke seluruh negeri.',
      '{singer} bernyanyi penuh percaya,',
      'Skor {score} mantap menghibur hati!',
    ],
    commentaryTemplate:
      'Frekuensi terkunci cukup rapi! {singer} membawakan lagu "{song}" dan meraih nilai rata-rata {score} dari Dewan Juri. Sedikit lagi masuk kualifikasi penyanyi utama Mabesau!',
  },
  {
    id: 'med-2',
    tier: 'medium',
    badge: 'LOLOS AUDISI SKUADRON // NILAI 60 - 80',
    pantunLines: [
      'Prajurit komlek menjaga radar,',
      'Pantau udara siang dan malam.',
      'Suara {singer} terdengar menggelegar,',
      'Lagu "{song}" sukses bikin tentram!',
    ],
    commentaryTemplate:
      'Penampilan yang solid dari {singer}! Skor {score} pada lagu "{song}" membuktikan modulasi suara sudah terkalibrasi baik, tinggal tambah daya dorong afterburner!',
  },
  {
    id: 'med-3',
    tier: 'medium',
    badge: 'TRANSMISI JERNIH // NILAI 60 - 80',
    pantunLines: [
      'Dari Halim menuju Lanud Iswahjudi,',
      'Terbang formasi menembus awan.',
      '{singer} tampil gagah berani,',
      'Nilai {score} resmi di tangan!',
    ],
    commentaryTemplate:
      'Dewan Juri Prajurit mencatat skor {score} untuk {singer} lewat tembang "{song}". Nafas cukup panjang walau di tikungan refrein sempat ngos-ngosan sedikit!',
  },
  {
    id: 'med-4',
    tier: 'medium',
    badge: 'PERTAHANAN NADA KUAT // NILAI 60 - 80',
    pantunLines: [
      'Merakit sirkuit di ruang teknisi,',
      'Pasang resistor beserta dioda.',
      '{singer} sudah lolos audisi,',
      'Skor {score} siap naik panggung utama!',
    ],
    commentaryTemplate:
      'Lagu "{song}" berhasil diselesaikan dengan apik oleh {singer} dengan perolehan nilai {score}. Sinyal audio stabil, siap lanjut ke misi lagu berikutnya!',
  },
  {
    id: 'med-5',
    tier: 'medium',
    badge: 'MANUVER VOKAL TAKTIS // NILAI 60 - 80',
    pantunLines: [
      'Pesawat F-16 bermanuver indah,',
      'Kembali mendarat di waktu senja.',
      'Suara {singer} merdu dan gagah,',
      'Nilai {score} dari juri untuk Anda!',
    ],
    commentaryTemplate:
      'Kerja bagus {singer}! Membawakan "{song}" dengan skor {score}. Dewan Juri menilai cengkok vokalnya sudah setara pemancar gelombang mikro berdaya menengah!',
  },
  {
    id: 'med-6',
    tier: 'medium',
    badge: 'GELOMBANG HARMONIS // NILAI 60 - 80',
    pantunLines: [
      'Bunga melati tumbuh di taman,',
      'Harum semerbak di pagi buta.',
      '{singer} nyanyi penuh penghayatan,',
      'Lagu "{song}" dapat nilai {score} sempurna!',
    ],
    commentaryTemplate:
      'Skor {score} diraih oleh {singer} pada lagu "{song}"! Sebuah pencapaian taktis yang membanggakan keluarga besar Diskomlekau!',
  },
  {
    id: 'med-7',
    tier: 'medium',
    badge: 'SASARAN TERKUNCI // NILAI 60 - 80',
    pantunLines: [
      'Antena parabola menghadap langit,',
      'Menangkap sinyal dari angkasa.',
      'Walau nada tinggi agak sedikit sulit,',
      '{singer} berhasil raih skor {score} luar biasa!',
    ],
    commentaryTemplate:
      'Mantap komando! {singer} menaklukkan lagu "{song}" dengan nilai {score}. Latihan rutin di kamar mandi terbukti membuahkan hasil positif di panggung!',
  },
  {
    id: 'med-8',
    tier: 'medium',
    badge: 'BINTANG PANGGUNG KOMLEK // NILAI 60 - 80',
    pantunLines: [
      'Minum kopi hangat bersama kawan,',
      'Sambil berjaga di pos komunikasi.',
      'Penampilan {singer} sungguh menawan,',
      'Skor {score} patut kita apresiasi!',
    ],
    commentaryTemplate:
      'Tepuk tangan untuk {singer}! Lagu "{song}" ditutup dengan nilai rata-rata {score}. Siap-siap vokalis berikutnya jangan mau kalah!',
  },
  {
    id: 'med-9',
    tier: 'medium',
    badge: 'AUDIO TERKALIBRASI // NILAI 60 - 80',
    pantunLines: [
      'Kirim berita lewat sandi morse,',
      'Diterima jelas oleh operator.',
      '{singer} bernyanyi penuh ekspresi,',
      'Nilai {score} tercatat di monitor!',
    ],
    commentaryTemplate:
      'Monitor utama Diskomlekau menampilkan skor {score} untuk {singer} pada lagu "{song}". Kualitas vokal jernih bebas interferensi!',
  },
  {
    id: 'med-10',
    tier: 'medium',
    badge: 'TAKE-OFF MULUS // NILAI 60 - 80',
    pantunLines: [
      'Lampu landasan menyala terang,',
      'Memandu pilot di malam hari.',
      '{singer} tampil hati pun senang,',
      'Dapat skor {score} dari dewan juri!',
    ],
    commentaryTemplate:
      'Take-off dan landing yang mulus dari {singer} di lagu "{song}" dengan nilai akhir {score}! Mari lanjutkan kemeriahan malam keakraban Diskomlekau!',
  },

  // ============================================================================
  // KATEGORI 3: NILAI TINGGI (> 80) - SUPERSONIK, JENDERAL VOKAL, PENYANYI ASLI
  // ============================================================================
  {
    id: 'high-1',
    tier: 'high',
    badge: 'JENDERAL VOKAL SUPERSONIK // NILAI > 80',
    pantunLines: [
      'Rudal jelajah melesat cepat,',
      'Tepat mengenai jantung sasaran.',
      'Suara {singer} sungguh memikat,',
      'Skor {score} bikin juri kagum tak karuan!',
    ],
    commentaryTemplate:
      'LUAR BIASA! Daya ledak vokal setara rudal supersonik! {singer} membawakan "{song}" dan meraih nilai fantastis {score}! Jangan-jangan ini penyanyi aslinya yang sedang menyamar di Diskomlekau!',
  },
  {
    id: 'high-2',
    tier: 'high',
    badge: 'BINTANG EMAS DISKOMLEKAU // NILAI > 80',
    pantunLines: [
      'Garuda terbang tinggi di awan,',
      'Swa Bhuwana Paksa semboyan kita.',
      '{singer} bernyanyi bak bangsawan,',
      'Nilai {score} mengguncang semesta!',
    ],
    commentaryTemplate:
      'Hormat komando untuk {singer}! Lagu "{song}" ditaklukkan dengan skor {score}! Akurasi nada seakurat radar pertahanan udara generasi terbaru!',
  },
  {
    id: 'high-3',
    tier: 'high',
    badge: 'KECEPATAN MACH 3 // NILAI > 80',
    pantunLines: [
      'Sinyal satelit pancarkan cahaya,',
      'Jaringan kuat tanpa hambatan.',
      'Vokal {singer} tiada duanya,',
      'Skor {score} pecahkan rekor pangkalan!',
    ],
    commentaryTemplate:
      'Rekor panggung terguncang! {singer} mencetak nilai rata-rata {score} pada lagu "{song}". Seluruh Dewan Juri Prajurit berdiri memberikan penghormatan tertinggi!',
  },
  {
    id: 'high-4',
    tier: 'high',
    badge: 'KOMANDAN NADA TINGGI // NILAI > 80',
    pantunLines: [
      'Langit biru cerah berseri,',
      'Tempat berlatih para penerbang.',
      '{singer} tampil memukau juri,',
      'Lagu "{song}" meraih {score} gemilang!',
    ],
    commentaryTemplate:
      'Sempurna tanpa celah! Skor {score} untuk {singer} lewat lagu "{song}". Kualitas frekuensi emas Korps Elektronika TNI Angkatan Udara!',
  },
  {
    id: 'high-5',
    tier: 'high',
    badge: 'RADAR EMAS TERKUNCI // NILAI > 80',
    pantunLines: [
      'Pasang pemancar di puncak bukit,',
      'Jangkauan luas sampai seberang.',
      'Nada tinggi "{song}" yang sangat sulit,',
      'Dilalap {singer} dengan skor {score} cemerlang!',
    ],
    commentaryTemplate:
      'TV hampir retak saking dahsyatnya suara {singer}! Nilai {score} di lagu "{song}" membuktikan kelas vokal tingkat tinggi kebanggaan Diskomlekau!',
  },
  {
    id: 'high-6',
    tier: 'high',
    badge: 'PENYANYI ASLI NYAMAR // NILAI > 80',
    pantunLines: [
      'Bintang kejora bersinar terang,',
      'Menghias indah langit malam.',
      'Suara emas {singer} selalu dikenang,',
      'Skor {score} bikin suasana makin dalam!',
    ],
    commentaryTemplate:
      'Fix, penyanyi asli nyamar jadi prajurit! {singer} mengguncang panggung lewat lagu "{song}" dengan skor spektakuler {score}!',
  },
  {
    id: 'high-7',
    tier: 'high',
    badge: 'FREKUENSI ULTRA HD // NILAI > 80',
    pantunLines: [
      'Serat optik berkilau kaca,',
      'Kirimkan data secepat kilat.',
      'Penampilan {singer} luar biasa,',
      'Skor {score} membuat semua terpikat!',
    ],
    commentaryTemplate:
      'Kejernihan vokal Ultra-HD dari {singer}! Lagu "{song}" meraih skor {score} mutlak dari Dewan Juri Prajurit. Layak langsung rekaman album komando!',
  },
  {
    id: 'high-8',
    tier: 'high',
    badge: 'SWA BHUWANA PAKSA // NILAI > 80',
    pantunLines: [
      'Sayap tanah air gagah perkasa,',
      'Menjaga langit nusantara tercinta.',
      '{singer} bernyanyi penuh wibawa,',
      'Nilai {score} jadi bukti nyata!',
    ],
    commentaryTemplate:
      'Penampilan berkelas bintang lima dari {singer} pada lagu "{song}"! Dengan skor {score}, panggung Vocal Simulation System Diskomlekau resmi membara!',
  },
  {
    id: 'high-9',
    tier: 'high',
    badge: 'JUARA BERTAHAN PANGGUNG // NILAI > 80',
    pantunLines: [
      'Terbang malam memakai radar,',
      'Cuaca cerah bintang bertabur.',
      'Vokal {singer} benar-benar menggelegar,',
      'Skor {score} bikin lawan langsung mundur!',
    ],
    commentaryTemplate:
      'Standar tinggi baru telah ditetapkan! {singer} meraih nilai {score} di lagu "{song}". Siapa pun yang bernyanyi setelah ini wajib menyiapkan tenaga ekstra!',
  },
  {
    id: 'high-10',
    tier: 'high',
    badge: 'MAESTRO KORPS ELEKTRO // NILAI > 80',
    pantunLines: [
      'Dari Sabang sampai Merauke,',
      'Sinyal Diskomlek menyatu padu.',
      'Kalau {singer} sudah mulai karaoke,',
      'Skor {score} pasti langsung melaju!',
    ],
    commentaryTemplate:
      'Maestro vokal Korps Elektronika! {singer} menutup lagu "{song}" dengan nilai {score}. Mari berikan tepuk tangan paling gemuruh!',
  },

  // ============================================================================
  // KATEGORI 4: PANTUN MANUAL / PENYEMANGAT PANGGUNG (TOMBOL "PANTUN MC")
  // ============================================================================
  {
    id: 'man-1',
    tier: 'manual',
    badge: 'SMART MC DISKOMLEKAU // PANTUN KOMANDO',
    pantunLines: [
      'Burung elang terbang ke awan,',
      'Menembus kabut di pagi hari.',
      'Selamat datang para pahlawan,',
      'Bersama {singer} mari bernyanyi!',
    ],
    commentaryTemplate:
      'Halo seluruh keluarga besar Diskomlekau! Saat ini panggung bersama {singer} di lagu "{song}". Ingat semboyan kita: Prajurit yang pantang mundur walau suara hancur!',
  },
  {
    id: 'man-2',
    tier: 'manual',
    badge: 'FREKUENSI KEAKRABAN // SMART MC',
    pantunLines: [
      'Antena tinggi menjulang megah,',
      'Menangkap sinyal dari satelit.',
      'Lagu "{song}" mengalun indah,',
      'Semangat {singer} setinggi langit!',
    ],
    commentaryTemplate:
      'Sinyal keakraban Diskomlekau terkunci 100 persen! Mari seluruh prajurit dan dewan juri ramaikan panggung untuk {singer}!',
  },
  {
    id: 'man-3',
    tier: 'manual',
    badge: 'KORPS ELEKTRONIKA // SMART MC',
    pantunLines: [
      'Rakit pemancar di hari senin,',
      'Uji gelombang di hari selasa.',
      'Suara {singer} menyejukkan angin,',
      'Keluarga Diskomlekau makin bahagia!',
    ],
    commentaryTemplate:
      'Dari meja kendali Smart MC Diskomlekau: Lagu "{song}" sedang mengudara bersama {singer}. Jangan lupa kirim sorak dan nilai terbaik dari HP masing-masing!',
  },
  {
    id: 'man-4',
    tier: 'manual',
    badge: 'SEMANGAT TEMPUR VOKAL // SMART MC',
    pantunLines: [
      'Pesawat tempur siap di landasan,',
      'Mesin menderu siap mengudara.',
      'Janganlah malu jangan sungkan,',
      'Ayo {singer} goyang panggung kita!',
    ],
    commentaryTemplate:
      'Panggung Vocal Simulation System Diskomlekau semakin panas! Bersama {singer} yang sedang membawakan "{song}", mari kita bernyanyi bersama-sama!',
  },
  {
    id: 'man-5',
    tier: 'manual',
    badge: 'JIWA KORSA TNI AU // SMART MC',
    pantunLines: [
      'Bunga anggrek mekar di taman,',
      'Dipetik satu oleh sang putri.',
      'Hidup Korps Elektro penuh kebanggaan,',
      'Siang bekerja malam bernyanyi!',
    ],
    commentaryTemplate:
      'Salam Swa Bhuwana Paksa! Smart MC mengapresiasi penampilan {singer} pada lagu "{song}". Siapkan mikrofon wireless HP Anda untuk duet seru!',
  },
  {
    id: 'man-6',
    tier: 'manual',
    badge: 'PANTANG MUNDUR // SMART MC',
    pantunLines: [
      'Layar radar berwarna hijau,',
      'Memantau langit sepanjang waktu.',
      'Walau suara kadang agak kacau,',
      'Semangat {singer} tetap nomor satu!',
    ],
    commentaryTemplate:
      'Panggilan komando dari Smart MC Diskomlekau! Mari beri semangat penuh untuk {singer} di lagu "{song}". Komando!',
  },
];

// Riwayat ID pantun terakhir agar tidak mengulang pantun yang sama berturut-turut
const recentTemplateIds: string[] = [];

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
  const candidates = available.length > 0 ? available : pool;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)] || SMART_MC_TEMPLATES[0];

  recentTemplateIds.push(chosen.id);
  if (recentTemplateIds.length > 6) {
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

  return {
    id: `mc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tier,
    badge: chosen.badge,
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
    utterance.rate = 0.98;
    utterance.pitch = 1.12;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
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
      if (
        !settled &&
        sessionId === activePlaybackSessionId &&
        !window.speechSynthesis.speaking &&
        !window.speechSynthesis.pending
      ) {
        settled = true;
        onFailed();
      }
    }, 900);
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
 */
export function playSmartMcAudio(
  tierOrText: SmartMcTier | string = 'manual',
  onStart?: () => void,
  onEnd?: () => void,
  speechText?: string
): void {
  // Cegah pantun lain sebelum pantun pertama selesai!
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
  const finishOnce = () => {
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
      } catch {}
      activeMcAudioRef = null;
    }
    onEnd?.();
  };

  if (typeof window === 'undefined') {
    finishOnce();
    return;
  }

  if (!unlockedAudioPoolEl) {
    unlockedAudioPoolEl = new Audio();
    unlockedAudioPoolEl.preload = 'auto';
  }

  onStart?.();

  // Prioritaskan langsung endpoint /api/tts suara Indonesia agar tidak buang user-gesture pada file 404
  const ttsEndpoint = `/api/tts?text=${encodeURIComponent(resolvedText.slice(0, 260))}&tier=${encodeURIComponent(resolvedTier)}`;
  const offlineFallbacks = SMART_MC_OFFLINE_FALLBACK_FILES[resolvedTier] || SMART_MC_OFFLINE_FALLBACK_FILES.manual;
  const candidateFiles = [ttsEndpoint, ...offlineFallbacks];

  // Safety timer agar status speaking & ducking selalu pulih tepat waktu
  fallbackSpeechTimerRef = setTimeout(finishOnce, 12000);

  let speechAttempted = false;

  const tryPlayCandidate = (index: number) => {
    if (hasCompleted || sessionId !== activePlaybackSessionId) return;

    // Jika /api/tts gagal, coba Web Speech API (bahasa Indonesia) terlebih dahulu sebelum jingle MP3
    if (index === 1 && !speechAttempted) {
      speechAttempted = true;
      const startedSpeech = tryBrowserSpeechFallback(
        resolvedText,
        sessionId,
        finishOnce,
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
      setTimeout(finishOnce, 2200);
      return;
    }

    const src = candidateFiles[index];
    let attemptSettled = false;

    try {
      const audio = index === 0 && unlockedAudioPoolEl ? unlockedAudioPoolEl : new Audio();
      audio.onended = null;
      audio.onerror = null;
      audio.src = src;
      audio.preload = 'auto';
      audio.volume = 1.0;
      activeMcAudioRef = audio;

      const advanceToNext = () => {
        if (attemptSettled || hasCompleted || sessionId !== activePlaybackSessionId) return;
        attemptSettled = true;
        try {
          audio.onended = null;
          audio.onerror = null;
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
        finishOnce();
      };

      audio.onerror = advanceToNext;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(advanceToNext);
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
  onEnd?: () => void,
  speechText?: string
): void {
  playSmartMcAudio(tierOrText, onStart, onEnd, speechText);
}

