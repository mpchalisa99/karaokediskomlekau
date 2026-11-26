// Vercel Serverless Function: Room Sync & Queue Management for Karaoke Diskomlekau
// Provides high-reliability room state synchronization for Smart TV Samsung (Tizen OS) and Android TV 13

interface SyncQueueItem {
  queueId: string;
  requestId?: string;
  song: any;
  singerName: string;
  addedAt: number;
  priority?: boolean;
}

interface ServerlessClient {
  id: string;
  name: string;
  role: 'master' | 'client';
  lastSeen: number;
}

interface PendingSyncCommand {
  id: string;
  action: string;
  payload: any;
  senderName?: string;
  timestamp: number;
}

interface ServerlessRoomState {
  roomId: string;
  currentSong: any | null;
  currentSinger: string | null;
  isPlaying: boolean;
  isMcSpeaking: boolean;
  isSmartMcVisible: boolean;
  activeMcAnnouncement: any | null;
  queue: SyncQueueItem[];
  history: any[];
  musicVolume: number;
  isMuted: boolean;
  musicDelayMs: number;
  juryVotes: any[];
  clients: Record<string, ServerlessClient>;
  pendingCommands: PendingSyncCommand[];
  version: number;
  lastUpdated: number;
}

// Persist across warm Vercel serverless container invocations via globalThis
const globalStore = globalThis as typeof globalThis & {
  __KARAOKE_SERVERLESS_ROOMS__?: Map<string, ServerlessRoomState>;
};
if (!globalStore.__KARAOKE_SERVERLESS_ROOMS__) {
  globalStore.__KARAOKE_SERVERLESS_ROOMS__ = new Map<string, ServerlessRoomState>();
}
const serverlessRooms = globalStore.__KARAOKE_SERVERLESS_ROOMS__;

const CLIENT_TTL_MS = 25000;

function getOrCreateServerlessRoom(rawRoomId?: string): ServerlessRoomState {
  const cleanId = (rawRoomId || 'ROOM-1001').trim().toUpperCase() || 'ROOM-1001';
  let room = serverlessRooms.get(cleanId);
  if (!room) {
    room = {
      roomId: cleanId,
      currentSong: null,
      currentSinger: null,
      isPlaying: false,
      isMcSpeaking: false,
      isSmartMcVisible: false,
      activeMcAnnouncement: null,
      queue: [],
      history: [],
      musicVolume: 100,
      isMuted: false,
      musicDelayMs: 70,
      juryVotes: [],
      clients: {},
      pendingCommands: [],
      version: 1,
      lastUpdated: Date.now(),
    };
    serverlessRooms.set(cleanId, room);
  }
  return room;
}

function pruneAndTouchClient(
  room: ServerlessRoomState,
  clientId?: string,
  singerName?: string,
  role?: string
) {
  const now = Date.now();
  for (const [id, client] of Object.entries(room.clients)) {
    if (now - client.lastSeen > CLIENT_TTL_MS) {
      delete room.clients[id];
    }
  }
  if (clientId && typeof clientId === 'string' && clientId.trim()) {
    const cleanClientId = clientId.trim().slice(0, 64);
    const resolvedRole: 'master' | 'client' = role === 'master' ? 'master' : 'client';
    const resolvedName =
      (singerName && typeof singerName === 'string' ? singerName.trim().slice(0, 48) : '') ||
      (resolvedRole === 'master' ? 'Layar Utama' : 'Prajurit (HP)');
    room.clients[cleanClientId] = {
      id: cleanClientId,
      name: resolvedName,
      role: resolvedRole,
      lastSeen: now,
    };
  }
}

function pushCommand(room: ServerlessRoomState, action: string, payload: any, senderName?: string, cmdId?: string) {
  const now = Date.now();
  const id = (cmdId || `cmd-${now}-${Math.random().toString(36).substring(2, 7)}`).trim();
  if (room.pendingCommands.some((c) => c.id === id)) return;
  room.pendingCommands.push({
    id,
    action,
    payload,
    senderName,
    timestamp: now,
  });
  if (room.pendingCommands.length > 30) {
    room.pendingCommands = room.pendingCommands.slice(-30);
  }
}

