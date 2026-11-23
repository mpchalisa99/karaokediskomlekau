/**
 * Service: PeerJS Manager
 * Enables direct P2P connection between TV (Master) and HP (Remote/Mic)
 * utilizing PeerJS cloud public signaling (0.peerjs.com) without requiring a backend WebSocket server.
 * Works seamlessly on serverless platforms (Vercel, Netlify, Cloud Run, static hosts).
 */

import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import type { Song, QueueItem } from '../types/karaoke';

export type PeerAction =
  | 'PLAY'
  | 'PAUSE'
  | 'NEXT_SONG'
  | 'SELECT_SONG'
  | 'SET_VOLUME'
  | 'SET_MUSIC_VOLUME'
  | 'ADD_QUEUE'
  | 'REMOVE_QUEUE'
  | 'REORDER_QUEUE'
  | 'PLAY_SOUND_FX'
  | 'MIC_PARAMS'
  | 'STATUS_UPDATE'
  | 'SET_MUSIC_DELAY'
  | 'SUBMIT_JURY_SCORE'
  | 'SYNC_JURY_SCORES'
  | 'TRIGGER_SMART_MC';

export interface PeerMessage {
  action: PeerAction;
  nowPlaying?: string;
  isPlaying?: boolean;
  currentTime?: number;
  song?: Song | null;
  queue?: QueueItem[];
  clientCount?: number;
  payload?: any;
  senderName?: string;
  senderId?: string;
  timestamp?: number;
}

/**
 * Normalizes Room ID to a valid PeerJS ID string (alphanumeric and hyphens only)
 * Example: "ROOM-5839" -> "karaoke-room-ROOM-5839"
 */
export function getTvPeerId(roomId: string): string {
  const clean = (roomId || 'ROOM-1001')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  return `karaoke-room-${clean}`;
}

/**
 * Generates unique client Peer ID for HP remote
 */
export function getClientPeerId(roomId: string): string {
  const clean = (roomId || 'default-room')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 12);
  const rand = Math.random().toString(36).substring(2, 7);
  return `karaoke-hp-${clean}-${Date.now().toString(36).slice(-4)}-${rand}`;
}

import { isLocalHotspotOrLan } from './signaling';

/**
 * PeerJS configuration.
 * When on Local Hotspot / Private LAN, STUN servers are eliminated (iceServers: [])
 * to enforce direct local host-to-host connectivity without public WAN delays.
 */
export function getPeerConfig(): any {
  // Allow custom peer server if configured via env vars
  let customHost: string | undefined;
  let customPort: number | undefined;
  let customPath: string | undefined;

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      customHost = import.meta.env.VITE_PEER_HOST;
      customPort = import.meta.env.VITE_PEER_PORT ? parseInt(import.meta.env.VITE_PEER_PORT, 10) : undefined;
      customPath = import.meta.env.VITE_PEER_PATH;
    }
  } catch {}

  const isLocal = isLocalHotspotOrLan();

  return {
    host: customHost || '0.peerjs.com',
    port: customPort || 443,
    path: customPath || '/',
    secure: true,
    debug: 0, // 0 suppresses PeerJS internal console.error logger for transient socket drops
    config: {
      // In local hotspot / LAN mode: strictly 0 external STUN servers for direct local candidates
      iceServers: isLocal
        ? []
        : [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    },
  };
}

/**
 * Sends a periodic heartbeat to prevent PeerJS cloud server (0.peerjs.com)
 * from timing out idle WebSocket connections.
 */
export function startPeerHeartbeat(peer: Peer): () => void {
  const timer = setInterval(() => {
    if (peer && !peer.destroyed) {
      try {
        const socket = (peer as any).socket;
        if (socket && typeof socket.send === 'function') {
          socket.send({ type: 'HEARTBEAT' });
        }
      } catch {}
    }
  }, 15000);

  return () => clearInterval(timer);
}

/**
 * Safely creates a new Peer instance with error suppression for expected ID collisions
 */
export function createPeer(id?: string): Peer {
  const config = getPeerConfig();
  if (id) {
    return new Peer(id, config);
  }
  return new Peer(config);
}

export type { DataConnection, MediaConnection };
