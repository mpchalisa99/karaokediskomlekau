import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Smartphone,
  Search,
  ListMusic,
  Sparkles,
  Play,
  Pause,
  Plus,
  Trash2,
  Rocket,
  Shield,
  RefreshCw,
  X,
  SkipForward,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  Tv,
  Music,
  Flame,
  Check,
  User,
  Zap,
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
  Scale,
  Trophy,
  Award,
} from 'lucide-react';
import { Song, QueueItem, SuffixFilter, getScoreQuote, SmartMcAnnouncement, ConnectionStatus } from '../types/karaoke';
import { CURATED_LIBRARY, CATEGORY_PRESETS, extractYoutubeVideoId, fetchOEmbedInfo, getHitsIndonesiaSongs, refreshIndonesianTrendingHits } from '../services/youtube';
import { generateSmartMcAnnouncement } from '../services/smartMc';
import { PWAInstallButton } from './PWAInstallButton';
import { useWebRTCMicrophone } from '../hooks/useWebRTCMicrophone';
import { getSignalingWebSocketUrl, getWebSocketStateName } from '../services/signaling';
import { getTvPeerId, getClientPeerId, createPeer, startPeerHeartbeat, type PeerAction, type PeerMessage, type DataConnection, type MediaConnection } from '../services/peerManager';
import type Peer from 'peerjs';

export interface MobileClientViewProps {
  isEmbedded?: boolean;
  onCloseEmbedded?: () => void;
  roomIdOverride?: string;
}

