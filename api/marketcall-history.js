import { supabase } from './supabaseClient.js';

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    /* Fetch complete, non-debug digests ordered by episode_date descending */
    const { data, error, count } = await supabase
      .from('digest_jobs')
      .select('id, episode_date, video_id, video_title, result, created_at, updated_at', { count: 'exact' })
      .eq('status', 'complete')
      .eq('is_debug', false)
      .not('result', 'is', null)
      .order('episode_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[marketcall-history] Database error:', error.message);
      return res.status(500).json({ error: `Database error: ${error.message}` });
    }

    const history = (data || []).map((row) => ({
      id: row.id,
      episodeDate: row.episode_date,
      videoId: row.video_id,
      videoTitle: row.video_title,
      digest: row.result?.digest || null,
      generatedAt: row.result?.generatedAt || row.updated_at || row.created_at,
    }));

    return res.status(200).json({
      count: count || history.length,
      limit,
      offset,
      history,
    });
  } catch (err) {
    console.error('[marketcall-history] Handler exception:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
