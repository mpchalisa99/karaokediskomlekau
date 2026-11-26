// Disable HMR in AI Studio environment as required by runtime environment guidelines
process.env.DISABLE_HMR = 'true';

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ytSearch from 'yt-search';
import os from 'os';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedClient {
  id: string;
  customId?: string;
  name: string;
  role: 'master' | 'client';
  ws?: WebSocket;
  sseRes?: express.Response;
  connectedAt: number;
  lastSeen?: number;
}

interface RoomState {
  roomId: string;
  currentSong: any | null;
  currentSinger?: string | null;
  isPlaying: boolean;
  isMcSpeaking?: boolean;
  isSmartMcVisible?: boolean;
  activeMcAnnouncement?: any | null;
  lastSmartMcId?: string;
  lastSmartMcAt?: number;
  queue: any[];
  history: any[];
  clients: Map<string, ConnectedClient>;
  juryVotes: Map<string, any>;
  lastUpdated: number;
  lastSkipAt?: number;
  musicDelayMs: number;
  musicVolume: number;
  isMuted: boolean;
}

// In-memory room repository
const rooms = new Map<string, RoomState>();

function getOrCreateRoom(roomId: string): RoomState {
  const cleanId = (roomId || '').trim().toUpperCase() || 'DEFAULT-ROOM';
  let room = rooms.get(cleanId);
  if (!room) {
    room = {
      roomId: cleanId,
      currentSong: null,
      currentSinger: null,
      isPlaying: false,
      isMcSpeaking: false,
      isSmartMcVisible: false,
      activeMcAnnouncement: null,
      lastSmartMcId: undefined,
      lastSmartMcAt: 0,
      queue: [],
      history: [],
      clients: new Map(),
      juryVotes: new Map(),
      lastUpdated: Date.now(),
      lastSkipAt: 0,
      musicDelayMs: 70,
      musicVolume: 100,
      isMuted: false,
    };
    rooms.set(cleanId, room);
  }
  return room;
}

function broadcastToRoom(room: RoomState, message: any, excludeWs?: WebSocket) {
  const payloadStr = JSON.stringify(message);

  room.clients.forEach((client) => {
    // 1. WebSocket broadcast
    if (client.ws && client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payloadStr);
      } catch (err) {
        console.warn('WS broadcast error:', err);
      }
    }

    // 2. SSE broadcast
    if (client.sseRes) {
      try {
        client.sseRes.write(`data: ${payloadStr}\n\n`);
      } catch (err) {
        console.warn('SSE broadcast error:', err);
      }
    }
  });
}

function getRoomClientSummaries(room: RoomState) {
  const list: { id: string; name: string; role: 'master' | 'client' }[] = [];
  room.clients.forEach((c) => {
    list.push({ id: c.id, name: c.name, role: c.role });
  });
  return list;
}