export const MobileClientView: React.FC<MobileClientViewProps> = ({
  isEmbedded = false,
  onCloseEmbedded,
  roomIdOverride,
}) => {
  // Extract roomId from URL or fallback
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const initialRoomId = (
    roomIdOverride ||
    urlParams.get('room') ||
    localStorage.getItem('karaoke_room_id_v1') ||
    'ROOM-1001'
  )
    .trim()
    .toUpperCase();

  const [roomId, setRoomId] = useState<string>(initialRoomId);

  // Keep roomId strictly synchronized when passed via modal props (e.g. Embedded Remote HP Layar Ini)
  useEffect(() => {
    if (roomIdOverride && roomIdOverride.trim()) {
      setRoomId(roomIdOverride.trim().toUpperCase());
    }
  }, [roomIdOverride]);

  const [singerName, setSingerName] = useState<string>(() => {
    return localStorage.getItem('karaoke_client_singer_name') || 'Prajurit (HP)';
  });
  const [isEditingSinger, setIsEditingSinger] = useState<boolean>(false);
  const [singerInput, setSingerInput] = useState<string>(singerName);

  // Client unique ID and sync time tracker
  const clientId = useRef<string>(
    isEmbedded
      ? `hp-sim-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).substring(2, 6)}`
      : (typeof window !== 'undefined' && localStorage.getItem('karaoke_client_device_id')) ||
        ('hp-' + Math.random().toString(36).substring(2, 9))
  ).current;
  const lastSyncTime = useRef<number>(Date.now());

  // Connection State
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [clientCount, setClientCount] = useState<number>(1);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingClientMessagesRef = useRef<{ type: string; payload: any; timestamp: number }[]>([]);
  const lastWsPongRef = useRef<number>(Date.now());
  const lastClientSkipRef = useRef<number>(0);

  // Master Room State (Synchronized with TV & Tablet)
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentSinger, setCurrentSinger] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isMcSpeakingOnTv, setIsMcSpeakingOnTv] = useState<boolean>(false);
  const mcSpeakingLockTimerRef = useRef<any>(null);

  const setMcSpeakingLock = useCallback((speaking: boolean) => {
    if (mcSpeakingLockTimerRef.current) {
      clearTimeout(mcSpeakingLockTimerRef.current);
      mcSpeakingLockTimerRef.current = null;
    }
    setIsMcSpeakingOnTv(speaking);
    if (speaking) {
      mcSpeakingLockTimerRef.current = setTimeout(() => {
        setIsMcSpeakingOnTv(false);
        mcSpeakingLockTimerRef.current = null;
      }, 12000);
    }
  }, []);

  // Navigation State: 6 Clear, Intuitive Tabs (including Mic Wireless & Dewan Juri Prajurit)
  const [activeTab, setActiveTab] = useState<'search' | 'mic' | 'queue' | 'reactions' | 'curated' | 'jury'>('search');

  // Dewan Juri Prajurit State (Kolaborasi Penilaian Multi-Client)
  const [juryScoreInput, setJuryScoreInput] = useState<number>(85);
  const [hasSubmittedJury, setHasSubmittedJury] = useState<boolean>(false);
  const [lastSubmittedScore, setLastSubmittedScore] = useState<number | null>(null);
  const [juryVotersList, setJuryVotersList] = useState<{ juryName: string; score: number }[]>([]);
  const [lastMcPreview, setLastMcPreview] = useState<SmartMcAnnouncement | null>(null);

  // Reset status juri setiap kali lagu baru diputar di TV
  useEffect(() => {
    setHasSubmittedJury(false);
    setLastSubmittedScore(null);
    setJuryVotersList([]);
  }, [currentSong?.id]);

  // Search State & Dynamic Hits Indonesia Trends
  const [hitsIndoSongs, setHitsIndoSongs] = useState<Song[]>(() => getHitsIndonesiaSongs());
  const [isRefreshingHits, setIsRefreshingHits] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suffixFilter, setSuffixFilter] = useState<SuffixFilter>('karaoke');
  const [searchResults, setSearchResults] = useState<Song[]>(() => {
    const hits = getHitsIndonesiaSongs();
    return hits.length > 0 ? hits : CURATED_LIBRARY['slow-rock'];
  });
  const [activeSearchCategory, setActiveSearchCategory] = useState<string | null>('hits-indonesia');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Curated (List Pilihan) Tab State
  const [curatedCategoryFilter, setCuratedCategoryFilter] = useState<string>('hits-indonesia');
  const [curatedSearchQuery, setCuratedSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'hits-indonesia': true,
  });

  // Direct YouTube Link Input (Simple & Collapsible)
  const [showDirectInput, setShowDirectInput] = useState<boolean>(false);
  const [directUrl, setDirectUrl] = useState<string>('');
  const [isResolvingDirect, setIsResolvingDirect] = useState<boolean>(false);

  // Toast / Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (e) {}
    }
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  // PeerJS P2P Client (Enables serverless direct TV-HP connections without backend WebSocket)
  const [peerConnectionState, setPeerConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaConnRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectPeerTimerRef = useRef<any>(null);
  const peerHeartbeatCleanRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [peerMicStreaming, setPeerMicStreaming] = useState<boolean>(false);
  const [peerMicMuted, setPeerMicMuted] = useState<boolean>(false);
  const [peerMicError, setPeerMicError] = useState<string | null>(null);
  const [peerAudioLevel, setPeerAudioLevel] = useState<number>(0);
  const [peerMicStatus, setPeerMicStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // TV Music Sync Delay Buffer (0ms - 250ms, default 70ms)
  const [tvMusicDelay, setTvMusicDelay] = useState<number>(70);

  // TV Music Volume State (0% - 100%, default 100% agar lantang & jernih) & Mute State
  const [musicVolume, setMusicVolume] = useState<number>(100);
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(false);

  // Local Network IP detection for Hotspot / LAN
  const [detectedLocalIps, setDetectedLocalIps] = useState<string[]>([]);

  // Helper to send JSON messages to TV Master via PeerJS DataConnection
  const sendPeerMessage = useCallback((msg: PeerMessage): boolean => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send(msg);
        return true;
      } catch (err) {
        console.warn('[PeerJS] send error:', err);
      }
    }
    return false;
  }, []);

  // Reliable WebSocket dispatch with retry queue when temporarily disconnected
  const sendWsReliable = useCallback(
    (type: string, payload: any): boolean => {
      const msg = { type, roomId, payload, timestamp: Date.now() };
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(msg));
          return true;
        } catch {}
      }
      if (type !== 'PING' && type !== 'PONG' && !type.startsWith('RTC_')) {
        const q = pendingClientMessagesRef.current;
        q.push({ type, payload, timestamp: Date.now() });
        if (q.length > 25) q.shift();
      }
      return false;
    },
    [roomId]
  );

  // Refresh dynamic Indonesian YouTube trends (with localStorage cache)
  const handleRefreshHits = useCallback(async () => {
    if (isRefreshingHits) return;
    setIsRefreshingHits(true);
    try {
      const result = await refreshIndonesianTrendingHits();
      const updated = result.songs;
      setHitsIndoSongs(updated);
      if (activeSearchCategory === 'hits-indonesia' && !searchQuery.trim()) {
        setSearchResults(updated);
      }
      showToast(
        result.fromOnline
          ? `🔥 Tren Hits Indonesia diperbarui dari YouTube (${updated.length} lagu)!`
          : `✅ Daftar Hits Indonesia tersimpan (${updated.length} lagu).`
      );
    } catch {
      showToast('⚠️ Gagal memuat tren terbaru, memakai daftar tersimpan.');
    } finally {
      setIsRefreshingHits(false);
    }
  }, [isRefreshingHits, activeSearchCategory, searchQuery, showToast]);

  const handleSetTvMusicDelay = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(250, Math.round(val)));
      setTvMusicDelay(clamped);

      // 1. WebSocket (with retry queue)
      sendWsReliable('MUSIC_SYNC_DELAY', { delayMs: clamped });

      // 2. PeerJS DataConnection
      sendPeerMessage({
        action: 'SET_MUSIC_DELAY',
        payload: { delayMs: clamped },
      });

      // 3. HTTP Fallback
      fetch(`/api/room/${encodeURIComponent(roomId)}/music-delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delayMs: clamped }),
      }).catch(() => {});

      showToast(`⚡ Sinkron Musik TV: ${clamped}ms`);
    },
    [roomId, sendWsReliable, sendPeerMessage, showToast]
  );

  // Control Music Volume on Master TV from Mobile Client (HP)
  const handleSetMusicVolume = useCallback(
    (val: number, mute?: boolean) => {
      const clamped = Math.max(0, Math.min(100, Math.round(val)));
      const effectiveMute = mute !== undefined ? mute : isMusicMuted;
      setMusicVolume(clamped);
      if (mute !== undefined) {
        setIsMusicMuted(effectiveMute);
      }

      // 1. WebSocket Signaling (with retry queue)
      sendWsReliable('SET_MUSIC_VOLUME', {
        volume: clamped,
        isMuted: effectiveMute,
        senderName: singerName,
      });

      // 2. PeerJS DataConnection P2P
      sendPeerMessage({
        action: 'SET_MUSIC_VOLUME' as any,
        payload: {
          volume: clamped,
          isMuted: effectiveMute,
          senderName: singerName,
        },
      });

      // 3. HTTP Fallback
      fetch(`/api/room/${encodeURIComponent(roomId)}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volume: clamped,
          isMuted: effectiveMute,
          senderName: singerName,
        }),
      }).catch(() => {});

      if (effectiveMute) {
        showToast('🔇 Musik TV dibisukan');
      } else {
        showToast(`🎵 Volume Musik TV: ${clamped}%`);
      }
    },
    [roomId, isMusicMuted, singerName, sendWsReliable, sendPeerMessage, showToast]
  );

  const handleToggleMusicMute = useCallback(() => {
    const nextMute = !isMusicMuted;
    handleSetMusicVolume(musicVolume, nextMute);
  }, [handleSetMusicVolume, isMusicMuted, musicVolume]);

  const handleIncreaseMusicVolume = useCallback(() => {
    handleSetMusicVolume(Math.min(100, musicVolume + 5), false);
  }, [handleSetMusicVolume, musicVolume]);

  const handleDecreaseMusicVolume = useCallback(() => {
    handleSetMusicVolume(Math.max(0, musicVolume - 5), false);
  }, [handleSetMusicVolume, musicVolume]);

  // WebSocket signaling readyState tracking
  const [wsReadyState, setWsReadyState] = useState<number>(WebSocket.CONNECTING);
  const triggerReconnectRef = useRef<(() => void) | null>(null);

  const handleRequestReconnect = useCallback(() => {
    if (triggerReconnectRef.current) {
      triggerReconnectRef.current();
    }
  }, []);

  // WebRTC P2P Wireless Microphone Broadcaster Hook
  const {
    isStreaming: isMicStreaming,
    isMuted: isMicMuted,
    isEchoCancellationEnabled,
    isZeroDelayBypass,
    micVolume,
    micEcho,
    audioLevel: micAudioLevel,
    micError,
    connectionStatus: micConnectionStatus,
    startBroadcasting: startMicBroadcast,
    stopBroadcasting: stopMicBroadcast,
    toggleMute: toggleMicMute,
    toggleEchoCancellation,
    toggleZeroDelayBypass,
    increaseVolume,
    decreaseVolume,
    setVolumeDirect,
    increaseEcho,
    decreaseEcho,
    setEchoDirect,
    handleSignalingMessage: handleMicSignaling,
  } = useWebRTCMicrophone({
    socketRef: wsRef,
    roomId,
    singerName,
    clientId,
    onToast: showToast,
    onRequestReconnect: handleRequestReconnect,
  });

  // Save singer name
  const handleSaveSinger = () => {
    const clean = singerInput.trim() || 'Prajurit (HP)';
    setSingerName(clean);
    localStorage.setItem('karaoke_client_singer_name', clean);
    setIsEditingSinger(false);
    showToast(`Nama disimpan: ${clean}`);
  };

  // Fetch initial room state and send HTTP heartbeat ping
  const fetchRoomState = useCallback(async () => {
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, singerName, role: 'client' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room) {
          lastSyncTime.current = Date.now();
          setIsConnected(true);
          setConnectionStatus('connected');
          if (data.room.currentSong !== undefined) setCurrentSong(data.room.currentSong);
          if (data.room.currentSinger !== undefined) setCurrentSinger(data.room.currentSinger);
          if (typeof data.room.isPlaying === 'boolean') setIsPlaying(data.room.isPlaying);
          if (typeof data.room.isMcSpeaking === 'boolean') setMcSpeakingLock(data.room.isMcSpeaking);
          if (Array.isArray(data.room.queue)) setQueue(data.room.queue);
          if (typeof data.room.musicDelayMs === 'number') setTvMusicDelay(data.room.musicDelayMs);
          if (typeof data.room.musicVolume === 'number') setMusicVolume(data.room.musicVolume);
          if (typeof data.room.isMuted === 'boolean') setIsMusicMuted(data.room.isMuted);
          if (Array.isArray(data.room.juryVotes)) {
            setJuryVotersList(data.room.juryVotes.map((v: any) => ({ juryName: v.juryName, score: v.score })));
          }
          if (data.clientCount !== undefined) setClientCount(data.clientCount);
        }
      }
    } catch {
      const elapsed = Date.now() - lastSyncTime.current;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      } else if (elapsed > 15000) {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      } else if (elapsed > 7000) {
        setIsConnected(false);
        setConnectionStatus('reconnecting');
      }
    }
  }, [roomId, singerName, clientId, setMcSpeakingLock]);

  // PeerJS Client connection & auto-reconnect logic (Serverless direct TV-HP connections)
  const establishDataConnection = useCallback((peer: Peer, targetTvId: string) => {
    setPeerConnectionState('connecting');
    const conn = peer.connect(targetTvId, { reliable: true });
    dataConnRef.current = conn;

    conn.on('open', () => {
      console.log('[PeerJS HP] Connected to TV Master:', targetTvId);
      setPeerConnectionState('connected');
      setIsConnected(true);
      // Handshake to TV
      conn.send({ action: 'STATUS_UPDATE', senderName: singerName, senderId: peer.id });
      showToast('🟢 Terhubung ke TV Master (P2P)!');
    });

    conn.on('data', (data: any) => {
      if (data && data.action === 'STATUS_UPDATE') {
        if (data.song !== undefined) setCurrentSong(data.song);
        if (data.currentSinger !== undefined || data.payload?.currentSinger !== undefined) {
          setCurrentSinger(data.currentSinger ?? data.payload?.currentSinger ?? null);
        }
        if (typeof data.isPlaying === 'boolean') setIsPlaying(data.isPlaying);
        if (typeof data.isMcSpeaking === 'boolean' || typeof data.payload?.isMcSpeaking === 'boolean') {
          setMcSpeakingLock(Boolean(data.isMcSpeaking ?? data.payload?.isMcSpeaking));
        }
        if (Array.isArray(data.queue)) setQueue(data.queue);
        if (typeof data.clientCount === 'number') setClientCount(data.clientCount);
        if (typeof data.payload?.musicDelayMs === 'number') setTvMusicDelay(data.payload.musicDelayMs);
        if (typeof data.payload?.musicVolume === 'number' || typeof data.musicVolume === 'number') {
          setMusicVolume(data.payload?.musicVolume ?? data.musicVolume);
        }
        if (typeof data.payload?.isMuted === 'boolean' || typeof data.isMuted === 'boolean') {
          setIsMusicMuted(data.payload?.isMuted ?? data.isMuted);
        }
        setIsConnected(true);
        setPeerConnectionState('connected');
      }
      if (data && data.action === 'SMART_MC_STATUS') {
        setMcSpeakingLock(Boolean(data.payload?.isSpeaking));
      }
      if (data && (data.action === 'SET_MUSIC_VOLUME' || data.action === 'SET_VOLUME')) {
        if (typeof data.payload?.volume === 'number') setMusicVolume(data.payload.volume);
        if (typeof data.payload?.isMuted === 'boolean') setIsMusicMuted(data.payload.isMuted);
      }
      if (data && data.action === 'SYNC_JURY_SCORES') {
        if (Array.isArray(data.payload?.votes)) {
          setJuryVotersList(data.payload.votes.map((v: any) => ({ juryName: v.juryName, score: v.score })));
        }
      }
    });

    conn.on('close', () => {
      console.log('[PeerJS HP] Connection to TV closed');
      setPeerConnectionState('disconnected');
      schedulePeerReconnect();
    });

    conn.on('error', (err) => {
      console.warn('[PeerJS HP] Connection error:', err);
      setPeerConnectionState('disconnected');
      schedulePeerReconnect();
    });
  }, [singerName, showToast, setMcSpeakingLock]);

  const schedulePeerReconnect = useCallback(() => {
    if (reconnectPeerTimerRef.current) clearTimeout(reconnectPeerTimerRef.current);
    reconnectPeerTimerRef.current = setTimeout(() => {
      connectToTvPeer();
    }, 3000);
  }, []);

  // Send action to TV via PeerJS DataConnection
  const sendPeerAction = useCallback((action: PeerAction, payload?: any): boolean => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send({
          action,
          payload,
          senderName: singerName,
          senderId: peerRef.current?.id,
          timestamp: Date.now(),
        });
        return true;
      } catch (err) {
        console.warn('[PeerJS HP] Error sending action:', err);
      }
    }
    return false;
  }, [singerName]);

  const connectToTvPeer = useCallback(() => {
    if (reconnectPeerTimerRef.current) {
      clearTimeout(reconnectPeerTimerRef.current);
      reconnectPeerTimerRef.current = null;
    }

    try {
      const tvPeerId = getTvPeerId(roomId);

      if (!peerRef.current || peerRef.current.destroyed) {
        const clientPeer = createPeer(getClientPeerId(roomId));
        peerRef.current = clientPeer;

        // Keep connection warm to 0.peerjs.com
        if (peerHeartbeatCleanRef.current) peerHeartbeatCleanRef.current();
        peerHeartbeatCleanRef.current = startPeerHeartbeat(clientPeer);

        clientPeer.on('open', (id) => {
          console.log('[PeerJS HP] Client peer registered:', id);
          establishDataConnection(clientPeer, tvPeerId);
        });

        // Reconnect immediately if connection to signaling broker is lost
        clientPeer.on('disconnected', () => {
          console.log('[PeerJS HP] Sinyal terputus dari broker. Menyambung ulang...');
          if (clientPeer && !clientPeer.destroyed && clientPeer.disconnected) {
            try {
              clientPeer.reconnect();
            } catch {
              schedulePeerReconnect();
            }
          }
        });

        clientPeer.on('error', (err: any) => {
          const errMsg = String(err?.message || err?.type || err || '');
          if (errMsg.includes('Lost connection') || err?.type === 'network' || err?.type === 'server-error') {
            if (clientPeer && !clientPeer.destroyed && clientPeer.disconnected) {
              try {
                clientPeer.reconnect();
                return;
              } catch {}
            }
          }
          console.warn('[PeerJS HP] Client peer error:', errMsg);
          setPeerConnectionState('disconnected');
          schedulePeerReconnect();
        });
      } else if (peerRef.current.disconnected) {
        try {
          peerRef.current.reconnect();
        } catch {
          schedulePeerReconnect();
        }
      } else if (peerRef.current.open) {
        establishDataConnection(peerRef.current, tvPeerId);
      }
    } catch (err) {
      console.warn('[PeerJS HP] Initialization error:', err);
      setPeerConnectionState('disconnected');
      schedulePeerReconnect();
    }
  }, [roomId, establishDataConnection, schedulePeerReconnect]);

  useEffect(() => {
    connectToTvPeer();

    return () => {
      if (reconnectPeerTimerRef.current) clearTimeout(reconnectPeerTimerRef.current);
      if (peerHeartbeatCleanRef.current) peerHeartbeatCleanRef.current();
      if (dataConnRef.current) {
        try {
          dataConnRef.current.close();
        } catch {}
      }
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch {}
      }
    };
  }, [connectToTvPeer]);

  // PeerJS WebRTC Microphone Streamer (Streams HP audio directly to TV)
  const startPeerMic = useCallback(async () => {
    setPeerMicError(null);
    setPeerMicStatus('connecting');

    if (peerConnectionState !== 'connected' || !dataConnRef.current?.open) {
      if (isEmbedded) return false;
      const err = 'Koneksi ke TV belum siap. Pastikan terhubung ke TV sebelum menyalakan mikrofon.';
      setPeerMicError(err);
      setPeerMicStatus('error');
      showToast(err);
      return false;
    }

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: isEchoCancellationEnabled,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: { ideal: 48000 },
          },
          video: false,
        });
      } catch (conErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: isEchoCancellationEnabled,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
      }
    } catch (err: any) {
      console.error('[Mic] getUserMedia error:', err);
      const name = err?.name || '';
      let msg = 'Gagal mengakses mikrofon.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg = 'Izin mikrofon ditolak oleh browser HP. Silakan buka Pengaturan Izin Situs dan pilih "Izinkan Mikrofon", lalu coba lagi.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'Perangkat mikrofon tidak ditemukan di ponsel Anda.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = 'Mikrofon HP sedang digunakan oleh aplikasi lain (misal WhatsApp atau panggilan telepon).';
      } else {
        msg = err?.message || 'Akses Mikrofon Bermasalah';
      }
      setPeerMicError(msg);
      setPeerMicStatus('error');
      showToast(msg);
      return false;
    }

    localStreamRef.current = stream;

    // Enforce low-latency speech profile on all audio tracks
    stream.getAudioTracks().forEach((track) => {
      track.contentHint = 'speech';
    });

    const tvPeerId = getTvPeerId(roomId);
    if (!peerRef.current) return false;

    const mediaConn = peerRef.current.call(tvPeerId, stream, {
      metadata: { singerName, senderId: peerRef.current.id, volume: 75 },
    });
    mediaConnRef.current = mediaConn;

    mediaConn.on('close', () => {
      setPeerMicStreaming(false);
      setPeerMicStatus('idle');
    });

    mediaConn.on('error', (err) => {
      console.warn('[Mic] MediaConnection error:', err);
      setPeerMicError('Koneksi streaming suara ke TV terputus.');
      setPeerMicStatus('error');
    });

    setPeerMicStreaming(true);
    setPeerMicStatus('connected');
    showToast('🎤 Mikrofon HP Terhubung Langsung ke Speaker TV!');

    // Setup local audio analyser for real-time VU meter
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        let audioCtx: AudioContext;
        try {
          audioCtx = new AudioCtx({ sampleRate: 16000, latencyHint: 'interactive' });
        } catch {
          try {
            audioCtx = new AudioCtx({ latencyHint: 'interactive' });
          } catch {
            audioCtx = new AudioCtx();
          }
        }
        audioContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const timeArray = new Uint8Array(analyser.fftSize);
        let lastSendTime = 0;
        let lastVUUpdate = 0;

        const updateVU = () => {
          if (analyserRef.current && localStreamRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray as any);
            analyserRef.current.getByteTimeDomainData(timeArray as any);

            let maxDiff = 0;
            for (let i = 0; i < timeArray.length; i++) {
              const diff = Math.abs(timeArray[i] - 128);
              if (diff > maxDiff) maxDiff = diff;
            }
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;

            const peakNorm = Math.min(1, maxDiff / 48);
            const freqNorm = Math.min(1, avg / 35);
            const combinedNorm = Math.max(peakNorm * 0.85, freqNorm);
            const targetLvl = peerMicMuted ? 0 : Math.min(100, Math.round(Math.pow(combinedNorm, 0.75) * 100));

            const now = performance.now();
            if (now - lastVUUpdate >= 40) {
              lastVUUpdate = now;
              setPeerAudioLevel((prev) => {
                if (targetLvl >= prev) return targetLvl;
                return Math.max(0, Math.round(prev * 0.82));
              });
            }

            // Also send level to TV over PeerJS data connection if open!
            const nowMs = Date.now();
            if (nowMs - lastSendTime > 50 && dataConnRef.current && dataConnRef.current.open) {
              lastSendTime = nowMs;
              try {
                dataConnRef.current.send({
                  action: 'UPDATE_MIC_LEVEL' as any,
                  payload: { level: targetLvl, senderName: singerName, senderId: peerRef.current?.id },
                  timestamp: nowMs,
                });
              } catch {}
            }

            animFrameRef.current = requestAnimationFrame(updateVU);
          }
        };
        updateVU();
      }
    } catch {}

    return true;
  }, [peerConnectionState, roomId, singerName, showToast, peerMicMuted]);

  const stopPeerMic = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaConnRef.current) {
      try {
        mediaConnRef.current.close();
      } catch {}
      mediaConnRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setPeerMicStreaming(false);
    setPeerMicStatus('idle');
    setPeerAudioLevel(0);
    showToast('Mikrofon dimatikan');
  }, [showToast]);

  const togglePeerMicMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const muted = !track.enabled;
      setPeerMicMuted(muted);
      showToast(muted ? 'Mikrofon dibisukan' : 'Mikrofon diaktifkan');
    }
  }, [showToast]);

  // Unified Wireless Microphone State & Controls
  const isMicLive = isMicStreaming || peerMicStreaming;
  const isCurrentMicMuted = isMicStreaming ? isMicMuted : peerMicMuted;
  const rawAudioLevel = Math.max(micAudioLevel, peerAudioLevel);
  const displayAudioLevel = isCurrentMicMuted ? 0 : rawAudioLevel;

  const handleStartUnifiedMic = useCallback(async () => {
    let ok = false;
    setPeerMicError(null);
    // 1. Prioritize ultra-low latency WebRTC stream via WebSocket signaling
    try {
      ok = await startMicBroadcast();
    } catch (err) {
      console.warn('[HP WebRTC] startMicBroadcast error:', err);
    }

    if (ok) {
      setPeerMicError(null);
      return true;
    }

    // 2. Fallback to PeerJS direct call only if WebSocket did not initialize stream and not in embedded simulator
    if (!ok && !isEmbedded) {
      if (peerConnectionState !== 'connected') {
        connectToTvPeer();
      }
      ok = await startPeerMic();
    }
    return ok;
  }, [startMicBroadcast, startPeerMic, peerConnectionState, connectToTvPeer, isEmbedded]);

  const handleStopUnifiedMic = useCallback(() => {
    if (isMicStreaming) {
      stopMicBroadcast();
    }
    if (peerMicStreaming) {
      stopPeerMic();
    }
  }, [isMicStreaming, peerMicStreaming, stopMicBroadcast, stopPeerMic]);

  const handleToggleUnifiedMute = useCallback(() => {
    if (isMicStreaming) {
      toggleMicMute();
    }
    if (peerMicStreaming) {
      togglePeerMicMute();
    }
  }, [isMicStreaming, peerMicStreaming, toggleMicMute, togglePeerMicMute]);

  // Connect WebSocket & fallback SSE with exponential backoff, heartbeat & retry queue
  useEffect(() => {
    fetchRoomState();

    let socket: WebSocket | null = null;
    let sseSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isUnmounted = false;

    let retryAttempt = 0;
    let pingInterval: any = null;

    const connectWebSocket = () => {
      if (isUnmounted) return;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      try {
        const wsUrl = getSignalingWebSocketUrl({
          roomId,
          role: 'client',
          singerName,
          clientId,
        });

        socket = new WebSocket(wsUrl);
        wsRef.current = socket;
        setWsReadyState(WebSocket.CONNECTING);
        if (Date.now() - lastSyncTime.current > 7000) {
          setConnectionStatus('reconnecting');
        }

        socket.onopen = () => {
          if (isUnmounted) return;
          retryAttempt = 0;
          lastSyncTime.current = Date.now();
          lastWsPongRef.current = Date.now();
          setIsConnected(true);
          setConnectionStatus('connected');
          setWsReadyState(WebSocket.OPEN);

          // Flush queued messages that were sent while temporarily disconnected
          if (pendingClientMessagesRef.current.length > 0) {
            const queued = [...pendingClientMessagesRef.current];
            pendingClientMessagesRef.current = [];
            queued.forEach((item) => {
              try {
                socket?.send(
                  JSON.stringify({
                    type: item.type,
                    roomId,
                    payload: item.payload,
                    timestamp: Date.now(),
                  })
                );
              } catch {
                pendingClientMessagesRef.current.push(item);
              }
            });
          }

          // Full room state sync upon opening/reconnecting
          fetchRoomState();

          // Heartbeat ping + staleness watchdog every 4 seconds
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              if (Date.now() - lastWsPongRef.current > 15000) {
                try {
                  socket.close();
                } catch {}
                return;
              }
              try {
                socket.send(JSON.stringify({ type: 'PING', roomId, timestamp: Date.now() }));
              } catch {}
            }
          }, 4000);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data || !data.type) return;

            lastSyncTime.current = Date.now();
            lastWsPongRef.current = Date.now();
            setIsConnected(true);
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
              case 'STATE_UPDATE':
                if (data.payload) {
                  if (data.payload.currentSong !== undefined) setCurrentSong(data.payload.currentSong);
                  if (data.payload.currentSinger !== undefined) setCurrentSinger(data.payload.currentSinger);
                  if (data.payload.isPlaying !== undefined) setIsPlaying(data.payload.isPlaying);
                  if (typeof data.payload.isMcSpeaking === 'boolean') setMcSpeakingLock(data.payload.isMcSpeaking);
                  if (Array.isArray(data.payload.queue)) setQueue(data.payload.queue);
                  if (data.payload.clientCount !== undefined) setClientCount(data.payload.clientCount);
                  if (typeof data.payload.musicDelayMs === 'number') setTvMusicDelay(data.payload.musicDelayMs);
                  if (typeof data.payload.musicVolume === 'number') setMusicVolume(data.payload.musicVolume);
                  if (typeof data.payload.isMuted === 'boolean') setIsMusicMuted(data.payload.isMuted);
                  if (Array.isArray(data.payload.juryVotes)) {
                    setJuryVotersList(data.payload.juryVotes.map((v: any) => ({ juryName: v.juryName, score: v.score })));
                  }
                  if (Array.isArray(data.payload.localIps) && data.payload.localIps.length > 0) {
                    setDetectedLocalIps(data.payload.localIps);
                  }
                }
                break;

              case 'ADD_QUEUE_ITEM':
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                } else if (data.payload?.item) {
                  setQueue((prev) => {
                    if (prev.some((q) => q.queueId === data.payload.item.queueId)) return prev;
                    return data.payload.item.priority ? [data.payload.item, ...prev] : [...prev, data.payload.item];
                  });
                }
                break;

              case 'REMOVE_QUEUE_ITEM':
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                } else if (data.payload?.queueId) {
                  setQueue((prev) => prev.filter((q) => q.queueId !== data.payload.queueId));
                }
                break;

              case 'SYNC_QUEUE':
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                }
                break;

              case 'PLAY_NOW':
                if (data.payload?.song) {
                  setCurrentSong(data.payload.song);
                  if (data.payload?.singerName) setCurrentSinger(data.payload.singerName);
                  setIsPlaying(true);
                }
                break;

              case 'SKIP_NEXT':
                if (data.payload?.currentSong !== undefined) {
                  setCurrentSong(data.payload.currentSong);
                }
                if (data.payload?.currentSinger !== undefined) {
                  setCurrentSinger(data.payload.currentSinger);
                }
                if (Array.isArray(data.payload?.queue)) {
                  setQueue(data.payload.queue);
                }
                break;

              case 'TOGGLE_PAUSE':
                if (data.payload?.isPlaying !== undefined) {
                  setIsPlaying(data.payload.isPlaying);
                } else {
                  setIsPlaying((prev) => !prev);
                }
                break;

              case 'SMART_MC_STATUS':
                setMcSpeakingLock(Boolean(data.payload?.isSpeaking));
                break;

              case 'TRIGGER_SMART_MC':
                setMcSpeakingLock(true);
                if (data.payload?.announcement) {
                  setLastMcPreview(data.payload.announcement);
                }
                break;

              case 'CLIENT_COUNT_UPDATE':
                if (data.payload?.clientCount) {
                  setClientCount(data.payload.clientCount);
                }
                break;

              case 'RTC_ANSWER':
              case 'RTC_ICE_CANDIDATE':
              case 'RTC_MIC_PARAMS':
                handleMicSignaling(data);
                break;

              case 'MUSIC_SYNC_DELAY':
                if (typeof data.payload?.delayMs === 'number') {
                  setTvMusicDelay(data.payload.delayMs);
                }
                break;

              case 'SET_MUSIC_VOLUME':
              case 'SET_VOLUME': {
                const vol = typeof data.payload === 'number' ? data.payload : data.payload?.volume;
                if (typeof vol === 'number') {
                  setMusicVolume(Math.max(0, Math.min(100, Math.round(vol))));
                }
                if (typeof data.payload?.isMuted === 'boolean') {
                  setIsMusicMuted(data.payload.isMuted);
                }
                break;
              }

              case 'SUBMIT_JURY_SCORE':
              case 'SYNC_JURY_SCORES': {
                if (Array.isArray(data.payload?.votes)) {
                  setJuryVotersList(data.payload.votes.map((v: any) => ({ juryName: v.juryName, score: v.score })));
                } else if (data.payload?.lastVote) {
                  const newVote = data.payload.lastVote;
                  setJuryVotersList((prev) => {
                    const filtered = prev.filter((v) => v.juryName !== newVote.juryName);
                    return [...filtered, { juryName: newVote.juryName, score: newVote.score }];
                  });
                }
                break;
              }
            }
          } catch (e) {
            console.warn('Error parsing WS message:', e);
          }
        };

        socket.onclose = () => {
          if (isUnmounted) return;
          setWsReadyState(WebSocket.CLOSED);
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
          if (isOffline) {
            setIsConnected(false);
            setConnectionStatus('disconnected');
          } else if (Date.now() - lastSyncTime.current > 7000) {
            setIsConnected(false);
            setConnectionStatus('reconnecting');
          }
          retryAttempt++;
          const delay = Math.min(1000 * Math.pow(1.5, retryAttempt), 15000);
          reconnectTimeout = setTimeout(connectWebSocket, delay);
        };

        socket.onerror = () => {
          setWsReadyState(WebSocket.CLOSED);
          try {
            socket?.close();
          } catch {}
        };
      } catch (err) {
        setWsReadyState(WebSocket.CLOSED);
        connectSSE();
      }
    };

    triggerReconnectRef.current = () => {
      retryAttempt = 0;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
      fetchRoomState();
    };

    const connectSSE = () => {
      try {
        const sseUrl = `/api/room/${encodeURIComponent(roomId)}/events?role=client&name=${encodeURIComponent(
          singerName
        )}`;
        sseSource = new EventSource(sseUrl);

        sseSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT_STATE' || data.type === 'STATE_UPDATE') {
              if (data.payload?.currentSong !== undefined) setCurrentSong(data.payload.currentSong);
              if (data.payload?.currentSinger !== undefined) setCurrentSinger(data.payload.currentSinger);
              if (data.payload?.isPlaying !== undefined) setIsPlaying(data.payload.isPlaying);
              if (typeof data.payload?.isMcSpeaking === 'boolean') setMcSpeakingLock(data.payload.isMcSpeaking);
              if (Array.isArray(data.payload?.queue)) setQueue(data.payload.queue);
              if (data.payload?.clientCount) setClientCount(data.payload.clientCount);
              setIsConnected(true);
              setConnectionStatus('connected');
            } else if (data.type === 'SYNC_QUEUE' && Array.isArray(data.payload?.queue)) {
              setQueue(data.payload.queue);
            } else if (data.type === 'PLAY_NOW' && data.payload?.song) {
              setCurrentSong(data.payload.song);
              if (data.payload?.singerName) setCurrentSinger(data.payload.singerName);
              setIsPlaying(true);
            } else if (data.type === 'SKIP_NEXT') {
              if (data.payload?.currentSong !== undefined) setCurrentSong(data.payload.currentSong);
              if (data.payload?.currentSinger !== undefined) setCurrentSinger(data.payload.currentSinger);
              if (Array.isArray(data.payload?.queue)) setQueue(data.payload.queue);
            } else if (data.type === 'SMART_MC_STATUS') {
              setMcSpeakingLock(Boolean(data.payload?.isSpeaking));
            } else if (data.type === 'TRIGGER_SMART_MC') {
              setMcSpeakingLock(true);
              if (data.payload?.announcement) setLastMcPreview(data.payload.announcement);
            } else if (data.type === 'TOGGLE_PAUSE') {
              if (data.payload?.isPlaying !== undefined) setIsPlaying(data.payload.isPlaying);
              else setIsPlaying((p) => !p);
            } else if (data.type === 'ADD_QUEUE_ITEM') {
              if (Array.isArray(data.payload?.queue)) {
                setQueue(data.payload.queue);
              } else if (data.payload?.item) {
                setQueue((prev) => {
                  if (prev.some((q) => q.queueId === data.payload.item.queueId)) return prev;
                  return data.payload.item.priority ? [data.payload.item, ...prev] : [...prev, data.payload.item];
                });
              }
            } else if (data.type === 'REMOVE_QUEUE_ITEM') {
              if (Array.isArray(data.payload?.queue)) {
                setQueue(data.payload.queue);
              } else if (data.payload?.queueId) {
                setQueue((prev) => prev.filter((q) => q.queueId !== data.payload.queueId));
              }
            }
          } catch (e) {}
        };

        sseSource.onerror = () => {
          setIsConnected(false);
          setConnectionStatus('reconnecting');
        };
      } catch (e) {}
    };

    connectWebSocket();

    // Fast auto-reconnect on screen unlock, app switch, or connection return
    const handlePhoneWake = () => {
      retryAttempt = 0;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
      fetchRoomState();
    };

    const handlePhoneOffline = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };

    document.addEventListener('visibilitychange', handlePhoneWake);
    window.addEventListener('online', handlePhoneWake);
    window.addEventListener('offline', handlePhoneOffline);
    window.addEventListener('focus', handlePhoneWake);
    window.addEventListener('pageshow', handlePhoneWake);

    // Fast polling every 1.5s to guarantee 100% real-time synchronization between TV and HP
    const pollInterval = setInterval(fetchRoomState, 1500);

    return () => {
      isUnmounted = true;
      document.removeEventListener('visibilitychange', handlePhoneWake);
      window.removeEventListener('online', handlePhoneWake);
      window.removeEventListener('offline', handlePhoneOffline);
      window.removeEventListener('focus', handlePhoneWake);
      window.removeEventListener('pageshow', handlePhoneWake);
      triggerReconnectRef.current = null;
      clearInterval(pollInterval);
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
      if (sseSource) sseSource.close();
    };
  }, [roomId, singerName, clientId, fetchRoomState, setMcSpeakingLock]);

  // Execute YouTube Search
  const executeSearch = useCallback(
    async (queryOverride?: string) => {
      const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
      if (!q) return;

      setIsSearching(true);
      setSearchError(null);

      // 1. Detect if user entered a direct YouTube link or Video ID
      const directId = extractYoutubeVideoId(q);
      if (directId) {
        let title = `Video YouTube (${directId})`;
        let channelTitle = 'YouTube Video';
        try {
          const oembed = await fetchOEmbedInfo(directId);
          if (oembed?.title) title = oembed.title;
          if (oembed?.author_name) channelTitle = oembed.author_name;
        } catch {}

        const directSong: Song = {
          id: directId,
          title,
          channelTitle,
          thumbnailUrl: `https://img.youtube.com/vi/${directId}/hqdefault.jpg`,
          isCurated: false,
        };

        setSearchResults([directSong]);
        setIsSearching(false);
        showToast(`🎥 Video YouTube terdeteksi: "${title.slice(0, 24)}..."`);
        return;
      }

      let finalQuery = q;
      if (suffixFilter === 'karaoke' && !q.toLowerCase().includes('karaoke')) {
        finalQuery += ' karaoke';
      } else if (suffixFilter === 'no vocal' && !q.toLowerCase().includes('no vocal')) {
        finalQuery += ' no vocal';
      } else if (suffixFilter === 'instrumental' && !q.toLowerCase().includes('instrumental')) {
        finalQuery += ' instrumental';
      }
      // If suffixFilter === 'none', do NOT append suffix (allows searching ALL YouTube videos)

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
          setSearchResults(data.songs);
          setSearchError(null);
        } else {
          const lower = q.toLowerCase();
          const allCurated = [...hitsIndoSongs, ...Object.entries(CURATED_LIBRARY).filter(([k]) => k !== 'hits-indonesia').flatMap(([, v]) => v)];
          const filtered = allCurated.filter(
            (s) => s.title.toLowerCase().includes(lower) || s.channelTitle.toLowerCase().includes(lower)
          );
          const fallbackSongs = filtered.length > 0 ? filtered : (hitsIndoSongs.length > 0 ? hitsIndoSongs : CURATED_LIBRARY['slow-rock']);
          setSearchResults(fallbackSongs);
          setSearchError('Pencarian kosong. Menampilkan koleksi lagu favorit.');
          showToast('⚠️ Lagu tidak ditemukan, menampilkan koleksi pilihan.');
        }
      } catch (err) {
        setSearchError('Koneksi pencarian lambat/gagal. Menampilkan koleksi lagu.');
        setSearchResults(hitsIndoSongs.length > 0 ? hitsIndoSongs : CURATED_LIBRARY['slow-rock']);
        showToast('⚠️ Waktu pencarian habis, menampilkan lagu favorit.');
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, suffixFilter, hitsIndoSongs, showToast]
  );

  // Add song to queue
  const handleAddSongToQueue = async (song: Song, priority = false) => {
    const canonicalQueueId = `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimisticItem: QueueItem = {
      queueId: canonicalQueueId,
      song,
      singerName,
      addedAt: Date.now(),
      priority,
    };

    // 1. Optimistic UI update with deduplication check
    setQueue((prev) => {
      if (
        prev.some(
          (q) =>
            q.queueId === canonicalQueueId ||
            (q.song.id === song.id && q.singerName === singerName && Date.now() - (q.addedAt || 0) < 3000)
        )
      ) {
        return prev;
      }
      return priority ? [optimisticItem, ...prev] : [...prev, optimisticItem];
    });

    if (!currentSong) {
      setCurrentSong(song);
      setCurrentSinger(singerName);
      setIsPlaying(true);
    }

    // 2. Multi-Channel Dispatch with identical canonical queueId (plus retry queue)
    sendPeerAction('ADD_QUEUE', { song, singerName, priority, queueId: canonicalQueueId, item: optimisticItem });
    sendWsReliable('ADD_QUEUE_ITEM', { song, singerName, priority, queueId: canonicalQueueId, item: optimisticItem });

    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, singerName, priority, queueId: canonicalQueueId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.currentSong) setCurrentSong(data.currentSong);
        if (data.currentSinger !== undefined) setCurrentSinger(data.currentSinger);
        if (Array.isArray(data.queue)) {
          setQueue(data.queue);
        }
      }
    } catch (err) {}

    showToast(
      priority
        ? `⚡ "${song.title.slice(0, 24)}..." diprioritaskan!`
        : `✅ "${song.title.slice(0, 24)}..." masuk antrean TV!`
    );
  };

  // Play song immediately on the TV
  const handlePlayNow = async (song: Song) => {
    setCurrentSong(song);
    setCurrentSinger(singerName);
    setIsPlaying(true);

    // Multi-Channel Dispatch
    sendPeerAction('SELECT_SONG', song);
    sendWsReliable('PLAY_NOW', { song, singerName });

    try {
      await fetch(`/api/room/${encodeURIComponent(roomId)}/play-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, singerName }),
      });
      fetchRoomState();
    } catch (e) {}
    showToast(`▶️ Memutar di TV: "${song.title.slice(0, 22)}..."`);
  };

  // Skip current song (Ganti lagu di TV)
  const handleSkipNext = async () => {
    const now = Date.now();
    if (now - lastClientSkipRef.current < 1500) {
      return;
    }
    lastClientSkipRef.current = now;

    let nextSongItem: Song | undefined;
    let nextQueueId: string | undefined;

    if (queue.length > 0) {
      nextSongItem = queue[0].song;
      nextQueueId = queue[0].queueId;
      setCurrentSong(nextSongItem);
      setCurrentSinger(queue[0].singerName || null);
      setQueue((prev) => prev.slice(1));
    }

    // Multi-Channel Dispatch
    sendPeerAction('NEXT_SONG', { nextSong: nextSongItem, queueId: nextQueueId });
    sendWsReliable('SKIP_NEXT', { senderName: singerName, nextSong: nextSongItem, queueId: nextQueueId });

    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ singerName, nextSong: nextSongItem, queueId: nextQueueId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.queue)) {
          setQueue(data.queue);
        }
      }
    } catch (e) {}
    showToast('⏭️ Mengganti lagu di TV!');
  };

  // Play / Pause control on the TV
  const handleTogglePlayPause = async () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    // Multi-Channel Dispatch: { action: "PLAY" } / { action: "PAUSE" }
    sendPeerAction(nextState ? 'PLAY' : 'PAUSE');
    sendWsReliable('TOGGLE_PAUSE', { isPlaying: nextState, senderName: singerName });

    try {
      await fetch(`/api/room/${encodeURIComponent(roomId)}/toggle-pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPlaying: nextState, senderName: singerName }),
      });
      fetchRoomState();
    } catch (e) {}
    showToast(nextState ? '▶️ Melanjutkan TV' : '⏸️ Menjeda TV');
  };

  // Submit Soldier Jury Score (Dewan Juri Prajurit)
  const handleSubmitJuryScore = useCallback(
    async (scoreVal?: number) => {
      const finalVal = Math.max(0, Math.min(100, Math.round(scoreVal !== undefined ? scoreVal : juryScoreInput)));
      const jName = (singerName || 'Prajurit (HP)').trim();

      // 1. PeerJS Direct Connection
      sendPeerAction('SUBMIT_JURY_SCORE' as any, {
        score: finalVal,
        juryName: jName,
        songId: currentSong?.id,
      });

      // 2. WebSocket Broadcast (with retry queue)
      sendWsReliable('SUBMIT_JURY_SCORE', {
        score: finalVal,
        juryName: jName,
        songId: currentSong?.id,
        clientId,
      });

      // 3. HTTP Fallback Endpoint
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/jury-vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: finalVal,
            juryName: jName,
            songId: currentSong?.id,
            clientId: jName.toLowerCase() || clientId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.votes)) {
            setJuryVotersList(data.votes.map((v: any) => ({ juryName: v.juryName, score: v.score })));
          }
        }
      } catch {}

      setHasSubmittedJury(true);
      setLastSubmittedScore(finalVal);
      setJuryVotersList((prev) => {
        const norm = jName.toLowerCase();
        const filtered = prev.filter((v) => v.juryName.trim().toLowerCase() !== norm);
        return [...filtered, { juryName: jName, score: finalVal }];
      });

      showToast(`⚖️ Nilai ${jName} (${finalVal}) terkirim ke dewan juri master!`);
    },
    [juryScoreInput, singerName, sendPeerAction, sendWsReliable, currentSong, roomId, clientId, showToast]
  );

  // Reorder queue: move song up or down
  const handleMoveQueueItem = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= queue.length) return;

    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    if (!moved) return;
    newQueue.splice(toIndex, 0, moved);
    setQueue(newQueue);

    sendPeerAction('REORDER_QUEUE', { fromIndex, toIndex, queueId: moved.queueId });
    const sentWs = sendWsReliable('MOVE_QUEUE_ITEM', { fromIndex, toIndex, queueId: moved.queueId, senderName: singerName });

    if (!sentWs) {
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromIndex, toIndex, queueId: moved.queueId, singerName }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.queue)) {
            setQueue(data.queue);
          }
        }
      } catch (e) {}
    }
    showToast(`↔️ Urutan lagu digeser ke #${toIndex + 1}`);
  };

  // Remove song from queue
  const handleRemoveQueueItem = async (queueId: string) => {
    setQueue((prev) => prev.filter((q) => q.queueId !== queueId));

    sendPeerAction('REMOVE_QUEUE', { queueId });
    sendWsReliable('REMOVE_QUEUE_ITEM', { queueId });

    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.queue)) {
          setQueue(data.queue);
        }
      }
    } catch (e) {}
    showToast('🗑️ Lagu dihapus dari antrean');
  };

  // Trigger Sound Reaction to TV Screen
  const handleSendReaction = async (sound: string, emoji: string, name: string) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(sound === 'boo' ? [120, 60, 180] : [60]);
      } catch {}
    }

    sendPeerAction('PLAY_SOUND_FX', { sound, senderName: singerName });
    const sentWs = sendWsReliable('PLAY_SOUND_FX', { sound, senderName: singerName });

    if (!sentWs) {
      try {
        await fetch(`/api/room/${encodeURIComponent(roomId)}/reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sound, singerName }),
        });
      } catch (err) {}
    }

    showToast(`${emoji} ${name} terkirim ke Layar TV!`);
  };

  // Trigger Smart MC Pantun Diskomlekau on Master TV Screen (100% Local Engine, No API Key)
  const handleTriggerSmartMc = async (withScore?: number | null) => {
    if (isMcSpeakingOnTv) {
      showToast('⏳ Tunggu pantun MC pertama selesai dibacakan di TV!');
      return;
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([50, 30, 70]);
      } catch {}
    }

    const effectiveScore =
      typeof withScore === 'number'
        ? withScore
        : juryVotersList.length > 0
        ? Math.round(juryVotersList.reduce((acc, v) => acc + v.score, 0) / juryVotersList.length)
        : undefined;

    const vocalistName = currentSinger || singerName || 'Prajurit Diskomlekau';
    const songTitle = currentSong?.title || 'Lagu Pilihan Prajurit';

    const announcement = generateSmartMcAnnouncement({
      singerName: vocalistName,
      songTitle,
      score: effectiveScore,
      forceTier: typeof withScore === 'number' ? undefined : 'manual',
      triggeredBy: singerName,
      isManual: true,
    });

    setMcSpeakingLock(true);
    setLastMcPreview(announcement);

    const payload = {
      announcement,
      singerName: vocalistName,
      senderName: singerName,
      songTitle,
      score: effectiveScore,
      isManual: true,
    };

    // 1. PeerJS DataConnection P2P
    sendPeerAction('TRIGGER_SMART_MC', payload);

    // 2. WebSocket (with retry queue)
    sendWsReliable('TRIGGER_SMART_MC', payload);

    // 3. HTTP Fallback
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}/smart-mc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.skipped === 'mc_busy') {
          showToast('⏳ Pantun MC pertama sedang berlangsung di TV!');
          return;
        }
      }
    } catch {}

    showToast('🎙️ Pantun Smart MC ditampilkan & dibacakan di Layar TV!');
  };

  // Add Direct YouTube Link
  const handleAddDirectLink = async (e?: React.FormEvent, playNow = false) => {
    if (e) e.preventDefault();
    if (!directUrl.trim()) return;

    const videoId = extractYoutubeVideoId(directUrl.trim());
    if (!videoId) {
      showToast('❌ Tautan YouTube tidak valid.');
      return;
    }

    setIsResolvingDirect(true);
    let title = `Video YouTube (${videoId})`;
    let channelTitle = 'YouTube Video';

    try {
      const oembed = await fetchOEmbedInfo(videoId);
      if (oembed?.title) title = oembed.title;
      if (oembed?.author_name) channelTitle = oembed.author_name;
    } catch {}

    const directSong: Song = {
      id: videoId,
      title,
      channelTitle,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      isCurated: false,
    };

    if (playNow) {
      await handlePlayNow(directSong);
    } else {
      await handleAddSongToQueue(directSong, false);
    }
    setDirectUrl('');
    setIsResolvingDirect(false);
    setShowDirectInput(false);
  };

  const effectiveConnectionStatus: ConnectionStatus =
    typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'disconnected'
      : isEmbedded || isConnected || wsReadyState === WebSocket.OPEN || peerConnectionState === 'connected'
      ? 'connected'
      : connectionStatus === 'disconnected' && peerConnectionState === 'disconnected'
      ? 'disconnected'
      : 'reconnecting';

  return (
    <div
      className={`text-slate-100 flex flex-col font-sans select-none ${
        isEmbedded ? 'h-full overflow-y-auto pb-20 bg-[#060e20]' : 'min-h-screen pb-28 max-w-lg mx-auto bg-[#060e20]'
      }`}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-3 inset-x-3 z-50 flex items-center justify-center animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xl shadow-sky-950 border border-sky-300/40 backdrop-blur-md">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Clean, Simple Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-sky-900/60 bg-[#07132c]/95 backdrop-blur-md px-3.5 py-2.5 shadow-md">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & TV Connection Status */}
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#02060d] shadow shrink-0 border border-sky-400/60 overflow-hidden">
              <img
                src="/assets/aistudio/1795037935766_8c0daa07.jpg"
                alt="Logo DISKOMLEKAU Karaoke"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm font-black tracking-tight text-white">
                  KARAOKE <span className="text-sky-400">DISKOMLEKAU</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
                <span
                  className={`h-2 w-2 rounded-full ${
                    effectiveConnectionStatus === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : effectiveConnectionStatus === 'reconnecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span
                  className={
                    effectiveConnectionStatus === 'connected'
                      ? 'text-emerald-400'
                      : effectiveConnectionStatus === 'reconnecting'
                      ? 'text-amber-300'
                      : 'text-rose-400'
                  }
                >
                  {effectiveConnectionStatus === 'connected'
                    ? 'Terhubung ke TV'
                    : effectiveConnectionStatus === 'reconnecting'
                    ? 'Menyambung Ulang...'
                    : 'Koneksi Terputus'}
                </span>
                <span className="text-slate-400 text-[10px]">({roomId})</span>
                {effectiveConnectionStatus !== 'connected' && (
                  <button
                    onClick={() => {
                      handleRequestReconnect();
                      connectToTvPeer();
                    }}
                    className="ml-1 rounded bg-sky-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white active:scale-95"
                    title="Sambung Ulang Sekarang"
                  >
                    ↻
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions: PWA Install & User Name Badge */}
          <div className="flex items-center gap-1.5">
            <PWAInstallButton variant="mobile" />

            {isEditingSinger ? (
              <div className="flex items-center gap-1 bg-[#040915] p-1 rounded-xl border border-sky-400 shadow">
                <input
                  type="text"
                  value={singerInput}
                  onChange={(e) => setSingerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveSinger()}
                  className="w-24 rounded bg-transparent px-1.5 py-0.5 text-xs text-white outline-none"
                  placeholder="Nama Anda"
                  autoFocus
                />
                <button
                  onClick={handleSaveSinger}
                  className="rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-bold text-white shrink-0"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSingerInput(singerName);
                  setIsEditingSinger(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#091838] px-2.5 py-1.5 text-xs border border-sky-800 hover:border-sky-500 transition shadow-sm"
                title="Sentuh untuk mengganti nama Anda"
              >
                <User className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span className="text-amber-300 font-bold truncate max-w-[85px]">{singerName}</span>
                <span className="text-[10px] text-sky-400">✏️</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Slogan Kebanggaan Prajurit Diskomlekau - Sebaris Memanjang Satu Garis */}
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-amber-500/20 border-b border-amber-400/50 px-3 py-1 text-center shadow-sm overflow-hidden whitespace-nowrap">
        <p className="font-display text-[10px] sm:text-xs font-black text-amber-300 uppercase tracking-wide drop-shadow whitespace-nowrap">
          &ldquo;Prajurit Yang Pantang Mundur Walau Suara Hancur&rdquo;
        </p>
      </div>

      {/* "SEDANG TAYANG DI LAYAR TV" (Live Synchronized Player Card) */}
      <section className="bg-gradient-to-r from-[#071533] to-[#091b40] p-3 border-b border-sky-900/60 shadow-inner">
        <div className="flex items-center justify-between text-[11px] font-bold text-sky-300 mb-1.5">
          <span className="flex items-center gap-1.5 uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            Sedang Tayang di Layar TV
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
            {isPlaying ? '▶️ Memutar' : '⏸️ Dijeda'}
          </span>
        </div>

        {currentSong ? (
          <div className="flex items-center gap-2.5">
            <img
              src={currentSong.thumbnailUrl}
              alt={currentSong.title}
              className="h-12 w-16 rounded-xl object-cover border border-sky-700/60 shadow shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white leading-tight">
                {currentSong.title}
              </p>
              <p className="truncate text-[10px] text-sky-300/80 mt-0.5">
                {currentSong.channelTitle}
              </p>
            </div>

            {/* Quick TV Playback Controls: Pause/Play & Skip */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleTogglePlayPause}
                className="flex items-center justify-center h-8 w-8 rounded-xl bg-sky-900/80 border border-sky-600/70 text-white hover:bg-sky-700 transition active:scale-95 shadow"
                title={isPlaying ? 'Jeda Lagu di TV' : 'Putar Lagu di TV'}
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current text-amber-300" /> : <Play className="h-4 w-4 fill-current text-emerald-400 ml-0.5" />}
              </button>

              <button
                onClick={handleSkipNext}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 px-2.5 py-2 text-[10px] font-black text-white shadow transition active:scale-95 border border-amber-400/50"
                title="Ganti ke lagu berikutnya di antrean TV"
              >
                <SkipForward className="h-3.5 w-3.5 fill-current" />
                <span>Ganti</span>
              </button>

              <button
                onClick={() => setActiveTab('jury')}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 px-2.5 py-2 text-[10px] font-black text-slate-950 shadow transition active:scale-95 border border-amber-300"
                title="Buka Dewan Juri Prajurit untuk memberi nilai lagu ini"
              >
                <Scale className="h-3.5 w-3.5 fill-current" />
                <span>Nilai</span>
              </button>

              <button
                onClick={() => handleTriggerSmartMc()}
                disabled={isMcSpeakingOnTv}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 px-2.5 py-2 text-[10px] font-black text-slate-950 shadow transition active:scale-95 border border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isMcSpeakingOnTv ? 'Tunggu pantun MC pertama selesai' : 'Panggil Pantun Smart MC Diskomlekau di Layar TV'}
              >
                <span>{isMcSpeakingOnTv ? '⏳ MC Bicara' : '🎙️ Pantun MC'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300 py-1 flex-wrap">
            <span>Belum ada lagu yang diputar di TV.</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleTriggerSmartMc()}
                disabled={isMcSpeakingOnTv}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950 shadow border border-emerald-300 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMcSpeakingOnTv ? '⏳ MC Bicara...' : '🎙️ Pantun MC'}
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className="rounded-xl bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white shadow"
              >
                Pilih Lagu Sekarang
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Quick Wireless Mic Floating Banner when Streaming */}
      {isMicLive && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-[#041c2c] border-b border-emerald-500/70 px-3 py-2 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 animate-in fade-in sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white truncate flex items-center gap-1.5">
                  <span>🎙️ Mic Live (Ultra-Low Latency)</span>
                  {isCurrentMicMuted && <span className="text-[9px] bg-rose-600 px-1 py-0.2 rounded font-mono font-bold">MUTED</span>}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-mono font-bold ${isCurrentMicMuted ? 'text-rose-400' : 'text-emerald-300'}`}>
                    {isCurrentMicMuted ? 'BISU (MUTED)' : `VU: ${displayAudioLevel}%`}
                  </span>
                  {/* Live mini dynamic VU meter bar */}
                  <div className="w-16 h-2 bg-black/70 rounded-full overflow-hidden p-0.5 border border-emerald-700/60 inline-flex items-center">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        isCurrentMicMuted
                          ? 'w-0'
                          : displayAudioLevel > 75
                          ? 'bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400'
                          : displayAudioLevel > 40
                          ? 'bg-gradient-to-r from-emerald-400 to-amber-300'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: isCurrentMicMuted ? '0%' : `${Math.min(100, Math.max(displayAudioLevel > 0 ? 6 : 0, displayAudioLevel))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleToggleUnifiedMute}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                  isCurrentMicMuted
                    ? 'bg-rose-900/80 text-rose-200 border-rose-500'
                    : 'bg-emerald-900/80 text-emerald-200 border-emerald-500'
                }`}
              >
                {isCurrentMicMuted ? 'Buka Mic' : 'Mute'}
              </button>
              <button
                onClick={() => setActiveTab('mic')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow"
              >
                Panel Mic
              </button>
            </div>
          </div>

          {/* Quick Controls: Volume, Echo, and Music Sync Delay Adjusters */}
          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-800/60 flex-wrap">
            {/* Quick Volume +/- */}
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-emerald-600/40">
              <span className="text-[10px] font-mono text-emerald-300 font-bold">Vol:</span>
              <button
                onClick={decreaseVolume}
                className="h-5 w-6 rounded bg-emerald-950 hover:bg-emerald-800 text-emerald-200 font-black text-xs flex items-center justify-center border border-emerald-500/50 active:scale-95 transition"
                title="Kurangi Volume (-)"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-white font-bold w-8 text-center">
                {micVolume}%
              </span>
              <button
                onClick={increaseVolume}
                className="h-5 w-6 rounded bg-emerald-950 hover:bg-emerald-800 text-emerald-200 font-black text-xs flex items-center justify-center border border-emerald-500/50 active:scale-95 transition"
                title="Tambah Volume (+)"
              >
                +
              </button>
            </div>

            {/* Quick Echo +/- */}
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-teal-600/40">
              <span className="text-[10px] font-mono text-teal-300 font-bold">Echo:</span>
              <button
                onClick={decreaseEcho}
                className="h-5 w-6 rounded bg-teal-950 hover:bg-teal-800 text-teal-200 font-black text-xs flex items-center justify-center border border-teal-500/50 active:scale-95 transition"
                title="Kurangi Echo (-)"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-amber-300 font-bold w-7 text-center">
                {micEcho}%
              </span>
              <button
                onClick={increaseEcho}
                className="h-5 w-6 rounded bg-teal-950 hover:bg-teal-800 text-teal-200 font-black text-xs flex items-center justify-center border border-teal-500/50 active:scale-95 transition"
                title="Tambah Echo (+)"
              >
                +
              </button>
            </div>

            {/* Quick TV Music Volume +/- */}
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-sky-600/50">
              <button
                onClick={handleToggleMusicMute}
                className="text-[10px] font-mono text-sky-300 hover:text-white font-bold flex items-center gap-0.5"
                title={isMusicMuted ? 'Buka Suara Musik TV' : 'Bisukan Musik TV'}
              >
                {isMusicMuted ? (
                  <VolumeX className="h-3 w-3 text-rose-400" />
                ) : (
                  <Volume2 className="h-3 w-3 text-sky-400" />
                )}
                <span>Musik:</span>
              </button>
              <button
                onClick={handleDecreaseMusicVolume}
                className="h-5 w-6 rounded bg-sky-950 hover:bg-sky-800 text-sky-200 font-black text-xs flex items-center justify-center border border-sky-500/50 active:scale-95 transition"
                title="Kurangi Volume Musik (-5%)"
              >
                -
              </button>
              <span className={`text-[10px] font-mono font-bold w-8 text-center ${isMusicMuted ? 'text-rose-400 line-through' : 'text-sky-100'}`}>
                {isMusicMuted ? '0%' : `${musicVolume}%`}
              </span>
              <button
                onClick={handleIncreaseMusicVolume}
                className="h-5 w-6 rounded bg-sky-950 hover:bg-sky-800 text-sky-200 font-black text-xs flex items-center justify-center border border-sky-500/50 active:scale-95 transition"
                title="Tambah Volume Musik (+5%)"
              >
                +
              </button>
            </div>

            {/* Quick TV Music Sync Delay +/- */}
            <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-amber-600/50">
              <span className="text-[10px] font-mono text-amber-300 font-bold flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                <span>Sync:</span>
              </span>
              <button
                onClick={() => handleSetTvMusicDelay(Math.max(0, tvMusicDelay - 5))}
                className="h-5 w-6 rounded bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-xs flex items-center justify-center border border-amber-500/50 active:scale-95 transition"
                title="Kurangi Delay Musik (-5ms)"
              >
                -
              </button>
              <span className="text-[10px] font-mono text-amber-200 font-bold px-1 text-center">
                +{tvMusicDelay}ms
              </span>
              <button
                onClick={() => handleSetTvMusicDelay(Math.min(250, tvMusicDelay + 5))}
                className="h-5 w-6 rounded bg-amber-950 hover:bg-amber-800 text-amber-200 font-black text-xs flex items-center justify-center border border-amber-500/50 active:scale-95 transition"
                title="Tambah Delay Musik (+5ms)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 p-3.5 space-y-4">
        {/* ============================================================== */}
        {/* TAB 1: CARI LAGU (Super Simpel & Jelas)                        */}
        {/* ============================================================== */}
        {activeTab === 'search' && (
          <div className="space-y-3.5">
            {/* Search Input Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                placeholder={
                  suffixFilter === 'none'
                    ? 'Cari video apa saja di YouTube atau tempel link...'
                    : 'Ketik judul lagu atau penyanyi...'
                }
                className="w-full rounded-2xl border-2 border-sky-600/60 bg-[#050e22] pl-10 pr-24 py-3 text-xs text-white placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 shadow-lg"
              />
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-sky-400" />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-16 top-3 p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                onClick={() => executeSearch()}
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-1.5 top-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 active:scale-95 transition shadow disabled:opacity-40"
              >
                {isSearching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Cari'}
              </button>
            </div>

            {/* Filter Mode YouTube: Karaoke vs Bebas Semua Video */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
              {[
                { id: 'karaoke', label: '🎤 Karaoke' },
                { id: 'no vocal', label: '🔇 Tanpa Vokal' },
                { id: 'instrumental', label: '🎹 Instrumental' },
                { id: 'none', label: '🌐 Semua Video YouTube (Bebas)' },
              ].map((opt) => {
                const isSelected = suffixFilter === opt.id;
                const isAllVideo = opt.id === 'none';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSuffixFilter(opt.id as SuffixFilter);
                      if (searchQuery.trim()) {
                        executeSearch(searchQuery);
                      }
                      showToast(
                        opt.id === 'none'
                          ? '🌐 Mode Bebas: Menampilkan SEMUA Video dari YouTube'
                          : `Filter mode: ${opt.label}`
                      );
                    }}
                    className={`rounded-xl px-2.5 py-1.5 font-bold whitespace-nowrap transition flex items-center gap-1 border active:scale-95 ${
                      isSelected
                        ? isAllVideo
                          ? 'border-amber-400 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-md shadow-red-950/60'
                          : 'border-sky-400 bg-sky-600 text-white shadow-md'
                        : isAllVideo
                        ? 'border-amber-700/70 bg-[#1f0e1f] text-amber-300 hover:border-amber-400'
                        : 'border-sky-900 bg-[#081533] text-sky-200 hover:border-sky-400'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Mode Notice when 'none' is selected */}
            {suffixFilter === 'none' && (
              <div className="rounded-xl border border-red-500/50 bg-red-950/40 p-2 text-[10px] text-amber-200 flex items-center gap-1.5 animate-in fade-in">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping shrink-0" />
                <span>
                  <strong>Mode Bebas Aktif:</strong> Akses penuh ke SELURUH video YouTube (klip asli, official MV, konser live, Mars TNI AU, dll).
                </span>
              </div>
            )}

            {/* List Pilihan Kategori Preset (Hits Indonesia Trending & Kategori Lain) */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-[11px] px-0.5 gap-2">
                <span className="font-bold text-sky-300 flex items-center gap-1">
                  <Flame className="h-3 w-3 text-rose-400" />
                  <span>List Pilihan:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {activeSearchCategory === 'hits-indonesia' && !searchQuery.trim() && (
                    <span className="text-[10px] font-semibold text-rose-300 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                      <span>Hits YouTube Indo ({hitsIndoSongs.length})</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleRefreshHits}
                    disabled={isRefreshingHits}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 px-2 py-0.5 text-[10px] font-bold text-rose-200 transition active:scale-95 disabled:opacity-50"
                    title="Ambil lagu hits Indonesia tren terbaru dari YouTube"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${isRefreshingHits ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingHits ? 'Memuat...' : 'Update Tren'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                {CATEGORY_PRESETS.map((preset) => {
                  const isSelected = activeSearchCategory === preset.id && !searchQuery.trim();
                  const isHitsIndo = preset.id === 'hits-indonesia';
                  const categoryList = isHitsIndo ? hitsIndoSongs : (CURATED_LIBRARY[preset.id] || []);
                  const count = categoryList.length;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setActiveSearchCategory(preset.id);
                        setSearchQuery('');
                        setSearchResults(categoryList);
                        showToast(`📂 Menampilkan list pilihan: ${preset.label}`);
                      }}
                      className={`rounded-xl px-2.5 py-1 whitespace-nowrap font-bold transition flex items-center gap-1 border active:scale-95 ${
                        isSelected
                          ? isHitsIndo
                            ? 'border-rose-400 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white shadow-md shadow-rose-950/50'
                            : 'border-sky-400 bg-sky-600 text-white shadow-md'
                          : isHitsIndo
                          ? 'border-rose-800/80 bg-[#170a1f] text-rose-200 hover:border-rose-400 hover:text-white'
                          : 'border-sky-900 bg-[#081533] text-sky-200 hover:border-sky-400 hover:text-white'
                      }`}
                    >
                      {isHitsIndo && <Flame className="h-3 w-3 text-amber-300" />}
                      <span>{preset.label}</span>
                      <span className="rounded-full bg-black/40 px-1 text-[9px] font-mono text-sky-200">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Filter Buttons (Pencarian Cepat 1-Sentuh) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] no-scrollbar opacity-90">
                <span className="text-[9px] font-bold text-slate-400 shrink-0">Kata Kunci:</span>
                {['Bernadya', 'Mahalini', 'Sal Priadi', 'Tulus', 'Dewa 19', 'Judika', 'Dangdut Koplo', 'Slow Rock'].map(
                  (term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setActiveSearchCategory(null);
                        setSearchQuery(term);
                        executeSearch(term);
                      }}
                      className="rounded-lg px-2 py-0.5 whitespace-nowrap bg-[#061129] border border-sky-900/60 text-sky-300 hover:border-sky-400 hover:text-white transition font-medium"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Direct Link Option Toggle */}
            <div className="text-right">
              <button
                onClick={() => setShowDirectInput(!showDirectInput)}
                className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 underline"
              >
                <LinkIcon className="h-3 w-3" />
                <span>{showDirectInput ? 'Tutup Input Link' : '+ Akses Link YouTube Langsung'}</span>
              </button>
            </div>

            {showDirectInput && (
              <div className="rounded-xl bg-[#050e22] p-2.5 border border-sky-800 animate-in fade-in duration-200 space-y-2">
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                  <LinkIcon className="h-3 w-3" />
                  <span>Akses Langsung Video YouTube:</span>
                </div>
                <input
                  type="text"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="Tempel link YouTube (cth: https://youtu.be/...)"
                  className="w-full rounded-lg bg-[#07132c] border border-sky-700/80 px-2.5 py-2 text-xs text-white placeholder-slate-500 outline-none truncate focus:border-sky-400"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddDirectLink(undefined, true)}
                    disabled={isResolvingDirect || !directUrl.trim()}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow active:scale-95 disabled:opacity-40"
                    title="Putar video langsung di layar TV sekarang"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>{isResolvingDirect ? 'Memproses...' : 'Putar di TV'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddDirectLink(undefined, false)}
                    disabled={isResolvingDirect || !directUrl.trim()}
                    className="flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow active:scale-95 disabled:opacity-40"
                    title="Tambahkan ke antrean berikutnya"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{isResolvingDirect ? 'Memproses...' : '+ Antrekan'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Search Results List */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-sky-300">
                <span className="font-bold">Daftar Lagu ({searchResults.length}):</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  Sentuh tombol untuk memutar ke TV
                </span>
              </div>

              {searchResults.map((song) => (
                <div
                  key={song.id}
                  onClick={() => handlePlayNow(song)}
                  className="flex items-center justify-between rounded-2xl border border-sky-900/80 bg-[#050e22] p-2.5 hover:border-emerald-400 hover:bg-[#071638] cursor-pointer transition gap-2 shadow active:scale-[0.99] group"
                >
                  <img
                    src={song.thumbnailUrl}
                    alt={song.title}
                    className="h-12 w-16 rounded-xl object-cover border border-sky-900 shrink-0 group-hover:border-emerald-500"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white leading-tight group-hover:text-emerald-300">
                      {song.title}
                    </p>
                    <p className="truncate text-[10px] text-sky-300/70 mt-0.5">
                      {song.channelTitle} {song.duration ? `• ${song.duration}` : ''}
                    </p>
                  </div>

                  {/* 2 Clear, High-Contrast Action Buttons */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {/* Green Button: Play Now on TV */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayNow(song);
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 text-[11px] font-black text-white active:scale-95 shadow transition"
                      title="Putar sekarang di layar TV"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Putar di TV</span>
                    </button>

                    {/* Blue Button: Add to Queue */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSongToQueue(song, false);
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-500 px-2.5 py-1.5 text-[10px] font-bold text-white active:scale-95 shadow transition"
                      title="Tambahkan ke antrean berikutnya"
                    >
                      <Plus className="h-3 w-3" />
                      <span>+ Antrean</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB: MIKROFON WIRELESS HP (WebRTC P2P Audio Streaming)        */}
        {/* ============================================================== */}
        {activeTab === 'mic' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header Card */}
            <div className="rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-[#041c14] via-[#05281d] to-[#041624] p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg border shrink-0 transition-all ${
                    isMicStreaming
                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white border-emerald-300 shadow-emerald-500/40 animate-pulse'
                      : 'bg-[#082218] text-emerald-400 border-emerald-600/40'
                  }`}
                >
                  <Mic className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-base font-black text-white tracking-wide flex items-center gap-2">
                    <span>Mikrofon Wireless HP</span>
                    {isMicStreaming && (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white uppercase animate-pulse">
                        LIVE ON AIR
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-emerald-300/80 mt-0.5">
                    Streaming audio suara vokal langsung ke speaker TV via WebRTC P2P
                  </p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="mt-3 pt-3 border-t border-emerald-700/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Koneksi TV (P2P &amp; Sync):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          effectiveConnectionStatus === 'connected'
                            ? 'bg-emerald-400'
                            : effectiveConnectionStatus === 'reconnecting'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span
                        className={
                          effectiveConnectionStatus === 'connected'
                            ? 'text-emerald-300'
                            : effectiveConnectionStatus === 'reconnecting'
                            ? 'text-amber-300'
                            : 'text-rose-300'
                        }
                      >
                        {effectiveConnectionStatus === 'connected'
                          ? `Terhubung ke TV (${roomId})`
                          : effectiveConnectionStatus === 'reconnecting'
                          ? 'Menyambung Ulang...'
                          : 'Koneksi Terputus'}
                      </span>
                    </span>
                    {effectiveConnectionStatus !== 'connected' && (
                      <button
                        onClick={() => {
                          handleRequestReconnect();
                          connectToTvPeer();
                        }}
                        className="px-2 py-0.5 rounded bg-sky-600/80 hover:bg-sky-500 text-white text-[10px] font-bold transition active:scale-95 flex items-center gap-1"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Sambung Ulang
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Jalur Audio HP:</span>
                  <span className="font-mono font-bold flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        peerMicStreaming || isMicStreaming
                          ? 'bg-emerald-400 animate-ping'
                          : peerMicStatus === 'connecting'
                          ? 'bg-amber-400 animate-pulse'
                          : peerMicStatus === 'error'
                          ? 'bg-rose-400'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span
                      className={
                        peerMicStreaming || isMicStreaming
                          ? 'text-emerald-300'
                          : peerMicStatus === 'connecting'
                          ? 'text-amber-300'
                          : peerMicStatus === 'error'
                          ? 'text-rose-300'
                          : 'text-slate-400'
                      }
                    >
                      {peerMicStreaming || isMicStreaming
                        ? 'Host Lokal Langsung (0ms STUN)'
                        : peerMicStatus === 'connecting'
                        ? 'Menghubungkan WebRTC...'
                        : peerMicStatus === 'error'
                        ? 'Perlu Izin / Tindakan'
                        : 'Siap Digunakan'}
                    </span>
                  </span>
                </div>

                {/* Local IP Network Indicator */}
                <div className="flex items-center justify-between pt-1 border-t border-emerald-900/40 text-[10px]">
                  <span className="text-slate-400">Jaringan Hotspot/LAN:</span>
                  <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>
                      {detectedLocalIps.length > 0
                        ? `${detectedLocalIps[0]} (Host Direct)`
                        : typeof window !== 'undefined' && window.location.hostname
                        ? `${window.location.hostname} (P2P Local)`
                        : 'Hotspot Lokal (Direct Candidate)'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Error banner if any */}
            {(peerMicError || micError) && (
              <div className="rounded-xl border border-rose-500/60 bg-rose-950/85 p-3.5 text-xs text-rose-200 shadow-lg flex items-start gap-3">
                <MicOff className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-rose-300 text-sm">
                    {(peerMicError || micError || '').includes('belum siap')
                      ? 'Koneksi ke TV Belum Siap'
                      : (peerMicError || micError || '').includes('Izin') || (peerMicError || micError || '').includes('ditolak')
                      ? 'Izin Mikrofon Ditolak'
                      : (peerMicError || micError || '').includes('HTTPS')
                      ? 'Koneksi Wajib HTTPS'
                      : 'Akses Mikrofon Bermasalah'}
                  </p>
                  <p className="text-[11px] leading-relaxed text-rose-100">{peerMicError || micError}</p>
                  {peerConnectionState !== 'connected' && (
                    <button
                      onClick={connectToTvPeer}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow transition active:scale-95"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sambungkan Ulang ke TV Sekarang
                    </button>
                  )}
                  {((peerMicError || micError || '').includes('Izin') || (peerMicError || micError || '').includes('ditolak')) && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      💡 Tips: Buka setelan browser HP (ikon gembok di samping alamat URL) &gt; Setelan Situs &gt; Izinkan Mikrofon, lalu coba lagi.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Main Interactive Mic Broadcast Console */}
            <div className="rounded-2xl border border-sky-800/70 bg-[#061430] p-5 shadow-2xl text-center space-y-4">
              {!isMicLive ? (
                <div className="space-y-4">
                  <button
                    onClick={handleStartUnifiedMic}
                    disabled={peerMicStatus === 'connecting' || micConnectionStatus === 'connecting'}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-display text-sm font-black tracking-wide shadow-xl shadow-emerald-950/70 border-2 border-emerald-400 active:scale-98 transition flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                  >
                    <Mic className="h-6 w-6 animate-bounce" />
                    <span>
                      {peerMicStatus === 'connecting' || micConnectionStatus === 'connecting'
                        ? 'MENGHUBUNGKAN KE TV...'
                        : '🎤 NYALAKAN MIKROFON WIRELESS HP'}
                    </span>
                  </button>

                  <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Sentuh tombol di atas untuk bernyanyi! Suara mikrofon HP Anda akan dipancarkan secara instan ke TV melalui jalur audio WebRTC Ultra-Low Latency (10ms Opus frame).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Big Live VU Meter Display */}
                  <div className="bg-[#030d1d] p-4 rounded-2xl border border-emerald-500/50 shadow-inner space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                        <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                        INDIKATOR LEVEL MIKROFON (VU METER)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          isCurrentMicMuted
                            ? 'bg-rose-900/80 text-rose-300 border border-rose-500/60'
                            : displayAudioLevel > 70
                            ? 'bg-amber-900/80 text-amber-300 border border-amber-500/60'
                            : displayAudioLevel > 15
                            ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500/60'
                            : 'bg-slate-900 text-slate-400 border border-slate-700'
                        }`}>
                          {isCurrentMicMuted
                            ? 'MUTED'
                            : displayAudioLevel > 70
                            ? 'PUNCAK'
                            : displayAudioLevel > 15
                            ? 'BERNYANYI'
                            : 'SENYAP'}
                        </span>
                        <span className="font-mono text-xs font-black text-white bg-black/60 px-2 py-0.5 rounded border border-emerald-600/50">
                          {displayAudioLevel}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar VU Meter with 20 segmented LEDs */}
                    <div className="h-4 w-full bg-slate-900 rounded-lg overflow-hidden p-0.5 border border-slate-700 flex gap-0.5">
                      {Array.from({ length: 20 }).map((_, idx) => {
                        const threshold = (idx + 1) * 5;
                        const isLit = !isCurrentMicMuted && displayAudioLevel >= threshold;
                        const isRed = idx >= 16;
                        const isYellow = idx >= 12 && idx < 16;

                        return (
                          <div
                            key={idx}
                            className={`flex-1 rounded-sm transition-all duration-75 ${
                              isLit
                                ? isRed
                                ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                                : isYellow
                                ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                : 'bg-slate-800/80'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Fluid Continuous VU Level Meter Bar */}
                    <div className="h-2 w-full bg-black/70 rounded-full overflow-hidden p-0.5 border border-emerald-900/60 flex items-center">
                      <div
                        className={`h-full rounded-full transition-all duration-75 ${
                          isCurrentMicMuted
                            ? 'w-0'
                            : displayAudioLevel > 75
                            ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 shadow-sm shadow-rose-500/30'
                            : displayAudioLevel > 40
                            ? 'bg-gradient-to-r from-emerald-500 to-amber-400 shadow-sm shadow-amber-500/30'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: isCurrentMicMuted ? '0%' : `${Math.min(100, Math.max(displayAudioLevel > 0 ? 5 : 0, displayAudioLevel))}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] font-mono text-slate-400 px-0.5">
                      <span>SENYAP (0-15%)</span>
                      <span>NORMAL (20-50%)</span>
                      <span className="text-amber-400 font-bold">OPTIMAL (55-80%)</span>
                      <span className="text-rose-400 font-bold">PUNCAK (&gt;80%)</span>
                    </div>
                  </div>

                  {/* Dual Action Controls: Mute & Stop */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleToggleUnifiedMute}
                      className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition active:scale-95 shadow cursor-pointer ${
                        isCurrentMicMuted
                          ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                      }`}
                    >
                      {isCurrentMicMuted ? (
                        <>
                          <MicOff className="h-4 w-4 text-amber-300" />
                          <span>Buka Suara Mic</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="h-4 w-4 text-rose-400" />
                          <span>Bisukan (Mute)</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleStopUnifiedMic}
                      className="py-3 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 border border-rose-400 active:scale-95 shadow cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                      <span>Matikan Mic</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dedicated Volume (+ and -) and Echo (+ and -) Controls */}
              <div className="space-y-3">
                {/* 1. Volume Musik TV / Panggung Control */}
                <div className="rounded-2xl bg-[#02132e] p-3.5 border-2 border-sky-500/70 text-left shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-sky-900/60 border border-sky-400/50 flex items-center justify-center text-sky-300">
                        {isMusicMuted ? (
                          <VolumeX className="h-4 w-4 text-rose-400" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-sky-400" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white tracking-wide block flex items-center gap-1.5">
                          <span>Volume Musik TV / Panggung</span>
                          <span className="text-[9px] bg-sky-500/30 text-sky-200 px-1.5 py-0.2 rounded border border-sky-400/40">TV Master</span>
                        </span>
                        <span className="text-[10px] text-sky-300/80 block">
                          Atur langsung kekerasan musik karaoke di layar TV dari HP
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleToggleMusicMute}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${
                          isMusicMuted
                            ? 'bg-rose-900/90 text-rose-200 border-rose-400 animate-pulse'
                            : 'bg-sky-950 text-sky-300 hover:text-white border-sky-600/50'
                        }`}
                        title={isMusicMuted ? 'Buka Suara Musik' : 'Bisukan Musik'}
                      >
                        {isMusicMuted ? '🔇 Bisu' : '🔊 Aktif'}
                      </button>
                      <span className={`font-mono text-xs font-black px-2 py-0.5 rounded-lg border ${
                        isMusicMuted
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 line-through'
                          : 'bg-sky-950/80 text-sky-300 border-sky-500/40'
                      }`}>
                        {isMusicMuted ? '0%' : `${musicVolume}%`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDecreaseMusicVolume}
                      className="h-10 w-12 rounded-xl bg-sky-950/90 hover:bg-sky-800 text-sky-200 font-black text-xl flex items-center justify-center border border-sky-500/50 shadow active:scale-95 transition"
                      title="Kurangi Volume Musik (-5%)"
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={isMusicMuted ? 0 : musicVolume}
                      onChange={(e) => handleSetMusicVolume(Number(e.target.value), false)}
                      className="flex-1 accent-sky-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <button
                      onClick={handleIncreaseMusicVolume}
                      className="h-10 w-12 rounded-xl bg-sky-950/90 hover:bg-sky-800 text-sky-200 font-black text-xl flex items-center justify-center border border-sky-500/50 shadow active:scale-95 transition"
                      title="Tambah Volume Musik (+5%)"
                    >
                      +
                    </button>
                  </div>

                  {/* Volume Presets */}
                  <div className="flex items-center justify-between gap-1 pt-1 text-[10px]">
                    {[
                      { val: 0, label: '0% Bisu', mute: true },
                      { val: 35, label: '35% Lirih', mute: false },
                      { val: 65, label: '65% Sedang', mute: false },
                      { val: 85, label: '85% Lantang', mute: false },
                      { val: 100, label: '100% Maks ★', mute: false },
                    ].map((p) => {
                      const isActive = !isMusicMuted && musicVolume === p.val && !p.mute;
                      const isMuteActive = isMusicMuted && p.mute;
                      return (
                        <button
                          key={p.label}
                          onClick={() => handleSetMusicVolume(p.val, p.mute)}
                          className={`flex-1 py-1 rounded-lg font-mono font-bold border transition ${
                            isActive || isMuteActive
                              ? 'bg-sky-600 text-white border-sky-300 shadow'
                              : 'bg-black/40 text-slate-400 hover:text-white border-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Volume Mic HP (+ and -) Control */}
                <div className="rounded-2xl bg-[#030f24] p-3.5 border border-emerald-500/50 text-left shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-white tracking-wide block">
                          Sensitivitas & Volume Mic HP
                        </span>
                        <span className="text-[10px] text-emerald-400/80 block">
                          Direkomendasikan 70-75% untuk redam echo/storing
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/40">
                      {micVolume}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={decreaseVolume}
                      className="h-10 w-12 rounded-xl bg-emerald-950/90 hover:bg-emerald-800 text-emerald-200 font-black text-xl flex items-center justify-center border border-emerald-500/50 shadow active:scale-95 transition"
                      title="Kurangi Volume (-)"
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="150"
                      step="5"
                      value={micVolume}
                      onChange={(e) => setVolumeDirect(Number(e.target.value))}
                      className="flex-1 accent-emerald-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <button
                      onClick={increaseVolume}
                      className="h-10 w-12 rounded-xl bg-emerald-950/90 hover:bg-emerald-800 text-emerald-200 font-black text-xl flex items-center justify-center border border-emerald-500/50 shadow active:scale-95 transition"
                      title="Tambah Volume (+)"
                    >
                      +
                    </button>
                  </div>

                  {/* Volume Presets with 75% highlighted as ideal anti-storing */}
                  <div className="flex items-center justify-between gap-1 pt-1 text-[10px]">
                    {[40, 60, 75, 90, 110].map((v) => (
                      <button
                        key={v}
                        onClick={() => setVolumeDirect(v)}
                        className={`flex-1 py-1 rounded-lg font-mono font-bold border transition ${
                          micVolume === v
                            ? 'bg-emerald-600 text-white border-emerald-300 shadow'
                            : 'bg-black/40 text-slate-400 hover:text-white border-slate-700'
                        }`}
                      >
                        {v}%{v === 75 ? ' ★' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Echo (+ and -) Karaoke Reverb Control */}
                <div className="rounded-2xl bg-[#030f24] p-3.5 border border-teal-500/50 text-left shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-400" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        Efek Echo / Gema Karaoke
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black text-amber-300 bg-teal-950/80 px-2 py-0.5 rounded-lg border border-teal-500/40">
                      {micEcho}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={decreaseEcho}
                      className="h-10 w-12 rounded-xl bg-teal-950/90 hover:bg-teal-800 text-teal-200 font-black text-xl flex items-center justify-center border border-teal-500/50 shadow active:scale-95 transition"
                      title="Kurangi Efek Echo (-)"
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={micEcho}
                      onChange={(e) => setEchoDirect(Number(e.target.value))}
                      className="flex-1 accent-teal-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <button
                      onClick={increaseEcho}
                      className="h-10 w-12 rounded-xl bg-teal-950/90 hover:bg-teal-800 text-teal-200 font-black text-xl flex items-center justify-center border border-teal-500/50 shadow active:scale-95 transition"
                      title="Tambah Efek Echo (+)"
                    >
                      +
                    </button>
                  </div>

                  {/* Echo Presets */}
                  <div className="flex items-center justify-between gap-1 pt-1 text-[10px]">
                    {[
                      { val: 0, label: '0% (Nol Delay)' },
                      { val: 15, label: '15% Lembut' },
                      { val: 30, label: '30% Standar' },
                      { val: 50, label: '50% Panggung' },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => setEchoDirect(p.val)}
                        className={`flex-1 py-1 rounded-lg font-mono font-bold border transition ${
                          micEcho === p.val
                            ? 'bg-teal-600 text-white border-teal-300 shadow'
                            : 'bg-black/40 text-slate-400 hover:text-white border-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-teal-300/80 italic pt-0.5">
                    {micEcho === 0
                      ? '🎙️ Mode Vokal Studio Profesional (0% Gema): Suara vokal jernih maksimal, bebas pantulan gema, dan 100% anti-storing.'
                      : `✨ Efek Reverb Karaoke Studio (${micEcho}%): Suara terdengar hangat dengan peredam loop feedback otomatis.`}
                  </p>
                </div>
              </div>

              {/* Zero-Delay & Anti-Gema Optimizer Controls */}
              <div className="rounded-xl bg-[#030e24] p-3 border border-sky-800/80 text-left space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Peredam Feedback Suara TV:</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Mencegah musik TV terpantul ulang ke mikrofon HP
                    </p>
                  </div>

                  <button
                    onClick={toggleEchoCancellation}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition border shadow shrink-0 active:scale-95 ${
                      isEchoCancellationEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 shadow-emerald-950/60'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    {isEchoCancellationEnabled ? '✓ AKTIF' : 'NONAKTIF'}
                  </button>
                </div>

                <div className="pt-2 border-t border-sky-900/60 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>Sinkronisasi Nol Delay Vokal-Musik:</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Bypass buffer window hardware agar suara pas dengan ketukan musik
                    </p>
                  </div>

                  <button
                    onClick={toggleZeroDelayBypass}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition border shadow shrink-0 active:scale-95 ${
                      isZeroDelayBypass
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-300 shadow-amber-950/60'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    {isZeroDelayBypass ? '⚡ AKTIF (0 Delay)' : 'STANDAR'}
                  </button>
                </div>
              </div>

              {/* Vocal Sync Delay / Music Delay Adjustment (TV DelayNode Buffer) */}
              <div className="rounded-2xl bg-[#030f24] p-3.5 border-2 border-amber-500/60 text-left shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white tracking-wide block">
                        Sinkronisasi Musik TV (Vocal Sync Buffer)
                      </span>
                      <span className="text-[10px] text-amber-200/80">
                        Atur Web Audio DelayNode di TV agar musik &amp; vokal 100% pas
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-amber-300 bg-amber-950/90 px-2 py-0.5 rounded-lg border border-amber-500/50">
                    +{tvMusicDelay} ms
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => handleSetTvMusicDelay(Math.max(0, tvMusicDelay - 5))}
                    className="h-10 w-12 rounded-xl bg-amber-950/90 hover:bg-amber-800 text-amber-200 font-black text-xl flex items-center justify-center border border-amber-500/50 shadow active:scale-95 transition"
                    title="Kurangi Delay Musik (-5ms)"
                  >
                    -
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="250"
                    step="5"
                    value={tvMusicDelay}
                    onChange={(e) => handleSetTvMusicDelay(Number(e.target.value))}
                    className="flex-1 accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />

                  <button
                    onClick={() => handleSetTvMusicDelay(Math.min(250, tvMusicDelay + 5))}
                    className="h-10 w-12 rounded-xl bg-amber-950/90 hover:bg-amber-800 text-amber-200 font-black text-xl flex items-center justify-center border border-amber-500/50 shadow active:scale-95 transition"
                    title="Tambah Delay Musik (+5ms)"
                  >
                    +
                  </button>
                </div>

                {/* Quick Presets for Vocal Sync Delay */}
                <div className="grid grid-cols-4 gap-1 pt-1 text-[10px]">
                  {[
                    { ms: 0, label: '0ms (Direct)' },
                    { ms: 60, label: '60ms (Cepat)' },
                    { ms: 75, label: '75ms (Ideal)' },
                    { ms: 100, label: '100ms (Stabil)' },
                  ].map((p) => (
                    <button
                      key={p.ms}
                      onClick={() => handleSetTvMusicDelay(p.ms)}
                      className={`py-1.5 px-1 rounded-lg font-mono font-bold border text-center transition ${
                        tvMusicDelay === p.ms
                          ? 'bg-amber-500 text-black border-amber-300 shadow font-black'
                          : 'bg-black/50 text-slate-300 hover:text-white border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-slate-300 leading-relaxed pt-1 border-t border-amber-500/20">
                  💡 <strong>Fungsi Sinkronisasi:</strong> Menunda audio musik di TV sedikit (60ms - 80ms) sehingga vokal dari mikrofon HP Anda yang masuk melalui WiFi terdengar persis bersamaan dengan ketukan musik di TV (tidak terasa terlambat).
                </p>
              </div>

              {/* Technical Profile Note */}
              <div className="text-left rounded-xl bg-[#040d20] p-3 border border-sky-900/60 text-[11px] space-y-1.5 text-slate-300">
                <p className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-sky-400" />
                  Fitur Vokal & Audio Subdis Rudal Diskomlekau:
                </p>
                <ul className="space-y-1 text-[10px] text-slate-300/90 pl-4 list-disc">
                  <li>
                    <strong className="text-sky-300">Volume Musik TV</strong> — Kontrol kekerasan musik latar panggung TV langsung dari smartphone prajurit.
                  </li>
                  <li>
                    <strong className="text-emerald-300">Volume Mic HP (+ dan -)</strong> — Atur kekerasan vokal HP langsung dari smartphone (hingga 150%).
                  </li>
                  <li>
                    <strong className="text-teal-300">Echo (+ dan -)</strong> — Atur efek gema panggung karaoke agar vokal terdengar merdu dan megah.
                  </li>
                  <li>
                    <strong className="text-amber-300">Nol Delay ke Musik</strong> — Transmisi 10ms Opus frame tanpa buffer lookahead sehingga vokal pas di tempo lagu.
                  </li>
                  <li>
                    <strong className="text-sky-300">Peredam Feedback</strong> — Highpass 85Hz & Dynamics Compressor memutus dengungan balik dari speaker TV.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ANTREAN TV (Jelas, Mudah Diatur Urutannya)             */}
        {/* ============================================================== */}
        {activeTab === 'queue' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-sky-300">
              <span className="font-bold flex items-center gap-1.5">
                <ListMusic className="h-4 w-4 text-sky-400" />
                Antrean di Layar TV ({queue.length} Lagu):
              </span>
              <button
                onClick={fetchRoomState}
                className="text-sky-400 hover:text-white flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Quick Skip to Next Button */}
            {queue.length > 0 && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[#081533] border border-sky-700 text-xs shadow-md">
                <div className="min-w-0">
                  <span className="font-bold text-[10px] uppercase text-sky-400 block">Lagu Berikutnya:</span>
                  <span className="text-amber-300 font-extrabold truncate block max-w-[180px]">
                    {queue[0].song.title}
                  </span>
                </div>
                <button
                  onClick={handleSkipNext}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-3.5 py-2 text-xs font-black text-white shadow-md active:scale-95 transition shrink-0"
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                  <span>Putar Lagu Ini</span>
                </button>
              </div>
            )}

            {queue.length === 0 ? (
              <div className="rounded-2xl border border-sky-900 bg-[#050e22] p-8 text-center space-y-3">
                <Rocket className="h-10 w-10 mx-auto text-amber-400 rotate-45" />
                <p className="text-sm font-bold text-white">Antrean TV Masih Kosong</p>
                <p className="text-xs text-sky-300/80 leading-relaxed max-w-xs mx-auto">
                  Belum ada lagu dalam antrean. Buka tab <strong>"Cari Lagu"</strong> lalu klik <strong>"+ Antrean"</strong> untuk mendaftarkan giliran bernyanyi Anda!
                </p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-sky-500"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Cari Lagu Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-sky-300/80">
                  💡 Gunakan tombol <strong>⬆️ Naik</strong> atau <strong>⬇️ Turun</strong> untuk memindahkan giliran lagu di TV, atau <strong>▶️ Putar</strong> untuk langsung memulai lagu tersebut.
                </p>

                {queue.map((item, index) => {
                  const isMySong = item.singerName.toLowerCase() === singerName.toLowerCase();

                  return (
                    <div
                      key={item.queueId}
                      className={`flex items-center justify-between rounded-2xl border p-2.5 transition gap-2 shadow ${
                        isMySong
                          ? 'border-sky-400 bg-sky-950/50'
                          : 'border-sky-900/70 bg-[#050e22]'
                      }`}
                    >
                      {/* Big Queue Number */}
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#07132c] text-sm font-mono font-black text-sky-300 border border-sky-800 shrink-0">
                        #{index + 1}
                      </div>

                      <img
                        src={item.song.thumbnailUrl}
                        alt={item.song.title}
                        className="h-11 w-14 rounded-lg object-cover border border-sky-900 shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white leading-tight">
                          {item.song.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                              isMySong
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-sky-900/40 text-sky-300 border-sky-700/50'
                            }`}
                          >
                            👤 {item.singerName} {isMySong ? '(Anda)' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Controls: Putar Sekarang, Naik/Turun, Hapus */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Play Now Button */}
                        <button
                          onClick={() => {
                            handlePlayNow(item.song);
                            handleRemoveQueueItem(item.queueId);
                          }}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600/30 border border-emerald-500/60 hover:bg-emerald-600 px-2 py-1.5 text-[10px] font-black text-emerald-300 hover:text-white transition active:scale-95"
                          title="Putar sekarang di layar TV"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Putar</span>
                        </button>

                        {/* Move Up/Down */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveQueueItem(index, index - 1)}
                            disabled={index === 0}
                            className="p-1 rounded-md bg-[#07132c] border border-sky-800 text-sky-300 hover:bg-sky-700 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition"
                            title="Geser Naik (Maju Giliran)"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveQueueItem(index, index + 1)}
                            disabled={index === queue.length - 1}
                            className="p-1 rounded-md bg-[#07132c] border border-sky-800 text-sky-300 hover:bg-sky-700 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition"
                            title="Geser Turun (Mundur Giliran)"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemoveQueueItem(item.queueId)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                          title="Hapus lagu ini dari antrean"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: KIRIM SORAK & EFEK SUARA TV (Sangat Jelas & Menyenangkan)*/}
        {/* ============================================================== */}
        {activeTab === 'reactions' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Kirim Sorak & Efek Suara ke Layar TV</span>
              </h3>
              <p className="text-[11px] text-sky-300/80">
                Tekan tombol di bawah untuk membunyikan suara di speaker TV dan memunculkan animasi reaksi seru di layar!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* SMART MC DISKOMLEKAU - PANTUN JENAKA & SUARA BAHASA INDONESIA */}
              <button
                onClick={() => handleTriggerSmartMc()}
                disabled={isMcSpeakingOnTv}
                className="col-span-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-900 to-sky-950 border-2 border-emerald-400 p-3.5 text-left text-white shadow-xl shadow-emerald-950/70 active:scale-95 transition cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl animate-pulse">🎙️</span>
                  <div>
                    <h4 className="font-display text-base font-black text-emerald-300 leading-tight">
                      PANTUN MC DISKOMLEKAU
                    </h4>
                    <p className="text-[11px] text-sky-200 mt-0.5">
                      {isMcSpeakingOnTv
                        ? 'Pantun MC pertama sedang dibacakan di TV, harap tunggu...'
                        : 'Tampilkan banner & bacakan pantun jenaka TNI AU di TV! 🔊'}
                    </p>
                  </div>
                </div>
                <span className="rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-black uppercase text-slate-950 shadow shrink-0">
                  {isMcSpeakingOnTv ? 'Berbicara...' : 'Pantun MC'}
                </span>
              </button>

              {lastMcPreview && (
                <div className="col-span-2 rounded-2xl border border-amber-400/70 bg-[#051026] p-3 text-xs space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-300">
                    <span>🎙️ PANTUN MC TERAKHIR DI TV:</span>
                    <span>{lastMcPreview.badge}</span>
                  </div>
                  <div className="text-slate-200 italic space-y-0.5">
                    <p>&ldquo;{lastMcPreview.pantunLines[0]}&rdquo;</p>
                    <p>&ldquo;{lastMcPreview.pantunLines[1]}&rdquo;</p>
                    <p className="text-amber-300 font-black not-italic">&ldquo;{lastMcPreview.pantunLines[2]}&rdquo;</p>
                    <p className="text-amber-300 font-black not-italic">&ldquo;{lastMcPreview.pantunLines[3]}&rdquo;</p>
                  </div>
                  {Boolean(lastMcPreview.commentary && lastMcPreview.commentary.trim()) && (
                    <p className="text-[11px] text-sky-200 pt-1 border-t border-sky-900/60">
                      {lastMcPreview.commentary}
                    </p>
                  )}
                </div>
              )}

              {/* SAWER DULU BOSKUU! */}
              <button
                onClick={() => handleSendReaction('sawer', '💸', 'Sawer Dulu Bosku!')}
                className="col-span-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-900 border-2 border-amber-400/90 p-3.5 text-left text-white shadow-xl shadow-amber-950/70 active:scale-95 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl animate-bounce">💸</span>
                  <div>
                    <h4 className="font-display text-base font-black text-amber-300 leading-tight">
                      SAWER DULU BOSKUU!
                    </h4>
                    <p className="text-[11px] text-amber-200 mt-0.5">
                      Hujan uang saweran & Ka-Ching di TV! 💰
                    </p>
                  </div>
                </div>
                <span className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black uppercase text-black shadow">
                  Sawer
                </span>
              </button>

              {/* BERI HORMAT PRAJURIT */}
              <button
                onClick={() => handleSendReaction('hormat', '🫡', 'Beri Hormat Prajurit!')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#081b3d] border-2 border-sky-400/80 p-3 text-left hover:border-sky-300 active:scale-95 transition shadow-lg"
              >
                <span className="text-3xl animate-pulse">🫡</span>
                <div>
                  <h4 className="text-xs font-black text-sky-200">Beri Hormat</h4>
                  <p className="text-[10px] text-sky-300/80">Salute TNI AU</p>
                </div>
              </button>

              {/* KASIH TELUR BUSUK */}
              <button
                onClick={() => handleSendReaction('telor', '🥚', 'Kasih Telor Busuk!')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#2e1308] border-2 border-orange-500/80 p-3 text-left hover:border-orange-400 active:scale-95 transition shadow-lg"
              >
                <span className="text-3xl">🥚</span>
                <div>
                  <h4 className="text-xs font-black text-orange-200">Kasih Telor</h4>
                  <p className="text-[10px] text-orange-300/80">Splat telur busuk</p>
                </div>
              </button>

              {/* TOMBOL SPESIAL HUUU PALING BESAR */}
              <button
                onClick={() => handleSendReaction('boo', '👎', 'Sorak HUUU (Suara Hancur!)')}
                className="col-span-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 border-2 border-rose-500/80 p-3.5 text-left text-white shadow-xl shadow-rose-950/60 active:scale-95 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl animate-bounce">👎</span>
                  <div>
                    <h4 className="font-display text-base font-black text-amber-300 leading-tight">
                      HUUU! (Suara Fals / Hancur)
                    </h4>
                    <p className="text-[11px] text-rose-200 mt-0.5">
                      "Prajurit Yang Pantang Mundur Walau Suara Hancur!" 😂
                    </p>
                  </div>
                </div>
                <span className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-black uppercase text-white shadow">
                  Kirim
                </span>
              </button>

              {/* TEPUK TANGAN PASUKAN */}
              <button
                onClick={() => handleSendReaction('applause', '👏', 'Tepuk Tangan Pasukan')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">👏</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Tepuk Tangan</h4>
                  <p className="text-[10px] text-sky-300/70">Apresiasi pasukan</p>
                </div>
              </button>

              {/* SORAK KOMANDO */}
              <button
                onClick={() => handleSendReaction('cheer', '🎉', 'Sorak Komando')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">🎉</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Sorak Komando</h4>
                  <p className="text-[10px] text-sky-300/70">Hore mantap!</p>
                </div>
              </button>

              {/* SIRINE TEMPUR */}
              <button
                onClick={() => handleSendReaction('airhorn', '📢', 'Sirine Tempur')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">📢</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Sirine Tempur</h4>
                  <p className="text-[10px] text-sky-300/70">DJ Airhorn pangkalan</p>
                </div>
              </button>

              {/* KETAWA NGAKAK */}
              <button
                onClick={() => handleSendReaction('laugh', '😂', 'Tawa Pasukan')}
                className="flex items-center gap-2.5 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">😂</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Ketawa Pasukan</h4>
                  <p className="text-[10px] text-sky-300/70">Tawa gembira</p>
                </div>
              </button>

              {/* LEMPAR KURSI */}
              <button
                onClick={() => handleSendReaction('ding', '🪑', 'Lempar Kursi')}
                className="col-span-2 flex items-center gap-3 rounded-2xl bg-[#091838] border border-sky-800 p-3 text-left hover:border-sky-500 active:scale-95 transition shadow"
              >
                <span className="text-3xl">🪑</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Lempar Kursi</h4>
                  <p className="text-[10px] text-sky-300/70">Aksi seru & kocak lempar kursi panggung</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* TAB 5: LIST PILIHAN LAGU (Koleksi Rekomendasi & Hits Populer) */}
        {/* ============================================================== */}
        {activeTab === 'curated' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* Header info */}
            <div className="rounded-2xl border border-sky-800/80 bg-gradient-to-r from-[#061539] via-[#081a42] to-[#05112c] p-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white tracking-wide uppercase">
                      List Pilihan Karaoke Populer
                    </h3>
                    <p className="text-[10px] text-sky-300/80">
                      Lagu siap langsung diputar di TV atau dimasukkan antrean
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshHits}
                    disabled={isRefreshingHits}
                    className="flex items-center gap-1 rounded-full bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/50 px-2.5 py-1 text-[10px] font-bold text-rose-200 transition active:scale-95 disabled:opacity-50"
                    title="Update daftar Hits YouTube Indonesia terbaru"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshingHits ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingHits ? 'Update...' : 'Update Tren'}</span>
                  </button>
                </div>
              </div>

              {/* In-Curated Quick Filter / Search */}
              <div className="relative mt-2.5">
                <input
                  type="text"
                  value={curatedSearchQuery}
                  onChange={(e) => setCuratedSearchQuery(e.target.value)}
                  placeholder="Saring lagu atau penyanyi di list pilihan..."
                  className="w-full rounded-xl border border-sky-700/60 bg-[#040d21] pl-8 pr-8 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-sky-400 shadow-inner"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sky-400" />
                {curatedSearchQuery && (
                  <button
                    onClick={() => setCuratedSearchQuery('')}
                    className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {CATEGORY_PRESETS.map((preset) => {
                const isActive = curatedCategoryFilter === preset.id;
                const isHitsIndo = preset.id === 'hits-indonesia';
                const count = (isHitsIndo ? hitsIndoSongs : (CURATED_LIBRARY[preset.id] || [])).length;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setCuratedCategoryFilter(preset.id);
                      setCuratedSearchQuery('');
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 whitespace-nowrap text-[11px] font-bold border transition active:scale-95 ${
                      isActive
                        ? isHitsIndo
                          ? 'border-rose-400 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white shadow-lg shadow-rose-950/50'
                          : 'border-sky-400 bg-sky-600 text-white shadow-md'
                        : isHitsIndo
                        ? 'border-rose-800/80 bg-[#160b1e] text-rose-300 hover:border-rose-400 hover:text-white'
                        : 'border-sky-900 bg-[#06122d] text-slate-300 hover:border-sky-600 hover:text-white'
                    }`}
                  >
                    {isHitsIndo && <Flame className="h-3 w-3 text-amber-300 animate-pulse" />}
                    <span>{preset.label}</span>
                    <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[9px] font-mono text-sky-200">
                      {count}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => {
                  setCuratedCategoryFilter('all');
                  setCuratedSearchQuery('');
                }}
                className={`rounded-xl px-3 py-1.5 whitespace-nowrap text-[11px] font-bold border transition ${
                  curatedCategoryFilter === 'all'
                    ? 'border-sky-400 bg-sky-600 text-white shadow-md'
                    : 'border-sky-900 bg-[#06122d] text-slate-300 hover:border-sky-600 hover:text-white'
                }`}
              >
                Semua Kategori
              </button>
            </div>

            {/* If Single Category Selected */}
            {curatedCategoryFilter !== 'all' && (() => {
              const categorySongs = curatedCategoryFilter === 'hits-indonesia'
                ? hitsIndoSongs
                : (CURATED_LIBRARY[curatedCategoryFilter] || []);
              const presetInfo = CATEGORY_PRESETS.find((p) => p.id === curatedCategoryFilter);
              const filterLower = curatedSearchQuery.trim().toLowerCase();
              const filteredSongs = filterLower
                ? categorySongs.filter(
                    (s) =>
                      s.title.toLowerCase().includes(filterLower) ||
                      s.channelTitle.toLowerCase().includes(filterLower)
                  )
                : categorySongs;

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-sky-900/60 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      {curatedCategoryFilter === 'hits-indonesia' ? (
                        <Flame className="h-4 w-4 text-rose-400" />
                      ) : (
                        <Music className="h-4 w-4 text-sky-400" />
                      )}
                      <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide">
                        {presetInfo?.label || curatedCategoryFilter}
                      </h4>
                    </div>
                    <span className="text-[10px] text-sky-300 font-mono bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-800">
                      {filteredSongs.length} dari {categorySongs.length} Lagu
                    </span>
                  </div>

                  {presetInfo?.description && (
                    <p className="text-[10px] text-slate-400 italic">
                      {presetInfo.description}
                    </p>
                  )}

                  {filteredSongs.length === 0 ? (
                    <div className="rounded-xl border border-sky-900 bg-[#050e22] p-4 text-center text-xs text-slate-400">
                      Tidak ada lagu yang cocok dengan "{curatedSearchQuery}".
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredSongs.map((song) => (
                        <div
                          key={song.id}
                          onClick={() => handlePlayNow(song)}
                          className="flex items-center justify-between rounded-xl border border-sky-900/70 bg-[#050e22] p-2 hover:border-emerald-400 hover:bg-[#071638] cursor-pointer gap-2 shadow-sm active:scale-[0.99] group transition"
                        >
                          <img
                            src={song.thumbnailUrl}
                            alt={song.title}
                            className="h-10 w-14 rounded-lg object-cover border border-sky-900 shrink-0 group-hover:border-emerald-500"
                            loading="lazy"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-white leading-tight group-hover:text-emerald-300">
                              {song.title}
                            </p>
                            <p className="truncate text-[10px] text-sky-300/70 mt-0.5">
                              {song.channelTitle} {song.duration ? `• ${song.duration}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayNow(song);
                              }}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-[10px] font-black text-white transition active:scale-95 flex items-center gap-1 shadow"
                              title="Putar sekarang di TV"
                            >
                              <Play className="h-2.5 w-2.5 fill-current" />
                              <span>Putar</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSongToQueue(song, false);
                              }}
                              className="rounded-lg bg-sky-600 hover:bg-sky-500 px-2 py-1 text-[10px] font-bold text-white shrink-0 active:scale-95 shadow"
                              title="Tambah ke antrean TV"
                            >
                              + Antrean
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* If All Categories Selected */}
            {curatedCategoryFilter === 'all' && (
              <div className="space-y-4">
                {Object.entries(CURATED_LIBRARY).map(([categoryKey, rawSongs]) => {
                  const songs = categoryKey === 'hits-indonesia' ? hitsIndoSongs : rawSongs;
                  const preset = CATEGORY_PRESETS.find((p) => p.id === categoryKey);
                  const isExpanded = expandedCategories[categoryKey] ?? (categoryKey === 'hits-indonesia');
                  const filterLower = curatedSearchQuery.trim().toLowerCase();
                  const filteredSongs = filterLower
                    ? songs.filter(
                        (s) =>
                          s.title.toLowerCase().includes(filterLower) ||
                          s.channelTitle.toLowerCase().includes(filterLower)
                      )
                    : songs;
                  const displayedSongs = isExpanded ? filteredSongs : filteredSongs.slice(0, 4);

                  if (filterLower && filteredSongs.length === 0) return null;

                  return (
                    <div key={categoryKey} className="space-y-2">
                      <div className="flex items-center justify-between border-b border-sky-900/60 pb-1">
                        <div className="flex items-center gap-1.5">
                          {categoryKey === 'hits-indonesia' && (
                            <Flame className="h-3.5 w-3.5 text-rose-400" />
                          )}
                          <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                            {preset?.label || categoryKey.replace('-', ' ')}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-sky-400 font-mono">
                            {songs.length} Lagu
                          </span>
                          {songs.length > 4 && (
                            <button
                              onClick={() =>
                                setExpandedCategories((prev) => ({
                                  ...prev,
                                  [categoryKey]: !isExpanded,
                                }))
                              }
                              className="text-[10px] text-sky-300 hover:text-white underline font-medium"
                            >
                              {isExpanded ? 'Ciutkan' : `Semua (${songs.length})`}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {displayedSongs.map((song) => (
                          <div
                            key={song.id}
                            onClick={() => handlePlayNow(song)}
                            className="flex items-center justify-between rounded-xl border border-sky-900/60 bg-[#050e22] p-2 hover:border-emerald-400 hover:bg-[#071638] cursor-pointer gap-2 shadow-sm active:scale-[0.99] group transition"
                          >
                            <img
                              src={song.thumbnailUrl}
                              alt={song.title}
                              className="h-10 w-14 rounded-lg object-cover border border-sky-900 shrink-0 group-hover:border-emerald-500"
                              loading="lazy"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-white leading-tight group-hover:text-emerald-300">
                                {song.title}
                              </p>
                              <p className="truncate text-[10px] text-sky-300/70 mt-0.5">
                                {song.channelTitle} {song.duration ? `• ${song.duration}` : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayNow(song);
                                }}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-[10px] font-black text-white transition active:scale-95 flex items-center gap-0.5"
                                title="Putar sekarang di TV"
                              >
                                <Play className="h-2.5 w-2.5 fill-current" />
                                <span>Putar</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSongToQueue(song, false);
                                }}
                                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-2 py-1 text-[10px] font-bold text-white shrink-0 active:scale-95"
                              >
                                + Antrean
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: DEWAN JURI PRAJURIT (KOLABORASI PENILAIAN MULTI-CLIENT) */}
        {/* ============================================================== */}
        {activeTab === 'jury' && (
          <div className="space-y-4 animate-in fade-in duration-200 pb-4">
            {/* Header Dewan Juri */}
            <div className="rounded-2xl border-2 border-amber-500/60 bg-gradient-to-r from-[#091b3e] via-[#0b2452] to-[#081a40] p-3.5 shadow-xl shadow-amber-950/40 hud-corner">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black shadow-md border border-amber-300 shrink-0">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-amber-300 tracking-wider uppercase flex items-center gap-1.5">
                      <span>DEWAN JURI PRAJURIT</span>
                      <span className="text-[9px] bg-amber-400/20 text-amber-200 border border-amber-400/50 px-1.5 py-0.5 rounded font-mono">
                        TNI AU
                      </span>
                    </h3>
                    <p className="text-[10px] text-sky-200/80 leading-tight">
                      Kolaborasi Multi-Client: Seluruh nilai HP prajurit dihitung rata-ratanya di layar master!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Lagu yang Sedang Dinilai */}
            <div className="rounded-2xl border border-sky-800/80 bg-[#061430] p-3 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-sky-300 flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-amber-400" />
                  <span>Lagu Sedang Dinilai di TV:</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                  isPlaying ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isPlaying ? '▶️ Sedang Diputar' : '⏸️ Dijeda'}
                </span>
              </div>

              {currentSong ? (
                <div className="flex items-center gap-3 bg-[#030d22] p-2.5 rounded-xl border border-sky-900/60">
                  <img
                    src={currentSong.thumbnailUrl}
                    alt={currentSong.title}
                    className="h-12 w-16 rounded-lg object-cover border border-sky-700/50 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-white truncate leading-tight">
                      {currentSong.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {currentSong.channelTitle}
                    </p>
                    <p className="text-[10px] text-amber-300 font-mono font-bold mt-0.5">
                      Vokalis: {singerName || 'Prajurit'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400 bg-[#030d22] rounded-xl border border-sky-900/40">
                  <p>Belum ada lagu yang diputar di TV master.</p>
                  <p className="text-[10px] text-sky-400 mt-1">Pilih lagu di tab Cari Lagu untuk memulai penilaian!</p>
                </div>
              )}
            </div>

            {/* Antarmuka Input Skor Interaktif */}
            <div className="rounded-2xl border-2 border-sky-500/50 bg-gradient-to-b from-[#08183a] via-[#05112c] to-[#030b20] p-4 shadow-2xl space-y-4">
              {/* Header Prajurit Juri */}
              <div className="space-y-2 border-b border-sky-900/60 pb-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-sky-400" />
                    <span>Nama Dewan Juri:</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={singerName}
                      onChange={(e) => {
                        setSingerName(e.target.value);
                        localStorage.setItem('karaoke_client_singer_name', e.target.value);
                      }}
                      placeholder="Nama Juri (cth: iwan)"
                      className="w-36 sm:w-44 bg-[#030919] border border-sky-600/70 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 text-right outline-none focus:ring-1 focus:ring-sky-400"
                    />
                  </div>
                </div>

                {/* Pilihan Cepat Anggota Dewan Juri */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-sky-300/80">Pilih Juri:</span>
                  {['iwan', 'rudi', 'rojikan', 'tomas', 'awan'].map((jNamePreset, idx) => (
                    <button
                      key={jNamePreset}
                      type="button"
                      onClick={() => {
                        setSingerName(jNamePreset);
                        localStorage.setItem('karaoke_client_singer_name', jNamePreset);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition ${
                        singerName.trim().toLowerCase() === jNamePreset
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow'
                          : 'bg-[#040d21] text-sky-200 border-sky-800 hover:border-amber-400/50'
                      }`}
                    >
                      {idx + 1}. {jNamePreset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tampilan Angka Skor Super Besar & Badge Penilaian */}
              <div className="flex flex-col items-center justify-center py-2 space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Nilai Pilihan Anda (0 - 100)
                </span>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="font-display text-6xl sm:text-7xl font-black text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.65)] tracking-tight">
                    {juryScoreInput}
                  </span>
                  <span className="text-sm font-mono text-slate-500 font-bold">/ 100</span>
                </div>

                {/* Quote Penilaian Sesuai Rentang Skor (0 s.d 100) */}
                <div className="pt-1 w-full text-center">
                  <span className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-amber-500/20 text-amber-200 border border-amber-400/70 shadow-lg shadow-amber-950/60">
                    &ldquo;{getScoreQuote(juryScoreInput, currentSong?.id ? `${currentSong.id}-${juryScoreInput}` : juryScoreInput)}&rdquo;
                  </span>
                </div>
              </div>

              {/* Slider Penilaian 0 - 100 */}
              <div className="space-y-1.5 px-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                  <span>0 (Mic Trauma)</span>
                  <span>50 (Panggil Damkar)</span>
                  <span>100 (Penyanyi Asli)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={juryScoreInput}
                  onChange={(e) => setJuryScoreInput(parseInt(e.target.value, 10))}
                  className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 border border-sky-700/60 shadow-inner"
                />
              </div>

              {/* Preset Cepat (Quick Preset Buttons 10 - 100) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-sky-300 font-bold block">
                  ⚡ Tombol Angka Cepat:
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setJuryScoreInput(preset)}
                      className={`py-1.5 rounded-xl text-xs font-black transition active:scale-95 border ${
                        juryScoreInput === preset
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/40 scale-105'
                          : 'bg-[#071536] text-slate-200 border-sky-800 hover:border-amber-400/50 hover:bg-sky-900/40'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tombol Utama Kirim Nilai ke Layar Master */}
              <button
                onClick={() => handleSubmitJuryScore()}
                disabled={!currentSong}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-xl ${
                  currentSong
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 border-2 border-amber-300 shadow-amber-950/60 active:scale-98 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <Scale className="h-5 w-5 fill-current" />
                <span>
                  {hasSubmittedJury ? 'SIMPAN / TAMBAH NILAI JURI KE MASTER' : 'KIRIM NILAI JURI KE LAYAR MASTER'}
                </span>
              </button>

              {/* Tombol Panggil Pantun Smart MC Sesuai Nilai Juri */}
              <button
                type="button"
                disabled={isMcSpeakingOnTv}
                onClick={() => handleTriggerSmartMc(juryScoreInput)}
                className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white border-2 border-emerald-300 active:scale-98 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <span>
                  {isMcSpeakingOnTv
                    ? '⏳ TUNGGU PANTUN MC SELESAI DI TV...'
                    : `🎙️ PANGGIL PANTUN MC (NILAI ${juryScoreInput}) KE LAYAR TV`}
                </span>
              </button>

              {/* Feedback Status Pengiriman */}
              {hasSubmittedJury && (
                <div className="rounded-xl border border-emerald-500/60 bg-emerald-950/60 p-3 text-center text-xs text-emerald-200 space-y-1 animate-in fade-in">
                  <div className="font-bold flex items-center justify-center gap-1.5 text-emerald-300">
                    <Check className="h-4 w-4" />
                    <span>Nilai ({lastSubmittedScore}) Telah Masuk ke Akumulasi Master!</span>
                  </div>
                  <p className="text-[10px] text-emerald-300/80">
                    Nilai seluruh juri diakumulasi dan dirata-rata sesuai jumlah juri di layar TV / Master.
                  </p>
                </div>
              )}
            </div>

            {/* Posisi Nilai: Akumulasi Nilai Juri & Rata-Rata Jumlah Juri */}
            {juryVotersList.length > 0 && (() => {
              const sumJury = juryVotersList.reduce((acc, cur) => acc + cur.score, 0);
              const avgJury = Math.round(sumJury / juryVotersList.length);
              const exprJury = juryVotersList.map((v) => v.score).join('+');
              return (
                <div className="rounded-2xl border-2 border-amber-500/60 bg-[#061430] p-4 shadow-xl space-y-2.5 font-mono">
                  <div className="flex items-center justify-between text-xs font-bold text-sky-200 border-b border-sky-800/80 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span>AKUMULASI NILAI JURI ({juryVotersList.length} JURI)</span>
                    </span>
                    <span className="text-amber-300 text-sm font-black bg-amber-950/80 px-2.5 py-0.5 rounded-lg border border-amber-400/50">
                      Nilai: {avgJury}
                    </span>
                  </div>

                  <div className="rounded-xl bg-amber-500/20 border border-amber-400/70 px-3 py-2 text-center">
                    <p className="text-sm sm:text-base font-black text-amber-200 uppercase tracking-wide">
                      &ldquo;{getScoreQuote(avgJury, currentSong?.id ? `${currentSong.id}-avg-${avgJury}` : avgJury)}&rdquo;
                    </p>
                  </div>

                  <div className="bg-[#030b1c] p-3 rounded-xl border border-sky-900/70 space-y-1 text-xs">
                    <div className="font-black text-amber-300">
                      dewan juri :
                    </div>
                    <div className="space-y-1 pl-1 text-slate-200">
                      {juryVotersList.map((v, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span>
                            {i + 1}. {v.juryName.toLowerCase()} penilaian :{' '}
                            <strong className="text-amber-300 font-black">{v.score}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 mt-2 border-t border-sky-800/70 text-emerald-300 font-black text-xs sm:text-sm">
                      skor total {exprJury}={sumJury}:{juryVotersList.length}={'  '}
                      <span className="text-amber-300 text-base underline">{avgJury}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Clean, Simple Fixed Bottom Navigation Bar (6 Clear Tabs including Wireless Mic & Dewan Juri) */}
      <nav className="fixed bottom-0 inset-x-0 z-45 bg-[#07132c]/98 border-t border-sky-900/80 backdrop-blur-lg px-1.5 py-1.5 max-w-lg mx-auto shadow-2xl">
        <div className="grid grid-cols-6 gap-0.5 sm:gap-1">
          {/* Tab 1: Cari Lagu */}
          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
              activeTab === 'search'
                ? 'bg-sky-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            <Search className="h-4 w-4 mb-0.5" />
            <span className="text-[9px] font-bold">Cari</span>
          </button>

          {/* Tab 2: Antrean TV */}
          <button
            onClick={() => setActiveTab('queue')}
            className={`relative flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
              activeTab === 'queue'
                ? 'bg-sky-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            <ListMusic className="h-4 w-4 mb-0.5" />
            <span className="text-[9px] font-bold">Antrean</span>
            {queue.length > 0 && (
              <span className="absolute top-0.5 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-black shadow">
                {queue.length}
              </span>
            )}
          </button>

          {/* Tab 3: Mic Wireless HP */}
          <button
            onClick={() => setActiveTab('mic')}
            className={`relative flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
              activeTab === 'mic'
                ? isMicLive
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black shadow-lg border border-emerald-300'
                  : 'bg-emerald-600 text-white font-black shadow-lg border border-emerald-300'
                : isMicLive
                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 shadow-sm'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <div className="relative">
              <Mic className={`h-4 w-4 mb-0.5 ${isMicLive ? 'text-emerald-300' : ''}`} />
              {isMicLive && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
              )}
            </div>
            <span className="text-[9px] font-bold">
              {isMicLive ? (displayAudioLevel > 0 ? `${displayAudioLevel}%` : 'Mic ON') : 'Mic HP'}
            </span>
          </button>

          {/* Tab 4: Dewan Juri Prajurit */}
          <button
            onClick={() => setActiveTab('jury')}
            className={`relative flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
              activeTab === 'jury'
                ? 'bg-gradient-to-tr from-amber-500 to-yellow-500 text-slate-950 font-black shadow-lg border border-amber-300'
                : hasSubmittedJury
                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/50'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Scale className={`h-4 w-4 mb-0.5 ${activeTab === 'jury' ? 'fill-current' : ''}`} />
            <span className="text-[9px] font-bold">Juri ⚖️</span>
            {hasSubmittedJury && (
              <span className="absolute top-0.5 right-1 flex h-2 w-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Tab 5: Kirim Sorak */}
          <button
            onClick={() => setActiveTab('reactions')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
              activeTab === 'reactions'
                ? 'bg-rose-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <Sparkles className="h-4 w-4 mb-0.5" />
            <span className="text-[9px] font-bold">Sorak</span>
          </button>

          {/* Tab 6: Rekomendasi Pilihan */}
          <button
            onClick={() => setActiveTab('curated')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
              activeTab === 'curated'
                ? 'bg-sky-600 text-white font-black shadow-lg'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            <Rocket className="h-4 w-4 mb-0.5" />
            <span className="text-[9px] font-bold">Pilihan</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