function serializeRoom(room: ServerlessRoomState) {
  const now = Date.now();
  const activeClients = Object.values(room.clients).filter((c) => now - c.lastSeen <= CLIENT_TTL_MS);
  const clientCount = Math.max(1, activeClients.length);

  return {
    roomId: room.roomId,
    nowPlaying: room.currentSong,
    currentSong: room.currentSong,
    currentSinger: room.currentSinger ?? null,
    isPlaying: room.isPlaying,
    isMcSpeaking: Boolean(room.isMcSpeaking),
    isSmartMcVisible: Boolean(room.isSmartMcVisible),
    activeMcAnnouncement: room.activeMcAnnouncement ?? null,
    queue: room.queue,
    musicVolume: room.musicVolume,
    isMuted: room.isMuted,
    musicDelayMs: room.musicDelayMs ?? 70,
    juryVotes: room.juryVotes,
    clients: activeClients.map((c) => ({ id: c.id, name: c.name, role: c.role })),
    clientCount,
    pendingCommands: room.pendingCommands,
    version: room.version,
    lastUpdated: room.lastUpdated,
  };
}

export default async function handler(req: any, res: any) {
  // Open CORS for all devices (Smart TV Samsung Tizen, Android TV, Mobile Browsers)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const roomId = (req.query?.room || req.query?.roomId || 'ROOM-1001') as string;
      const clientId = req.query?.clientId as string | undefined;
      const singerName = req.query?.singerName as string | undefined;
      const role = req.query?.role as string | undefined;

      const room = getOrCreateServerlessRoom(roomId);
      pruneAndTouchClient(room, clientId, singerName, role);

      const serialized = serializeRoom(room);
      return res.status(200).json({
        success: true,
        source: 'vercel-serverless-room-sync',
        roomId: room.roomId,
        clientCount: serialized.clientCount,
        room: serialized,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const {
        roomId,
        action,
        song,
        singerName,
        priority,
        queueId,
        requestId,
        payload,
        announcement,
        clientId,
        role,
        commandId,
      } = body;

      const room = getOrCreateServerlessRoom(roomId || payload?.roomId);
      const cleanSinger = (singerName || payload?.singerName || 'Prajurit (HP)').trim();
      const now = Date.now();
      const resolvedClientId = clientId || payload?.clientId;
      const resolvedRole = role || payload?.role || (payload?.fromMaster ? 'master' : 'client');

      pruneAndTouchClient(room, resolvedClientId, cleanSinger, resolvedRole);

      let mutated = false;

      switch (action) {
        case 'HEARTBEAT':
        case 'PING': {
          // Presence already updated above
          break;
        }

        case 'ADD_QUEUE': {
          const targetSong = song || payload?.song;
          if (!targetSong || !targetSong.id) {
            return res.status(400).json({ success: false, error: 'Data lagu tidak valid' });
          }

          const qId = (
            queueId ||
            payload?.queueId ||
            requestId ||
            payload?.requestId ||
            `q-${now}-${Math.random().toString(36).substring(2, 7)}`
          ).trim();
          const reqId = (requestId || payload?.requestId || qId).trim();

          const exists = room.queue.some(
            (q) =>
              q.queueId === qId ||
              (q.requestId && q.requestId === reqId) ||
              (q.song?.id === targetSong.id && q.singerName === cleanSinger && now - (q.addedAt || 0) < 3000)
          );
          if (!exists) {
            const newItem: SyncQueueItem = {
              queueId: qId,
              requestId: reqId,
              song: targetSong,
              singerName: cleanSinger,
              addedAt: now,
              priority: Boolean(priority || payload?.priority),
            };

            if (newItem.priority) {
              room.queue.unshift(newItem);
            } else {
              room.queue.push(newItem);
            }
            mutated = true;
          }
          break;
        }

        case 'PLAY_NOW': {
          const targetSong = song || payload?.song;
          const consumedId = body.consumedQueueId || queueId || payload?.consumedQueueId || payload?.queueId;
          if (consumedId) {
            room.queue = room.queue.filter((q) => q.queueId !== consumedId && q.requestId !== consumedId);
          }
          if (targetSong && targetSong.id) {
            if (room.currentSong && room.currentSong.id !== targetSong.id) {
              room.history = [room.currentSong, ...room.history.slice(0, 19)];
            }
            room.currentSong = targetSong;
            room.currentSinger = cleanSinger;
            room.isPlaying = true;
            room.juryVotes = [];
            if (!payload?.fromMaster) {
              pushCommand(room, 'PLAY_NOW', { song: targetSong, singerName: cleanSinger }, cleanSinger, commandId);
            }
            mutated = true;
          }
          break;
        }

        case 'STOP_IDLE': {
          if (room.currentSong) {
            room.history = [room.currentSong, ...room.history.slice(0, 19)];
          }
          room.currentSong = null;
          room.currentSinger = null;
          room.isPlaying = false;
          room.juryVotes = [];
          mutated = true;
          break;
        }

        case 'SKIP_NEXT': {
          const targetId = body.consumedQueueId || queueId || payload?.queueId;
          let next: SyncQueueItem | undefined;
          if (targetId) {
            next = room.queue.find((q) => q.queueId === targetId || q.requestId === targetId);
            room.queue = room.queue.filter((q) => q.queueId !== targetId && q.requestId !== targetId);
          } else if (room.queue.length > 0) {
            next = room.queue.shift();
          }

          if (next) {
            if (room.currentSong) {
              room.history = [room.currentSong, ...room.history.slice(0, 19)];
            }
            room.currentSong = next.song;
            room.currentSinger = next.singerName;
            room.isPlaying = true;
          } else {
            room.currentSong = null;
            room.currentSinger = null;
            room.isPlaying = false;
          }
          room.juryVotes = [];
          if (!payload?.fromMaster) {
            pushCommand(
              room,
              'SKIP_NEXT',
              { currentSong: room.currentSong, currentSinger: room.currentSinger, queue: room.queue },
              cleanSinger,
              commandId
            );
          }
          mutated = true;
          break;
        }

        case 'REMOVE_QUEUE': {
          const targetId = queueId || payload?.queueId;
          if (targetId) {
            room.queue = room.queue.filter((q) => q.queueId !== targetId && q.requestId !== targetId);
            if (!payload?.fromMaster) {
              pushCommand(room, 'REMOVE_QUEUE', { queueId: targetId }, cleanSinger, commandId);
            }
            mutated = true;
          }
          break;
        }

        case 'REORDER_QUEUE': {
          const fromIdx = typeof body.fromIndex === 'number' ? body.fromIndex : payload?.fromIndex;
          const toIdx = typeof body.toIndex === 'number' ? body.toIndex : payload?.toIndex;
          if (
            typeof fromIdx === 'number' &&
            typeof toIdx === 'number' &&
            fromIdx >= 0 &&
            toIdx >= 0 &&
            fromIdx < room.queue.length &&
            toIdx < room.queue.length
          ) {
            const [moved] = room.queue.splice(fromIdx, 1);
            if (moved) {
              room.queue.splice(toIdx, 0, moved);
            }
          }
          if (!payload?.fromMaster) {
            pushCommand(
              room,
              'REORDER_QUEUE',
              { fromIndex: fromIdx, toIndex: toIdx, queue: room.queue },
              cleanSinger,
              commandId
            );
          }
          mutated = true;
          break;
        }

        case 'TOGGLE_PAUSE':
        case 'PLAY':
        case 'PAUSE': {
          const nextPlaying =
            action === 'PLAY'
              ? true
              : action === 'PAUSE'
              ? false
              : typeof body.isPlaying === 'boolean'
              ? body.isPlaying
              : typeof payload?.isPlaying === 'boolean'
              ? payload.isPlaying
              : !room.isPlaying;
          room.isPlaying = nextPlaying;
          if (!payload?.fromMaster) {
            pushCommand(room, 'TOGGLE_PAUSE', { isPlaying: nextPlaying }, cleanSinger, commandId);
          }
          mutated = true;
          break;
        }

        case 'SET_VOLUME':
        case 'SET_MUSIC_VOLUME': {
          const rawVol =
            typeof body.volume === 'number'
              ? body.volume
              : typeof payload?.volume === 'number'
              ? payload.volume
              : room.musicVolume;
          const clampedVol = Math.max(0, Math.min(100, Math.round(rawVol)));
          const nextMuted =
            typeof body.isMuted === 'boolean'
              ? body.isMuted
              : typeof payload?.isMuted === 'boolean'
              ? payload.isMuted
              : room.isMuted;
          room.musicVolume = clampedVol;
          room.isMuted = nextMuted;
          if (!payload?.fromMaster) {
            pushCommand(
              room,
              'SET_MUSIC_VOLUME',
              { volume: clampedVol, isMuted: nextMuted, senderName: cleanSinger },
              cleanSinger,
              commandId
            );
          }
          mutated = true;
          break;
        }

        case 'PLAY_SOUND_FX': {
          const sound = body.sound || payload?.sound;
          if (sound) {
            pushCommand(room, 'PLAY_SOUND_FX', { sound, senderName: cleanSinger }, cleanSinger, commandId);
            mutated = true;
          }
          break;
        }

        case 'SET_MUSIC_DELAY': {
          const rawDelay = typeof body.delayMs === 'number' ? body.delayMs : payload?.delayMs;
          if (typeof rawDelay === 'number') {
            const clampedDelay = Math.max(0, Math.min(250, Math.round(rawDelay)));
            room.musicDelayMs = clampedDelay;
            if (!payload?.fromMaster) {
              pushCommand(room, 'SET_MUSIC_DELAY', { delayMs: clampedDelay }, cleanSinger, commandId);
            }
            mutated = true;
          }
          break;
        }

        case 'SUBMIT_JURY_SCORE': {
          const rawScore = typeof body.score === 'number' ? body.score : payload?.score;
          const jName = (body.juryName || payload?.juryName || cleanSinger || 'Prajurit (HP)').trim();
          const cId = (resolvedClientId || jName.toLowerCase()).trim();
          if (typeof rawScore === 'number') {
            const vote = {
              clientId: cId,
              juryName: jName,
              score: Math.max(0, Math.min(100, Math.round(rawScore))),
              songId: body.songId || payload?.songId || room.currentSong?.id || '',
              songTitle: room.currentSong?.title || '',
              submittedAt: now,
            };
            const norm = jName.toLowerCase();
            room.juryVotes = room.juryVotes.filter(
              (v) => (v.juryName || '').trim().toLowerCase() !== norm && v.clientId !== cId
            );
            room.juryVotes.push(vote);
            mutated = true;
          }
          break;
        }

        case 'SHOW_PANTUN':
        case 'TRIGGER_SMART_MC': {
          const resolvedAnnouncement = announcement || payload?.announcement;
          room.isSmartMcVisible = true;
          if (resolvedAnnouncement) {
            room.activeMcAnnouncement = resolvedAnnouncement;
          }
          mutated = true;
          break;
        }

        case 'DISMISS_SMART_MC': {
          room.isSmartMcVisible = false;
          mutated = true;
          break;
        }

        case 'SMART_MC_STATUS': {
          if (typeof payload?.isSpeaking === 'boolean') room.isMcSpeaking = payload.isSpeaking;
          if (typeof payload?.isVisible === 'boolean') room.isSmartMcVisible = payload.isVisible;
          mutated = true;
          break;
        }

        case 'SYNC_STATE': {
          if (payload?.currentSong !== undefined) room.currentSong = payload.currentSong;
          if (payload?.currentSinger !== undefined) room.currentSinger = payload.currentSinger;
          if (typeof payload?.isPlaying === 'boolean') room.isPlaying = payload.isPlaying;
          if (typeof payload?.musicDelayMs === 'number') {
            room.musicDelayMs = Math.max(0, Math.min(250, Math.round(payload.musicDelayMs)));
          }
          if (typeof payload?.musicVolume === 'number') {
            room.musicVolume = Math.max(0, Math.min(100, Math.round(payload.musicVolume)));
          }
          if (typeof payload?.isMuted === 'boolean') room.isMuted = payload.isMuted;
          if (typeof payload?.isMcSpeaking === 'boolean') room.isMcSpeaking = payload.isMcSpeaking;
          if (typeof payload?.isSmartMcVisible === 'boolean') room.isSmartMcVisible = payload.isSmartMcVisible;
          if (payload?.activeMcAnnouncement !== undefined) room.activeMcAnnouncement = payload.activeMcAnnouncement;

          // Merge Master queue safely while preserving very recent client additions (< 4s) not yet seen by Master
          if (Array.isArray(payload?.queue)) {
            const incomingIds = new Set(payload.queue.map((q: any) => q?.queueId).filter(Boolean));
            const recentUnseenClientItems = room.queue.filter(
              (q) => q && q.queueId && !incomingIds.has(q.queueId) && now - (q.addedAt || 0) < 4000
            );
            room.queue = [...payload.queue, ...recentUnseenClientItems];
          }
          mutated = true;
          break;
        }

        default:
          break;
      }

      if (mutated) {
        room.version += 1;
        room.lastUpdated = now;
      }

      const serialized = serializeRoom(room);
      return res.status(200).json({
        success: true,
        source: 'vercel-serverless-room-sync',
        roomId: room.roomId,
        clientCount: serialized.clientCount,
        room: serialized,
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Vercel room-sync error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error on room sync' });
  }
}
