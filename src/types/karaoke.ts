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

export function getScoreQuote(score: number): string {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 10) return 'Mic trauma minta resign!';
  if (s <= 20) return 'Pantang mundur walau hancur!';
  if (s <= 30) return 'Nada ke utara, suara ke selatan.';
  if (s <= 40) return 'Lumayan buat uji nyali telinga.';
  if (s <= 50) return 'Bikin tetangga panik nelpon damkar!';
  if (s <= 60) return 'Nada pas, tapi napas ngos-ngosan.';
  if (s <= 70) return 'Bintang konser kamar mandi.';
  if (s <= 80) return 'Lolos audisi tingkat RT!';
  if (s <= 90) return 'Suara dahsyat, TV mau retak!';
  return 'Fix, penyanyi asli nyamar!';
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
  | 'TRIGGER_SMART_MC';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  roomId?: string;
  payload?: any;
  senderName?: string;
  timestamp: number;
}
