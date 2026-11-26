import fs from 'fs';
import path from 'path';

function splitTtsChunks(text: string, maxLen = 180): string[] {
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
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawText = String(req.query?.text || req.query?.q || 'Selamat bernyanyi di Karaoke Diskomlekau!').trim();
  const tier = String(req.query?.tier || 'manual').trim();
  const chunks = splitTtsChunks(rawText, 200);

  try {
    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        try {
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&ttsspeed=1&q=${encodeURIComponent(chunk)}`;
          const upstream = await fetch(ttsUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Referer: 'https://translate.google.com/',
            },
          });
          if (upstream.ok) {
            const arrBuf = await upstream.arrayBuffer();
            if (arrBuf.byteLength > 256) {
              return Buffer.from(arrBuf);
            }
          }
        } catch {
          // Abaikan chunk gagal
        } finally {
          clearTimeout(timer);
        }
        return null;
      })
    );

    const audioBuffers = chunkResults.filter((buf): buf is NonNullable<typeof buf> => buf !== null);

    if (audioBuffers.length > 0) {
      const combined = Buffer.concat(audioBuffers);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', String(combined.length));
      return res.status(200).send(combined);
    }
  } catch (err) {
    console.warn('[Vercel TTS] Upstream TTS unavailable, using local fallback:', err);
  }

  // Fallback ke file MP3 lokal di public/sounds jika TTS eksternal gagal
  const fallbackFile =
    tier === 'high'
      ? 'mc-high.mp3'
      : tier === 'medium'
      ? 'mc-medium.mp3'
      : tier === 'low'
      ? 'mc-low.mp3'
      : 'mc-pantun.mp3';

  const candidates = [
    path.resolve(process.cwd(), 'public', 'sounds', fallbackFile),
    path.resolve(process.cwd(), 'public', 'sounds', 'mc-pantun.mp3'),
    path.resolve(process.cwd(), 'public', 'sounds', 'cheer.mp3'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Length', String(buf.length));
      return res.status(200).send(buf);
    }
  }

  return res.status(404).json({ success: false, error: 'TTS audio tidak tersedia' });
}
