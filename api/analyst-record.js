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

    /* ── Calculate Benchmark-Adjusted Alpha, Time-Decay & Unique Position Clustering ── */
    const TSX_BENCHMARK_RETURN = 10.0;
    const SP500_BENCHMARK_RETURN = 12.0;
    const nowMs = Date.now();

    const tickerClusters = new Map();
    const episodeDatesSet = new Set();

    let weightedHitSum = 0;
    let weightedAlphaSum = 0;
    let totalWeightSum = 0;
    let totalReturnSum = 0;
    let rawHitCount = 0;

    const evaluatedPicks = activeRows.map((pick) => {
      const reviewDateStr = pick.pick_publish_date || new Date().toISOString().split('T')[0];
      if (reviewDateStr) episodeDatesSet.add(reviewDateStr);

      const isCanadian = pick.ticker.endsWith('.TO') || pick.ticker.endsWith('.V') || pick.ticker.endsWith('.CN');
      const benchmarkReturn = isCanadian ? TSX_BENCHMARK_RETURN : SP500_BENCHMARK_RETURN;

      const rawReturn = pick.total_return_pct ?? pick.return_pct ?? 0;
      const rawAlpha = rawReturn - benchmarkReturn;
      const winsorizedAlpha = Math.max(-50, Math.min(50, rawAlpha));
      const isBeatBenchmark = winsorizedAlpha > 0;

      if (isBeatBenchmark) rawHitCount++;
      totalReturnSum += rawReturn;

      /* Time-decay: e^(-0.15 * yearsAgo) — 2026 picks weighted ~1.0, 2020 picks weighted ~0.37 */
      const reviewMs = new Date(reviewDateStr).getTime();
      const yearsAgo = Math.max(0, (nowMs - (isNaN(reviewMs) ? nowMs : reviewMs)) / (365.25 * 86400 * 1000));
      const weight = Math.exp(-0.15 * yearsAgo);

      weightedHitSum += (isBeatBenchmark ? 1 : 0) * weight;
      weightedAlphaSum += winsorizedAlpha * weight;
      totalWeightSum += weight;

      /* Cluster by normalized ticker */
      const normTicker = pick.ticker.toUpperCase().replace(/\-(U|UN)$/i, '-U.TO');
      if (!tickerClusters.has(normTicker)) {
        tickerClusters.set(normTicker, []);
      }
      tickerClusters.get(normTicker).push(pick);

      return {
        id: pick.id,
        ticker: pick.ticker,
        companyName: pick.company_name,
        thenPrice: pick.then_price,
        nowPrice: pick.now_price,
        returnPct: pick.return_pct,
        totalReturnPct: pick.total_return_pct,
        reviewDate: reviewDateStr,
        sourceUrl: pick.source_article_url,
        benchmarkReturn,
        benchmarkAlpha: Number(winsorizedAlpha.toFixed(2)),
        isBeatBenchmark,
        weight: Number(weight.toFixed(2)),
      };
    });

    const nTotal = evaluatedPicks.length;
    const uniquePositionsCount = tickerClusters.size;
    const totalEpisodesCount = episodeDatesSet.size || 1;

    /* Effective independent sample size N_eff based on unique position clusters */
    const nEff = uniquePositionsCount;

    /* Weighted metrics vs raw metrics */
    const weightedHitRate = totalWeightSum > 0 ? Number((weightedHitSum / totalWeightSum).toFixed(2)) : Number((rawHitCount / nTotal).toFixed(2));
    const weightedAvgAlpha = totalWeightSum > 0 ? Number((weightedAlphaSum / totalWeightSum).toFixed(2)) : 0;
    const rawHitRate = Number((rawHitCount / nTotal).toFixed(2));
    const avgTotalReturn = Number((totalReturnSum / nTotal).toFixed(2));

    /* ── Raw Score Formula ──
       Hit rate score (40%): weightedHitRate * 100
       Alpha score (60%): 50 + (weightedAvgAlpha * 2.5)
    */
    const hitRateScore = Math.max(0, Math.min(100, weightedHitRate * 100));
    const alphaScore = Math.max(0, Math.min(100, 50 + (weightedAvgAlpha * 2.5)));
    const rawScore = (0.40 * hitRateScore) + (0.60 * alphaScore);

    /* ── Empirical Bayes Shrinkage (population mean = 55.0, k = 4.5) ── */
    const k = 4.5;
    const empiricalPoolMean = 55.0;
    const credibilityScore = Number((((nEff / (nEff + k)) * rawScore) + ((k / (nEff + k)) * empiricalPoolMean)).toFixed(1));

    /* ── Persist score globally in Supabase analyst_scores table for all users ── */
    try {
      await supabase
        .from('analyst_scores')
        .upsert(
          {
            analyst_name: cleanGuest,
            credibility_score: Math.round(credibilityScore),
            hit_rate: weightedHitRate,
            avg_alpha: weightedAvgAlpha,
            total_picks: nTotal,
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
      totalPicks: nTotal,
      uniquePositionsCount,
      totalEpisodesCount,
      hitRate: weightedHitRate,
      rawHitRate,
      hitCount: rawHitCount,
      avgAlpha: weightedAvgAlpha,
      avgTotalReturn,
      rawScore: Number(rawScore.toFixed(1)),
      credibilityScore,
      dataSummaryText: `Based on latest ${nTotal} past picks (${uniquePositionsCount} unique positions) across ${totalEpisodesCount} BNN episode${totalEpisodesCount > 1 ? 's' : ''}`,
      picks: evaluatedPicks,
    });
  } catch (err) {
    console.error('[analyst-record] Exception:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
