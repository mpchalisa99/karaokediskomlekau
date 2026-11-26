import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Song, QueueItem, SuffixFilter, WebSocketMessage, RemoteClientInfo, RemoteNotification, SongScoreData, ScreenReaction, SoundFxType, JuryVote, JuryScoreSummary, getScoreQuote, SmartMcAnnouncement, SmartMcTier, ConnectionStatus } from '../types/karaoke';
import { searchKaraokeSongs, CURATED_LIBRARY, CATEGORY_PRESETS, extractYoutubeVideoId, fetchOEmbedInfo, getHitsIndonesiaSongs, getHitsIndonesiaLastUpdated, refreshIndonesianTrendingHits } from '../services/youtube';
import { audioFx } from '../services/audioFx';
import { generateSmartMcAnnouncement, speakSmartMcIndonesian, stopSmartMcSpeech, unlockSmartMcAudio, isSmartMcPlaying } from '../services/smartMc';
import { useWebRTCAudioReceiver, ActiveWirelessMic } from '../hooks/useWebRTCAudioReceiver';
import { useKaraokeScoring, LiveScoringState } from '../hooks/useKaraokeScoring';
import { getSignalingWebSocketUrl } from '../services/signaling';
import { getTvPeerId, createPeer, startPeerHeartbeat, type PeerMessage, type DataConnection } from '../services/peerManager';
import { isSmartTvDevice } from '../utils/fullscreen';
import type Peer from 'peerjs';

interface KaraokeContextType {
  // Search & Filter
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  suffixFilter: SuffixFilter;
  setSuffixFilter: (filter: SuffixFilter) => void;
  searchResults: Song[];
  isSearching: boolean;
  searchError: string | null;
  isCuratedFallback: boolean;
  activeCategory: string | null;
  executeSearch: (query?: string, categoryId?: string) => Promise<void>;
  addDirectVideoUrl: (urlOrId: string, singerName?: string, playImmediately?: boolean) => Promise<boolean>;

  // Trending Favorit Hits Indonesia
  hitsIndonesiaSongs: Song[];
  hitsLastUpdated: number | null;
  isRefreshingHits: boolean;
  refreshHitsIndonesia: () => Promise<boolean>;

  // Queue Management
  queue: QueueItem[];
  currentSong: Song | null;
  currentSingerName: string | null;
  history: Song[];
  addToQueue: (song: Song, singerName?: string, playNext?: boolean, customQueueId?: string) => void;
  removeFromQueue: (queueId: string) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  updateSingerName: (queueId: string, newSinger: string) => void;
  playSongNow: (song: Song, singerName?: string) => void;
  skipNextSong: () => void;
  replayCurrentSong: () => void;

  // Player State
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: (broadcast?: boolean) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
  changeAudioVolume: (volume: number | ((prev: number) => number)) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleMusicMute: () => void;
  handlePlayerEnded: () => void;
  playerRef: any;

  // UI States
  isQueueOpenMobile: boolean;
  setIsQueueOpenMobile: (open: boolean) => void;
  isScoreModalOpen: boolean;
  setIsScoreModalOpen: (open: boolean) => void;
  currentScoreData: SongScoreData | null;
  evaluateCurrentSong: () => void;
  notifyPlaybackTime: (currentTime: number, totalDuration?: number) => void;
  isTvMode: boolean;
  setIsTvMode: (tvMode: boolean) => void;
  defaultSingerName: string;
  setDefaultSingerName: (name: string) => void;

  // Dewan Juri Prajurit (Multi-Client Collaborative Scoring)
  juryVotes: JuryVote[];
  submitJuryVote: (score: number, juryName?: string, clientId?: string) => void;
  getJuryAverageSummary: () => JuryScoreSummary;

  // Smart MC Diskomlekau (100% Local Pantun & Indonesian Voice/TTS)
  activeMcAnnouncement: SmartMcAnnouncement | null;
  isMcSpeaking: boolean;
  isSmartMcVisible: boolean;
  setIsSmartMcVisible: (visible: boolean) => void;
  isPlayerEnded: boolean;
  triggerSmartMc: (options?: {
    singerName?: string;
    songTitle?: string;
    score?: number | null;
    forceTier?: SmartMcTier;
    triggeredBy?: string;
    announcement?: SmartMcAnnouncement;
    broadcast?: boolean;
    isManual?: boolean;
    nextSongTitle?: string;
    onSpeechEnd?: () => void;
  }) => void;
  replaySmartMcSpeech: () => void;
  dismissSmartMc: () => void;
  unlockTvAudio: () => void;

  // Remote & Sync
  roomId: string;
  connectionStatus: ConnectionStatus;
  remoteConnectedDevices: number;
  remoteClientsList: RemoteClientInfo[];
  remoteNotifications: RemoteNotification[];
  removeRemoteNotification: (id: string) => void;
  activeReactions: ScreenReaction[];
  triggerSoundFx: (type: SoundFxType | string, broadcast?: boolean, senderName?: string) => void;

  // WebRTC Wireless Microphone Audio
  activeWirelessMics: ActiveWirelessMic[];
  masterMicVolume: number;
  setMasterMicVolume: (vol: number) => void;
  masterMicEcho: number;
  setMasterMicEcho: (echo: number) => void;
  isMasterMicMuted: boolean;
  setIsMasterMicMuted: (muted: boolean) => void;
  increaseMicVolume: () => void;
  decreaseMicVolume: () => void;
  increaseMicEcho: () => void;
  decreaseMicEcho: () => void;
  isAudioSuspended: boolean;
  resumeAudio: () => void;
  setClientMicVolume: (senderId: string, volume: number) => void;
  setClientMicEcho: (senderId: string, echo: number) => void;
  toggleClientMicMute: (senderId: string) => void;

  // Web Audio API Karaoke Scoring System
  scoringState: LiveScoringState;
  isScoringActive: boolean;
  startScoring: () => void;
  stopScoringAndGetResult: () => SongScoreData | null;
  musicMediaRef: React.MutableRefObject<HTMLMediaElement | null>;

  // Vocal Sync Delay / Music Delay Adjustment (TV DelayNode buffer)
  musicDelayMs: number;
  setMusicDelayMs: (ms: number, broadcast?: boolean) => void;
  connectMusicMediaElement: (element: HTMLMediaElement) => void;
}

const KaraokeContext = createContext<KaraokeContextType | null>(null);

const STORAGE_KEYS = {
  QUEUE: 'karaoke_queue_list_v1',
  HISTORY: 'karaoke_history_list_v1',
  CURRENT: 'karaoke_current_song_v1',
  SINGER: 'karaoke_default_singer_v1',
  ROOM_ID: 'karaoke_room_id_v1',
};

