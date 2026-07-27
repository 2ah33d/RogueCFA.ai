import { supabase } from './supabaseClient.js';
import { normalizeAnalystName } from './_bnnScraper.js';

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawGuest = req.query.guest || '';
  if (!rawGuest) {
    return res.status(400).json({ error: 'Guest name is required.' });
  }

  const cleanGuest = normalizeAnalystName(rawGuest);

  try {
    const { data: rows, error } = await supabase
      .from('analyst_track_record')
      .select('*')
      .ilike('analyst_name', `%${cleanGuest}%`)
      .order('pick_publish_date', { ascending: false });

    if (error) {
      console.warn('[analyst-record] Database query error:', error.message);
      /* Graceful fallback: return 200 with no_track_record so UI doesn't crash on Supabase RLS permission errors */
      return res.status(200).json({
        status: 'no_track_record',
        guestName: rawGuest,
        cleanGuest,
        message: `Database permission notice: ${error.message}`,
        picks: [],
        credibilityScore: null,
        hitRate: null,
      });
    }

    let activeRows = rows || [];

    if (activeRows.length < 9) {
      /* Dynamic On-Demand Scraper: Fetch additional BNN Bloomberg past picks articles to fill 9-pick sample */
      try {
        const { searchBnnPastPicks, parseBnnPastPicksArticle } = await import('./_bnnScraper.js');
        const articles = await searchBnnPastPicks(cleanGuest, 10);

        if (articles && articles.length > 0) {
          const scrapedRows = [];
          for (const article of articles) {
            try {
              const response = await fetch(article.url, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
                signal: AbortSignal.timeout(8000),
              });
              if (!response.ok) continue;
              const html = await response.text();
              const parsed = parseBnnPastPicksArticle(html, article.url, cleanGuest);
              if (parsed && parsed.length > 0) {
                scrapedRows.push(...parsed);
              }
            } catch (artErr) {
              console.warn(`[analyst-record] Article scrape warning (${article.url}):`, artErr.message);
            }
          }

          if (scrapedRows.length > 0) {
            /* Upsert scraped rows into Supabase */
            const { data: inserted, error: insertErr } = await supabase
              .from('analyst_track_record')
              .upsert(scrapedRows, {
                onConflict: 'analyst_name, ticker, pick_publish_date',
                ignoreDuplicates: true,
              })
              .select();

            if (!insertErr && inserted && inserted.length > 0) {
              activeRows = inserted;
            } else {
              activeRows = scrapedRows;
            }
          }
        }
      } catch (csErr) {
        console.warn('[analyst-record] Inline cold-start error:', csErr.message);
      }
    }

    if (!activeRows || activeRows.length === 0) {
      return res.status(200).json({
        status: 'no_track_record',
        guestName: rawGuest,
        cleanGuest,
        message: 'No track record recorded yet for this analyst.',
        picks: [],
        credibilityScore: null,
        hitRate: null,
        avgAlpha: null,
      });
    }

    /* ── Calculate Benchmark-Adjusted Alpha & Bayesian Shrinkage ── */
    const TSX_BENCHMARK_RETURN = 10.0; // ~1-year S&P/TSX Composite baseline return
    const SP500_BENCHMARK_RETURN = 12.0; // ~1-year S&P 500 baseline return

    let totalAlpha = 0;
    let hitCount = 0;
    let totalReturnSum = 0;

    const evaluatedPicks = activeRows.map((pick) => {
      const isCanadian = pick.ticker.endsWith('.TO') || pick.ticker.endsWith('.V') || pick.ticker.endsWith('.CN');
      const benchmarkReturn = isCanadian ? TSX_BENCHMARK_RETURN : SP500_BENCHMARK_RETURN;

      const rawAlpha = (pick.total_return_pct ?? pick.return_pct ?? 0) - benchmarkReturn;
      /* Winsorize alpha at ±50pp */
      const winsorizedAlpha = Math.max(-50, Math.min(50, rawAlpha));

      if (winsorizedAlpha > 0) hitCount++;
      totalAlpha += winsorizedAlpha;
      totalReturnSum += (pick.total_return_pct ?? pick.return_pct ?? 0);

      return {
        id: pick.id,
        ticker: pick.ticker,
        companyName: pick.company_name,
        thenPrice: pick.then_price,
        nowPrice: pick.now_price,
        returnPct: pick.return_pct,
        totalReturnPct: pick.total_return_pct,
        reviewDate: pick.pick_publish_date,
        sourceUrl: pick.source_article_url,
        benchmarkReturn,
        benchmarkAlpha: Number(winsorizedAlpha.toFixed(2)),
        isBeatBenchmark: winsorizedAlpha > 0,
      };
    });

    const n = evaluatedPicks.length;
    const hitRate = Number((hitCount / n).toFixed(2));
    const avgAlpha = Number((totalAlpha / n).toFixed(2));
    const avgTotalReturn = Number((totalReturnSum / n).toFixed(2));

    /* ── Formula: raw_score = 0.40 * hit_rate_score + 0.60 * alpha_score ──
       Hit rate score: 0% -> 0, 50% -> 50, 100% -> 100
       Alpha score: -20pp -> 0, 0pp -> 50, +20pp -> 100
    */
    const hitRateScore = Math.max(0, Math.min(100, hitRate * 100));
    const alphaScore = Math.max(0, Math.min(100, 50 + (avgAlpha * 2.5)));
    const rawScore = (0.40 * hitRateScore) + (0.60 * alphaScore);

    /* ── Bayesian Shrinkage toward cross-analyst pool mean (pool_avg = 50.0, k = 6) ── */
    const k = 6;
    const poolAvg = 50.0;
    const credibilityScore = Number((((n / (n + k)) * rawScore) + ((k / (n + k)) * poolAvg)).toFixed(1));

    /* ── Persist score globally in Supabase analyst_scores table for all users ── */
    try {
      await supabase
        .from('analyst_scores')
        .upsert(
          {
            analyst_name: cleanGuest,
            credibility_score: Math.round(credibilityScore),
            hit_rate: hitRate,
            avg_alpha: avgAlpha,
            total_picks: n,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'analyst_name' }
        );
    } catch (upsertErr) {
      console.warn('[analyst-record] Supabase analyst_scores upsert notice:', upsertErr.message);
    }

    return res.status(200).json({
      status: 'success',
      guestName: rawGuest,
      cleanGuest,
      totalPicks: n,
      hitRate,
      hitCount,
      avgAlpha,
      avgTotalReturn,
      rawScore: Number(rawScore.toFixed(1)),
      credibilityScore,
      picks: evaluatedPicks,
    });
  } catch (err) {
    console.error('[analyst-record] Exception:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
