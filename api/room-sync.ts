// Vercel Serverless Function: Room Sync & Queue Management for Karaoke Diskomlekau
// Provides high-reliability room state synchronization for Smart TV Samsung (Tizen OS) and Android TV 13

interface SyncQueueItem {
  queueId: string;
  song: any;
  singerName: string;
  addedAt: number;
  priority?: boolean;
}

interface ServerlessRoomState {
  roomId: string;
  currentSong: any | null;
  currentSinger: string | null;
  isPlaying: boolean;
  isMcSpeaking?: boolean;
  isSmartMcVisible?: boolean;
  activeMcAnnouncement?: any | null;
  queue: SyncQueueItem[];
  history: any[];
  musicVolume: number;
  isMuted: boolean;
  lastUpdated: number;
}

// In-memory store for serverless runtime instances
const serverlessRooms = new Map<string, ServerlessRoomState>();

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
      lastUpdated: Date.now(),
    };
    serverlessRooms.set(cleanId, room);
  }
  return room;
}

export default async function handler(req: any, res: any) {
  // Open CORS for all devices (Smart TV Samsung Tizen, Android TV, Mobile Browsers)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const roomId = (req.query?.room || req.query?.roomId || 'ROOM-1001') as string;
      const room = getOrCreateServerlessRoom(roomId);

      return res.status(200).json({
        success: true,
        source: 'vercel-serverless-room-sync',
        roomId: room.roomId,
        room: {
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
          lastUpdated: room.lastUpdated,
        },
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { roomId, action, song, singerName, priority, queueId, payload, announcement } = body;

      const room = getOrCreateServerlessRoom(roomId || payload?.roomId);
      const cleanSinger = (singerName || payload?.singerName || 'Prajurit (HP)').trim();
      const now = Date.now();

      switch (action) {
        case 'ADD_QUEUE': {
          if (!song || !song.id) {
            return res.status(400).json({ success: false, error: 'Data lagu tidak valid' });
          }

          const qId = (queueId || payload?.queueId || `q-${now}-${Math.random().toString(36).substring(2, 7)}`).trim();

          // Deduplicate if already in queue
          const exists = room.queue.some((q) => q.queueId === qId || (q.song?.id === song.id && q.singerName === cleanSinger && now - (q.addedAt || 0) < 3000));
          if (!exists) {
            const newItem: SyncQueueItem = {
              queueId: qId,
              song,
              singerName: cleanSinger,
              addedAt: now,
              priority: Boolean(priority || payload?.priority),
            };

            if (!room.currentSong) {
              room.currentSong = song;
              room.currentSinger = cleanSinger;
              room.isPlaying = true;
            } else if (newItem.priority) {
              room.queue.unshift(newItem);
            } else {
              room.queue.push(newItem);
            }
          }
          break;
        }

        case 'PLAY_NOW': {
          if (song && song.id) {
            if (room.currentSong) {
              room.history = [room.currentSong, ...room.history.slice(0, 19)];
            }
            room.currentSong = song;
            room.currentSinger = cleanSinger;
            room.isPlaying = true;
          }
          break;
        }

        case 'SKIP_NEXT': {
          if (room.queue.length > 0) {
            const next = room.queue.shift();
            if (next) {
              if (room.currentSong) {
                room.history = [room.currentSong, ...room.history.slice(0, 19)];
              }
              room.currentSong = next.song;
              room.currentSinger = next.singerName;
              room.isPlaying = true;
            }
          } else {
            room.currentSong = null;
            room.currentSinger = null;
            room.isPlaying = false;
          }
          break;
        }

        case 'REMOVE_QUEUE': {
          const targetId = queueId || payload?.queueId;
          if (targetId) {
            room.queue = room.queue.filter((q) => q.queueId !== targetId);
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
          break;
        }

        case 'DISMISS_SMART_MC': {
          room.isSmartMcVisible = false;
          break;
        }

        case 'SYNC_STATE': {
          if (payload?.currentSong !== undefined) room.currentSong = payload.currentSong;
          if (payload?.currentSinger !== undefined) room.currentSinger = payload.currentSinger;
          if (typeof payload?.isPlaying === 'boolean') room.isPlaying = payload.isPlaying;
          if (Array.isArray(payload?.queue)) room.queue = payload.queue;
          if (typeof payload?.isSmartMcVisible === 'boolean') room.isSmartMcVisible = payload.isSmartMcVisible;
          if (payload?.activeMcAnnouncement !== undefined) room.activeMcAnnouncement = payload.activeMcAnnouncement;
          break;
        }

        default:
          break;
      }

      room.lastUpdated = now;

      return res.status(200).json({
        success: true,
        source: 'vercel-serverless-room-sync',
        roomId: room.roomId,
        room: {
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
          lastUpdated: room.lastUpdated,
        },
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Vercel room-sync error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error on room sync' });
  }
}
