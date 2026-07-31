import { supabase } from './_supabaseClient.js';
import {
  normalizeAnalystName,
  searchBnnPastPicks,
  parseBnnPastPicksArticle,
} from './_bnnScraper.js';

export const config = { maxDuration: 60 };

const COLDSTART_ARTICLE_LIMIT = parseInt(process.env.COLDSTART_ARTICLE_LIMIT || '3', 10);

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const analystRaw =
    req.method === 'POST' ? req.body?.analyst : req.query?.analyst;

  if (!analystRaw) {
    return res.status(400).json({ error: 'Analyst name is required.' });
  }

  const cleanName = normalizeAnalystName(analystRaw);
  if (!cleanName) {
    return res.status(400).json({ error: 'Invalid analyst name.' });
  }

  try {
    /* Step 1: Check if analyst already has records in analyst_track_record */
    const { count: existingCount, error: countErr } = await supabase
      .from('analyst_track_record')
      .select('id', { count: 'exact', head: true })
      .ilike('analyst_name', `%${cleanName}%`);

    if (!countErr && existingCount && existingCount > 0) {
      return res.status(200).json({
        status: 'already_exists',
        analyst: cleanName,
        existingRows: existingCount,
        message: `Analyst "${cleanName}" already has ${existingCount} tracked pick(s).`,
      });
    }

    /* Step 2: Cold-Start Search — fetch recent past picks articles from BNN via Queryly */
    const articles = await searchBnnPastPicks(cleanName, COLDSTART_ARTICLE_LIMIT);

    if (!articles || articles.length === 0) {
      return res.status(200).json({
        status: 'no_articles_found',
        analyst: cleanName,
        rowsInserted: 0,
        message: `No BNN past-picks review articles found for analyst "${cleanName}".`,
      });
    }

    let totalRowsInserted = 0;
    const processedArticles = [];

    /* Step 3: Scrape and parse each article */
    for (const article of articles) {
      try {
        const response = await fetch(article.url, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) continue;
        const html = await response.text();

        const rows = parseBnnPastPicksArticle(html, article.url, cleanName);

        if (rows && rows.length > 0) {
          /* Dedup upsert into analyst_track_record */
          const { data: inserted, error: insertErr } = await supabase
            .from('analyst_track_record')
            .upsert(rows, {
              onConflict: 'analyst_name, ticker, pick_publish_date',
              ignoreDuplicates: true,
            })
            .select();

          if (insertErr) {
            console.warn(`[analyst-coldstart] Insert error for ${article.url}:`, insertErr.message);
          } else {
            const count = inserted ? inserted.length : rows.length;
            totalRowsInserted += count;
            processedArticles.push({ url: article.url, rowsParsed: rows.length, inserted: count });
          }
        }
      } catch (articleErr) {
        console.warn(`[analyst-coldstart] Article fetch failed (${article.url}):`, articleErr.message);
      }
    }

    return res.status(200).json({
      status: 'success',
      analyst: cleanName,
      articlesFound: articles.length,
      articlesProcessed: processedArticles.length,
      rowsInserted: totalRowsInserted,
      details: processedArticles,
    });
  } catch (err) {
    console.error('[analyst-coldstart] Exception:', err);
    return res.status(500).json({
      status: 'error',
      analyst: cleanName,
      error: err.message,
    });
  }
}
