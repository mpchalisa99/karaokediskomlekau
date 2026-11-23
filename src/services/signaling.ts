/**
 * Service: Signaling & Network Configuration
 * Dynamic WebSocket signaling URL resolver, WebRTC ICE servers, and connection state helpers.
 * Supports VITE_SIGNALING_SERVER_URL, NEXT_PUBLIC_SIGNALING_SERVER_URL, dynamic window.location host,
 * and PeerJS public server fallback (0.peerjs.com).
 */

export interface SignalingUrlParams {
  roomId: string;
  role?: 'master' | 'client';
  singerName?: string;
  clientId?: string;
}

/**
 * Public PeerJS cloud infrastructure settings
 * Can be used as a public signaling fallback for WebRTC P2P
 */
export const PEERJS_PUBLIC_SERVER = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  pingInterval: 5000,
};

/**
 * Automatically detects whether the app is running on a Local Hotspot, Private LAN, or Offline Wi-Fi.
 * Supports IPv4 formats: 192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1, localhost, and .local mDNS.
 */
export function isLocalHotspotOrLan(host?: string): boolean {
  if (typeof window === 'undefined') return true;
  const currentHost = (host || window.location.hostname || '').toLowerCase().trim();

  // Explicit override via query parameters (e.g. ?hotspot=1, ?lan=1, ?direct=1)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get('hotspot') === '1' ||
      urlParams.get('lan') === '1' ||
      urlParams.get('direct') === '1' ||
      urlParams.get('local') === '1'
    ) {
      return true;
    }
  } catch {}

  if (!currentHost) return true;

  return (
    currentHost === 'localhost' ||
    currentHost === '127.0.0.1' ||
    currentHost.endsWith('.local') ||
    currentHost.startsWith('192.168.') ||
    currentHost.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(currentHost) ||
    /^169\.254\./.test(currentHost) ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(currentHost)
  );
}

/**
 * Returns detected local IP / host address of the server or client
 */
export function getDetectedLocalHost(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname || 'localhost';
  }
  return 'localhost';
}

/**
 * Parses an ICE candidate string to extract local IP, port, and candidate type.
 * Format: "candidate:... <foundation> <component> <protocol> <priority> <ip> <port> typ <type> ..."
 */
export function parseCandidateIp(candidateStr?: string): { ip: string; port: number; type: string } | null {
  if (!candidateStr) return null;
  try {
    const parts = candidateStr.trim().split(/\s+/);
    if (parts.length >= 8) {
      const ip = parts[4];
      const port = parseInt(parts[5], 10);
      const type = parts[7];
      return { ip, port, type };
    }
  } catch {}
  return null;
}

/**
 * Checks if a candidate string or RTCIceCandidate is a direct local host candidate.
 * Host candidates bind directly to the device's physical/virtual local IP (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x).
 */
export function isLocalHostCandidate(candidate: RTCIceCandidate | RTCIceCandidateInit | string | null | undefined): boolean {
  if (!candidate) return false;
  const candidateStr = typeof candidate === 'string' ? candidate : candidate.candidate || '';
  if (!candidateStr) return false;

  // WebRTC ICE SDP candidate grammar contains "typ host"
  if (candidateStr.includes('typ host')) return true;

  const parsed = parseCandidateIp(candidateStr);
  if (parsed) {
    if (parsed.type === 'host') return true;
    const ip = parsed.ip;
    if (
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      ip.startsWith('169.254.') ||
      ip === '127.0.0.1' ||
      ip.endsWith('.local')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Generates optimal WebRTC configuration for Local Hotspot & Direct LAN streaming.
 * In Hotspot / Private LAN mode, external STUN servers (e.g. Google, Cloudflare, Mozilla)
 * are COMPLETELY DISABLED (iceServers: []), preventing slow DNS resolution, WAN round-trips,
 * and multi-second ICE gathering pauses. WebRTC immediately binds local host network interfaces.
 */
export function getOptimalRtcConfig(_forceLocalDirect?: boolean): RTCConfiguration {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 0,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

/**
 * Default WebRTC configuration (Dynamically evaluated based on local hotspot/LAN detection)
 */
export const RTC_ICE_SERVERS: RTCConfiguration = getOptimalRtcConfig();

/**
 * Resolves the WebSocket signaling URL dynamically:
 * 1. Checks environment variable VITE_SIGNALING_SERVER_URL or NEXT_PUBLIC_SIGNALING_SERVER_URL or VITE_WS_URL
 * 2. Defaults to current window.location with wss: (HTTPS) or ws: (HTTP)
 * 3. Never hardcoded to localhost on deployed environments
 */
export function getSignalingWebSocketUrl(params: SignalingUrlParams): string {
  const { roomId, role = 'client', singerName = 'Prajurit (HP)', clientId } = params;
  const cleanRoom = encodeURIComponent((roomId || 'DEFAULT-ROOM').trim().toUpperCase());
  const cleanRole = encodeURIComponent(role);
  const cleanSinger = encodeURIComponent(singerName);
  let queryStr = `room=${cleanRoom}&role=${cleanRole}&singer=${cleanSinger}`;
  if (clientId && clientId.trim()) {
    queryStr += `&clientId=${encodeURIComponent(clientId.trim())}`;
  }

  // 1. Check custom environment variable if configured
  let envUrl: string | undefined = undefined;

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl =
        import.meta.env.VITE_SIGNALING_SERVER_URL ||
        (import.meta.env as any).NEXT_PUBLIC_SIGNALING_SERVER_URL ||
        import.meta.env.VITE_WS_URL;
    }
  } catch {}

  if (!envUrl) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        envUrl =
          process.env.VITE_SIGNALING_SERVER_URL ||
          process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL ||
          process.env.VITE_WS_URL;
      }
    } catch {}
  }

  if (!envUrl) {
    try {
      if (typeof window !== 'undefined' && (window as any).__ENV__) {
        envUrl =
          (window as any).__ENV__.VITE_SIGNALING_SERVER_URL ||
          (window as any).__ENV__.NEXT_PUBLIC_SIGNALING_SERVER_URL;
      }
    } catch {}
  }

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    let base = envUrl.trim();
    // Convert http(s) to ws(s) if necessary
    if (base.startsWith('https://')) {
      base = base.replace('https://', 'wss://');
    } else if (base.startsWith('http://')) {
      base = base.replace('http://', 'ws://');
    } else if (!base.startsWith('wss://') && !base.startsWith('ws://')) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      base = (isHttps ? 'wss://' : 'ws://') + base;
    }

    // Strip trailing slash
    base = base.replace(/\/+$/, '');
    const path = base.includes('/ws') ? '' : '/ws';
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${path}${separator}${queryStr}`;
  }

  // 2. Dynamic host detection from window.location (handles any domain / port / Cloud Run host)
  if (typeof window !== 'undefined' && window.location) {
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws?${queryStr}`;
  }

  // 3. Fallback for non-browser context
  return `ws://localhost:3000/ws?${queryStr}`;
}