async function startServer() {
  const app = express();
  const PORT = (() => {
    // 1. Check positional numeric argument (e.g. `npm run dev --port 3000` passes `3000` as argv[2])
    for (const arg of process.argv.slice(2)) {
      if (/^\d{4,5}$/.test(arg)) {
        const p = parseInt(arg, 10);
        if (!isNaN(p) && p !== 8080 && p !== 8000) return p;
      }
    }
    // 2. Check --port <val>
    const portArgIndex = process.argv.indexOf('--port');
    if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
      const p = parseInt(process.argv[portArgIndex + 1], 10);
      if (!isNaN(p) && p !== 8080 && p !== 8000) return p;
    }
    // 3. Check --port=<val>
    for (const arg of process.argv) {
      if (arg.startsWith('--port=')) {
        const p = parseInt(arg.split('=')[1], 10);
        if (!isNaN(p) && p !== 8080 && p !== 8000) return p;
      }
    }
    // 4. AI Studio containers run Nginx on port 8080 which reverse-proxies to port 3000.
    // If process.env.PORT is 8080, binding directly to 8080 causes EADDRINUSE with Nginx.
    // Therefore, always listen on 3000 unless an alternate non-8080 port is explicitly specified.
    if (process.env.PORT && process.env.PORT !== '8080' && process.env.PORT !== '8000') {
      const p = parseInt(process.env.PORT, 10);
      if (!isNaN(p)) return p;
    }
    return 3000;
  })();
  const isProduction = process.env.NODE_ENV === 'production';

  // Support proxies across all Cloud Run regions and CDNs
  app.set('trust proxy', true);

  // Cross-Origin Resource Sharing (CORS) for all regions, origins and devices
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Immediate lightweight healthcheck endpoint for control-plane and container probes
  app.get(['/health', '/_health', '/api/health'], (_req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime(), timestamp: Date.now() });
  });

  function getDetectedLocalIps(): string[] {
    const networkInterfaces = os.networkInterfaces();
    const localIps: string[] = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          localIps.push(net.address);
        }
      }
    }
    return localIps;
  }

  // Universal Network & Host Info endpoint for cross-region and all-device barcode connectivity
  app.get('/api/network-info', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
    const detectedUrl = `${proto}://${host}`;

    const localIps = getDetectedLocalIps();

    const publicUrl = process.env.APP_URL || detectedUrl;
    const sharedUrl = publicUrl.includes('ais-dev-')
      ? publicUrl.replace('ais-dev-', 'ais-pre-')
      : publicUrl;

    res.json({
      success: true,
      detectedUrl: publicUrl,
      sharedUrl,
      rawDetectedUrl: detectedUrl,
      localIps,
      port: PORT,
      region: process.env.CLOUD_RUN_REGION || process.env.REGION || 'asia-southeast1',
      isCloudRun: !!process.env.K_SERVICE || !!process.env.APP_URL,
    });
  });

  // Server-side search route (Uses server env YOUTUBE_API_KEY if configured, or scraper engine)
  app.get('/api/search', async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
      }

      // If server environment has YOUTUBE_API_KEY, use official API securely server-side
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) {
        try {
          const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=24&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;
          const ytRes = await fetch(ytUrl);
          if (ytRes.ok) {
            const data: any = await ytRes.json();
            if (data.items && data.items.length > 0) {
              const videos = data.items.map((item: any) => ({
                id: item.id.videoId,
                title: item.snippet?.title || '',
                channelTitle: item.snippet?.channelTitle || 'YouTube',
                thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
                duration: '',
                publishedAt: item.snippet?.publishedAt || '',
                isCurated: false,
              }));
              return res.json({
                success: true,
                source: 'official-api-proxy',
                query,
                count: videos.length,
                songs: videos,
              });
            }
          }
        } catch (apiErr) {
          console.warn('Server-side YouTube API error, falling back to scraper:', apiErr);
        }
      }

      const r = await ytSearch(query);
      const videos = (r.videos || []).slice(0, 24).map((v) => ({
        id: v.videoId,
        title: v.title,
        channelTitle: v.author?.name || 'YouTube',
        thumbnailUrl: v.thumbnail || v.image || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
        duration: v.timestamp || '',
        publishedAt: v.ago || '',
        views: v.views,
        isCurated: false,
      }));

      return res.json({
        success: true,
        source: 'no-api-key-engine',
        query,
        count: videos.length,
        songs: videos,
      });
    } catch (err: any) {
      console.error('Search error in /api/search:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal mencari video dari YouTube',
        songs: [],
      });
    }
  });

  // Indonesian Female Voice TTS Endpoint for Smart MC fallback (100% compatible with Samsung Tizen OS)
  const splitTtsChunks = (text: string, maxLen = 180): string[] => {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    if (cleaned.length <= maxLen) return [cleaned];

    const chunks: string[] = [];
    const sentences = cleaned.split(/(?<=[.!?,;:])\s+/);
    let current = '';

    for (const sentence of sentences) {
      if (!sentence) continue;
      if ((current + ' ' + sentence).trim().length <= maxLen) {
        current = (current + ' ' + sentence).trim();
      } else {
        if (current) {
          chunks.push(current);
          current = '';
        }
        if (sentence.length <= maxLen) {
          current = sentence;
        } else {
          const words = sentence.split(' ');
          for (const w of words) {
            if ((current + ' ' + w).trim().length <= maxLen) {
              current = (current + ' ' + w).trim();
            } else {
              if (current) chunks.push(current);
              current = w.slice(0, maxLen);
            }
          }
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.slice(0, 4);
  };

  app.get('/api/tts', async (req, res) => {
    const rawText = String(req.query.text || req.query.q || 'Selamat bernyanyi di Karaoke Diskomlekau!').trim();
    const tier = String(req.query.tier || 'manual').trim();
    const chunks = splitTtsChunks(rawText, 180);

    try {
      const audioBuffers: Buffer[] = [];
      for (const chunk of chunks) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(chunk)}`;
          const upstream = await fetch(ttsUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Referer: 'https://translate.google.com/',
            },
          });
          if (upstream.ok) {
            const arrBuf = await upstream.arrayBuffer();
            if (arrBuf.byteLength > 256) {
              audioBuffers.push(Buffer.from(arrBuf));
            }
          }
        } finally {
          clearTimeout(timer);
        }
      }

      if (audioBuffers.length > 0) {
        const combined = Buffer.concat(audioBuffers);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', String(combined.length));
        return res.status(200).send(combined);
      }
    } catch (err) {
      console.warn('[Server TTS] Upstream TTS unavailable, falling back to local MP3:', err);
    }

    const fallbackFile =
      tier === 'high'
        ? 'mc-high.mp3'
        : tier === 'medium'
        ? 'mc-medium.mp3'
        : tier === 'low'
        ? 'mc-low.mp3'
        : 'mc-pantun.mp3';

    const candidates = [
      path.resolve(__dirname, 'public', 'sounds', fallbackFile),
      path.resolve(__dirname, 'public', 'sounds', 'mc-pantun.mp3'),
      path.resolve(__dirname, 'public', 'sounds', 'cheer.mp3'),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(filePath);
      }
    }

    return res.status(404).json({ success: false, error: 'Audio TTS tidak tersedia' });
  });

  // Ensure missing local MP3 requests under /sounds/* return 404 immediately instead of SPA HTML
  app.get('/sounds/:fileName', (req, res, next) => {
    const safeName = path.basename(req.params.fileName || '');
    const distSound = path.resolve(__dirname, 'dist', 'sounds', safeName);
    const publicSound = path.resolve(__dirname, 'public', 'sounds', safeName);
    if (fs.existsSync(distSound)) return res.sendFile(distSound);
    if (fs.existsSync(publicSound)) return res.sendFile(publicSound);
    if (safeName.endsWith('.mp3') || safeName.endsWith('.wav') || safeName.endsWith('.ogg')) {
      return res.status(404).end();
    }
    next();
  });

  // Server-side Gemini AI song recommendations & military karaoke cheer
  app.post('/api/ai/cheer', async (req, res) => {
    try {
      const { songTitle, singerName, score } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          success: true,
          cheer: `Prajurit ${singerName || 'TNI AU'} membakar panggung dengan lagu "${songTitle || 'favorit'}"! Pantang mundur walau suara hancur! Komando!`,
        });
      }

      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Berikan komentar karaoke gaya militer TNI AU / Diskomlekau yang seru, kocak, dan membakar semangat (maksimal 2 kalimat) untuk prajurit bernama "${singerName || 'Prajurit'}" yang baru saja menyanyikan lagu "${songTitle || 'lagu'}" dengan skor karaoke ${score || 85}/100. Slogan: "Prajurit yang pantang mundur walau suara hancur".`,
      });

      return res.json({
        success: true,
        cheer: response.text?.trim() || 'Luar biasa! Prajurit sejati pantang mundur walau suara hancur!',
      });
    } catch (err: any) {
      console.warn('Gemini AI cheer error:', err);
      return res.json({
        success: true,
        cheer: 'Prajurit sejati pantang mundur walau suara hancur! Luar biasa!',
      });
    }
  });

  app.get('/api/ai/recommendations', async (req, res) => {
    try {
      const genre = (req.query.genre as string) || 'Slow Rock & Reggae';
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          success: true,
          recommendations: [
            'Scorpions - Wind Of Change',
            'Bon Jovi - Bed Of Roses',
            'Bob Marley - Could You Be Loved',
            'Dewa 19 - Kangen',
          ],
        });
      }

      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Sebutkan 5 judul lagu karaoke populer untuk genre "${genre}". Kembalikan hanya daftar judul lagu dan artis (satu per baris, tanpa nomor).`,
      });

      const lines = (response.text || '')
        .split('\n')
        .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 5);

      return res.json({
        success: true,
        recommendations: lines,
      });
    } catch (err: any) {
      return res.json({
        success: true,
        recommendations: [
          'Scorpions - Wind Of Change',
          'Bon Jovi - Bed Of Roses',
          'Bob Marley - Could You Be Loved',
        ],
      });
    }
  });

  // Resolve video info by ID without API key
  app.get('/api/resolve-video', async (req, res) => {
    try {
      const videoId = (req.query.id as string || '').trim();
      if (!videoId) {
        return res.status(400).json({ error: 'Parameter "id" is required' });
      }

      const r = await ytSearch({ videoId });
      if (r) {
        return res.json({
          success: true,
          song: {
            id: r.videoId,
            title: r.title,
            channelTitle: r.author?.name || 'YouTube',
            thumbnailUrl: r.thumbnail || `https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`,
            duration: r.timestamp || '',
            publishedAt: r.ago || '',
          },
        });
      }

      return res.status(404).json({ error: 'Video tidak ditemukan' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Shortcut routes so users never get "page not found" on manual URL typing
  app.get(['/client', '/remote', '/hp'], (req, res) => {
    const room = req.query.room ? `&room=${encodeURIComponent(req.query.room as string)}` : '';
    res.redirect(`/?client=1${room}`);
  });

  app.get(['/tv', '/stage', '/panggung'], (req, res) => {
    const room = req.query.room ? `&room=${encodeURIComponent(req.query.room as string)}` : '';
    res.redirect(`/?mode=tv${room}`);
  });

  // --- ROOM STATE & SYNC API FOR ANDROID CLIENTS & MASTER ---

  // Get current room state
  app.get('/api/room/:roomId', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    res.json({
      success: true,
      room: {
        roomId: room.roomId,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        queue: room.queue,
        musicDelayMs: room.musicDelayMs ?? 70,
        musicVolume: room.musicVolume ?? 100,
        isMuted: room.isMuted ?? false,
        clientCount: room.clients.size,
        clients: getRoomClientSummaries(room),
        juryVotes: Array.from(room.juryVotes.values()),
        lastUpdated: room.lastUpdated,
      },
    });
  });

  // Master syncs current state to server
  app.post('/api/room/:roomId/sync', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { currentSong, currentSinger, isPlaying, queue, history, musicDelayMs, musicVolume, isMuted } = req.body;

    if (currentSong !== undefined) room.currentSong = currentSong;
    if (currentSinger !== undefined) room.currentSinger = currentSinger;
    if (isPlaying !== undefined) room.isPlaying = isPlaying;
    if (Array.isArray(queue)) room.queue = queue;
    if (Array.isArray(history)) room.history = history;
    if (typeof musicDelayMs === 'number') room.musicDelayMs = musicDelayMs;
    if (typeof musicVolume === 'number') room.musicVolume = Math.max(0, Math.min(100, Math.round(musicVolume)));
    if (typeof isMuted === 'boolean') room.isMuted = isMuted;
    room.lastUpdated = Date.now();

    // Broadcast state update to all phones/clients
    broadcastToRoom(room, {
      type: 'STATE_UPDATE',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        currentSinger: room.currentSinger ?? null,
        isPlaying: room.isPlaying,
        isMcSpeaking: Boolean(room.isMcSpeaking),
        queue: room.queue,
        musicDelayMs: room.musicDelayMs,
        musicVolume: room.musicVolume,
        isMuted: room.isMuted,
        clientCount: room.clients.size,
      },
      timestamp: Date.now(),
    });

    res.json({ success: true, clientCount: room.clients.size, musicDelayMs: room.musicDelayMs, musicVolume: room.musicVolume, isMuted: room.isMuted });
  });

  // Client or Master adjusts TV music volume
  app.post('/api/room/:roomId/volume', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { volume, isMuted, senderName } = req.body;
    if (typeof volume === 'number') {
      room.musicVolume = Math.max(0, Math.min(100, Math.round(volume)));
    }
    if (typeof isMuted === 'boolean') {
      room.isMuted = isMuted;
    }
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'SET_MUSIC_VOLUME',
      roomId: room.roomId,
      payload: {
        volume: room.musicVolume ?? 100,
        isMuted: room.isMuted ?? false,
        senderName: senderName || 'Prajurit (HP)',
      },
      timestamp: Date.now(),
    });

    res.json({ success: true, volume: room.musicVolume, isMuted: room.isMuted });
  });

  // Client or Master adjusts TV music delay buffer
  app.post('/api/room/:roomId/music-delay', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { delayMs } = req.body;
    if (typeof delayMs === 'number') {
      const clamped = Math.max(0, Math.min(250, Math.round(delayMs)));
      room.musicDelayMs = clamped;
      room.lastUpdated = Date.now();
      broadcastToRoom(room, {
        type: 'MUSIC_SYNC_DELAY',
        roomId: room.roomId,
        payload: { delayMs: clamped },
        timestamp: Date.now(),
      });
      return res.json({ success: true, delayMs: clamped });
    }
    res.status(400).json({ success: false, error: 'delayMs must be a number' });
  });

  // Client submits jury score via REST
  app.post('/api/room/:roomId/jury-vote', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { score, juryName, songId, clientId } = req.body;
    if (typeof score === 'number') {
      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
      const cleanName = (juryName || 'Prajurit (HP)').trim();
      const voteKey = cleanName.toLowerCase() || clientId || `hp-${Date.now()}`;
      const vote = {
        clientId: voteKey,
        juryName: cleanName,
        score: clampedScore,
        songId: songId || room.currentSong?.id || '',
        songTitle: room.currentSong?.title || '',
        submittedAt: Date.now(),
      };
      room.juryVotes.set(voteKey, vote);
      room.lastUpdated = Date.now();

      const votesArray = Array.from(room.juryVotes.values());
      broadcastToRoom(room, {
        type: 'SYNC_JURY_SCORES',
        roomId: room.roomId,
        payload: {
          votes: votesArray,
          songId: room.currentSong?.id,
          lastVote: vote,
        },
        timestamp: Date.now(),
      });
      return res.json({ success: true, vote, votes: votesArray, totalVotes: room.juryVotes.size });
    }
    return res.status(400).json({ success: false, error: 'score must be a number' });
  });

  app.get('/api/room/:roomId/jury-votes', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    return res.json({
      success: true,
      votes: Array.from(room.juryVotes.values()),
      songId: room.currentSong?.id,
    });
  });

  // Client & Master HTTP heartbeat ping (tracks live connected phones even when WebSockets are blocked)
  app.post('/api/room/:roomId/ping', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { clientId, singerName, role } = req.body;
    const id = clientId || `http-${req.ip || 'device'}`;

    const existing = room.clients.get(id);
    const isNew = !existing;
    const clientRecord: ConnectedClient = {
      id,
      name: singerName || existing?.name || (role === 'master' ? 'Layar Utama' : 'Prajurit (HP)'),
      role: role || 'client',
      lastSeen: Date.now(),
      connectedAt: existing?.connectedAt || Date.now(),
    };
    room.clients.set(id, clientRecord);

    // Prune stale HTTP clients that haven't pinged in 20 seconds
    const now = Date.now();
    for (const [cId, client] of room.clients.entries()) {
      if (!client.ws && client.lastSeen && now - client.lastSeen > 20000) {
        room.clients.delete(cId);
      }
    }

    if (isNew) {
      broadcastToRoom(room, {
        type: 'CLIENT_COUNT_UPDATE',
        roomId: room.roomId,
        payload: {
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
          joinedName: clientRecord.name,
        },
      });
    }

    res.json({
      success: true,
      clientCount: room.clients.size,
      room: {
        roomId: room.roomId,
        currentSong: room.currentSong,
        currentSinger: room.currentSinger ?? null,
        isPlaying: room.isPlaying,
        isMcSpeaking: Boolean(room.isMcSpeaking),
        queue: room.queue,
        musicDelayMs: room.musicDelayMs ?? 70,
        musicVolume: room.musicVolume ?? 100,
        isMuted: room.isMuted ?? false,
        juryVotes: Array.from(room.juryVotes.values()),
        lastUpdated: room.lastUpdated,
      },
    });
  });

  function addSongToRoomQueue(
    room: RoomState,
    song: any,
    singerName?: string,
    priority: boolean = false,
    customQueueId?: string
  ): { item: any; isCurrent: boolean } {
    const finalSinger = singerName?.trim() || 'Prajurit (HP)';
    const qId = customQueueId?.trim() || `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 1. Deduplication check: if exact queueId already exists in room.queue, return existing without duplicating
    const existing = room.queue.find((q) => q.queueId === qId);
    if (existing) {
      return { item: existing, isCurrent: false };
    }

    // 2. Debounce multi-channel/double submission: if exact same song and singer added within 3 seconds, return existing
    const recentDuplicate = room.queue.find(
      (q) => q.song?.id === song.id && q.singerName === finalSinger && Date.now() - (q.addedAt || 0) < 3000
    );
    if (recentDuplicate) {
      return { item: recentDuplicate, isCurrent: false };
    }

    // 2b. If the exact same song is currently playing and was started less than 3 seconds ago, treat as current
    if (room.currentSong?.id === song.id && Date.now() - (room.lastUpdated || 0) < 3000) {
      return { item: { queueId: qId, song, singerName: finalSinger, addedAt: Date.now(), priority }, isCurrent: true };
    }

    const newItem = {
      queueId: qId,
      song,
      singerName: finalSinger,
      addedAt: Date.now(),
      priority: !!priority,
    };

    // If no song is currently playing, start playing this song immediately and do NOT duplicate in queue
    let isCurrent = false;
    if (!room.currentSong) {
      room.currentSong = song;
      room.currentSinger = finalSinger;
      room.isPlaying = true;
      isCurrent = true;
    } else {
      if (priority) {
        room.queue.unshift(newItem);
      } else {
        room.queue.push(newItem);
      }
    }

    room.lastUpdated = Date.now();

    // Broadcast ADD_QUEUE_ITEM to Master and all connected devices with authoritative queue included
    broadcastToRoom(room, {
      type: 'ADD_QUEUE_ITEM',
      roomId: room.roomId,
      payload: {
        item: newItem,
        queue: room.queue,
        senderName: newItem.singerName,
        isCurrent,
      },
      timestamp: Date.now(),
    });

    // Also broadcast authoritative STATE_UPDATE so all connected devices (TV, phones) have exact identical queue
    broadcastToRoom(room, {
      type: 'STATE_UPDATE',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        currentSinger: room.currentSinger ?? null,
        isPlaying: room.isPlaying,
        queue: room.queue,
        clientCount: room.clients.size,
      },
      timestamp: Date.now(),
    });

    return { item: newItem, isCurrent };
  }

  // Client adds song to the master queue
  app.post('/api/room/:roomId/queue', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { song, singerName, priority, queueId } = req.body;

    if (!song || !song.id) {
      return res.status(400).json({ success: false, error: 'Data lagu tidak lengkap' });
    }

    const { item, isCurrent } = addSongToRoomQueue(room, song, singerName, !!priority, queueId);
    res.json({ success: true, item, queue: room.queue, queueLength: room.queue.length, currentSong: room.currentSong, isCurrent });
  });

  // Client or master removes a song from queue
  app.post('/api/room/:roomId/remove', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { queueId } = req.body;

    if (!queueId) {
      return res.status(400).json({ success: false, error: 'queueId wajib diisi' });
    }

    room.queue = room.queue.filter((q) => q.queueId !== queueId);
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'REMOVE_QUEUE_ITEM',
      roomId: room.roomId,
      payload: { queueId, queue: room.queue },
      timestamp: Date.now(),
    });

    broadcastToRoom(room, {
      type: 'STATE_UPDATE',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        queue: room.queue,
        clientCount: room.clients.size,
      },
      timestamp: Date.now(),
    });

    res.json({ success: true, queue: room.queue });
  });

  // Client reorders queue (move up / down or move by queueId)
  app.post('/api/room/:roomId/reorder', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { fromIndex, toIndex, queueId, singerName } = req.body;

    if (queueId) {
      const fromIdx = room.queue.findIndex((q) => q.queueId === queueId);
      if (fromIdx !== -1 && typeof toIndex === 'number' && toIndex >= 0 && toIndex < room.queue.length) {
        const [moved] = room.queue.splice(fromIdx, 1);
        room.queue.splice(toIndex, 0, moved);
        room.lastUpdated = Date.now();

        broadcastToRoom(room, {
          type: 'SYNC_QUEUE',
          roomId: room.roomId,
          payload: { queue: room.queue, senderName: singerName || 'HP Client' },
          timestamp: Date.now(),
        });
        return res.json({ success: true, queue: room.queue });
      }
    }

    if (
      typeof fromIndex === 'number' &&
      typeof toIndex === 'number' &&
      fromIndex >= 0 &&
      fromIndex < room.queue.length &&
      toIndex >= 0 &&
      toIndex < room.queue.length
    ) {
      const [moved] = room.queue.splice(fromIndex, 1);
      room.queue.splice(toIndex, 0, moved);
      room.lastUpdated = Date.now();

      broadcastToRoom(room, {
        type: 'SYNC_QUEUE',
        roomId: room.roomId,
        payload: { queue: room.queue, senderName: singerName || 'HP Client' },
        timestamp: Date.now(),
      });
      return res.json({ success: true, queue: room.queue });
    }
    return res.status(400).json({ success: false, error: 'Index antrean tidak valid' });
  });

  // Client changes song immediately (play now)
  app.post('/api/room/:roomId/play-now', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { song, singerName } = req.body;

    if (!song || !song.id) {
      return res.status(400).json({ success: false, error: 'Data lagu tidak valid' });
    }

    room.currentSong = song;
    room.currentSinger = singerName || 'Prajurit (HP)';
    room.isPlaying = true;
    room.juryVotes.clear();
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'PLAY_NOW',
      roomId: room.roomId,
      payload: { song, singerName: room.currentSinger },
      timestamp: Date.now(),
    });

    res.json({ success: true, currentSong: room.currentSong, currentSinger: room.currentSinger });
  });

  // Client skips to next song
  app.post('/api/room/:roomId/skip', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { singerName, nextSong, queueId } = req.body;
    const now = Date.now();

    // Debounce rapid repeated skips within 1200ms
    if (now - (room.lastSkipAt || 0) < 1200) {
      return res.json({ success: true, currentSong: room.currentSong, currentSinger: room.currentSinger ?? null, queue: room.queue, debounced: true });
    }
    room.lastSkipAt = now;
    room.juryVotes.clear();

    if (queueId) {
      const idx = room.queue.findIndex((q) => q.queueId === queueId);
      if (idx !== -1) {
        const [target] = room.queue.splice(idx, 1);
        room.currentSong = target.song;
        room.currentSinger = target.singerName || singerName || null;
        room.isPlaying = true;
      } else if (nextSong && nextSong.id) {
        room.currentSong = nextSong;
        room.currentSinger = singerName || null;
        room.isPlaying = true;
      }
    } else if (nextSong && nextSong.id) {
      room.currentSong = nextSong;
      const idx = room.queue.findIndex((q) => q.song?.id === nextSong.id);
      if (idx !== -1) {
        const [matched] = room.queue.splice(idx, 1);
        room.currentSinger = matched.singerName || singerName || null;
      } else {
        room.currentSinger = singerName || null;
      }
      room.isPlaying = true;
    } else if (room.queue.length > 0) {
      const nextItem = room.queue.shift();
      if (nextItem) {
        room.currentSong = nextItem.song;
        room.currentSinger = nextItem.singerName || null;
        room.isPlaying = true;
      }
    } else {
      room.currentSong = null;
      room.currentSinger = null;
      room.isPlaying = false;
    }
    room.lastUpdated = now;

    broadcastToRoom(room, {
      type: 'SKIP_NEXT',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        currentSinger: room.currentSinger ?? null,
        queue: room.queue,
        senderName: singerName || 'Prajurit (HP)',
      },
      timestamp: now,
    });

    broadcastToRoom(room, {
      type: 'STATE_UPDATE',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        currentSinger: room.currentSinger ?? null,
        isPlaying: room.isPlaying,
        queue: room.queue,
        clientCount: room.clients.size,
      },
      timestamp: now,
    });

    res.json({ success: true, currentSong: room.currentSong, currentSinger: room.currentSinger ?? null, queue: room.queue });
  });

  // Client toggles play / pause on the TV & Tablet
  app.post('/api/room/:roomId/toggle-pause', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { senderName, isPlaying } = req.body;
    if (typeof isPlaying === 'boolean') {
      room.isPlaying = isPlaying;
    } else {
      room.isPlaying = !room.isPlaying;
    }
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'TOGGLE_PAUSE',
      roomId: room.roomId,
      payload: { isPlaying: room.isPlaying, senderName: senderName || 'Tablet/HP' },
      timestamp: Date.now(),
    });

    res.json({ success: true, isPlaying: room.isPlaying });
  });

  // Client triggers sound effect reaction on the TV master screen
  app.post('/api/room/:roomId/reaction', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { sound, singerName } = req.body;

    broadcastToRoom(room, {
      type: 'PLAY_SOUND_FX',
      roomId: room.roomId,
      payload: {
        sound: sound || 'applause',
        senderName: singerName || 'Prajurit (HP)',
      },
      timestamp: Date.now(),
    });

    res.json({ success: true });
  });

  // Client or Master triggers Smart MC Pantun Diskomlekau on the Master TV screen
  app.post('/api/room/:roomId/smart-mc', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { singerName, songTitle, score, forceTier, announcement } = req.body || {};
    const now = Date.now();
    const mcId = announcement?.id;

    // Deduplicate identical announcement ID or concurrent requests while MC is speaking
    if ((mcId && room.lastSmartMcId === mcId) || (room.isMcSpeaking && now - (room.lastSmartMcAt || 0) < 12000)) {
      return res.json({ success: true, deduped: true });
    }
    if (mcId) room.lastSmartMcId = mcId;
    room.lastSmartMcAt = now;
    room.isSmartMcVisible = true;
    if (announcement) room.activeMcAnnouncement = announcement;

    const mcPayload = {
      singerName: room.currentSinger || singerName || 'Prajurit (HP)',
      songTitle: songTitle || room.currentSong?.title || 'Lagu Pilihan Prajurit',
      score,
      forceTier,
      announcement,
      sampiran: announcement?.sampiran || (announcement?.pantunLines ? [announcement.pantunLines[0], announcement.pantunLines[1]] : undefined),
      isi: announcement?.isi || (announcement?.pantunLines ? [announcement.pantunLines[2], announcement.pantunLines[3]] : undefined),
      komentar: announcement?.komentar || announcement?.commentary,
      namaVokalis: room.currentSinger || singerName || 'Prajurit (HP)',
      judulLagu: songTitle || room.currentSong?.title,
      isManual: true,
    };

    broadcastToRoom(room, {
      type: 'SHOW_PANTUN',
      roomId: room.roomId,
      payload: mcPayload,
      timestamp: now,
    });

    broadcastToRoom(room, {
      type: 'TRIGGER_SMART_MC',
      roomId: room.roomId,
      payload: mcPayload,
      timestamp: now,
    });

    res.json({ success: true, isSmartMcVisible: true });
  });

  // Vercel-compatible /api/room-sync endpoint for Smart TV Samsung (Tizen OS) & Android TV 13
  app.get('/api/room-sync', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const rawRoom = (req.query.room || req.query.roomId || 'ROOM-1001') as string;
    const room = getOrCreateRoom(rawRoom);
    return res.json({
      success: true,
      roomId: room.roomId,
      room: {
        roomId: room.roomId,
        nowPlaying: room.currentSong,
        currentSong: room.currentSong,
        currentSinger: room.currentSinger ?? null,
        isPlaying: room.isPlaying,
        queue: room.queue,
        isMcSpeaking: Boolean(room.isMcSpeaking),
        isSmartMcVisible: Boolean(room.isSmartMcVisible),
        activeMcAnnouncement: room.activeMcAnnouncement ?? null,
        musicDelayMs: room.musicDelayMs ?? 70,
        musicVolume: room.musicVolume ?? 100,
        isMuted: room.isMuted ?? false,
        clientCount: room.clients.size,
        juryVotes: Array.from(room.juryVotes.values()),
        lastUpdated: room.lastUpdated,
      },
    });
  });

  app.post('/api/room-sync', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const body = req.body || {};
    const { roomId, action, song, singerName, priority, queueId, requestId, consumedQueueId, payload, announcement } = body;
    const room = getOrCreateRoom(roomId || payload?.roomId);
    const cleanSinger = (singerName || payload?.singerName || 'Prajurit (HP)').trim();
    const now = Date.now();

    switch (action) {
      case 'ADD_QUEUE': {
        const targetSong = song || payload?.song;
        if (!targetSong || !targetSong.id) {
          return res.status(400).json({ success: false, error: 'Data lagu tidak valid' });
        }
        const { item, isCurrent } = addSongToRoomQueue(
          room,
          targetSong,
          cleanSinger,
          !!(priority || payload?.priority),
          queueId || requestId || payload?.queueId || payload?.requestId
        );
        return res.json({
          success: true,
          action,
          item,
          isCurrent,
          room: {
            roomId: room.roomId,
            nowPlaying: room.currentSong,
            currentSong: room.currentSong,
            currentSinger: room.currentSinger ?? null,
            isPlaying: room.isPlaying,
            queue: room.queue,
            lastUpdated: room.lastUpdated,
          },
        });
      }

      case 'PLAY_NOW': {
        const targetSong = song || payload?.song;
        const consumedId = consumedQueueId || queueId || payload?.consumedQueueId || payload?.queueId;
        if (consumedId) {
          room.queue = room.queue.filter((q) => q.queueId !== consumedId);
        }
        if (targetSong && targetSong.id) {
          room.currentSong = targetSong;
          room.currentSinger = cleanSinger;
          room.isPlaying = true;
          room.lastUpdated = now;
          broadcastToRoom(room, {
            type: 'PLAY_NOW',
            roomId: room.roomId,
            payload: { song: targetSong, singerName: cleanSinger },
            timestamp: now,
          });
          broadcastToRoom(room, {
            type: 'STATE_UPDATE',
            roomId: room.roomId,
            payload: {
              currentSong: room.currentSong,
              currentSinger: room.currentSinger,
              isPlaying: true,
              queue: room.queue,
              clientCount: room.clients.size,
            },
            timestamp: now,
          });
        }
        break;
      }

      case 'STOP_IDLE': {
        room.currentSong = null;
        room.currentSinger = null;
        room.isPlaying = false;
        room.lastUpdated = now;
        break;
      }

      case 'REMOVE_QUEUE': {
        const targetId = queueId || payload?.queueId;
        if (targetId) {
          room.queue = room.queue.filter((q) => q.queueId !== targetId);
          room.lastUpdated = now;
          broadcastToRoom(room, {
            type: 'REMOVE_QUEUE_ITEM',
            roomId: room.roomId,
            payload: { queueId: targetId, queue: room.queue },
            timestamp: now,
          });
        }
        break;
      }

      case 'SKIP_NEXT': {
        const targetId = consumedQueueId || queueId || payload?.queueId;
        let next: any;
        if (targetId) {
          next = room.queue.find((q) => q.queueId === targetId);
          room.queue = room.queue.filter((q) => q.queueId !== targetId);
        } else if (room.queue.length > 0) {
          next = room.queue.shift();
        }
        if (next) {
          room.currentSong = next.song;
          room.currentSinger = next.singerName;
          room.isPlaying = true;
        } else {
          room.currentSong = null;
          room.currentSinger = null;
          room.isPlaying = false;
        }
        room.lastUpdated = now;
        broadcastToRoom(room, {
          type: 'SKIP_NEXT',
          roomId: room.roomId,
          payload: { currentSong: room.currentSong, currentSinger: room.currentSinger, queue: room.queue },
          timestamp: now,
        });
        break;
      }

      case 'SHOW_PANTUN':
      case 'TRIGGER_SMART_MC': {
        const resolvedAnnouncement = announcement || payload?.announcement;
        room.isSmartMcVisible = true;
        if (resolvedAnnouncement) {
          room.activeMcAnnouncement = resolvedAnnouncement;
          room.lastSmartMcId = resolvedAnnouncement.id;
        }
        room.lastSmartMcAt = now;
        const mcPayload = {
          ...(payload || {}),
          announcement: resolvedAnnouncement,
          sampiran: resolvedAnnouncement?.sampiran || (resolvedAnnouncement?.pantunLines ? [resolvedAnnouncement.pantunLines[0], resolvedAnnouncement.pantunLines[1]] : undefined),
          isi: resolvedAnnouncement?.isi || (resolvedAnnouncement?.pantunLines ? [resolvedAnnouncement.pantunLines[2], resolvedAnnouncement.pantunLines[3]] : undefined),
          komentar: resolvedAnnouncement?.komentar || resolvedAnnouncement?.commentary,
          namaVokalis: resolvedAnnouncement?.namaVokalis || cleanSinger,
          judulLagu: resolvedAnnouncement?.judulLagu || song?.title,
          singerName: room.currentSinger || cleanSinger,
          songTitle: song?.title || room.currentSong?.title,
          isManual: true,
        };
        broadcastToRoom(room, {
          type: 'SHOW_PANTUN',
          roomId: room.roomId,
          payload: mcPayload,
          timestamp: now,
        });
        broadcastToRoom(room, {
          type: 'TRIGGER_SMART_MC',
          roomId: room.roomId,
          payload: mcPayload,
          timestamp: now,
        });
        break;
      }

      case 'DISMISS_SMART_MC': {
        room.isSmartMcVisible = false;
        broadcastToRoom(room, {
          type: 'SMART_MC_STATUS',
          roomId: room.roomId,
          payload: { isSpeaking: false, isVisible: false },
          timestamp: now,
        });
        break;
      }

      case 'SYNC_STATE': {
        if (payload?.currentSong !== undefined) room.currentSong = payload.currentSong;
        if (payload?.currentSinger !== undefined) room.currentSinger = payload.currentSinger;
        if (typeof payload?.isPlaying === 'boolean') room.isPlaying = payload.isPlaying;
        if (Array.isArray(payload?.queue)) room.queue = payload.queue;
        if (typeof payload?.isSmartMcVisible === 'boolean') room.isSmartMcVisible = payload.isSmartMcVisible;
        if (payload?.activeMcAnnouncement !== undefined) room.activeMcAnnouncement = payload.activeMcAnnouncement;
        room.lastUpdated = now;
        break;
      }
    }

    return res.json({
      success: true,
      action,
      room: {
        roomId: room.roomId,
        nowPlaying: room.currentSong,
        currentSong: room.currentSong,
        currentSinger: room.currentSinger ?? null,
        isPlaying: room.isPlaying,
        isSmartMcVisible: Boolean(room.isSmartMcVisible),
        activeMcAnnouncement: room.activeMcAnnouncement ?? null,
        queue: room.queue,
        lastUpdated: room.lastUpdated,
      },
    });
  });

  // Server-Sent Events (SSE) fallback stream
  app.get('/api/room/:roomId/events', (req, res) => {
    const roomId = req.params.roomId;
    const room = getOrCreateRoom(roomId);
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const clientName = (req.query.name as string) || 'HP Client';
    const role = (req.query.role as 'master' | 'client') || 'client';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');

    const connectedClient: ConnectedClient = {
      id: clientId,
      name: clientName,
      role,
      sseRes: res,
      connectedAt: Date.now(),
    };
    room.clients.set(clientId, connectedClient);

    // Send initial snapshot
    res.write(
      `data: ${JSON.stringify({
        type: 'INIT_STATE',
        roomId: room.roomId,
        payload: {
          currentSong: room.currentSong,
          isPlaying: room.isPlaying,
          queue: room.queue,
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
        },
        timestamp: Date.now(),
      })}\n\n`
    );

    // Notify room of new device
    broadcastToRoom(room, {
      type: 'CLIENT_COUNT_UPDATE',
      roomId: room.roomId,
      payload: {
        clientCount: room.clients.size,
        clients: getRoomClientSummaries(room),
        joinedName: clientName,
      },
      timestamp: Date.now(),
    });

    req.on('close', () => {
      room.clients.delete(clientId);
      broadcastToRoom(room, {
        type: 'CLIENT_COUNT_UPDATE',
        roomId: room.roomId,
        payload: {
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
        },
        timestamp: Date.now(),
      });
    });
  });

  // Create unified HTTP server
  const server = http.createServer(app);

  // WebSocket Server for Karaoke sync attached cleanly using noServer mode
  const wss = new WebSocketServer({ noServer: true });
  // Dummy WebSocket server for Vite HMR to cleanly open without closing prematurely
  const viteWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        // Accept Vite HMR WebSocket connection cleanly so browser does not throw "WebSocket closed without opened"
        viteWss.handleUpgrade(request, socket, head, (ws) => {
          try {
            ws.send(JSON.stringify({ type: 'connected' }));
          } catch {}
          ws.on('message', () => {});
        });
      }
    } catch {
      // Allow other upgrade listeners to proceed
    }
  });

  // Explicit PWA routes to guarantee installability across Android Chrome, iOS, and Smart TV
  const publicDir = path.resolve(__dirname, 'public');
  const distDir = path.resolve(__dirname, 'dist');

  const servePwaAsset = (fileName: string, contentType: string, extraHeaders: Record<string, string> = {}) => {
    return (_req: express.Request, res: express.Response) => {
      const distFile = path.resolve(distDir, fileName);
      const publicFile = path.resolve(publicDir, fileName);
      const targetFile = fs.existsSync(distFile) ? distFile : (fs.existsSync(publicFile) ? publicFile : null);

      if (targetFile) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
        return res.sendFile(targetFile);
      }
      res.status(404).send('Asset not found');
    };
  };

  app.get('/manifest.json', servePwaAsset('manifest.json', 'application/manifest+json'));
  app.get('/manifest.webmanifest', servePwaAsset('manifest.webmanifest', 'application/manifest+json'));
  app.get('/sw.js', servePwaAsset('sw.js', 'application/javascript; charset=utf-8', { 'Service-Worker-Allowed': '/' }));
  app.get('/registerSW.js', servePwaAsset('registerSW.js', 'application/javascript; charset=utf-8'));
  app.get('/pwa-192x192.png', servePwaAsset('pwa-192x192.png', 'image/png'));
  app.get('/pwa-512x512.png', servePwaAsset('pwa-512x512.png', 'image/png'));
  app.get('/pwa-maskable-512x512.png', servePwaAsset('pwa-maskable-512x512.png', 'image/png'));
  app.get('/apple-touch-icon.png', servePwaAsset('apple-touch-icon.png', 'image/png'));
  app.get('/favicon.ico', servePwaAsset('favicon.ico', 'image/x-icon'));
  app.get('/icon.svg', servePwaAsset('icon.svg', 'image/svg+xml'));

  // Vite middleware in dev or static files in prod
  if (!isProduction) {
    if (typeof (globalThis as any).__dirname === 'string' && (globalThis as any).__dirname === '.') {
      delete (globalThis as any).__dirname;
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.resolve(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).send('Application build in progress. Please refresh shortly.');
        }
      });
    });
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const roomId = (url.searchParams.get('room') || 'DEFAULT-ROOM').trim().toUpperCase();
    const role = (url.searchParams.get('role') as 'master' | 'client') || 'client';
    const singerName = url.searchParams.get('singer') || (role === 'master' ? 'Layar Utama' : 'Prajurit (HP)');

    const room = getOrCreateRoom(roomId);
    const requestedClientId = (url.searchParams.get('clientId') || '').trim();
    const clientId = requestedClientId || `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const existingClient = room.clients.get(clientId);
    if (existingClient && existingClient.ws && existingClient.ws !== ws) {
      try {
        existingClient.ws.terminate();
      } catch {}
    }

    const clientRecord: ConnectedClient = {
      id: clientId,
      customId: requestedClientId || undefined,
      name: singerName,
      role,
      ws,
      connectedAt: existingClient?.connectedAt || Date.now(),
      lastSeen: Date.now(),
    };
    (ws as any).isAlive = true;
    room.clients.set(clientId, clientRecord);

    // Send initial snapshot to newly connected device (including detected local hotspot/LAN IPs for zero-delay WebRTC)
    const detectedIps = getDetectedLocalIps();
    ws.send(
      JSON.stringify({
        type: 'INIT_STATE',
        roomId: room.roomId,
        assignedClientId: clientId,
        payload: {
          currentSong: room.currentSong,
          currentSinger: room.currentSinger ?? null,
          isPlaying: room.isPlaying,
          isMcSpeaking: Boolean(room.isMcSpeaking),
          queue: room.queue,
          musicDelayMs: room.musicDelayMs ?? 70,
          musicVolume: room.musicVolume ?? 100,
          isMuted: room.isMuted ?? false,
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
          juryVotes: Array.from(room.juryVotes.values()),
          localIps: detectedIps,
          serverPort: PORT,
        },
        timestamp: Date.now(),
      })
    );

    // Broadcast client join update
    broadcastToRoom(room, {
      type: 'CLIENT_COUNT_UPDATE',
      roomId: room.roomId,
      payload: {
        clientCount: room.clients.size,
        clients: getRoomClientSummaries(room),
        joinedName: singerName,
      },
      timestamp: Date.now(),
    });

    ws.on('pong', () => {
      (ws as any).isAlive = true;
      clientRecord.lastSeen = Date.now();
    });

    ws.on('message', (data) => {
      try {
        (ws as any).isAlive = true;
        clientRecord.lastSeen = Date.now();
        const msg = JSON.parse(data.toString());
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'PING': {
            try {
              ws.send(JSON.stringify({ type: 'PONG', roomId: room.roomId, timestamp: Date.now() }));
            } catch {}
            break;
          }

          case 'PONG': {
            room.lastUpdated = Date.now();
            break;
          }

          case 'SYNC_STATE': {
            if (msg.payload) {
              if (msg.payload.currentSong !== undefined) room.currentSong = msg.payload.currentSong;
              if (msg.payload.isPlaying !== undefined) room.isPlaying = msg.payload.isPlaying;
              if (Array.isArray(msg.payload.queue)) room.queue = msg.payload.queue;
              if (typeof msg.payload.musicDelayMs === 'number') room.musicDelayMs = msg.payload.musicDelayMs;
              if (typeof msg.payload.musicVolume === 'number') room.musicVolume = Math.max(0, Math.min(100, Math.round(msg.payload.musicVolume)));
              if (typeof msg.payload.isMuted === 'boolean') room.isMuted = msg.payload.isMuted;
              room.lastUpdated = Date.now();

              broadcastToRoom(
                room,
                {
                  type: 'STATE_UPDATE',
                  roomId: room.roomId,
                  payload: {
                    currentSong: room.currentSong,
                    isPlaying: room.isPlaying,
                    queue: room.queue,
                    musicDelayMs: room.musicDelayMs,
                    musicVolume: room.musicVolume ?? 100,
                    isMuted: room.isMuted ?? false,
                    clientCount: room.clients.size,
                  },
                  timestamp: Date.now(),
                },
                ws
              );
            }
            break;
          }

          case 'ADD_QUEUE_ITEM': {
            const { song, singerName: addedBy, priority, queueId, item: sentItem } = msg.payload || {};
            const targetSong = song || sentItem?.song;
            const targetSinger = addedBy || sentItem?.singerName || singerName;
            const targetQueueId = queueId || sentItem?.queueId;
            const targetPriority = priority !== undefined ? priority : sentItem?.priority;
            if (targetSong && targetSong.id) {
              addSongToRoomQueue(room, targetSong, targetSinger, !!targetPriority, targetQueueId);
            }
            break;
          }

          case 'REMOVE_QUEUE_ITEM': {
            const queueId = msg.payload?.queueId;
            if (queueId) {
              room.queue = room.queue.filter((q) => q.queueId !== queueId);
              room.lastUpdated = Date.now();
              broadcastToRoom(room, {
                type: 'REMOVE_QUEUE_ITEM',
                roomId: room.roomId,
                payload: { queueId, queue: room.queue },
                timestamp: Date.now(),
              });
              broadcastToRoom(room, {
                type: 'STATE_UPDATE',
                roomId: room.roomId,
                payload: {
                  currentSong: room.currentSong,
                  isPlaying: room.isPlaying,
                  queue: room.queue,
                  clientCount: room.clients.size,
                },
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'MOVE_QUEUE_ITEM': {
            const { fromIndex, toIndex, queueId } = msg.payload || {};
            if (queueId) {
              const fromIdx = room.queue.findIndex((q) => q.queueId === queueId);
              if (fromIdx !== -1 && typeof toIndex === 'number' && toIndex >= 0 && toIndex < room.queue.length) {
                const [moved] = room.queue.splice(fromIdx, 1);
                room.queue.splice(toIndex, 0, moved);
                room.lastUpdated = Date.now();

                broadcastToRoom(room, {
                  type: 'SYNC_QUEUE',
                  roomId: room.roomId,
                  payload: { queue: room.queue, senderName: singerName },
                  timestamp: Date.now(),
                });
              }
            } else if (
              typeof fromIndex === 'number' &&
              typeof toIndex === 'number' &&
              fromIndex >= 0 &&
              fromIndex < room.queue.length &&
              toIndex >= 0 &&
              toIndex < room.queue.length
            ) {
              const [moved] = room.queue.splice(fromIndex, 1);
              room.queue.splice(toIndex, 0, moved);
              room.lastUpdated = Date.now();

              broadcastToRoom(room, {
                type: 'SYNC_QUEUE',
                roomId: room.roomId,
                payload: { queue: room.queue, senderName: singerName },
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'PLAY_NOW': {
            const song = msg.payload?.song;
            const singer = msg.payload?.singerName || singerName;
            if (song && song.id) {
              room.currentSong = song;
              room.currentSinger = singer;
              room.isPlaying = true;
              room.juryVotes.clear();
              room.lastUpdated = Date.now();

              broadcastToRoom(room, {
                type: 'PLAY_NOW',
                roomId: room.roomId,
                payload: { song, singerName: singer },
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'PLAY_SOUND_FX': {
            broadcastToRoom(room, {
              type: 'PLAY_SOUND_FX',
              roomId: room.roomId,
              payload: {
                sound: msg.payload?.sound || 'applause',
                senderName: singerName,
              },
              timestamp: Date.now(),
            });
            break;
          }

          case 'SHOW_PANTUN':
          case 'TRIGGER_SMART_MC': {
            const now = Date.now();
            const mcId = msg.payload?.announcement?.id;
            if ((mcId && room.lastSmartMcId === mcId) || (room.isMcSpeaking && now - (room.lastSmartMcAt || 0) < 12000)) {
              break;
            }
            if (mcId) room.lastSmartMcId = mcId;
            room.lastSmartMcAt = now;
            room.isSmartMcVisible = true;
            if (msg.payload?.announcement) {
              room.activeMcAnnouncement = msg.payload.announcement;
            }

            const announcement = msg.payload?.announcement;
            const cleanSinger = room.currentSinger || msg.payload?.singerName || singerName;
            const mcPayload = {
              ...(msg.payload || {}),
              singerName: cleanSinger,
              senderName: msg.payload?.senderName || msg.payload?.singerName || singerName,
              sampiran: msg.payload?.sampiran || announcement?.sampiran || (announcement?.pantunLines ? [announcement.pantunLines[0], announcement.pantunLines[1]] : undefined),
              isi: msg.payload?.isi || announcement?.isi || (announcement?.pantunLines ? [announcement.pantunLines[2], announcement.pantunLines[3]] : undefined),
              komentar: msg.payload?.komentar || announcement?.komentar || announcement?.commentary,
              namaVokalis: msg.payload?.namaVokalis || announcement?.namaVokalis || cleanSinger,
              judulLagu: msg.payload?.judulLagu || announcement?.judulLagu || msg.payload?.songTitle || room.currentSong?.title,
              isManual: true,
            };

            broadcastToRoom(room, {
              type: 'SHOW_PANTUN',
              roomId: room.roomId,
              payload: mcPayload,
              timestamp: now,
            });

            broadcastToRoom(room, {
              type: 'TRIGGER_SMART_MC',
              roomId: room.roomId,
              payload: mcPayload,
              timestamp: now,
            });
            break;
          }

          case 'SMART_MC_STATUS': {
            const speaking = Boolean(msg.payload?.isSpeaking);
            room.isMcSpeaking = speaking;
            if (speaking) {
              room.lastSmartMcAt = Date.now();
            }
            broadcastToRoom(
              room,
              {
                type: 'SMART_MC_STATUS',
                roomId: room.roomId,
                payload: { isSpeaking: speaking },
                timestamp: Date.now(),
              },
              ws
            );
            break;
          }

          case 'SKIP_NEXT': {
            const now = Date.now();
            if (now - (room.lastSkipAt || 0) >= 1200) {
              room.lastSkipAt = now;
              room.juryVotes.clear();

              const nextQueueId = msg.payload?.queueId;
              const nextSong = msg.payload?.nextSong;

              if (nextQueueId) {
                const idx = room.queue.findIndex((q) => q.queueId === nextQueueId);
                if (idx !== -1) {
                  const [target] = room.queue.splice(idx, 1);
                  room.currentSong = target.song;
                  room.currentSinger = target.singerName || singerName || null;
                  room.isPlaying = true;
                } else if (nextSong && nextSong.id) {
                  room.currentSong = nextSong;
                  room.currentSinger = singerName || null;
                  room.isPlaying = true;
                }
              } else if (nextSong && nextSong.id) {
                room.currentSong = nextSong;
                const idx = room.queue.findIndex((q) => q.song?.id === nextSong.id);
                if (idx !== -1) {
                  const [matched] = room.queue.splice(idx, 1);
                  room.currentSinger = matched.singerName || singerName || null;
                } else {
                  room.currentSinger = singerName || null;
                }
                room.isPlaying = true;
              } else if (room.queue.length > 0) {
                const nextItem = room.queue.shift();
                if (nextItem) {
                  room.currentSong = nextItem.song;
                  room.currentSinger = nextItem.singerName || null;
                  room.isPlaying = true;
                }
              } else {
                room.currentSong = null;
                room.currentSinger = null;
                room.isPlaying = false;
              }
              room.lastUpdated = now;

              broadcastToRoom(room, {
                type: 'SKIP_NEXT',
                roomId: room.roomId,
                payload: {
                  currentSong: room.currentSong,
                  currentSinger: room.currentSinger ?? null,
                  queue: room.queue,
                  senderName: singerName,
                },
                timestamp: now,
              });

              broadcastToRoom(room, {
                type: 'STATE_UPDATE',
                roomId: room.roomId,
                payload: {
                  currentSong: room.currentSong,
                  currentSinger: room.currentSinger ?? null,
                  isPlaying: room.isPlaying,
                  queue: room.queue,
                  clientCount: room.clients.size,
                },
                timestamp: now,
              });
            }
            break;
          }

          case 'TOGGLE_PAUSE': {
            if (typeof msg.payload?.isPlaying === 'boolean') {
              room.isPlaying = msg.payload.isPlaying;
            } else {
              room.isPlaying = !room.isPlaying;
            }
            room.lastUpdated = Date.now();
            broadcastToRoom(room, {
              type: 'TOGGLE_PAUSE',
              roomId: room.roomId,
              payload: { isPlaying: room.isPlaying, senderName: singerName },
              timestamp: Date.now(),
            });
            break;
          }

          case 'SET_VOLUME':
          case 'SET_MUSIC_VOLUME': {
            const { volume, isMuted, senderName: customSender } = msg.payload || {};
            const effectiveVol = typeof volume === 'number' ? volume : (typeof msg.payload === 'number' ? msg.payload : undefined);
            if (typeof effectiveVol === 'number') {
              room.musicVolume = Math.max(0, Math.min(100, Math.round(effectiveVol)));
            }
            if (typeof isMuted === 'boolean') {
              room.isMuted = isMuted;
            }
            room.lastUpdated = Date.now();
            broadcastToRoom(room, {
              type: 'SET_MUSIC_VOLUME',
              roomId: room.roomId,
              payload: {
                volume: room.musicVolume ?? 100,
                isMuted: room.isMuted ?? false,
                senderName: customSender || singerName,
              },
              timestamp: Date.now(),
            });
            break;
          }

          case 'SUBMIT_JURY_SCORE': {
            const { score, juryName, songId, clientId: voteClientId } = msg.payload || {};
            const cleanName = (juryName || singerName || 'Prajurit (HP)').trim();
            const voteKey = cleanName.toLowerCase() || voteClientId || clientId;
            if (typeof score === 'number') {
              const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
              const vote = {
                clientId: voteKey,
                juryName: cleanName,
                score: clampedScore,
                songId: songId || room.currentSong?.id || '',
                songTitle: room.currentSong?.title || '',
                submittedAt: Date.now(),
              };
              room.juryVotes.set(voteKey, vote);
              room.lastUpdated = Date.now();

              const votesArray = Array.from(room.juryVotes.values());
              broadcastToRoom(room, {
                type: 'SYNC_JURY_SCORES',
                roomId: room.roomId,
                payload: {
                  votes: votesArray,
                  songId: room.currentSong?.id,
                  lastVote: vote,
                },
                timestamp: Date.now(),
              });
            }
            break;
          }

          // WebRTC P2P Audio Streaming Signaling
          case 'RTC_OFFER': {
            const { targetClientId, offer, senderName: customSender, senderId: customSenderId } = msg.payload || {};
            if (customSenderId) {
              clientRecord.customId = customSenderId;
            }
            const payload = {
              senderId: customSenderId || clientId,
              wsSenderId: clientId,
              senderName: customSender || singerName,
              offer,
            };
            room.clients.forEach((c) => {
              if (c.id !== clientId) {
                const matchesTarget = targetClientId && (c.id === targetClientId || c.customId === targetClientId);
                if (matchesTarget || (!targetClientId && c.role === 'master')) {
                  if (c.ws && c.ws.readyState === WebSocket.OPEN) {
                    c.ws.send(JSON.stringify({
                      type: 'RTC_OFFER',
                      roomId: room.roomId,
                      payload,
                      timestamp: Date.now(),
                    }));
                  }
                }
              }
            });
            break;
          }

          case 'RTC_ANSWER': {
            const { targetClientId, answer } = msg.payload || {};
            if (targetClientId) {
              let targetClient = room.clients.get(targetClientId);
              if (!targetClient) {
                targetClient = Array.from(room.clients.values()).find(
                  (c) => c.id === targetClientId || c.customId === targetClientId
                );
              }
              if (targetClient && targetClient.ws && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify({
                  type: 'RTC_ANSWER',
                  roomId: room.roomId,
                  payload: {
                    senderId: clientId,
                    targetClientId,
                    answer,
                  },
                  timestamp: Date.now(),
                }));
              }
            }
            break;
          }

          case 'RTC_ICE_CANDIDATE': {
            const { targetClientId, candidate } = msg.payload || {};
            if (targetClientId) {
              let targetClient = room.clients.get(targetClientId);
              if (!targetClient) {
                targetClient = Array.from(room.clients.values()).find(
                  (c) => c.id === targetClientId || c.customId === targetClientId
                );
              }
              if (targetClient && targetClient.ws && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify({
                  type: 'RTC_ICE_CANDIDATE',
                  roomId: room.roomId,
                  payload: {
                    senderId: clientId,
                    targetClientId,
                    candidate,
                  },
                  timestamp: Date.now(),
                }));
              }
            } else {
              room.clients.forEach((c) => {
                if (c.id !== clientId && c.role === 'master') {
                  if (c.ws && c.ws.readyState === WebSocket.OPEN) {
                    c.ws.send(JSON.stringify({
                      type: 'RTC_ICE_CANDIDATE',
                      roomId: room.roomId,
                      payload: {
                        senderId: msg.payload?.senderId || clientId,
                        candidate,
                      },
                      timestamp: Date.now(),
                    }));
                  }
                }
              });
            }
            break;
          }

          case 'RTC_MIC_STATUS': {
            const { isMicOn, senderName: customSender, senderId: customSenderId } = msg.payload || {};
            broadcastToRoom(room, {
              type: 'RTC_MIC_STATUS',
              roomId: room.roomId,
              payload: {
                senderId: customSenderId || clientId,
                senderName: customSender || singerName,
                isMicOn: !!isMicOn,
              },
              timestamp: Date.now(),
            });
            break;
          }

          case 'RTC_MIC_PARAMS': {
            const { targetClientId, volume, echo, isMuted, senderName: customSender } = msg.payload || {};
            if (targetClientId) {
              const targetClient = room.clients.get(targetClientId);
              if (targetClient && targetClient.ws && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify({
                  type: 'RTC_MIC_PARAMS',
                  roomId: room.roomId,
                  payload: {
                    senderId: clientId,
                    targetClientId,
                    senderName: customSender || singerName,
                    volume,
                    echo,
                    isMuted,
                  },
                  timestamp: Date.now(),
                }));
              }
            } else {
              // Route to master so Master can adjust the individual stream's gain & echo without overriding other phones
              room.clients.forEach((c) => {
                if (c.role === 'master' && c.ws && c.ws.readyState === WebSocket.OPEN) {
                  c.ws.send(JSON.stringify({
                    type: 'RTC_MIC_PARAMS',
                    roomId: room.roomId,
                    payload: {
                      senderId: clientId,
                      senderName: customSender || singerName,
                      volume,
                      echo,
                      isMuted,
                    },
                    timestamp: Date.now(),
                  }));
                }
              });
            }
            break;
          }

          // Live audio relay chunk stream (guarantees audio entry into master even if P2P NAT fails)
          case 'CLIENT_MIC_AUDIO_DATA': {
            const senderId = msg.payload?.senderId || clientId;
            const audioPayload = {
              senderId,
              senderName: msg.payload?.senderName || singerName,
              pcm: msg.payload?.pcm,
              sampleRate: msg.payload?.sampleRate || 24000,
              level: msg.payload?.level || 0,
              timestamp: Date.now(),
            };
            room.clients.forEach((c) => {
              if (c.id !== clientId && c.role === 'master' && c.ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify({
                  type: 'CLIENT_MIC_AUDIO_DATA',
                  roomId: room.roomId,
                  payload: audioPayload,
                  timestamp: Date.now(),
                }));
              }
            });
            break;
          }

          // Live VU meter audio level from client phone mic
          case 'RTC_MIC_LEVEL': {
            const senderId = msg.payload?.senderId || clientId;
            const levelPayload = {
              senderId,
              senderName: msg.payload?.senderName || singerName,
              level: msg.payload?.level || 0,
            };
            room.clients.forEach((c) => {
              if (c.id !== clientId && c.role === 'master' && c.ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify({
                  type: 'RTC_MIC_LEVEL',
                  roomId: room.roomId,
                  payload: levelPayload,
                  timestamp: Date.now(),
                }));
              }
            });
            break;
          }

          // Vocal sync buffer delay adjustment (syncs TV music delay)
          case 'MUSIC_SYNC_DELAY': {
            const delayMs = msg.payload?.delayMs;
            if (typeof delayMs === 'number') {
              const clamped = Math.max(0, Math.min(250, Math.round(delayMs)));
              room.musicDelayMs = clamped;
              room.lastUpdated = Date.now();
              broadcastToRoom(room, {
                type: 'MUSIC_SYNC_DELAY',
                roomId: room.roomId,
                payload: { delayMs: clamped },
                timestamp: Date.now(),
              });
            }
            break;
          }
        }
      } catch (err) {
        console.warn('WS message error:', err);
      }
    });

    ws.on('close', () => {
      const current = room.clients.get(clientId);
      if (current && current.ws === ws) {
        room.clients.delete(clientId);
        broadcastToRoom(room, {
          type: 'RTC_MIC_STATUS',
          roomId: room.roomId,
          payload: {
            senderId: clientId,
            senderName: singerName,
            isMicOn: false,
          },
          timestamp: Date.now(),
        });
        broadcastToRoom(room, {
          type: 'CLIENT_COUNT_UPDATE',
          roomId: room.roomId,
          payload: {
            clientCount: room.clients.size,
            clients: getRoomClientSummaries(room),
          },
          timestamp: Date.now(),
        });
      }
    });

    ws.on('error', (err) => {
      console.warn('WS connection error:', err);
    });
  });

  // Server-side active heartbeat every 4.5s to prevent proxy/NAT timeouts & prune dead sockets
  setInterval(() => {
    wss.clients.forEach((client: any) => {
      if (client.isAlive === false) {
        try {
          client.terminate();
        } catch {}
        return;
      }
      client.isAlive = false;
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
          client.send(JSON.stringify({ type: 'HEARTBEAT', timestamp: Date.now() }));
        } catch {}
      }
    });
  }, 4500);

  server.on('error', (err: any) => {
    console.error('Server error on port ' + PORT + ':', err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server karaoke aktif di port ${PORT} (WebSocket + REST + Scraping).`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