export const KaraokeProvider: React.FC<{ children: React.ReactNode; initialIsTvMode?: boolean }> = ({
  children,
  initialIsTvMode = false,
}) => {
  // Stored preferences
  const [defaultSingerName, setDefaultSingerNameState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.SINGER) || 'Vokalis Bintang';
  });

  const [roomId] = useState<string>(() => {
    // Check URL first
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('room');
    if (fromUrl) {
      const clean = fromUrl.trim().toUpperCase();
      localStorage.setItem(STORAGE_KEYS.ROOM_ID, clean);
      return clean;
    }
    let stored = localStorage.getItem(STORAGE_KEYS.ROOM_ID);
    if (!stored) {
      stored = 'ROOM-' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem(STORAGE_KEYS.ROOM_ID, stored);
    }
    return stored.trim().toUpperCase();
  });

  // Player & Queue State - Selalu mulai kosong (Standby) saat pertama online hingga ada lagu yang dipilih/diputar
  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT);
      localStorage.removeItem('karaoke_current_singer_v1');
    } catch {}
    return null;
  });
  const [currentSingerName, setCurrentSingerName] = useState<string | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);
  const currentSingerNameRef = useRef<string | null>(currentSingerName);
  const setTrackedCurrentSinger = useCallback((name: string | null | undefined) => {
    const clean = name && name.trim() ? name.trim() : null;
    currentSingerNameRef.current = clean;
    setCurrentSingerName(clean);
    try {
      if (clean) {
        localStorage.setItem('karaoke_current_singer_v1', clean);
      } else {
        localStorage.removeItem('karaoke_current_singer_v1');
      }
    } catch {}
  }, []);

  const [queue, setQueue] = useState<QueueItem[]>([]);

  const [history, setHistory] = useState<Song[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Search & Favorit Hits Indonesia State
  const [hitsIndonesiaSongs, setHitsIndonesiaSongs] = useState<Song[]>(() => getHitsIndonesiaSongs());
  const [hitsLastUpdated, setHitsLastUpdated] = useState<number | null>(() => getHitsIndonesiaLastUpdated());
  const [isRefreshingHits, setIsRefreshingHits] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suffixFilter, setSuffixFilter] = useState<SuffixFilter>('karaoke');
  const [searchResults, setSearchResults] = useState<Song[]>(() => getHitsIndonesiaSongs());
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isCuratedFallback, setIsCuratedFallback] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string | null>('hits-indonesia');

  // Player Controls (Default Volume Maksimal 100% agar terdengar lantang)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const playerRef = useRef<any>(null);
  const audioVolumeRef = useRef<number>(100);
  const isMutedRef = useRef<boolean>(false);

  useEffect(() => {
    audioVolumeRef.current = audioVolume;
  }, [audioVolume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Modals & Panels
  const [isQueueOpenMobile, setIsQueueOpenMobile] = useState<boolean>(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState<boolean>(false);
  const [currentScoreData, setCurrentScoreData] = useState<SongScoreData | null>(null);
  const [isTvMode, setIsTvMode] = useState<boolean>(() => {
    if (initialIsTvMode) return true;
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'tv' || urlParams.get('tv') === '1') return true;
    return isSmartTvDevice();
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'disconnected' : 'reconnecting'
  );
  const [remoteConnectedDevices, setRemoteConnectedDevices] = useState<number>(1);
  const [remoteClientsList, setRemoteClientsList] = useState<RemoteClientInfo[]>([]);
  const [remoteNotifications, setRemoteNotifications] = useState<RemoteNotification[]>([]);
  const [activeReactions, setActiveReactions] = useState<ScreenReaction[]>([]);

  // Smart MC Diskomlekau & Audio Ducking State
  const [activeMcAnnouncement, setActiveMcAnnouncement] = useState<SmartMcAnnouncement | null>(null);
  const [isMcSpeaking, setIsMcSpeaking] = useState<boolean>(false);
  const [isSmartMcVisible, setIsSmartMcVisible] = useState<boolean>(false);
  const [isPlayerEnded, setIsPlayerEnded] = useState<boolean>(false);
  const isPlayerEndedRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const isMcSpeakingRef = useRef<boolean>(false);
  const processedMcIdsRef = useRef<Set<string>>(new Set());
  const mcDismissTimerRef = useRef<any>(null);
  const mcAudioEndWaitTimerRef = useRef<any>(null);
  const endTransitionTimerRef = useRef<any>(null);
  const isAwaitingEndTransitionQueueSkipRef = useRef<boolean>(false);
  const lastMcTriggerTimeRef = useRef<number>(0);
  const preDuckVolumeRef = useRef<number>(100);
  const isDuckingRef = useRef<boolean>(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isPlayerEndedRef.current = isPlayerEnded;
  }, [isPlayerEnded]);

  // WebSocket, Retry Queue, and BroadcastChannel references
  const wsRef = useRef<WebSocket | null>(null);
  const pendingMessagesRef = useRef<string[]>([]);
  const lastWsPongRef = useRef<number>(Date.now());
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // WebRTC Wireless Microphone Audio Receiver for Master
  const {
    activeMics: activeWirelessMics,
    masterMicVolume,
    setMasterMicVolume,
    masterMicEcho,
    setMasterMicEcho,
    isMasterMicMuted,
    setIsMasterMicMuted,
    increaseVolume: increaseMicVolume,
    decreaseVolume: decreaseMicVolume,
    increaseEcho: increaseMicEcho,
    decreaseEcho: decreaseMicEcho,
    isAudioSuspended,
    resumeAudio,
    setClientMicVolume,
    setClientMicEcho,
    toggleClientMicMute,
    handleSignalingMessage: handleWebRTCSignaling,
    attachAudioStream,
    cleanupSender,
    musicDelayMs,
    setMusicDelayMs,
    connectMusicMediaElement,
    setMusicBoostMultiplier,
  } = useWebRTCAudioReceiver({
    socketRef: wsRef,
    roomId,
  });

  // PeerJS P2P TV Master references (Serverless WebRTC via 0.peerjs.com)
  const peerRef = useRef<Peer | null>(null);
  const peerConnectionsRef = useRef<Map<string, DataConnection>>(new Map());

  // Reference to HTMLMediaElement for Web Audio API music analyzer
  const musicMediaRef = useRef<HTMLMediaElement | null>(null);

  // Active WebRTC microphone audio stream (from mobile broadcaster)
  const activeMicStream =
    activeWirelessMics.length > 0 && activeWirelessMics[0].stream
      ? activeWirelessMics[0].stream
      : null;

  // Direct Hardware & IFrame Volume Controller: Applies volume changes instantly to YouTube player or any iframe in TV/Master
  const applyHardwarePlayerVolume = useCallback((volume: number, muted?: boolean) => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.setVolume === 'function') {
          playerRef.current.setVolume(volume);
        }
        if (muted && typeof playerRef.current.mute === 'function') {
          playerRef.current.mute();
        } else if (!muted && typeof playerRef.current.unMute === 'function') {
          playerRef.current.unMute();
        }
      } catch {}
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('iframe').forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: [] }),
            '*'
          );
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }),
            '*'
          );
        } catch {}
      });
    }
  }, []);

  // Audio Ducking: kecilkan sementara musik karaoke saat Smart MC berbicara, lalu kembalikan ke volume asal
  const startAudioDucking = useCallback(() => {
    if (!isDuckingRef.current) {
      preDuckVolumeRef.current = audioVolumeRef.current;
      isDuckingRef.current = true;
    }
    const duckedVol = Math.max(15, Math.round(preDuckVolumeRef.current * 0.25));
    applyHardwarePlayerVolume(duckedVol, isMutedRef.current);
    setMusicBoostMultiplier(0.35);
  }, [applyHardwarePlayerVolume, setMusicBoostMultiplier]);

  const stopAudioDucking = useCallback(() => {
    if (!isDuckingRef.current) return;
    isDuckingRef.current = false;
    const restoreVol = Math.max(0, Math.min(100, preDuckVolumeRef.current || audioVolumeRef.current));
    applyHardwarePlayerVolume(restoreVol, isMutedRef.current);
    setMusicBoostMultiplier(1.45);
  }, [applyHardwarePlayerVolume, setMusicBoostMultiplier]);

  // Unlock Audio Smart MC & AudioContext pada interaksi pertama layar TV/Master
  const unlockTvAudio = useCallback(() => {
    unlockSmartMcAudio();
    resumeAudio();
  }, [resumeAudio]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFirstInteraction = () => {
      unlockTvAudio();
    };
    window.addEventListener('click', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true, passive: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [unlockTvAudio]);

  // Refresh Favorit Hits Indonesia dengan tren musik YouTube terkini (100% gratis + cache localStorage)
  const refreshHitsIndonesia = useCallback(async (): Promise<boolean> => {
    setIsRefreshingHits(true);
    try {
      const result = await refreshIndonesianTrendingHits();
      setHitsIndonesiaSongs(result.songs);
      setHitsLastUpdated(result.updatedAt);
      if (activeCategory === 'hits-indonesia' && !searchQuery.trim()) {
        setSearchResults(result.songs);
        setIsCuratedFallback(true);
      }
      return result.fromOnline;
    } catch {
      return false;
    } finally {
      setIsRefreshingHits(false);
    }
  }, [activeCategory, searchQuery]);

  // Auto-refresh Favorit Hits Indonesia secara otomatis setiap aplikasi dijalankan
  useEffect(() => {
    refreshIndonesianTrendingHits()
      .then((res) => {
        setHitsIndonesiaSongs(res.songs);
        setHitsLastUpdated(res.updatedAt);
        if (activeCategory === 'hits-indonesia' && !searchQuery.trim()) {
          setSearchResults(res.songs);
        }
      })
      .catch(() => {});
  }, []);

  // Dewan Juri Prajurit (Multi-Client Collaborative Scoring)
  const [juryVotes, setJuryVotes] = useState<JuryVote[]>([]);

  // Reset jury votes and close any open score modal on song change
  useEffect(() => {
    setJuryVotes([]);
    setIsScoreModalOpen(false);
    setCurrentScoreData(null);
  }, [currentSong?.id]);

  // Web Audio API Karaoke Scoring Engine (dual AnalyserNode for mic and music)
  const {
    liveState: scoringState,
    isScoringActive,
    startScoring,
    stopScoringAndGetResult,
  } = useKaraokeScoring({
    currentSong,
    singerName: defaultSingerName,
    isPlaying,
    micStream: activeMicStream,
    musicMediaElement: musicMediaRef.current,
    triggerSoundFx: (type) => triggerSoundFx(type),
    nextItem: queue.length > 0 ? queue[0] : undefined,
    masterMicLevel: activeWirelessMics.length > 0 ? (activeWirelessMics[0].audioLevel || 0) : 0,
  });

  // Automatically start scoring session when song playback begins
  useEffect(() => {
    if (isPlaying && currentSong) {
      startScoring();
    }
  }, [isPlaying, currentSong, startScoring]);

  const addRemoteNotification = useCallback((message: string, senderName?: string, type: 'info' | 'success' | 'alert' = 'info') => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNotif: RemoteNotification = {
      id,
      message,
      senderName,
      type,
      timestamp: Date.now(),
    };
    setRemoteNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setRemoteNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const removeRemoteNotification = useCallback((id: string) => {
    setRemoteNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Persist storage helpers
  const setDefaultSingerName = (name: string) => {
    setDefaultSingerNameState(name);
    localStorage.setItem(STORAGE_KEYS.SINGER, name);
  };

  // Keep localStorage updated
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    if (currentSong) {
      localStorage.setItem(STORAGE_KEYS.CURRENT, JSON.stringify(currentSong));
    }
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);

  const isHydratedRef = useRef<boolean>(false);
  const isServerUpdateRef = useRef<boolean>(false);
  const lastLocalActionTimeRef = useRef<number>(0);
  const processedSyncIdsRef = useRef<Set<string>>(new Set());

  const markSyncIdProcessed = useCallback((id?: string | null) => {
    if (!id) return;
    processedSyncIdsRef.current.add(id);
    if (processedSyncIdsRef.current.size > 120) {
      const oldest = processedSyncIdsRef.current.values().next().value;
      if (oldest) processedSyncIdsRef.current.delete(oldest);
    }
  }, []);

  const applyServerCurrentSong = useCallback((nextSong: Song | null | undefined) => {
    if (!nextSong || !nextSong.id) return;
    setCurrentSong((prev) => {
      if (prev && prev.id === nextSong.id && prev.title === nextSong.title) return prev;
      isServerUpdateRef.current = true;
      return nextSong;
    });
  }, []);

  const applyServerQueue = useCallback((nextQueue: QueueItem[] | undefined) => {
    if (!Array.isArray(nextQueue)) return;
    setQueue((prev) => {
      if (
        prev.length === nextQueue.length &&
        prev.every(
          (q, i) =>
            q.queueId === nextQueue[i]?.queueId &&
            q.song?.id === nextQueue[i]?.song?.id &&
            q.singerName === nextQueue[i]?.singerName
        )
      ) {
        return prev;
      }
      isServerUpdateRef.current = true;
      return nextQueue;
    });
  }, []);

  const applyServerClients = useCallback((nextClients: RemoteClientInfo[] | undefined) => {
    if (!Array.isArray(nextClients)) return;
    setRemoteClientsList((prev) => {
      if (
        prev.length === nextClients.length &&
        prev.every((c, i) => c.id === nextClients[i]?.id && c.name === nextClients[i]?.name)
      ) {
        return prev;
      }
      return nextClients;
    });
  }, []);

  // Sync Master state to backend server so newly scanned Android clients get latest data
  const syncStateToServer = useCallback(() => {
    if (!isHydratedRef.current) return;

    // 1. Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'SYNC_STATE',
            roomId,
            payload: {
              currentSong,
              currentSinger: currentSingerNameRef.current,
              isPlaying,
              queue,
              musicDelayMs,
              musicVolume: audioVolume,
              isMuted,
            },
          })
        );
      } catch (err) {
        console.warn('WS sync state error:', err);
      }
    }

    // 2. HTTP POST sync
    fetch(`/api/room/${encodeURIComponent(roomId)}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentSong,
        currentSinger: currentSingerNameRef.current,
        isPlaying,
        queue,
        musicDelayMs,
        musicVolume: audioVolume,
        isMuted,
      }),
    }).catch(() => {});
  }, [roomId, currentSong, isPlaying, queue, musicDelayMs, audioVolume, isMuted]);

  // Connect music media element to TV DelayNode pipeline on mount
  useEffect(() => {
    if (musicMediaRef.current) {
      connectMusicMediaElement(musicMediaRef.current);
    }
  }, [connectMusicMediaElement]);

  // Push server sync on local changes (debounced, suppressed when change originated from server)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (isServerUpdateRef.current) {
      isServerUpdateRef.current = false;
      return;
    }
    lastLocalActionTimeRef.current = Date.now();
    const timer = setTimeout(syncStateToServer, 200);
    return () => clearTimeout(timer);
  }, [syncStateToServer]);

  // Real-time WebSocket connection to server with exponential backoff, heartbeat watchdog & retry queue
  useEffect(() => {
    let socket: WebSocket | null = null;
    let sseSource: EventSource | null = null;
    let reconnectTimer: any = null;
    let pingInterval: any = null;
    let retryCount = 0;
    let isDisposed = false;

    const flushPendingMessages = (activeSocket: WebSocket | null) => {
      if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;
      while (pendingMessagesRef.current.length > 0) {
        const queuedMsg = pendingMessagesRef.current.shift();
        if (!queuedMsg) continue;
        try {
          activeSocket.send(queuedMsg);
        } catch {
          pendingMessagesRef.current.unshift(queuedMsg);
          break;
        }
      }
    };

    const fetchRoomState = async () => {
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: 'master-cockpit', singerName: 'Layar Utama', role: 'master' }),
        });
        const data = await res.json();
        if (data.success && data.room) {
          setConnectionStatus('connected');
          const isRecentLocalAction = Date.now() - lastLocalActionTimeRef.current < 3500;
          if (!isRecentLocalAction && !isPlayerEndedRef.current) {
            if (data.room.currentSong) {
              applyServerCurrentSong(data.room.currentSong);
            }
            if (data.room.currentSinger !== undefined) {
              setTrackedCurrentSinger(data.room.currentSinger);
            }
            if (typeof data.room.isPlaying === 'boolean') {
              setIsPlaying((prev) => (prev === data.room.isPlaying ? prev : data.room.isPlaying));
            }
            if (Array.isArray(data.room.queue)) {
              applyServerQueue(data.room.queue);
            }
          }
          if (Array.isArray(data.room.juryVotes)) {
            setJuryVotes(data.room.juryVotes);
          }
          if (typeof data.room.musicDelayMs === 'number') {
            setMusicDelayMs(data.room.musicDelayMs, false);
          }
          if (typeof data.room.musicVolume === 'number') {
            const nextVol = Math.max(0, Math.min(100, Math.round(data.room.musicVolume)));
            setAudioVolume((prev) => (prev === nextVol ? prev : nextVol));
          }
          if (typeof data.room.isMuted === 'boolean') {
            setIsMuted((prev) => (prev === data.room.isMuted ? prev : data.room.isMuted));
          }
          if (data.clientCount !== undefined) {
            setRemoteConnectedDevices((prev) => (prev === data.clientCount ? prev : data.clientCount));
          }
          if (Array.isArray(data.room.clients)) {
            applyServerClients(data.room.clients);
          }
        }
      } catch (e) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setConnectionStatus('disconnected');
        } else if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          setConnectionStatus('reconnecting');
        }
      } finally {
        isHydratedRef.current = true;
      }
    };

    // Initial hydration from room server
    fetchRoomState();

    const connectWs = () => {
      if (isDisposed) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setConnectionStatus('disconnected');
        reconnectTimer = setTimeout(connectWs, 3000);
        return;
      }
      try {
        const wsUrl = getSignalingWebSocketUrl({
          roomId,
          role: 'master',
          singerName: 'Layar Utama',
          clientId: 'master-cockpit',
        });

        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          retryCount = 0;
          lastWsPongRef.current = Date.now();
          setConnectionStatus('connected');
          flushPendingMessages(socket);
          fetchRoomState();
          if (pingInterval) clearInterval(pingInterval);
          // Heartbeat ping + watchdog every 4.5 seconds
          pingInterval = setInterval(() => {
            if (!socket) return;
            if (socket.readyState === WebSocket.OPEN) {
              if (Date.now() - lastWsPongRef.current > 14000) {
                setConnectionStatus('reconnecting');
                try {
                  socket.close();
                } catch {}
                return;
              }
              try {
                socket.send(JSON.stringify({ type: 'PING', roomId, timestamp: Date.now() }));
              } catch {}
            }
          }, 4500);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data || !data.type) return;

            lastWsPongRef.current = Date.now();
            setConnectionStatus('connected');

            switch (data.type) {
              case 'PONG':
                break;

              case 'HEARTBEAT': {
                try {
                  socket?.send(JSON.stringify({ type: 'PONG', roomId, timestamp: Date.now() }));
                } catch {}
                break;
              }

              case 'INIT_STATE':
              case 'STATE_UPDATE': {
                if (data.payload) {
                  if (data.payload.currentSong !== undefined && data.payload.currentSong !== null) {
                    applyServerCurrentSong(data.payload.currentSong);
                  }
                  if (data.payload.currentSinger !== undefined) {
                    setTrackedCurrentSinger(data.payload.currentSinger);
                  }
                  if (data.payload.isPlaying !== undefined) {
                    setIsPlaying((prev) => (prev === data.payload.isPlaying ? prev : data.payload.isPlaying));
                  }
                  if (Array.isArray(data.payload.queue)) {
                    applyServerQueue(data.payload.queue);
                  }
                  if (Array.isArray(data.payload.juryVotes)) {
                    setJuryVotes(data.payload.juryVotes);
                  }
                  if (typeof data.payload.musicVolume === 'number') {
                    const nextVol = Math.max(0, Math.min(100, Math.round(data.payload.musicVolume)));
                    setAudioVolume((prev) => (prev === nextVol ? prev : nextVol));
                  }
                  if (typeof data.payload.isMuted === 'boolean') {
                    setIsMuted((prev) => (prev === data.payload.isMuted ? prev : data.payload.isMuted));
                  }
                  if (data.payload.clientCount !== undefined) {
                    setRemoteConnectedDevices((prev) => (prev === data.payload.clientCount ? prev : data.payload.clientCount));
                  }
                  if (Array.isArray(data.payload.clients)) {
                    applyServerClients(data.payload.clients);
                  }
                }
                break;
              }

              case 'ADD_QUEUE_ITEM': {
                const item = data.payload?.item;
                const sender = data.payload?.senderName || 'Prajurit (HP)';
                if (item?.queueId) markSyncIdProcessed(item.queueId);
                if (item?.requestId) markSyncIdProcessed(item.requestId);
                if (Array.isArray(data.payload?.queue)) {
                  data.payload.queue.forEach((q: any) => {
                    if (q?.queueId) markSyncIdProcessed(q.queueId);
                    if (q?.requestId) markSyncIdProcessed(q.requestId);
                  });
                  setQueue(data.payload.queue);
                } else if (item && item.song) {
                  setQueue((prev) => {
                    if (prev.some((q) => q.queueId === item.queueId)) return prev;
                    if (item.priority) {
                      return [item, ...prev];
                    }
                    return [...prev, item];
                  });
                }
                audioFx.playDing();
                const songTitle = item?.song?.title || 'lagu baru';
                addRemoteNotification(
                  `📱 ${sender} menambahkan lagu "${songTitle.slice(0, 30)}..." ke antrean!`,
                  sender,
                  'success'
                );
                break;
              }

              case 'REMOVE_QUEUE_ITEM': {
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                } else if (data.payload?.queueId) {
                  const queueId = data.payload.queueId;
                  setQueue((prev) => prev.filter((q) => q.queueId !== queueId));
                }
                break;
              }

              case 'SYNC_QUEUE': {
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                  const sender = data.payload?.senderName;
                  if (sender && sender !== 'Layar Utama') {
                    addRemoteNotification(`📱 ${sender} memperbarui urutan antrean lagu!`, sender, 'info');
                  }
                }
                break;
              }

              case 'PLAY_NOW': {
                if (data.payload?.song) {
                  const sender = data.payload?.singerName || 'HP';
                  setCurrentSong(data.payload.song);
                  setTrackedCurrentSinger(sender);
                  setIsPlaying(true);
                  addRemoteNotification(`📱 ${sender} mengganti lagu: "${data.payload.song.title.slice(0, 30)}..."`, sender, 'info');
                }
                break;
              }

              case 'PLAY_SOUND_FX': {
                const sound = data.payload?.sound;
                const sender = data.payload?.senderName || 'Prajurit (HP)';
                if (sound) {
                  triggerSoundFx(sound, false, sender);
                  addRemoteNotification(
                    sound === 'boo' ? `👎 Sorak HUUU dari ${sender}!` : `🎉 Reaksi "${sound}" dari ${sender}!`,
                    sender,
                    sound === 'boo' ? 'alert' : 'info'
                  );
                }
                break;
              }

              case 'CLIENT_COUNT_UPDATE': {
                if (data.payload?.clientCount !== undefined) {
                  setRemoteConnectedDevices(data.payload.clientCount);
                }
                if (Array.isArray(data.payload?.clients)) {
                  setRemoteClientsList(data.payload.clients);
                }
                if (data.payload?.joinedName && data.payload.joinedName !== 'Layar Utama') {
                  addRemoteNotification(`📱 ${data.payload.joinedName} berhasil terhubung dari HP!`, undefined, 'info');
                }
                break;
              }

              case 'SKIP_NEXT': {
                if (data.payload?.currentSong) {
                  setCurrentSong(data.payload.currentSong);
                  setTrackedCurrentSinger(data.payload?.currentSinger ?? data.payload?.singerName ?? null);
                  setIsPlaying(true);
                } else if (data.payload?.currentSong === null) {
                  setTrackedCurrentSinger(null);
                }
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                } else {
                  skipNextSong(false);
                }
                break;
              }

              case 'TOGGLE_PAUSE': {
                if (data.payload?.isPlaying !== undefined) {
                  setIsPlaying(data.payload.isPlaying);
                } else {
                  setIsPlaying((prev) => !prev);
                }
                break;
              }

              case 'SET_VOLUME':
              case 'SET_MUSIC_VOLUME': {
                const vol = typeof data.payload === 'number' ? data.payload : data.payload?.volume;
                const remoteMuted = typeof data.payload === 'object' ? data.payload?.isMuted : undefined;
                const remoteSender = typeof data.payload === 'object' ? data.payload?.senderName : undefined;
                if (typeof vol === 'number') {
                  const clamped = Math.max(0, Math.min(100, Math.round(vol)));
                  setAudioVolume(clamped);
                  const effectiveMute = typeof remoteMuted === 'boolean' ? remoteMuted : false;
                  if (typeof remoteMuted === 'boolean') {
                    setIsMuted(remoteMuted);
                  }
                  applyHardwarePlayerVolume(clamped, effectiveMute);
                } else if (typeof remoteMuted === 'boolean') {
                  setIsMuted(remoteMuted);
                  applyHardwarePlayerVolume(audioVolume, remoteMuted);
                }
                if (remoteSender && remoteSender !== 'Layar Utama') {
                  addRemoteNotification(
                    remoteMuted ? `🔇 ${remoteSender} membisukan musik TV` : `🔊 ${remoteSender} mengatur volume musik: ${vol ?? audioVolume}%`,
                    remoteSender,
                    'info'
                  );
                }
                break;
              }

              case 'CLIENT_MIC_AUDIO_DATA':
              case 'RTC_MIC_LEVEL':
              case 'RTC_OFFER':
              case 'RTC_ICE_CANDIDATE':
              case 'RTC_MIC_PARAMS':
              case 'MUSIC_SYNC_DELAY': {
                handleWebRTCSignaling(data);
                break;
              }

              case 'RTC_MIC_STATUS': {
                handleWebRTCSignaling(data);
                const isMicOn = data.payload?.isMicOn;
                const sender = data.payload?.senderName || 'Prajurit (HP)';
                if (isMicOn) {
                  addRemoteNotification(
                    `🎤 ${sender} mengaktifkan Mikrofon Wireless HP! Suara disiarkan langsung ke speaker.`,
                    sender,
                    'success'
                  );
                } else {
                  addRemoteNotification(
                    `🎤 ${sender} mematikan Mikrofon Wireless HP.`,
                    sender,
                    'info'
                  );
                }
                break;
              }

              case 'SUBMIT_JURY_SCORE':
              case 'SYNC_JURY_SCORES': {
                if (Array.isArray(data.payload?.votes)) {
                  setJuryVotes(data.payload.votes);
                } else if (data.payload?.lastVote) {
                  const newVote = data.payload.lastVote;
                  const normName = (newVote.juryName || '').trim().toLowerCase();
                  setJuryVotes((prev) => {
                    const filtered = prev.filter(
                      (v) => (v.juryName || '').trim().toLowerCase() !== normName && v.clientId !== newVote.clientId
                    );
                    return [...filtered, newVote];
                  });
                }
                if (data.payload?.lastVote) {
                  const v = data.payload.lastVote;
                  addRemoteNotification(
                    `⚖️ ${v.juryName} memberi nilai: ${v.score}!`,
                    v.juryName,
                    'info'
                  );
                }
                break;
              }

              case 'SHOW_PANTUN':
              case 'TRIGGER_SMART_MC': {
                const incomingId = data.payload?.announcement?.id;
                const alreadyHandled = Boolean(incomingId && processedMcIdsRef.current.has(incomingId));
                if (!alreadyHandled && !isMcSpeakingRef.current && !isSmartMcPlaying()) {
                  const sender = data.payload?.senderName || data.payload?.singerName || 'Prajurit (HP)';
                  const singer = data.payload?.namaVokalis || data.payload?.singerName || currentSingerNameRef.current || defaultSingerName;
                  const song = data.payload?.judulLagu || data.payload?.songTitle || currentSong?.title;

                  let announcement = data.payload?.announcement
                    ? { ...data.payload.announcement, isManual: true }
                    : generateSmartMcAnnouncement({
                        singerName: singer,
                        songTitle: song,
                        score: typeof data.payload?.score === 'number' ? data.payload.score : currentScoreData?.totalScore,
                        forceTier: data.payload?.forceTier,
                        triggeredBy: sender,
                        isManual: true,
                      });

                  if (data.payload?.sampiran) announcement.sampiran = data.payload.sampiran;
                  if (data.payload?.isi) announcement.isi = data.payload.isi;
                  if (data.payload?.komentar) announcement.komentar = data.payload.komentar;
                  announcement.namaVokalis = singer;
                  announcement.judulLagu = song;

                  setIsSmartMcVisible(true);
                  triggerSmartMcRef.current({
                    singerName: singer,
                    songTitle: song,
                    score: typeof data.payload?.score === 'number' ? data.payload.score : currentScoreData?.totalScore,
                    forceTier: data.payload?.forceTier,
                    triggeredBy: sender,
                    announcement,
                    isManual: true,
                    broadcast: false,
                  });
                  addRemoteNotification(`🎙️ ${sender} memanggil Pantun Smart MC Diskomlekau!`, sender, 'success');
                }
                break;
              }
            }
          } catch (err) {
            console.warn('Master WS parse error:', err);
          }
        };

        socket.onclose = () => {
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          if (isDisposed) return;
          setConnectionStatus(
            typeof navigator !== 'undefined' && navigator.onLine === false ? 'disconnected' : 'reconnecting'
          );
          retryCount++;
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 15000);
          reconnectTimer = setTimeout(connectWs, delay);
        };

        socket.onerror = () => {
          try {
            socket?.close();
          } catch {}
        };
      } catch (e) {
        setConnectionStatus('reconnecting');
        connectSSE();
      }
    };

    const connectSSE = () => {
      try {
        sseSource = new EventSource(`/api/room/${encodeURIComponent(roomId)}/events?role=master&name=Layar%20Utama`);
        sseSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT_STATE' || data.type === 'STATE_UPDATE') {
              if (data.payload?.currentSong !== undefined && data.payload.currentSong !== null) {
                applyServerCurrentSong(data.payload.currentSong);
              }
              if (data.payload?.currentSinger !== undefined) {
                setTrackedCurrentSinger(data.payload.currentSinger);
              }
              if (data.payload?.isPlaying !== undefined) {
                setIsPlaying((prev) => (prev === data.payload.isPlaying ? prev : data.payload.isPlaying));
              }
              if (Array.isArray(data.payload?.queue)) {
                applyServerQueue(data.payload.queue);
              }
              if (data.payload?.clientCount !== undefined) {
                setRemoteConnectedDevices((prev) => (prev === data.payload.clientCount ? prev : data.payload.clientCount));
              }
              if (Array.isArray(data.payload?.clients)) {
                applyServerClients(data.payload.clients);
              }
            } else if (data.type === 'SYNC_QUEUE' && Array.isArray(data.payload?.queue)) {
              applyServerQueue(data.payload.queue);
            } else if (data.type === 'PLAY_NOW' && data.payload?.song) {
              applyServerCurrentSong(data.payload.song);
              setTrackedCurrentSinger(data.payload?.singerName || null);
              setIsPlaying(true);
            } else if (data.type === 'SKIP_NEXT') {
              if (data.payload?.currentSong) {
                applyServerCurrentSong(data.payload.currentSong);
                setTrackedCurrentSinger(data.payload?.currentSinger ?? data.payload?.singerName ?? null);
                setIsPlaying(true);
              } else if (data.payload?.currentSong === null) {
                setTrackedCurrentSinger(null);
              }
              if (Array.isArray(data.payload?.queue)) {
                applyServerQueue(data.payload.queue);
              } else {
                skipNextSong();
              }
            } else if (data.type === 'ADD_QUEUE_ITEM') {
              if (Array.isArray(data.payload?.queue)) {
                applyServerQueue(data.payload.queue);
              } else if (data.payload?.item) {
                setQueue((prev) => {
                  if (prev.some((q) => q.queueId === data.payload.item.queueId)) return prev;
                  return data.payload.item.priority ? [data.payload.item, ...prev] : [...prev, data.payload.item];
                });
              }
              audioFx.playDing();
              addRemoteNotification(`📱 HP Prajurit menambahkan lagu ke antrean!`);
            } else if (data.type === 'REMOVE_QUEUE_ITEM') {
              if (Array.isArray(data.payload?.queue)) {
                applyServerQueue(data.payload.queue);
              } else if (data.payload?.queueId) {
                setQueue((prev) => prev.filter((q) => q.queueId !== data.payload.queueId));
              }
            } else if (data.type === 'CLIENT_COUNT_UPDATE') {
              if (data.payload?.clientCount !== undefined) {
                setRemoteConnectedDevices((prev) => (prev === data.payload.clientCount ? prev : data.payload.clientCount));
              }
              if (Array.isArray(data.payload?.clients)) {
                applyServerClients(data.payload.clients);
              }
            } else if (data.type === 'SHOW_PANTUN' || data.type === 'TRIGGER_SMART_MC') {
              const incomingId = data.payload?.announcement?.id;
              const alreadyHandled = Boolean(incomingId && processedMcIdsRef.current.has(incomingId));
              if (!alreadyHandled && !isMcSpeakingRef.current && !isSmartMcPlaying()) {
                const sender = data.payload?.senderName || data.payload?.singerName || 'Prajurit (HP)';
                const singer = data.payload?.namaVokalis || data.payload?.singerName || currentSingerNameRef.current || defaultSingerName;
                const song = data.payload?.judulLagu || data.payload?.songTitle || currentSong?.title;
                let announcement = data.payload?.announcement
                  ? { ...data.payload.announcement, isManual: true }
                  : generateSmartMcAnnouncement({
                      singerName: singer,
                      songTitle: song,
                      score: typeof data.payload?.score === 'number' ? data.payload.score : undefined,
                      forceTier: data.payload?.forceTier,
                      triggeredBy: sender,
                      isManual: true,
                    });
                if (data.payload?.sampiran) announcement.sampiran = data.payload.sampiran;
                if (data.payload?.isi) announcement.isi = data.payload.isi;
                if (data.payload?.komentar) announcement.komentar = data.payload.komentar;
                announcement.namaVokalis = singer;
                announcement.judulLagu = song;
                setIsSmartMcVisible(true);
                triggerSmartMcRef.current({
                  singerName: singer,
                  songTitle: song,
                  score: typeof data.payload?.score === 'number' ? data.payload.score : undefined,
                  forceTier: data.payload?.forceTier,
                  triggeredBy: sender,
                  announcement,
                  isManual: true,
                  broadcast: false,
                });
                addRemoteNotification(`🎙️ ${sender} memanggil Pantun Smart MC Diskomlekau!`, sender, 'success');
              }
            }
          } catch (err) {}
        };
      } catch (err) {}
    };

    connectWs();

    // Fast auto-reconnect on visibility change, network return, or window focus
    const handleWakeReconnect = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setConnectionStatus('disconnected');
        return;
      }
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setConnectionStatus('reconnecting');
        connectWs();
      } else {
        flushPendingMessages(socket);
      }
      fetchRoomState();
    };

    const handleOffline = () => {
      setConnectionStatus('disconnected');
    };

    document.addEventListener('visibilitychange', handleWakeReconnect);
    window.addEventListener('online', handleWakeReconnect);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleWakeReconnect);
    window.addEventListener('pageshow', handleWakeReconnect);

    // Polling ke /api/room-sync?room=ROOM_ID setiap 1,5 detik untuk sinkronisasi andal di Vercel & Smart TV Samsung (Tizen OS)
    const pollRoomSync = async () => {
      try {
        const res = await fetch(`/api/room-sync?room=${encodeURIComponent(roomId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success || !data?.room) return;
        setConnectionStatus('connected');

        const serverRoom = data.room;
        const isRecentLocalAction = Date.now() - lastLocalActionTimeRef.current < 2000;

        // 1. Gabungkan antrean baru dari /api/room-sync tanpa duplikat atau lagu yang sudah diproses
        const rawServerQueue: any[] = Array.isArray(serverRoom.queue) ? serverRoom.queue : [];
        const freshItems = rawServerQueue.filter((item) => {
          if (!item?.song?.id) return false;
          if (item.queueId && processedSyncIdsRef.current.has(item.queueId)) return false;
          if (item.requestId && processedSyncIdsRef.current.has(item.requestId)) return false;
          return true;
        });

        if (!isRecentLocalAction && freshItems.length > 0) {
          if (!currentSongRef.current) {
            // Jika layar TV masih kosong & belum ada lagu diputar, langsung putar lagu pertama lalu masukkan sisanya ke antrean
            const [firstItem, ...restItems] = freshItems;
            markSyncIdProcessed(firstItem.queueId);
            markSyncIdProcessed(firstItem.requestId);
            restItems.forEach((it) => {
              markSyncIdProcessed(it.queueId);
              markSyncIdProcessed(it.requestId);
            });

            if (firstItem?.song?.id) {
              const firstSinger = firstItem.singerName || defaultSingerName;
              isServerUpdateRef.current = true;
              currentSongRef.current = firstItem.song;
              setCurrentSong(firstItem.song);
              setTrackedCurrentSinger(firstSinger);
              setIsPlaying(true);

              if (restItems.length > 0) {
                setQueue((prev) => {
                  const next = [...prev];
                  for (const rItem of restItems) {
                    const dup = next.some(
                      (q) =>
                        q.queueId === rItem.queueId ||
                        (rItem.requestId && (q as any).requestId === rItem.requestId)
                    );
                    if (!dup) {
                      if (rItem.priority) next.unshift(rItem);
                      else next.push(rItem);
                    }
                  }
                  return next;
                });
              }

              // Tandai item pertama sudah dikonsumsi oleh Master TV di /api/room-sync
              fetch('/api/room-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId,
                  action: 'PLAY_NOW',
                  song: firstItem.song,
                  singerName: firstSinger,
                  consumedQueueId: firstItem.queueId,
                }),
              }).catch(() => {});

              audioFx.playDing();
              addRemoteNotification(
                `📱 ${firstSinger} memutar lagu "${(firstItem.song.title || '').slice(0, 28)}..."`,
                firstSinger,
                'success'
              );

              if (!isMcSpeakingRef.current && !isSmartMcPlaying()) {
                setTimeout(() => {
                  triggerSmartMcRef.current({
                    singerName: firstSinger,
                    songTitle: firstItem.song.title,
                    isManual: true,
                    broadcast: true,
                  });
                }, 350);
              }
            }
          } else {
            const addedTitles: { title: string; singer: string }[] = [];
            setQueue((prev) => {
              const next = [...prev];
              let changed = false;
              for (const item of freshItems) {
                markSyncIdProcessed(item.queueId);
                markSyncIdProcessed(item.requestId);
                const alreadyExists = next.some(
                  (q) =>
                    q.queueId === item.queueId ||
                    (item.requestId && (q as any).requestId === item.requestId) ||
                    (q.song?.id === item.song.id && q.singerName === item.singerName && Math.abs((q.addedAt || 0) - (item.addedAt || 0)) < 3000)
                );
                if (!alreadyExists) {
                  if (item.priority) next.unshift(item);
                  else next.push(item);
                  changed = true;
                  addedTitles.push({ title: item.song.title || 'Lagu baru', singer: item.singerName || 'Prajurit (HP)' });
                }
              }
              if (changed) isServerUpdateRef.current = true;
              return changed ? next : prev;
            });

            if (addedTitles.length > 0) {
              audioFx.playDing();
              const latestAdded = addedTitles[addedTitles.length - 1];
              addRemoteNotification(
                `📱 ${latestAdded.singer} menambahkan "${latestAdded.title.slice(0, 28)}..." ke antrean!`,
                latestAdded.singer,
                'success'
              );
            }
          }
        }

        // 2. Sinkronisasi lagu yang sedang diputar jika TV masih kosong dan ada PLAY_NOW dari HP
        const serverPlaying = serverRoom.nowPlaying || serverRoom.currentSong;
        if (!isRecentLocalAction && !isPlayerEndedRef.current && !currentSongRef.current && serverPlaying?.id) {
          isServerUpdateRef.current = true;
          currentSongRef.current = serverPlaying;
          applyServerCurrentSong(serverPlaying);
          if (serverRoom.currentSinger !== undefined) {
            setTrackedCurrentSinger(serverRoom.currentSinger);
          }
          setIsPlaying(true);
        }

        // 3. Sinkronisasi Pantun Smart MC dari /api/room-sync
        if (serverRoom.isSmartMcVisible && serverRoom.activeMcAnnouncement?.id) {
          const mcAnn = serverRoom.activeMcAnnouncement;
          if (!processedMcIdsRef.current.has(mcAnn.id) && !isMcSpeakingRef.current && !isSmartMcPlaying()) {
            setIsSmartMcVisible(true);
            triggerSmartMcRef.current({
              singerName: mcAnn.namaVokalis || mcAnn.singerName || currentSingerNameRef.current || defaultSingerName,
              songTitle: mcAnn.judulLagu || mcAnn.songTitle || currentSongRef.current?.title,
              announcement: { ...mcAnn, isManual: true },
              isManual: true,
              broadcast: false,
            });
          }
        }
      } catch {}
    };

    const pollTimer = setInterval(pollRoomSync, 1500);
    const fullStatePollTimer = setInterval(fetchRoomState, 4000);

    return () => {
      isDisposed = true;
      document.removeEventListener('visibilitychange', handleWakeReconnect);
      window.removeEventListener('online', handleWakeReconnect);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleWakeReconnect);
      window.removeEventListener('pageshow', handleWakeReconnect);
      clearInterval(pollTimer);
      clearInterval(fullStatePollTimer);
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
      if (sseSource) sseSource.close();
    };
  }, [roomId, addRemoteNotification, applyServerCurrentSong, applyServerQueue, applyServerClients, defaultSingerName, setTrackedCurrentSinger]);

  // Broadcast Channel setup for instant multi-window / multi-screen sync on same browser
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`karaoke_channel_${roomId}`);
      broadcastRef.current = channel;

      channel.onmessage = (event) => {
        const msg: WebSocketMessage = event.data;
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'ADD_QUEUE_ITEM':
            if (Array.isArray(msg.payload?.queue)) {
              setQueue(msg.payload.queue);
            } else if (msg.payload?.item) {
              setQueue((prev) => {
                if (prev.some((q) => q.queueId === msg.payload.item.queueId)) return prev;
                return msg.payload.item.priority ? [msg.payload.item, ...prev] : [...prev, msg.payload.item];
              });
            }
            audioFx.playDing();
            break;
          case 'REMOVE_QUEUE_ITEM':
            if (Array.isArray(msg.payload?.queue)) {
              setQueue(msg.payload.queue);
            } else if (msg.payload?.queueId) {
              setQueue((prev) => prev.filter((q) => q.queueId !== msg.payload.queueId));
            }
            break;
          case 'PLAY_NOW':
            if (msg.payload?.song) {
              setCurrentSong(msg.payload.song);
              if (msg.payload?.singerName) {
                setTrackedCurrentSinger(msg.payload.singerName);
              }
              setIsPlaying(true);
            }
            break;
          case 'SYNC_QUEUE':
            if (Array.isArray(msg.payload?.queue)) {
              setQueue(msg.payload.queue);
            }
            break;
          case 'SKIP_NEXT':
            skipNextSong(false);
            break;
          case 'TOGGLE_PAUSE':
            if (msg.payload?.isPlaying !== undefined) {
              setIsPlaying(msg.payload.isPlaying);
            } else {
              setIsPlaying((prev) => !prev);
            }
            break;
          case 'PLAY_SOUND_FX':
            if (msg.payload?.sound) {
              triggerSoundFx(msg.payload.sound, false, msg.payload.senderName);
            }
            break;
          case 'CLIENT_CONNECTED':
            setRemoteConnectedDevices((prev) => prev + 1);
            break;
          case 'MUSIC_SYNC_DELAY':
            if (typeof msg.payload?.delayMs === 'number') {
              setMusicDelayMs(msg.payload.delayMs, false);
            }
            break;
          case 'SET_MUSIC_VOLUME':
            if (typeof msg.payload?.volume === 'number') {
              setAudioVolume(Math.max(0, Math.min(100, Math.round(msg.payload.volume))));
            }
            if (typeof msg.payload?.isMuted === 'boolean') {
              setIsMuted(msg.payload.isMuted);
            }
            break;
          case 'SUBMIT_JURY_SCORE':
          case 'SYNC_JURY_SCORES':
            if (Array.isArray(msg.payload?.votes)) {
              setJuryVotes(msg.payload.votes);
            } else if (msg.payload?.lastVote) {
              const newVote = msg.payload.lastVote;
              const normName = (newVote.juryName || '').trim().toLowerCase();
              setJuryVotes((prev) => {
                const filtered = prev.filter(
                  (v) => (v.juryName || '').trim().toLowerCase() !== normName && v.clientId !== newVote.clientId
                );
                return [...filtered, newVote];
              });
            }
            break;
          case 'SHOW_PANTUN':
          case 'TRIGGER_SMART_MC':
            if (!isMcSpeakingRef.current && !isSmartMcPlaying()) {
              const singer = msg.payload?.namaVokalis || msg.payload?.singerName || currentSingerNameRef.current || defaultSingerName;
              const song = msg.payload?.judulLagu || msg.payload?.songTitle || currentSong?.title;
              let announcement = msg.payload?.announcement
                ? { ...msg.payload.announcement, isManual: true }
                : generateSmartMcAnnouncement({
                    singerName: singer,
                    songTitle: song,
                    score: msg.payload?.score,
                    forceTier: msg.payload?.forceTier,
                    isManual: true,
                  });
              if (msg.payload?.sampiran) announcement.sampiran = msg.payload.sampiran;
              if (msg.payload?.isi) announcement.isi = msg.payload.isi;
              if (msg.payload?.komentar) announcement.komentar = msg.payload.komentar;
              announcement.namaVokalis = singer;
              announcement.judulLagu = song;
              setIsSmartMcVisible(true);
              triggerSmartMcRef.current({
                singerName: singer,
                songTitle: song,
                score: msg.payload?.score,
                forceTier: msg.payload?.forceTier,
                announcement,
                isManual: true,
                broadcast: false,
              });
            }
            break;
        }
      };

      return () => {
        channel.close();
      };
    }
  }, [roomId]);

  // Send message helper across sync channels with automatic retry queue when offline/reconnecting
  const broadcastMessage = useCallback(
    (type: WebSocketMessage['type'], payload?: any) => {
      const serialized = JSON.stringify({
        type,
        roomId,
        payload,
        timestamp: Date.now(),
      });

      // 1. BroadcastChannel (same browser tabs)
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({
            type,
            roomId,
            payload,
            timestamp: Date.now(),
          });
        } catch {}
      }

      // 2. WebSocket (remote network devices) + retry queue if socket temporarily down
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(serialized);
          return;
        } catch {}
      }

      const criticalTypes = new Set<string>([
        'PLAY_NOW',
        'ADD_QUEUE_ITEM',
        'REMOVE_QUEUE_ITEM',
        'SYNC_QUEUE',
        'SKIP_NEXT',
        'TOGGLE_PAUSE',
        'SET_MUSIC_VOLUME',
        'SUBMIT_JURY_SCORE',
        'TRIGGER_SMART_MC',
        'SMART_MC_STATUS',
        'SYNC_STATE',
      ]);
      if (criticalTypes.has(type)) {
        if (pendingMessagesRef.current.length >= 25) {
          pendingMessagesRef.current.shift();
        }
        pendingMessagesRef.current.push(serialized);
      }
    },
    [roomId]
  );

  const broadcastMcStatus = useCallback(
    (speaking: boolean) => {
      broadcastMessage('SMART_MC_STATUS', { isSpeaking: speaking });
      peerConnectionsRef.current.forEach((c) => {
        if (c.open) {
          try {
            c.send({
              action: 'SMART_MC_STATUS' as any,
              payload: { isSpeaking: speaking },
            });
          } catch {}
        }
      });
    },
    [broadcastMessage]
  );

  // Helper to broadcast messages to all connected PeerJS mobile clients
  const broadcastToPeers = useCallback((msg: PeerMessage) => {
    peerConnectionsRef.current.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {}
      }
    });
  }, []);

  // Sound effects runner with on-screen visual reaction (HUUU, Cheer, Applause, etc.)
  const triggerSoundFx = useCallback(
    (type: SoundFxType | string, broadcast = true, senderName?: string) => {
      const sender = senderName || defaultSingerName || 'Prajurit';

      const reactionMeta: Record<string, { label: string; emoji: string }> = {
        boo: { label: 'KASIH HUUU', emoji: '👎' },
        cheer: { label: 'SORAK GEMBIRA', emoji: '🎉' },
        applause: { label: 'TEPUK TANGAN', emoji: '👏' },
        airhorn: { label: 'TEROMPET DJ', emoji: '📢' },
        laugh: { label: 'KETAWA NGAKAK', emoji: '😂' },
        ding: { label: 'LEMPAR KURSI', emoji: '🪑' },
        rimshot: { label: 'DRUM ROLL', emoji: '🥁' },
        sawer: { label: 'SAWER DULU', emoji: '💸' },
        hormat: { label: 'KASIH HORMAT', emoji: '🫡' },
        telor: { label: 'LEMPAR TELUR', emoji: '🥚' },
      };

      if (type !== 'score_reveal') {
        const meta = reactionMeta[type] || { label: type.toUpperCase(), emoji: '✨' };
        const reactionId = `rx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newReaction: ScreenReaction = {
          id: reactionId,
          type: type as SoundFxType,
          label: meta.label,
          emoji: meta.emoji,
          senderName: sender,
          timestamp: Date.now(),
        };

        setActiveReactions((prev) => [...prev.slice(-3), newReaction]);
        setTimeout(() => {
          setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
        }, 3000);
      }

      switch (type) {
        case 'score_reveal':
          // Suara / musik saat skor muncul dihilangkan
          break;
        case 'applause':
          audioFx.playApplause();
          break;
        case 'cheer':
          audioFx.playCheer();
          break;
        case 'sawer':
          audioFx.playSawer();
          break;
        case 'hormat':
          audioFx.playHormat();
          break;
        case 'telor':
          audioFx.playTelor();
          break;
        case 'airhorn':
          audioFx.playAirhorn();
          break;
        case 'ding':
          audioFx.playDing();
          break;
        case 'rimshot':
          audioFx.playRimshot();
          break;
        case 'boo':
          audioFx.playBoo();
          break;
        case 'laugh':
          audioFx.playLaugh();
          break;
      }
      if (broadcast) {
        broadcastMessage('PLAY_SOUND_FX', { sound: type, senderName: sender });
      }
    },
    [broadcastMessage, defaultSingerName]
  );

  // Helper to calculate average score and formula from all jury votes
  const getJuryAverageSummary = useCallback((): JuryScoreSummary => {
    if (juryVotes.length === 0) {
      return {
        votes: [],
        averageScore: 0,
        totalVoters: 0,
        calculationFormula: 'Belum ada penilaian prajurit',
      };
    }
    const sum = juryVotes.reduce((acc, v) => acc + v.score, 0);
    const avg = Math.round(sum / juryVotes.length);
    const formula = `skor total ${juryVotes.map((v) => v.score).join('+')}=${sum}:${juryVotes.length}= ${avg}`;
    return {
      votes: juryVotes,
      averageScore: avg,
      totalVoters: juryVotes.length,
      calculationFormula: formula,
    };
  }, [juryVotes]);

  // Submit soldier jury vote (accessible from client or master)
  const submitJuryVote = useCallback(
    (score: number, juryName?: string, clientId?: string) => {
      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
      const jName = (juryName || defaultSingerName || 'Prajurit (HP)').trim();
      const normName = jName.toLowerCase();
      const cId = normName || clientId || `juri-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const vote: JuryVote = {
        clientId: cId,
        juryName: jName,
        score: clampedScore,
        songId: currentSong?.id || '',
        songTitle: currentSong?.title || '',
        submittedAt: Date.now(),
      };

      setJuryVotes((prev) => {
        const filtered = prev.filter(
          (v) => (v.juryName || '').trim().toLowerCase() !== normName && v.clientId !== cId
        );
        const nextVotes = [...filtered, vote];

        // 1. Broadcast via BroadcastChannel & WebSocket
        broadcastMessage('SUBMIT_JURY_SCORE', {
          score: clampedScore,
          juryName: jName,
          clientId: cId,
          songId: currentSong?.id,
          lastVote: vote,
          votes: nextVotes,
        });

        // 2. Broadcast via PeerJS
        peerConnectionsRef.current.forEach((conn) => {
          if (conn.open) {
            conn.send({
              action: 'SYNC_JURY_SCORES',
              payload: { votes: nextVotes, songId: currentSong?.id, lastVote: vote },
            });
          }
        });

        return nextVotes;
      });

      // 3. HTTP Fallback
      fetch(`/api/room/${encodeURIComponent(roomId)}/jury-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: clampedScore,
          juryName: jName,
          clientId: cId,
          songId: currentSong?.id,
        }),
      }).catch(() => {});
    },
    [defaultSingerName, currentSong, broadcastMessage, roomId]
  );

  // Execute Search
  const executeSearch = useCallback(
    async (queryOverride?: string, categoryId?: string) => {
      const q = queryOverride !== undefined ? queryOverride : searchQuery;
      if (!q.trim() && !categoryId) return;

      setIsSearching(true);
      setSearchError(null);
      if (categoryId) {
        setActiveCategory(categoryId);
      } else {
        setActiveCategory(null);
      }

      // 1. Direct link / Video ID detection: if user pastes YouTube link in search bar, resolve directly
      const directId = extractYoutubeVideoId(q);
      if (directId) {
        setIsSearching(true);
        try {
          const oembed = await fetchOEmbedInfo(directId);
          const directSong: Song = {
            id: directId,
            title: oembed?.title || `YouTube Video (${directId})`,
            channelTitle: oembed?.author_name || 'YouTube Video',
            thumbnailUrl: `https://img.youtube.com/vi/${directId}/hqdefault.jpg`,
            isCurated: false,
          };
          setSearchResults([directSong]);
          setIsCuratedFallback(false);
          setIsSearching(false);
          return;
        } catch {
          // fallback to regular search
        }
      }

      const res = await searchKaraokeSongs(q, suffixFilter, categoryId);
      setSearchResults(res.songs);
      setIsCuratedFallback(res.isCuratedFallback);
      if (res.error) {
        setSearchError(res.error);
      }
      setIsSearching(false);
    },
    [searchQuery, suffixFilter]
  );

  // Add Direct YouTube Video Link / ID with automatic title resolution and optional play immediately
  const addDirectVideoUrl = useCallback(
    async (urlOrId: string, singerName?: string, playImmediately = false): Promise<boolean> => {
      const videoId = extractYoutubeVideoId(urlOrId);
      if (!videoId) return false;

      let title = `Video YouTube (${videoId})`;
      let channelTitle = 'YouTube Video';

      try {
        const oembed = await fetchOEmbedInfo(videoId);
        if (oembed?.title) {
          title = oembed.title;
        }
        if (oembed?.author_name) {
          channelTitle = oembed.author_name;
        }
      } catch (e) {
        console.warn('oEmbed fetch error:', e);
      }

      const directSong: Song = {
        id: videoId,
        title,
        channelTitle,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        isCurated: false,
      };

      const sName = singerName?.trim() || defaultSingerName;

      if (playImmediately) {
        if (currentSong) {
          setHistory((prev) => [currentSong, ...prev.slice(0, 19)]);
        }
        setCurrentSong(directSong);
        setTrackedCurrentSinger(sName);
        setIsPlaying(true);
        broadcastMessage('PLAY_NOW', { song: directSong, singerName: sName });
        fetch(`/api/room/${encodeURIComponent(roomId)}/play-now`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song: directSong, singerName: sName }),
        }).catch(() => {});
        audioFx.playDing();
        return true;
      }

      const qId = `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newItem: QueueItem = {
        queueId: qId,
        song: directSong,
        singerName: sName,
        addedAt: Date.now(),
      };

      setQueue((prev) => [...prev, newItem]);
      broadcastMessage('ADD_QUEUE_ITEM', { item: newItem });
      fetch(`/api/room/${encodeURIComponent(roomId)}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: directSong, singerName: sName, queueId: qId }),
      }).catch(() => {});
      audioFx.playDing();
      return true;
    },
    [defaultSingerName, broadcastMessage, currentSong, roomId, setTrackedCurrentSinger]
  );

  // Add to Queue
  const addToQueue = useCallback(
    (song: Song, singerName?: string, playNext = false, customQueueId?: string) => {
      const sName = singerName?.trim() || defaultSingerName;
      const qId = customQueueId?.trim() || `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      markSyncIdProcessed(qId);
      const newItem: QueueItem = {
        queueId: qId,
        song,
        singerName: sName,
        addedAt: Date.now(),
        priority: playNext,
      };

      const isScreenIdle = !currentSongRef.current;
      if (isScreenIdle) {
        unlockSmartMcAudio();
        currentSongRef.current = song;
        setCurrentSong(song);
        setTrackedCurrentSinger(sName);
        setIsPlaying(true);

        broadcastMessage('PLAY_NOW', { song, singerName: sName });
        fetch(`/api/room/${encodeURIComponent(roomId)}/play-now`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song, singerName: sName }),
        }).catch(() => {});
        fetch('/api/room-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, action: 'PLAY_NOW', song, singerName: sName, consumedQueueId: qId }),
        }).catch(() => {});

        setTimeout(() => {
          triggerSmartMcRef.current({
            singerName: sName,
            songTitle: song.title,
            isManual: true,
            broadcast: true,
          });
        }, 350);
      } else {
        setQueue((prev) => {
          if (
            prev.some(
              (q) =>
                q.queueId === qId ||
                (q.song.id === song.id && q.singerName === sName && Date.now() - (q.addedAt || 0) < 3000)
            )
          ) {
            return prev;
          }
          if (playNext) {
            return [newItem, ...prev];
          }
          return [...prev, newItem];
        });

        broadcastMessage('ADD_QUEUE_ITEM', { item: newItem, song, singerName: sName, priority: playNext, queueId: qId });
        fetch(`/api/room/${encodeURIComponent(roomId)}/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song, singerName: sName, priority: playNext, queueId: qId }),
        }).catch(() => {});
        fetch('/api/room-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            action: 'ADD_QUEUE',
            song,
            singerName: sName,
            priority: playNext,
            queueId: qId,
            requestId: qId,
          }),
        }).catch(() => {});
      }

      audioFx.playDing();
    },
    [defaultSingerName, broadcastMessage, roomId, setTrackedCurrentSinger, markSyncIdProcessed]
  );

  // Remove from Queue
  const removeFromQueue = useCallback((queueId: string) => {
    markSyncIdProcessed(queueId);
    setQueue((prev) => prev.filter((item) => item.queueId !== queueId));
    broadcastMessage('REMOVE_QUEUE_ITEM', { queueId });
    fetch(`/api/room/${encodeURIComponent(roomId)}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId }),
    }).catch(() => {});
    fetch('/api/room-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, action: 'REMOVE_QUEUE', queueId }),
    }).catch(() => {});
  }, [broadcastMessage, roomId, markSyncIdProcessed]);

  // Reorder Queue
  const moveQueueItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      setQueue((prev) => {
        if (toIndex < 0 || toIndex >= prev.length) return prev;
        const updated = [...prev];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        const targetQueueId = moved?.queueId;
        broadcastMessage('SYNC_QUEUE', { queue: updated });
        fetch(`/api/room/${encodeURIComponent(roomId)}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromIndex, toIndex, queueId: targetQueueId, singerName: defaultSingerName }),
        }).catch(() => {});
        return updated;
      });
    },
    [broadcastMessage, roomId, defaultSingerName]
  );

  // Clear Queue
  const clearQueue = useCallback(() => {
    setQueue([]);
    broadcastMessage('SYNC_QUEUE', { queue: [] });
  }, [broadcastMessage]);

  // Update singer name
  const updateSingerName = useCallback((queueId: string, newSinger: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.queueId === queueId ? { ...item, singerName: newSinger } : item))
    );
  }, []);

  // Helper to immediately stop Smart MC speech, restore ducked volume, and hide banner when playback starts/resumes
  const clearSmartMcImmediately = useCallback(() => {
    if (mcDismissTimerRef.current) {
      clearTimeout(mcDismissTimerRef.current);
      mcDismissTimerRef.current = null;
    }
    if (mcAudioEndWaitTimerRef.current) {
      clearTimeout(mcAudioEndWaitTimerRef.current);
      mcAudioEndWaitTimerRef.current = null;
    }
    if (endTransitionTimerRef.current) {
      clearTimeout(endTransitionTimerRef.current);
      endTransitionTimerRef.current = null;
    }
    isAwaitingEndTransitionQueueSkipRef.current = false;
    isMcSpeakingRef.current = false;
    stopSmartMcSpeech();
    stopAudioDucking();
    setIsMcSpeaking(false);
    setIsSmartMcVisible(false);
    setActiveMcAnnouncement(null);
    broadcastMcStatus(false);
  }, [stopAudioDucking, broadcastMcStatus]);

  // Play Song Immediately
  const playSongNow = useCallback(
    (song: Song, singerName?: string) => {
      const sName = singerName || defaultSingerName;
      unlockSmartMcAudio();
      clearSmartMcImmediately();
      isPlayerEndedRef.current = false;
      setIsPlayerEnded(false);
      isPlayingRef.current = true;

      if (currentSong) {
        setHistory((prev) => [currentSong, ...prev.slice(0, 19)]);
      }
      currentSongRef.current = song;
      setCurrentSong(song);
      setTrackedCurrentSinger(sName);
      setIsPlaying(true);

      // Trigger immediate playback on playerRef and DOM iframes
      try {
        if (playerRef.current) {
          if (!isMuted) {
            playerRef.current.unMute?.();
            playerRef.current.setVolume?.(audioVolume);
          }
          playerRef.current.playVideo?.();
        }
      } catch {}

      try {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((ifr) => {
          try {
            ifr.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
              '*'
            );
            ifr.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'setVolume', args: [audioVolume] }),
              '*'
            );
            ifr.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          } catch {}
        });
      } catch {}

      broadcastMessage('PLAY_NOW', { song, singerName: sName });
      fetch(`/api/room/${encodeURIComponent(roomId)}/play-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, singerName: sName }),
      }).catch(() => {});
      fetch('/api/room-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, action: 'PLAY_NOW', song, singerName: sName }),
      }).catch(() => {});

      // Pemicu otomatis kartu SMART MC DISKOMLEKAU saat lagu baru mulai diputar di TV
      setTimeout(() => {
        triggerSmartMcRef.current({
          singerName: sName,
          songTitle: song.title,
          isManual: true,
          broadcast: true,
        });
      }, 350);
    },
    [currentSong, broadcastMessage, roomId, defaultSingerName, playerRef, isMuted, audioVolume, clearSmartMcImmediately, setTrackedCurrentSinger]
  );

  // Guard against rapid multi-click or simultaneous video events skipping twice
  const lastSkipTimestampRef = useRef<number>(0);

  // Skip to next song in queue
  const skipNextSong = useCallback(
    (broadcast = true) => {
      const now = Date.now();
      if (now - lastSkipTimestampRef.current < 1500) {
        return;
      }
      lastSkipTimestampRef.current = now;
      unlockSmartMcAudio();

      if (endTransitionTimerRef.current) {
        clearTimeout(endTransitionTimerRef.current);
        endTransitionTimerRef.current = null;
      }
      isAwaitingEndTransitionQueueSkipRef.current = false;

      setQueue((prevQueue) => {
        if (prevQueue.length === 0) {
          // Jika antrean habis, kembali ke mode standby (jangan putar lagu sembarangan)
          if (currentSong) {
            setHistory((prevHist) => [currentSong, ...prevHist.slice(0, 19)]);
          }
          currentSongRef.current = null;
          setCurrentSong(null);
          setTrackedCurrentSinger(null);
          isPlayingRef.current = false;
          setIsPlaying(false);
          try {
            localStorage.removeItem(STORAGE_KEYS.CURRENT);
          } catch {}
          if (broadcast) {
            broadcastMessage('SKIP_NEXT', { currentSong: null, currentSinger: null, queue: [] });
            broadcastMessage('SYNC_QUEUE', { queue: [] });
            fetch(`/api/room/${encodeURIComponent(roomId)}/skip`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ singerName: defaultSingerName }),
            }).catch(() => {});
            fetch('/api/room-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId, action: 'STOP_IDLE' }),
            }).catch(() => {});
          }
          return [];
        }
        const [nextItem, ...remaining] = prevQueue;
        const nextSinger = nextItem.singerName || defaultSingerName;
        markSyncIdProcessed(nextItem.queueId);
        // Larangan Mutlak di Tengah Lagu: Saat lagu berikutnya mulai diputar, sembunyikan Smart MC & hentikan suara
        clearSmartMcImmediately();
        isPlayerEndedRef.current = false;
        setIsPlayerEnded(false);
        isPlayingRef.current = true;
        hasTriggered60sScoreRef.current = null;
        hasTriggeredScoreRef.current = null;
        songPlaybackStartRef.current = Date.now();
        latestRealTimeRef.current = 0;

        if (currentSong) {
          setHistory((prevHist) => [currentSong, ...prevHist.slice(0, 19)]);
        }
        currentSongRef.current = nextItem.song;
        setCurrentSong(nextItem.song);
        setTrackedCurrentSinger(nextSinger);
        setIsPlaying(true);

        // Immediate play trigger on skip
        try {
          if (playerRef.current) {
            if (!isMuted) {
              playerRef.current.unMute?.();
              playerRef.current.setVolume?.(audioVolume);
            }
            playerRef.current.playVideo?.();
          }
        } catch {}

        try {
          const iframes = document.querySelectorAll('iframe');
          iframes.forEach((ifr) => {
            try {
              ifr.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
                '*'
              );
              ifr.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [audioVolume] }),
                '*'
              );
              ifr.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                '*'
              );
            } catch {}
          });
        } catch {}

        if (broadcast) {
          broadcastMessage('PLAY_NOW', { song: nextItem.song, singerName: nextSinger });
          broadcastMessage('SYNC_QUEUE', { queue: remaining });
          fetch(`/api/room/${encodeURIComponent(roomId)}/skip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ singerName: nextSinger, nextSong: nextItem.song, queueId: nextItem.queueId }),
          }).catch(() => {});
          fetch('/api/room-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              action: 'PLAY_NOW',
              song: nextItem.song,
              singerName: nextSinger,
              consumedQueueId: nextItem.queueId,
            }),
          }).catch(() => {});
        }

        // Pemicu otomatis kartu SMART MC DISKOMLEKAU saat lagu berikutnya mulai diputar di TV
        setTimeout(() => {
          triggerSmartMcRef.current({
            singerName: nextSinger,
            songTitle: nextItem.song.title,
            isManual: true,
            broadcast: true,
          });
        }, 350);

        return remaining;
      });
    },
    [currentSong, broadcastMessage, roomId, defaultSingerName, playerRef, isMuted, audioVolume, clearSmartMcImmediately, setTrackedCurrentSinger, markSyncIdProcessed]
  );

  // Toggle Play / Pause synchronized across TV, Tablet, and Mobile
  const togglePlayPause = useCallback(
    (broadcast = true) => {
      setIsPlaying((prev) => {
        const next = !prev;
        isPlayingRef.current = next;
        if (next) {
          // Larangan Mutlak di Tengah Lagu: Jika pemutar kembali PLAY, blokir/sembunyikan Smart MC & hentikan speechSynthesis
          isPlayerEndedRef.current = false;
          setIsPlayerEnded(false);
          clearSmartMcImmediately();
        }
        if (broadcast) {
          broadcastMessage('TOGGLE_PAUSE', { isPlaying: next });
          fetch(`/api/room/${encodeURIComponent(roomId)}/toggle-pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPlaying: next, senderName: defaultSingerName }),
          }).catch(() => {});
        }
        return next;
      });
    },
    [broadcastMessage, roomId, defaultSingerName, clearSmartMcImmediately]
  );

  const generateScoreData = useCallback((song: Song, singer: string, nextItem?: QueueItem): SongScoreData => {
    const totalScore = 80;
    const grade: 'SS' | 'S' | 'A' | 'B' | 'C' = 'A';
    const quote = getScoreQuote(totalScore);

    return {
      song,
      singerName: singer || defaultSingerName,
      totalScore,
      grade,
      rankTitle: quote,
      commentary: quote,
      pitchAccuracy: totalScore,
      vocalPower: totalScore,
      stagePresence: totalScore,
      combatSpirit: totalScore,
      nextSong: nextItem?.song,
      nextSingerName: nextItem?.singerName,
      evaluatedAt: Date.now(),
    };
  }, [defaultSingerName]);

  // Replay current song
  const replayCurrentSong = useCallback(() => {
    clearSmartMcImmediately();
    isPlayerEndedRef.current = false;
    setIsPlayerEnded(false);
    isPlayingRef.current = true;
    hasTriggered60sScoreRef.current = null;
    hasTriggeredScoreRef.current = null;
    songPlaybackStartRef.current = Date.now();
    latestRealTimeRef.current = 0;

    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, [clearSmartMcImmediately]);

  const buildDefaultJuryVotes = useCallback(
    (targetAvg: number, songId = '', songTitle = ''): JuryVote[] => {
      const defaultNames = ['iwan', 'rudi', 'rojikan', 'tomas', 'awan'];
      const clamped = Math.max(0, Math.min(100, Math.round(targetAvg)));
      return defaultNames.map((name, idx) => ({
        clientId: `default-juri-${idx + 1}`,
        juryName: name,
        score: clamped,
        songId,
        songTitle,
        submittedAt: Date.now(),
      }));
    },
    []
  );

  // Smart MC Diskomlekau Controllers (100% Local Pantun & Indonesian Speech Synthesis)
  const dismissSmartMc = useCallback(() => {
    const shouldAdvanceQueue = isAwaitingEndTransitionQueueSkipRef.current;
    clearSmartMcImmediately();
    setIsSmartMcVisible(false);
    fetch('/api/room-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, action: 'DISMISS_SMART_MC' }),
    }).catch(() => {});
    if (shouldAdvanceQueue) {
      lastSkipTimestampRef.current = 0;
      skipNextSong();
    }
  }, [clearSmartMcImmediately, skipNextSong, roomId]);

  // Saat lagu mulai diputar (isPlaying === true), reset status ENDED
  useEffect(() => {
    if (isPlaying && currentSong?.id) {
      isPlayerEndedRef.current = false;
      setIsPlayerEnded(false);
    }
  }, [isPlaying, currentSong?.id]);

  // Selama lagu sedang diputar (isPlaying === true dan status pemutar bukan ENDED),
  // Smart MC otomatis wajib diblokir/disembunyikan total, serta hentikan suara speechSynthesis.
  useEffect(() => {
    if (isPlaying && !isPlayerEnded && activeMcAnnouncement && !activeMcAnnouncement.isManual) {
      clearSmartMcImmediately();
    }
  }, [isPlaying, isPlayerEnded, activeMcAnnouncement, clearSmartMcImmediately]);

  const replaySmartMcSpeech = useCallback(() => {
    if (!activeMcAnnouncement) return;
    // Cegah pantun/suara MC baru memotong pantun yang masih aktif berbicara
    if (isMcSpeakingRef.current || isSmartMcPlaying()) {
      return;
    }

    if (mcDismissTimerRef.current) {
      clearTimeout(mcDismissTimerRef.current);
      mcDismissTimerRef.current = null;
    }
    if (mcAudioEndWaitTimerRef.current) {
      clearTimeout(mcAudioEndWaitTimerRef.current);
      mcAudioEndWaitTimerRef.current = null;
    }

    isMcSpeakingRef.current = true;
    setIsMcSpeaking(true);
    broadcastMcStatus(true);

    // Batas aman maksimal 15 detik agar lock/banner tidak pernah menyangkut
    mcDismissTimerRef.current = setTimeout(() => {
      stopSmartMcSpeech();
      stopAudioDucking();
      isMcSpeakingRef.current = false;
      setActiveMcAnnouncement(null);
      setIsMcSpeaking(false);
      broadcastMcStatus(false);
    }, 15000);

    speakSmartMcIndonesian(
      activeMcAnnouncement.tier,
      () => {
        startAudioDucking();
        isMcSpeakingRef.current = true;
        setIsMcSpeaking(true);
      },
      () => {
        stopAudioDucking();
        isMcSpeakingRef.current = false;
        setIsMcSpeaking(false);
        broadcastMcStatus(false);
        if (mcDismissTimerRef.current) {
          clearTimeout(mcDismissTimerRef.current);
          mcDismissTimerRef.current = null;
        }
        if (mcAudioEndWaitTimerRef.current) {
          clearTimeout(mcAudioEndWaitTimerRef.current);
        }
        mcAudioEndWaitTimerRef.current = setTimeout(() => {
          setActiveMcAnnouncement(null);
        }, 1200);
      },
      activeMcAnnouncement.fullSpeechText
    );
  }, [activeMcAnnouncement, startAudioDucking, stopAudioDucking, broadcastMcStatus]);

  const triggerSmartMc = useCallback(
    (options?: {
      singerName?: string;
      songTitle?: string;
      score?: number | null;
      forceTier?: SmartMcTier;
      triggeredBy?: string;
      announcement?: SmartMcAnnouncement;
      broadcast?: boolean;
      isManual?: boolean;
      nextSongTitle?: string;
      onSpeechEnd?: () => void;
    }) => {
      const isManualTrigger = Boolean(options?.isManual || options?.announcement?.isManual);

      // KETENTUAN 1 (Larangan Mutlak di Tengah Lagu):
      // Selama lagu sedang diputar (isPlaying === true dan status pemutar bukan ENDED),
      // pemicu otomatis Smart MC wajib diblokir total dan suara audio MC dihentikan.
      if (!isManualTrigger && isPlayingRef.current && !isPlayerEndedRef.current) {
        stopSmartMcSpeech();
        stopAudioDucking();
        isMcSpeakingRef.current = false;
        setIsMcSpeaking(false);
        setActiveMcAnnouncement(null);
        broadcastMcStatus(false);
        return;
      }

      // Deduplikasi ID pengumuman agar trigger dari banyak channel (PeerJS + WS + SSE) tidak memicu suara ganda
      const incomingId = options?.announcement?.id;
      if (incomingId && processedMcIdsRef.current.has(incomingId)) {
        return;
      }

      // Cegah pantun lain sebelum pantun pertama selesai berbicara
      if (isMcSpeakingRef.current || isSmartMcPlaying()) {
        return;
      }

      lastMcTriggerTimeRef.current = Date.now();
      const effectiveScore =
        options?.score !== undefined
          ? options.score
          : currentScoreData?.totalScore ??
            (juryVotes.length > 0
              ? Math.round(juryVotes.reduce((acc, v) => acc + v.score, 0) / juryVotes.length)
              : undefined);

      const resolvedSinger = options?.singerName || currentSingerNameRef.current || defaultSingerName;

      const baseAnnouncement =
        options?.announcement ||
        generateSmartMcAnnouncement({
          singerName: resolvedSinger,
          songTitle: options?.songTitle || currentSong?.title || 'Lagu Pilihan Prajurit',
          score: effectiveScore,
          forceTier: options?.forceTier,
          triggeredBy: options?.triggeredBy || (isManualTrigger ? 'Pantun MC (HP)' : 'Akhir Lagu'),
          isManual: isManualTrigger,
          nextSongTitle: options?.nextSongTitle,
        });

      const announcement: SmartMcAnnouncement = {
        ...baseAnnouncement,
        isManual: isManualTrigger,
        nextSongTitle: options?.nextSongTitle ?? baseAnnouncement.nextSongTitle,
      };

      processedMcIdsRef.current.add(announcement.id);
      if (processedMcIdsRef.current.size > 30) {
        const oldest = processedMcIdsRef.current.values().next().value;
        if (oldest) processedMcIdsRef.current.delete(oldest);
      }

      if (mcDismissTimerRef.current) {
        clearTimeout(mcDismissTimerRef.current);
        mcDismissTimerRef.current = null;
      }
      if (mcAudioEndWaitTimerRef.current) {
        clearTimeout(mcAudioEndWaitTimerRef.current);
        mcAudioEndWaitTimerRef.current = null;
      }

      // Kunci langsung secara sinkron sebelum audio diputar agar tidak ada panggilan kedua yang menembus
      isMcSpeakingRef.current = true;
      setIsMcSpeaking(true);
      setActiveMcAnnouncement(announcement);
      setIsSmartMcVisible(true);
      broadcastMcStatus(true);

      // Batas aman auto-dismiss 10 detik sesuai spesifikasi Smart MC
      mcDismissTimerRef.current = setTimeout(() => {
        stopSmartMcSpeech();
        stopAudioDucking();
        isMcSpeakingRef.current = false;
        setActiveMcAnnouncement(null);
        setIsSmartMcVisible(false);
        setIsMcSpeaking(false);
        broadcastMcStatus(false);
      }, 10000);

      speakSmartMcIndonesian(
        announcement.tier,
        () => {
          startAudioDucking();
          isMcSpeakingRef.current = true;
          setIsMcSpeaking(true);
        },
        () => {
          stopAudioDucking();
          isMcSpeakingRef.current = false;
          setIsMcSpeaking(false);
          broadcastMcStatus(false);
          options?.onSpeechEnd?.();
        },
        announcement.fullSpeechText
      );

      if (options?.broadcast) {
        const mcPayload = {
          announcement,
          sampiran: announcement.sampiran,
          isi: announcement.isi,
          komentar: announcement.komentar,
          namaVokalis: announcement.namaVokalis || announcement.singerName,
          judulLagu: announcement.judulLagu || announcement.songTitle,
          singerName: announcement.singerName,
          songTitle: announcement.songTitle,
          score: announcement.score,
          isManual: isManualTrigger,
        };
        broadcastMessage('SHOW_PANTUN', mcPayload);
        broadcastMessage('TRIGGER_SMART_MC', mcPayload);
        broadcastToPeers({
          action: 'SHOW_PANTUN' as any,
          payload: mcPayload,
        });
        broadcastToPeers({
          action: 'TRIGGER_SMART_MC',
          payload: mcPayload,
        });
        fetch('/api/room-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            action: 'SHOW_PANTUN',
            announcement,
            payload: mcPayload,
          }),
        }).catch(() => {});
      }
    },
    [currentScoreData, juryVotes, defaultSingerName, currentSong, broadcastMessage, broadcastMcStatus, startAudioDucking, stopAudioDucking, broadcastToPeers, roomId]
  );

  const triggerSmartMcRef = useRef(triggerSmartMc);
  useEffect(() => {
    triggerSmartMcRef.current = triggerSmartMc;
  }, [triggerSmartMc]);

  // Trigger song scoring evaluation on demand (TANPA memicu Smart MC otomatis agar tidak mengganggu lagu)
  const evaluateCurrentSong = useCallback(() => {
    if (currentSong) {
      const nextItem = queue.length > 0 ? queue[0] : undefined;
      const autoScore = stopScoringAndGetResult() || generateScoreData(currentSong, defaultSingerName, nextItem);
      const effectiveVotes =
        juryVotes.length > 0
          ? [...juryVotes]
          : buildDefaultJuryVotes(autoScore.totalScore, currentSong.id, currentSong.title);
      const sum = effectiveVotes.reduce((acc, v) => acc + v.score, 0);
      const finalScore = Math.round(sum / effectiveVotes.length);
      const quote = getScoreQuote(finalScore);

      const scoreData: SongScoreData = {
        ...autoScore,
        totalScore: finalScore,
        grade: finalScore >= 95 ? 'SS' : finalScore >= 88 ? 'S' : finalScore >= 80 ? 'A' : finalScore >= 65 ? 'B' : 'C',
        rankTitle: quote,
        commentary: quote,
        juryVotes: effectiveVotes,
        juryAverageScore: finalScore,
        isJuryAverage: true,
      };
      setCurrentScoreData(scoreData);
      setIsScoreModalOpen(true);
    }
  }, [currentSong, defaultSingerName, queue, stopScoringAndGetResult, generateScoreData, juryVotes, buildDefaultJuryVotes]);

  // Automated song score trigger locks & playback elapsed trackers
  const hasTriggered60sScoreRef = useRef<string | null>(null);
  const hasTriggeredScoreRef = useRef<string | null>(null);
  const songPlaybackStartRef = useRef<number>(Date.now());
  const latestRealTimeRef = useRef<number>(0);

  // KETENTUAN 2 (Hanya Saat Lagu Selesai / Transisi ENDED):
  // Smart MC otomatis muncul sebagai banner elegan di layar Master TV dan bersuara bahasa Indonesia
  // HANYA ketika lagu yang diputar benar-benar selesai (ENDED) atau saat transisi ke antrean lagu berikutnya.
  const handlePlayerEnded = useCallback(() => {
    if (currentSong) {
      if (hasTriggeredScoreRef.current === `${currentSong.id}-ended`) return;
      hasTriggeredScoreRef.current = `${currentSong.id}-ended`;
      lastLocalActionTimeRef.current = Date.now();

      const endedSong = currentSong;
      const endedSinger = currentSingerNameRef.current || defaultSingerName;
      const endScore =
        currentScoreData?.totalScore ??
        (juryVotes.length > 0
          ? Math.round(juryVotes.reduce((acc, v) => acc + v.score, 0) / juryVotes.length)
          : 80);

      // Set status pemutar menjadi ENDED & hentikan pemutaran video yang sudah selesai
      isPlayerEndedRef.current = true;
      setIsPlayerEnded(true);
      isPlayingRef.current = false;
      setIsPlaying(false);
      setIsScoreModalOpen(false);

      try {
        playerRef.current?.pauseVideo?.();
      } catch {}
      try {
        if (typeof document !== 'undefined') {
          document.querySelectorAll('iframe').forEach((ifr) => {
            try {
              ifr.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
                '*'
              );
            } catch {}
          });
        }
      } catch {}

      const hasNextInQueue = queue.length > 0;
      const nextQueueItem = hasNextInQueue ? queue[0] : undefined;

      if (hasNextInQueue) {
        isAwaitingEndTransitionQueueSkipRef.current = true;

        const proceedToNextSong = () => {
          if (!isAwaitingEndTransitionQueueSkipRef.current) return;
          isAwaitingEndTransitionQueueSkipRef.current = false;
          if (endTransitionTimerRef.current) {
            clearTimeout(endTransitionTimerRef.current);
            endTransitionTimerRef.current = null;
          }
          clearSmartMcImmediately();
          lastSkipTimestampRef.current = 0;
          skipNextSong();
        };

        if (endTransitionTimerRef.current) {
          clearTimeout(endTransitionTimerRef.current);
        }
        // Fallback batas waktu transisi (12 detik) jika audio TTS/lokal selesai atau macet
        endTransitionTimerRef.current = setTimeout(proceedToNextSong, 12000);

        triggerSmartMcRef.current({
          singerName: endedSinger,
          songTitle: endedSong.title,
          score: endScore,
          triggeredBy: 'Transisi Lagu',
          isManual: false,
          nextSongTitle: nextQueueItem?.song.title,
          broadcast: false,
          onSpeechEnd: () => {
            setTimeout(proceedToNextSong, 500);
          },
        });
      } else {
        // Antrean kosong: pindah ke standby & tampilkan Smart MC penutup lagu
        isAwaitingEndTransitionQueueSkipRef.current = false;
        lastSkipTimestampRef.current = 0;
        skipNextSong();

        triggerSmartMcRef.current({
          singerName: endedSinger,
          songTitle: endedSong.title,
          score: endScore,
          triggeredBy: 'Akhir Lagu',
          isManual: false,
          broadcast: false,
        });
      }
    }
  }, [currentSong, currentScoreData, juryVotes, defaultSingerName, queue, skipNextSong, clearSmartMcImmediately]);

  const getSongDurationSeconds = useCallback((song: Song | null): number => {
    if (!song) return 210;
    if (song.duration) {
      const parts = song.duration.split(':').map((p) => parseInt(p, 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
      }
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }
    return 210;
  }, []);

  // Reset scoring evaluation locks & elapsed timer ONLY when currentSong.id changes
  useEffect(() => {
    hasTriggered60sScoreRef.current = null;
    hasTriggeredScoreRef.current = null;
    songPlaybackStartRef.current = Date.now();
    latestRealTimeRef.current = 0;
  }, [currentSong?.id]);

  const notifyPlaybackTime = useCallback(
    (currentTime: number, totalDuration?: number, isRealPlayerTime = false) => {
      if (!currentSong || !isPlaying) return;
      if (hasTriggeredScoreRef.current === `${currentSong.id}-ended`) return;

      if (isRealPlayerTime && currentTime > 0) {
        latestRealTimeRef.current = currentTime;
      }

      const duration = totalDuration && totalDuration > 15 ? totalDuration : getSongDurationSeconds(currentSong);
      const remainingSeconds = duration - currentTime;

      // =========================================================================
      // Pemicu Waktu Skor & Quote (60 detik sebelum lagu berakhir):
      // HANYA menampilkan kotak skor Dewan Juri & Quote (TANPA Smart MC dan TANPA suara)
      // =========================================================================
      if (
        remainingSeconds <= 60 &&
        remainingSeconds > 1.5 &&
        currentTime >= 8 &&
        hasTriggered60sScoreRef.current !== currentSong.id
      ) {
        hasTriggered60sScoreRef.current = currentSong.id;
        const nextItem = queue.length > 0 ? queue[0] : undefined;
        const autoScore = stopScoringAndGetResult() || generateScoreData(currentSong, defaultSingerName, nextItem);

        // Dewan Juri Prajurit: Hitung rata-rata dari juri HP atau panel 5 juri default
        const effectiveVotes =
          juryVotes.length > 0
            ? [...juryVotes]
            : buildDefaultJuryVotes(autoScore.totalScore, currentSong.id, currentSong.title);
        const sum = effectiveVotes.reduce((acc, v) => acc + v.score, 0);
        const finalScore = Math.round(sum / effectiveVotes.length);
        const quote = getScoreQuote(finalScore);

        const scoreData: SongScoreData = {
          ...autoScore,
          totalScore: finalScore,
          grade: finalScore >= 95 ? 'SS' : finalScore >= 88 ? 'S' : finalScore >= 80 ? 'A' : finalScore >= 65 ? 'B' : 'C',
          rankTitle: quote,
          commentary: quote,
          juryVotes: effectiveVotes,
          juryAverageScore: finalScore,
          isJuryAverage: true,
        };

        setCurrentScoreData(scoreData);
        setIsScoreModalOpen(true);
      }

      // Lagu berakhir penuh (kurang dari 1.2 detik sebelum durasi total habis) -> Picu ENDED & transisi lagu berikutnya
      if (remainingSeconds <= 1.2 && currentTime > 15) {
        handlePlayerEnded();
      }
    },
    [currentSong, isPlaying, getSongDurationSeconds, queue, defaultSingerName, stopScoringAndGetResult, generateScoreData, handlePlayerEnded, juryVotes, buildDefaultJuryVotes]
  );

  // Sinkronisasi dinamis real-time: setiap kali juri baru masuk, perbarui data skor rata-rata & Quote
  // Tanpa memunculkan modal skor sebelum waktunya (hanya update jika currentScoreData sudah aktif)
  useEffect(() => {
    if (juryVotes.length > 0 && currentSong) {
      const sum = juryVotes.reduce((acc, v) => acc + v.score, 0);
      const avg = Math.round(sum / juryVotes.length);
      const quote = getScoreQuote(avg);
      setCurrentScoreData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          totalScore: avg,
          grade: avg >= 95 ? 'SS' : avg >= 88 ? 'S' : avg >= 80 ? 'A' : avg >= 65 ? 'B' : 'C',
          rankTitle: quote,
          commentary: quote,
          juryVotes: [...juryVotes],
          juryAverageScore: avg,
          isJuryAverage: true,
        };
      });
    }
  }, [juryVotes, currentSong]);

  // Global listener for YouTube postMessage API (infoDelivery & onStateChange events from IFrames)
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          const parsed = JSON.parse(event.data);
          
          // 1. YouTube postMessage player state ended:
          // Format { event: 'onStateChange', info: 0 } or { event: 'infoDelivery', info: { playerState: 0 } }
          if (
            (parsed.event === 'onStateChange' && (parsed.info === 0 || parsed.data === 0)) ||
            (parsed.event === 'infoDelivery' && parsed.info?.playerState === 0)
          ) {
            handlePlayerEnded();
            return;
          }

          if (parsed.event === 'infoDelivery' && parsed.info) {
            const curTime = parsed.info.currentTime;
            const dur = parsed.info.duration;
            if (typeof curTime === 'number' && typeof dur === 'number' && dur > 10) {
              if (curTime >= dur - 1.2) {
                handlePlayerEnded();
                return;
              }
            }
            if (typeof curTime === 'number' && curTime > 0) {
              notifyPlaybackTime(curTime, dur, true);
            }
          }
        }
      } catch {}
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [handlePlayerEnded, notifyPlaybackTime]);

  const notifyPlaybackTimeRef = useRef(notifyPlaybackTime);
  useEffect(() => {
    notifyPlaybackTimeRef.current = notifyPlaybackTime;
  }, [notifyPlaybackTime]);

  const handlePlayerEndedRef = useRef(handlePlayerEnded);
  useEffect(() => {
    handlePlayerEndedRef.current = handlePlayerEnded;
  }, [handlePlayerEnded]);

  // Periodic active ticker: monitors playback position continuously every 1 second (stable across queue/jury updates)
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const songId = currentSong.id;
    const dur = getSongDurationSeconds(currentSong);

    const ticker = setInterval(() => {
      if (hasTriggeredScoreRef.current === `${songId}-ended`) return;
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const state = playerRef.current.getPlayerState?.();
          if (state === 0) {
            handlePlayerEndedRef.current();
            return;
          }
          const cur = playerRef.current.getCurrentTime();
          const pDur = playerRef.current.getDuration?.();
          if (typeof cur === 'number' && cur > 0) {
            notifyPlaybackTimeRef.current(cur, pDur || dur, true);
            return;
          }
        } catch {}
      }
      // If YouTube iframe already reported real playback time via postMessage recently, let postMessage drive it
      if (latestRealTimeRef.current > 0) {
        return;
      }
      const elapsed = (Date.now() - songPlaybackStartRef.current) / 1000;
      notifyPlaybackTimeRef.current(elapsed, dur, false);
    }, 1000);

    return () => clearInterval(ticker);
  }, [isPlaying, currentSong?.id, getSongDurationSeconds]);

  // Broadcast TV status update to all connected PeerJS mobile clients whenever song or queue changes
  useEffect(() => {
    const msg: PeerMessage = {
      action: 'STATUS_UPDATE',
      nowPlaying: currentSong?.title || '',
      isPlaying,
      currentTime: 0,
      song: currentSong,
      queue,
      payload: { musicDelayMs },
      clientCount: Math.max(1, peerConnectionsRef.current.size + 1),
      timestamp: Date.now(),
    };
    broadcastToPeers(msg);
  }, [currentSong, isPlaying, queue, musicDelayMs, broadcastToPeers]);

  // PeerJS P2P Master Host: Enables serverless direct TV-HP connections (Vercel ready via 0.peerjs.com)
  useEffect(() => {
    let peerInstance: Peer | null = null;
    let heartbeatCleanup: (() => void) | null = null;
    let reconnectTimer: any = null;
    let isCleanedUp = false;

    const initMaster = () => {
      if (isCleanedUp) return;

      try {
        const tvPeerId = getTvPeerId(roomId);
        peerInstance = createPeer(tvPeerId);
        peerRef.current = peerInstance;

        // Keep WebSocket signaling alive on 0.peerjs.com
        if (heartbeatCleanup) heartbeatCleanup();
        heartbeatCleanup = startPeerHeartbeat(peerInstance);

        peerInstance.on('open', (id) => {
          if (isCleanedUp) return;
          console.log('[PeerJS TV Master] Berhasil terdaftar dengan Peer ID:', id);
        });

        // Reconnect immediately if signaling server connection drops
        peerInstance.on('disconnected', () => {
          if (isCleanedUp) return;
          console.log('[PeerJS TV Master] Sinyal terputus dari server. Menyambung ulang...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isCleanedUp && peerInstance && !peerInstance.destroyed && peerInstance.disconnected) {
              try {
                peerInstance.reconnect();
              } catch {}
            }
          }, 1500);
        });

        // Handle incoming direct wireless microphone audio calls from mobile clients
        peerInstance.on('call', (mediaConn) => {
          if (isCleanedUp) return;
          console.log('[PeerJS TV Master] Menerima panggilan audio mic dari:', mediaConn.peer);
          // Answer call without sending local stream (Master only receives audio)
          mediaConn.answer();
          mediaConn.on('stream', (remoteStream) => {
            console.log('[PeerJS TV Master] Audio stream remote diterima dari:', mediaConn.peer);
            const callerName = mediaConn.metadata?.singerName || 'Prajurit (HP)';
            attachAudioStream(mediaConn.peer, callerName, remoteStream);
          });
          mediaConn.on('close', () => {
            cleanupSender(mediaConn.peer);
          });
          mediaConn.on('error', (err) => {
            console.warn('[PeerJS TV Master] MediaConnection error:', err);
          });
        });

        // Handle incoming data connections from mobile clients (Remote control & queue sync)
        peerInstance.on('connection', (conn) => {
          if (isCleanedUp) return;

          conn.on('open', () => {
            peerConnectionsRef.current.set(conn.peer, conn);
            setRemoteConnectedDevices(Math.max(1, peerConnectionsRef.current.size + 1));

            // Immediately send full state snapshot to the newly connected phone
            conn.send({
              action: 'STATUS_UPDATE',
              nowPlaying: currentSong?.title || '',
              isPlaying,
              currentTime: 0,
              song: currentSong,
              currentSinger: currentSingerNameRef.current,
              isMcSpeaking: isMcSpeakingRef.current,
              queue,
              clientCount: Math.max(1, peerConnectionsRef.current.size + 1),
            });
          });

          conn.on('data', (data: any) => {
            if (!data || !data.action) return;

            switch (data.action) {
              case 'PLAY':
                setIsPlaying(true);
                break;

              case 'PAUSE':
                setIsPlaying(false);
                break;

              case 'NEXT_SONG':
                skipNextSong();
                break;

              case 'SELECT_SONG':
                if (data.payload) {
                  playSongNow(data.payload, data.senderName);
                }
                break;

              case 'SET_VOLUME':
              case 'SET_MUSIC_VOLUME': {
                const vol = typeof data.payload === 'number' ? data.payload : data.payload?.volume;
                const isMutedVal = typeof data.payload?.isMuted === 'boolean' ? data.payload.isMuted : false;
                if (typeof vol === 'number') {
                  const clamped = Math.max(0, Math.min(100, Math.round(vol)));
                  setAudioVolume(clamped);
                  setIsMuted(isMutedVal);
                  applyHardwarePlayerVolume(clamped, isMutedVal);
                  const sender = data.senderName || data.payload?.senderName;
                  if (sender) {
                    addRemoteNotification(
                      isMutedVal ? `🔇 ${sender} membisukan musik TV` : `🔊 ${sender} mengatur volume musik: ${clamped}%`,
                      sender,
                      'info'
                    );
                  }
                }
                break;
              }

              case 'ADD_QUEUE':
                if (data.payload?.song) {
                  addToQueue(
                    data.payload.song,
                    data.payload.singerName,
                    data.payload.priority,
                    data.payload.queueId || data.payload.item?.queueId
                  );
                }
                break;

              case 'REMOVE_QUEUE':
                if (data.payload?.queueId) {
                  removeFromQueue(data.payload.queueId);
                }
                break;

              case 'REORDER_QUEUE':
                if (typeof data.payload?.fromIndex === 'number' && typeof data.payload?.toIndex === 'number') {
                  moveQueueItem(data.payload.fromIndex, data.payload.toIndex);
                }
                break;

              case 'PLAY_SOUND_FX':
                if (data.payload?.sound) {
                  triggerSoundFx(data.payload.sound, false, data.payload.senderName);
                }
                break;

              case 'MIC_PARAMS':
                if (data.payload) {
                  const targetId = conn.peer;
                  if (typeof data.payload.volume === 'number') {
                    setClientMicVolume(targetId, data.payload.volume);
                  }
                  if (typeof data.payload.echo === 'number') {
                    setClientMicEcho(targetId, data.payload.echo);
                  }
                }
                break;

              case 'UPDATE_MIC_LEVEL':
              case 'RTC_MIC_LEVEL':
                if (data.payload && typeof data.payload.level === 'number') {
                  const targetLevel = data.payload.level;
                  handleWebRTCSignaling({
                    type: 'RTC_MIC_LEVEL',
                    roomId,
                    payload: {
                      senderId: data.payload.senderId || conn.peer,
                      senderName: data.payload.senderName,
                      level: targetLevel,
                    },
                  });
                }
                break;

              case 'SET_MUSIC_DELAY':
                if (typeof data.payload?.delayMs === 'number') {
                  setMusicDelayMs(data.payload.delayMs, true);
                }
                break;

              case 'STATUS_UPDATE':
                conn.send({
                  action: 'STATUS_UPDATE',
                  nowPlaying: currentSong?.title || '',
                  isPlaying,
                  currentTime: 0,
                  song: currentSong,
                  currentSinger: currentSingerNameRef.current,
                  isMcSpeaking: isMcSpeakingRef.current,
                  queue,
                  payload: {
                    musicDelayMs,
                    currentSinger: currentSingerNameRef.current,
                    isMcSpeaking: isMcSpeakingRef.current,
                  },
                  clientCount: Math.max(1, peerConnectionsRef.current.size + 1),
                });
                break;

              case 'SUBMIT_JURY_SCORE':
                if (data.payload && typeof data.payload.score === 'number') {
                  const jName = (data.payload.juryName || data.senderName || 'Prajurit (HP)').trim();
                  const normName = jName.toLowerCase();
                  const vote: JuryVote = {
                    clientId: normName || data.senderId || conn.peer,
                    juryName: jName,
                    score: Math.max(0, Math.min(100, Math.round(data.payload.score))),
                    songId: currentSong?.id || '',
                    songTitle: currentSong?.title || '',
                    submittedAt: Date.now(),
                  };
                  setJuryVotes((prev) => {
                    const filtered = prev.filter(
                      (v) => (v.juryName || '').trim().toLowerCase() !== normName && v.clientId !== vote.clientId
                    );
                    const nextVotes = [...filtered, vote];
                    peerConnectionsRef.current.forEach((c) => {
                      if (c.open) {
                        try {
                          c.send({
                            action: 'SYNC_JURY_SCORES',
                            payload: { votes: nextVotes, songId: currentSong?.id, lastVote: vote },
                          });
                        } catch {}
                      }
                    });
                    return nextVotes;
                  });
                  addRemoteNotification(
                    `⚖️ ${vote.juryName} memberi nilai: ${vote.score}!`,
                    vote.juryName,
                    'info'
                  );
                }
                break;

              case 'SHOW_PANTUN':
              case 'TRIGGER_SMART_MC': {
                const incomingId = data.payload?.announcement?.id;
                const alreadyHandled = Boolean(incomingId && processedMcIdsRef.current.has(incomingId));
                if (!alreadyHandled && !isMcSpeakingRef.current && !isSmartMcPlaying()) {
                  const sender = data.senderName || data.payload?.singerName || 'Prajurit (HP)';
                  const singer = data.payload?.namaVokalis || data.payload?.singerName || currentSingerNameRef.current || defaultSingerName;
                  const song = data.payload?.judulLagu || data.payload?.songTitle || currentSong?.title;
                  let announcement = data.payload?.announcement
                    ? { ...data.payload.announcement, isManual: true }
                    : generateSmartMcAnnouncement({
                        singerName: singer,
                        songTitle: song,
                        score: data.payload?.score,
                        forceTier: data.payload?.forceTier,
                        triggeredBy: sender,
                        isManual: true,
                      });
                  if (data.payload?.sampiran) announcement.sampiran = data.payload.sampiran;
                  if (data.payload?.isi) announcement.isi = data.payload.isi;
                  if (data.payload?.komentar) announcement.komentar = data.payload.komentar;
                  announcement.namaVokalis = singer;
                  announcement.judulLagu = song;
                  setIsSmartMcVisible(true);
                  triggerSmartMcRef.current({
                    singerName: singer,
                    songTitle: song,
                    score: data.payload?.score,
                    forceTier: data.payload?.forceTier,
                    triggeredBy: sender,
                    announcement,
                    isManual: true,
                    broadcast: false,
                  });
                  addRemoteNotification(`🎙️ ${sender} memanggil Pantun Smart MC Diskomlekau!`, sender, 'success');
                }
                break;
              }
            }
          });

          conn.on('close', () => {
            peerConnectionsRef.current.delete(conn.peer);
            setRemoteConnectedDevices(Math.max(1, peerConnectionsRef.current.size + 1));
          });

          conn.on('error', () => {
            peerConnectionsRef.current.delete(conn.peer);
            setRemoteConnectedDevices(Math.max(1, peerConnectionsRef.current.size + 1));
          });
        });

        // Handle incoming WebRTC MediaConnection for Wireless Microphone audio streaming
        peerInstance.on('call', (mediaConn) => {
          if (isCleanedUp) return;

          // Answer call to accept incoming audio stream from phone
          mediaConn.answer();
          const senderId = mediaConn.peer;
          const senderName = mediaConn.metadata?.singerName || 'Prajurit (HP)';

          // Enforce zero jitter buffer latency hint on RTCRtpReceiver
          try {
            const pc = (mediaConn as any).peerConnection as RTCPeerConnection;
            if (pc && pc.getReceivers) {
              pc.getReceivers().forEach((receiver) => {
                if ('playoutDelayHint' in receiver) (receiver as any).playoutDelayHint = 0;
                if ('jitterBufferTarget' in receiver) (receiver as any).jitterBufferTarget = 0;
              });
            }
          } catch {}

          mediaConn.on('stream', (remoteStream) => {
            try {
              remoteStream.getAudioTracks().forEach((track) => {
                if ('playoutDelayHint' in track) (track as any).playoutDelayHint = 0;
              });
            } catch {}
            attachAudioStream(senderId, senderName, remoteStream);
            addRemoteNotification(
              `🎤 ${senderName} mengaktifkan Mikrofon HP (P2P)! Suara langsung disiarkan ke speaker TV.`,
              senderName,
              'success'
            );
          });

          mediaConn.on('close', () => {
            cleanupSender(senderId);
            addRemoteNotification(
              `🎤 ${senderName} mematikan Mikrofon HP.`,
              senderName,
              'info'
            );
          });

          mediaConn.on('error', () => {
            cleanupSender(senderId);
          });
        });

        peerInstance.on('error', (err: any) => {
          const errMsg = String(err?.message || err?.type || err || '');
          if (isCleanedUp) return;

          // Recover from server drops or transient disconnects
          if (errMsg.includes('Lost connection') || err?.type === 'network' || err?.type === 'server-error') {
            if (peerInstance && !peerInstance.destroyed && peerInstance.disconnected) {
              try {
                peerInstance.reconnect();
              } catch {}
            }
          } else if (err?.type === 'unavailable-id') {
            // Wait 2.5 seconds if previous session hasn't released ID, then re-initialize
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (!isCleanedUp) initMaster();
            }, 2500);
          }
        });
      } catch (e) {
        console.warn('[PeerJS TV Master] initialization error:', e);
      }
    };

    initMaster();

    return () => {
      isCleanedUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatCleanup) heartbeatCleanup();
      peerConnectionsRef.current.clear();
      if (peerInstance) {
        try {
          peerInstance.destroy();
        } catch {}
      }
      peerRef.current = null;
    };
  }, [
    roomId,
    currentSong,
    isPlaying,
    queue,
    attachAudioStream,
    cleanupSender,
    addRemoteNotification,
    addToQueue,
    moveQueueItem,
    playSongNow,
    removeFromQueue,
    setAudioVolume,
    setClientMicEcho,
    setClientMicVolume,
    setIsPlaying,
    skipNextSong,
    triggerSoundFx,
  ]);

  const changeAudioVolume = useCallback(
    (val: number | ((prev: number) => number)) => {
      setAudioVolume((prev) => {
        const next = typeof val === 'function' ? val(prev) : val;
        const clamped = Math.max(0, Math.min(100, Math.round(next)));
        applyHardwarePlayerVolume(clamped, false);
        broadcastMessage('SET_MUSIC_VOLUME', { volume: clamped, isMuted: false, senderName: 'Layar Utama' });
        fetch(`/api/room/${encodeURIComponent(roomId)}/volume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: clamped, isMuted: false, senderName: 'Layar Utama' }),
        }).catch(() => {});
        return clamped;
      });
    },
    [applyHardwarePlayerVolume, broadcastMessage, roomId]
  );

  const toggleMusicMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      applyHardwarePlayerVolume(audioVolume, next);
      broadcastMessage('SET_MUSIC_VOLUME', { volume: audioVolume, isMuted: next, senderName: 'Layar Utama' });
      fetch(`/api/room/${encodeURIComponent(roomId)}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: audioVolume, isMuted: next, senderName: 'Layar Utama' }),
      }).catch(() => {});
      return next;
    });
  }, [applyHardwarePlayerVolume, audioVolume, broadcastMessage, roomId]);

  return (
    <KaraokeContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        suffixFilter,
        setSuffixFilter,
        searchResults,
        isSearching,
        searchError,
        isCuratedFallback,
        activeCategory,
        executeSearch,
        addDirectVideoUrl,
        hitsIndonesiaSongs,
        hitsLastUpdated,
        isRefreshingHits,
        refreshHitsIndonesia,
        queue,
        currentSong,
        currentSingerName,
        history,
        addToQueue,
        removeFromQueue,
        moveQueueItem,
        clearQueue,
        updateSingerName,
        playSongNow,
        skipNextSong,
        replayCurrentSong,
        evaluateCurrentSong,
        notifyPlaybackTime,
        isPlaying,
        setIsPlaying,
        togglePlayPause,
        audioVolume,
        setAudioVolume,
        changeAudioVolume,
        isMuted,
        setIsMuted,
        toggleMusicMute,
        handlePlayerEnded,
        playerRef,
        isQueueOpenMobile,
        setIsQueueOpenMobile,
        isScoreModalOpen,
        setIsScoreModalOpen,
        currentScoreData,
        isTvMode,
        setIsTvMode,
        defaultSingerName,
        setDefaultSingerName,
        juryVotes,
        submitJuryVote,
        getJuryAverageSummary,
        activeMcAnnouncement,
        isMcSpeaking,
        isSmartMcVisible,
        setIsSmartMcVisible,
        isPlayerEnded,
        triggerSmartMc,
        replaySmartMcSpeech,
        dismissSmartMc,
        unlockTvAudio,
        roomId,
        connectionStatus,
        remoteConnectedDevices,
        remoteClientsList,
        remoteNotifications,
        removeRemoteNotification,
        activeReactions,
        triggerSoundFx,
        activeWirelessMics,
        masterMicVolume,
        setMasterMicVolume,
        masterMicEcho,
        setMasterMicEcho,
        isMasterMicMuted,
        setIsMasterMicMuted,
        increaseMicVolume,
        decreaseMicVolume,
        increaseMicEcho,
        decreaseMicEcho,
        isAudioSuspended,
        resumeAudio,
        setClientMicVolume,
        setClientMicEcho,
        toggleClientMicMute,
        scoringState,
        isScoringActive,
        startScoring,
        stopScoringAndGetResult,
        musicMediaRef,
        musicDelayMs,
        setMusicDelayMs,
        connectMusicMediaElement,
      }}
    >
      {/* Hidden HTMLMediaElement for Web Audio API music scoring analyzer */}
      <audio
        ref={musicMediaRef}
        id="karaoke-music-media-element"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
      {children}
    </KaraokeContext.Provider>
  );
};

export const useKaraoke = (): KaraokeContextType => {
  const context = useContext(KaraokeContext);
  if (!context) {
    throw new Error('useKaraoke must be used within a KaraokeProvider');
  }
  return context;
};