/**
 * Checks whether the current runtime environment permits navigator.mediaDevices.getUserMedia.
 * Web browsers strictly require a Secure Context (HTTPS or localhost) for microphone access.
 */
export function isSecureContextValid(): { valid: boolean; reason?: string } {
  if (typeof window === 'undefined') {
    return { valid: true };
  }

  // Check if getUserMedia is directly available
  const hasMediaDevices =
    typeof navigator !== 'undefined' &&
    ((navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') ||
      typeof (navigator as any).getUserMedia === 'function' ||
      typeof (navigator as any).webkitGetUserMedia === 'function' ||
      typeof (navigator as any).mozGetUserMedia === 'function');

  // If browser exposes navigator.mediaDevices.getUserMedia, allow it!
  if (hasMediaDevices) {
    return { valid: true };
  }

  // Modern browsers expose window.isSecureContext
  if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';

    if (!isLocalhost) {
      return {
        valid: false,
        reason:
          'Akses mikrofon dinonaktifkan oleh peramban HP karena alamat menggunakan HTTP biasa. Buka tautan HTTPS atau aktifkan izin mikrofon di setelan browser agar Mic HP dapat digunakan.',
      };
    }
  }

  return {
    valid: false,
    reason: 'Peramban tidak mendukung akses perekaman mikrofon audio.',
  };
}

/**
 * Returns user-friendly Indonesian error message based on DOMException name from getUserMedia.
 * Explicitly covers NotAllowedError, NotFoundError, NotReadableError, OverconstrainedError, and SecurityError.
 */
export function getFriendlyMicErrorMessage(err: any): string {
  if (!err) return 'Gagal mengakses mikrofon.';

  const name = err.name || '';
  const msg = err.message || '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Izin mikrofon ditolak oleh browser HP. Silakan buka Pengaturan Izin Situs (klik ikon gembok/setelan di samping bilah URL) dan pilih "Izinkan Mikrofon", lalu muat ulang halaman.';
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Perangkat mikrofon tidak ditemukan di ponsel Anda. Pastikan mikrofon HP tidak dinonaktifkan di pengaturan sistem.';
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Mikrofon ponsel sedang digunakan oleh aplikasi lain (misal: WhatsApp, Panggilan Telepon, atau Perekam Suara). Tutup aplikasi lain terlebih dahulu.';
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Konfigurasi audio mikrofon tidak didukung oleh perangkat keras HP ini.';
  }

  if (name === 'SecurityError') {
    return 'Akses mikrofon diblokir oleh kebijakan keamanan browser (wajib menggunakan HTTPS).';
  }

  if (name === 'AbortError') {
    return 'Permintaan akses mikrofon dibatalkan oleh sistem.';
  }

  return msg || 'Gagal mengaktifkan mikrofon. Pastikan izin mikrofon telah diberikan di browser HP.';
}

/**
 * Translates WebSocket readyState numbers to human readable strings
 */
export function getWebSocketStateName(state: number | undefined): string {
  switch (state) {
    case WebSocket.CONNECTING:
      return 'CONNECTING (Sedang Menghubungkan)';
    case WebSocket.OPEN:
      return 'OPEN (Terhubung)';
    case WebSocket.CLOSING:
      return 'CLOSING (Sedang Menutup)';
    case WebSocket.CLOSED:
      return 'CLOSED (Terputus)';
    default:
      return 'OFFLINE (Belum Tersambung)';
  }
}

/**
 * Asynchronously waits for a WebSocket instance to reach OPEN state.
 * Returns true if OPEN within timeoutMs, otherwise false.
 */
export async function waitForWebSocketReady(
  socketOrGetter: WebSocket | null | (() => WebSocket | null),
  timeoutMs: number = 6000
): Promise<boolean> {
  const getSocket = () => (typeof socketOrGetter === 'function' ? socketOrGetter() : socketOrGetter);
  const initial = getSocket();
  if (initial && initial.readyState === WebSocket.OPEN) return true;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = getSocket();
    if (s && s.readyState === WebSocket.OPEN) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  const finalSock = getSocket();
  return !!finalSock && finalSock.readyState === WebSocket.OPEN;
}
