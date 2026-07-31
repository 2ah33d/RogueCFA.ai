import { supabase } from './_supabaseClient.js';

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

    /* ── Automated 30-Day Retention Pruning: Delete summaries older than 30 days ── */
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      supabase
        .from('digest_jobs')
        .delete()
        .lt('episode_date', cutoffDate)
        .then(({ error: pruneErr }) => {
          if (pruneErr) console.warn('[marketcall-history] 30-day retention cleanup error:', pruneErr.message);
        });
    } catch {
      /* ignore */
    }

    /* Fetch complete digests ordered by episode_date descending, then created_at descending */
    const { data, error } = await supabase
      .from('digest_jobs')
      .select('id, episode_date, video_id, video_title, result, created_at, updated_at')
      .eq('status', 'complete')
      .not('result', 'is', null)
      .order('episode_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[marketcall-history] Database error:', error.message);
      return res.status(500).json({ error: `Database error: ${error.message}` });
    }

    /* Deduplicate by episode_date so each BNN episode date appears exactly once in chronological order */
    const seenDates = new Set();
    const uniqueHistory = [];

    for (const row of data || []) {
      const dateKey = row.episode_date || row.result?.episodeDate || 'unknown';

      /* Filter out weekend dates (MarketCall only airs Monday-Friday) */
      if (dateKey && dateKey !== 'unknown') {
        const dateObj = new Date(`${dateKey}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip 0 (Sun) & 6 (Sat)
      }

      /* Filter out malformed phonetic mishearings from prior Whisper runs */
      const guestName = (row.result?.digest?.guest || '').toLowerCase();
      if (guestName.includes('nono-wamden') || guestName.includes('nono wamden')) {
        continue;
      }

      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        uniqueHistory.push({
          id: row.id,
          episodeDate: dateKey,
          videoId: row.video_id || row.result?.videoId,
          videoTitle: row.video_title || row.result?.videoTitle,
          digest: row.result?.digest || null,
          generatedAt: row.result?.generatedAt || row.updated_at || row.created_at,
        });
      }
    }

    const paginated = uniqueHistory.slice(offset, offset + limit);

    return res.status(200).json({
      count: uniqueHistory.length,
      limit,
      offset,
      history: paginated,
    });
  } catch (err) {
    console.error('[marketcall-history] Handler exception:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
