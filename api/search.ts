import ytSearch from 'yt-search';

export default async function handler(req: any, res: any) {
  // Set CORS headers for Vercel deployment
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = (req.query?.q || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required', songs: [] });
    }

    const r = await ytSearch(query);
    const videos = (r.videos || []).slice(0, 24).map((v: any) => ({
      id: v.videoId,
      title: v.title,
      channelTitle: v.author?.name || 'YouTube',
      thumbnailUrl: v.thumbnail || v.image || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
      duration: v.timestamp || '',
      publishedAt: v.ago || '',
      views: v.views,
      isCurated: false,
    }));

    return res.status(200).json({
      success: true,
      source: 'vercel-serverless-yt-search',
      query,
      count: videos.length,
      songs: videos,
    });
  } catch (err: any) {
    console.error('Vercel search function error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Gagal mencari video dari YouTube',
      songs: [],
    });
  }
}
