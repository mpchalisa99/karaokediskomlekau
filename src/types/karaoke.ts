export interface Song {
  id: string; // YouTube Video ID
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration?: string;
  publishedAt?: string;
  isCurated?: boolean;
}

export interface QueueItem {
  queueId: string;
  song: Song;
  singerName: string;
  addedAt: number;
  priority?: boolean;
}

export type SuffixFilter = 'karaoke' | 'no vocal' | 'instrumental' | 'none';

export interface CategoryPreset {
  id: string;
  label: string;
  query: string;
  description: string;
  iconName: string;
  badgeColor: string;
}

export type SoundFxType =
  | 'applause'
  | 'cheer'
  | 'airhorn'
  | 'ding'
  | 'rimshot'
  | 'boo'
  | 'laugh'
  | 'sawer'
  | 'hormat'
  | 'telor'
  | 'score_reveal';

export interface ScreenReaction {
  id: string;
  type: SoundFxType;
  label: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

export interface RemoteClientInfo {
  id: string;
  name: string;
  role: 'master' | 'client';
}

export interface RemoteNotification {
  id: string;
  message: string;
  senderName?: string;
  type?: 'info' | 'success' | 'alert';
  timestamp: number;
}

export interface JuryVote {
  clientId: string;
  juryName: string;
  score: number;
  songId: string;
  songTitle?: string;
  submittedAt: number;
}

export interface JuryScoreSummary {
  votes: JuryVote[];
  averageScore: number;
  totalVoters: number;
  calculationFormula: string;
}

export interface SongScoreData {
  song: Song;
  singerName: string;
  totalScore: number;
  grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  rankTitle: string;
  commentary: string;
  pitchAccuracy: number;
  vocalPower: number;
  stagePresence: number;
  combatSpirit: number;
  nextSong?: Song;
  nextSingerName?: string;
  evaluatedAt: number;
  juryVotes?: JuryVote[];
  juryAverageScore?: number;
  isJuryAverage?: boolean;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

const SCORE_QUOTE_TIERS: Record<number, string[]> = {
  10: [
    'Signal suara hilang dari radar! Mic minta izin pulang ke markas!',
    'Menggetarkan kaca tetangga — mode pemanasan ekstrim!',
    'Frekuensi darurat! Warga sekitar siap evakuasi telinga!',
  ],
  20: [
    'Pantang mundur walau hancur, kaca tetangga ikut bergetar!',
    'Mode pemanasan berat! Yang penting niat dan nyali tetap komando!',
    'Radar menangkap suara penuh perjuangan, tetap semangat prajurit!',
  ],
  30: [
    'Penuh penghayatan meski nada masih merdeka ke segala arah!',
    'Nada ke utara, suara ke selatan — kompas vokal perlu kalibrasi!',
    'Anti-mainstream sejati! Musik ke kiri, vokal terbang ke kanan!',
  ],
  40: [
    'Lumayan buat uji nyali telinga, penuh penghayatan meski nada bebas merdeka!',
    'Vokal eksperimental tingkat lanjut — unik dan penuh keberanian!',
    'Bikin komandan tersenyum penuh makna, lanjutkan latihan!',
  ],
  50: [
    'Aman terkendali di jalur tengah, bikin tetangga standby nelpon damkar!',
    'Setengah jalan menuju panggung juara, napas masih hemat kuota!',
    'Stabil di zona aman — sedikit lagi tembus batas kecepatan suara!',
  ],
  60: [
    'Aman terkendali di jalur tengah! Nada pas, gaya tetap gagah!',
    'Sudah mulai terdeteksi radar merdu, tinggal tambah power dikit!',
    'Penampilan solid kelas prajurit, bikin suasana makin hangat!',
  ],
  70: [
    'Mulai bikin seisi ruangan ikut bergoyang! Bintang konser panggung!',
    'Vokal mantap mengudara! Penonton mulai rebutan tepuk tangan!',
    'Goyang terus komando! Irama masuk, penghayatan tembus!',
  ],
  80: [
    'Lolos audisi tingkat markas! Mulai bikin seisi ruangan ikut bergoyang!',
    'Suara jernih sejernih layar radar! Siap jadi andalan panggung!',
    'Penampilan berkelas, seluruh ruangan langsung ikut bernyanyi!',
  ],
  90: [
    'Hampir sempurna seperti rekaman studio! Suara dahsyat, TV mau retak!',
    'Kualitas audio HD! Dewan juri langsung angkat jempol dua!',
    'Nyaris tanpa celah! Bisa bikin penyanyi aslinya ketar-ketir!',
  ],
  100: [
    'Legenda panggung Diskomlekau! Penyanyi dadakan resmi naik pangkat!',
    'Fix penyanyi asli nyamar! Nilai mutlak 100, langsung masuk hall of fame!',
    'Puncak kejayaan vokal TNI AU! Satu kompi langsung standing ovation!',
  ],
};

export function getScoreQuote(score: number, seed?: string | number): string {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const tier = Math.min(100, Math.max(10, Math.round(s / 10) * 10));
  const pool = SCORE_QUOTE_TIERS[tier] || SCORE_QUOTE_TIERS[80];
  let offset = s;
  if (seed !== undefined) {
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      offset = (offset * 31 + str.charCodeAt(i)) >>> 0;
    }
  }
  return pool[offset % pool.length];
}

export type SmartMcTier = 'low' | 'medium' | 'high' | 'manual';

export interface SmartMcAnnouncement {
  id: string;
  tier: SmartMcTier;
  badge: string;
  pantunLines: [string, string, string, string];
  commentary: string;
  fullSpeechText: string;
  singerName: string;
  songTitle: string;
  score?: number;
  triggeredBy?: string;
  isManual?: boolean;
  nextSongTitle?: string;
  timestamp: number;
}

export type WebSocketMessageType =
  | 'PING'
  | 'PONG'
  | 'HEARTBEAT'
  | 'CLIENT_CONNECTED'
  | 'JOIN_ROOM'
  | 'INIT_STATE'
  | 'STATE_UPDATE'
  | 'CLIENT_COUNT_UPDATE'
  | 'SYNC_STATE'
  | 'SYNC_QUEUE'
  | 'ADD_QUEUE_ITEM'
  | 'REMOVE_QUEUE_ITEM'
  | 'MOVE_QUEUE_ITEM'
  | 'PLAY_NOW'
  | 'SKIP_NEXT'
  | 'TOGGLE_PAUSE'
  | 'PLAY_SOUND_FX'
  | 'SET_SINGER'
  | 'MUSIC_SYNC_DELAY'
  | 'SET_MUSIC_VOLUME'
  | 'CLIENT_MIC_AUDIO_DATA'
  | 'RTC_MIC_LEVEL'
  | 'RTC_OFFER'
  | 'RTC_ANSWER'
  | 'RTC_ICE_CANDIDATE'
  | 'RTC_MIC_PARAMS'
  | 'RTC_MIC_STATUS'
  | 'SUBMIT_JURY_SCORE'
  | 'SYNC_JURY_SCORES'
  | 'TRIGGER_SMART_MC'
  | 'SMART_MC_STATUS';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  roomId?: string;
  payload?: any;
  senderName?: string;
  timestamp: number;
}
