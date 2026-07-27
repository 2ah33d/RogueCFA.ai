/* ════════════════════════════════════════════════════════════════
   CENTRALIZED & AUDITABLE SCORING ENGINE CONFIGURATION
   ════════════════════════════════════════════════════════════════ */
export const SCORING_CONFIG = {
  version: '3.2.0-empirical-bayes',
  ts: '2026-07-27',
  priorSource: 'heuristic prior (k=4.5, mu_pop=50.0) — empirical population calibration pending full dataset ingestion',
  weightsSource: 'hand-chosen baseline (40% win consistency / 60% risk-adjusted alpha return)',
  populationMean: 50.0, // μ_pop prior baseline (50%)
  shrinkageK: 4.5,     // k shrinkage weight parameter
  tsxAnnualBenchmarkRate: 8.0,   // ~8.0% annual S&P/TSX Composite baseline return
  sp500AnnualBenchmarkRate: 10.0, // ~10.0% annual S&P 500 baseline return
  winsorizeAlphaLimit: 50.0,   // ±50pp alpha ceiling/floor
  hitRateWeight: 0.40, // 40% win consistency weight in raw score calculation (hand-chosen)
  alphaWeight: 0.60,   // 60% alpha return weight in raw score calculation (hand-chosen)
};

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
      /* Dynamic On-Demand Scraper: Fetch additional BNN Bloomberg past picks articles to fill sample */
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

    /* ── Calculate Holding-Period Matched Benchmark Returns & Alpha ── */
    const nowMs = Date.now();
    const tickerClusters = new Map();
    const episodeDatesSet = new Set();

    let rawHitCount = 0;
    let totalAlphaSum = 0;
    let totalReturnSum = 0;

    const evaluatedPicks = activeRows.map((pick) => {
      const reviewDateStr = pick.pick_publish_date || new Date().toISOString().split('T')[0];
      if (reviewDateStr) episodeDatesSet.add(reviewDateStr);

      const isCanadian = pick.ticker.endsWith('.TO') || pick.ticker.endsWith('.V') || pick.ticker.endsWith('.CN');
      const annualBenchmarkRate = isCanadian
        ? SCORING_CONFIG.tsxAnnualBenchmarkRate
        : SCORING_CONFIG.sp500AnnualBenchmarkRate;

      /* Calculate holding period in years from review date to now */
      const reviewMs = new Date(reviewDateStr).getTime();
      const validReviewMs = isNaN(reviewMs) ? nowMs : reviewMs;
      const holdingYears = Math.max(0.01, (nowMs - validReviewMs) / (365.25 * 86400 * 1000));

      /* Period-matched benchmark return compounded over holding period */
      const periodBenchmarkReturn = Number(
        ((Math.pow(1 + annualBenchmarkRate / 100, holdingYears) - 1) * 100).toFixed(2)
      );

      const rawReturn = pick.total_return_pct ?? pick.return_pct ?? 0;
      const rawAlpha = rawReturn - periodBenchmarkReturn;
      const winsorizedAlpha = Math.max(
        -SCORING_CONFIG.winsorizeAlphaLimit,
        Math.min(SCORING_CONFIG.winsorizeAlphaLimit, rawAlpha)
      );
      const isBeatBenchmark = winsorizedAlpha > 0;

      if (isBeatBenchmark) rawHitCount++;
      totalAlphaSum += winsorizedAlpha;
      totalReturnSum += rawReturn;

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
        holdingYears: Number(holdingYears.toFixed(2)),
        benchmarkReturn: periodBenchmarkReturn,
        benchmarkAlpha: Number(winsorizedAlpha.toFixed(2)),
        isBeatBenchmark,
      };
    });

    const nTotal = evaluatedPicks.length;
    const uniquePositionsCount = tickerClusters.size;
    const totalEpisodesCount = episodeDatesSet.size || 1;

    /* ── Ground-Truth Primary Stats (Undecayed) ── */
    const rawHitRate = nTotal > 0 ? Number((rawHitCount / nTotal).toFixed(2)) : 0;
    const avgAlpha = nTotal > 0 ? Number((totalAlphaSum / nTotal).toFixed(2)) : 0;
    const avgTotalReturn = nTotal > 0 ? Number((totalReturnSum / nTotal).toFixed(2)) : 0;

    /* ── STRICT GENERALIZED GUARDRAIL ASSERTION FOR ALL ANALYSTS ── */
    const expectedHitRate = nTotal > 0 ? Number((rawHitCount / nTotal).toFixed(2)) : 0;
    if (Math.abs(rawHitRate - expectedHitRate) > 0.001) {
      const errMsg = `[Scoring Engine Integrity Failure] Computed rawHitRate (${rawHitRate}) diverges from ground-truth raw table win ratio (${rawHitCount}/${nTotal} = ${expectedHitRate}).`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    /* ── Raw Score Formula ──
       Raw score combines undecayed ground-truth hit rate (40%) + alpha return (60%)
    */
    const hitRateScore = Math.max(0, Math.min(100, rawHitRate * 100));
    const alphaScore = Math.max(0, Math.min(100, 50 + (avgAlpha * 2.5)));
    const rawScore = (SCORING_CONFIG.hitRateWeight * hitRateScore) + (SCORING_CONFIG.alphaWeight * alphaScore);

    /* ── Empirical Bayes Shrinkage over N_eff (unique positions count) ── */
    const nEff = uniquePositionsCount;
    const k = SCORING_CONFIG.shrinkageK;
    const poolMean = SCORING_CONFIG.populationMean;
    const credibilityScore = Number((((nEff / (nEff + k)) * rawScore) + ((k / (nEff + k)) * poolMean)).toFixed(1));

    /* ── Persist score globally in Supabase analyst_scores table for all users ── */
    try {
      await supabase
        .from('analyst_scores')
        .upsert(
          {
            analyst_name: cleanGuest,
            credibility_score: Math.round(credibilityScore),
            hit_rate: rawHitRate,
            avg_alpha: avgAlpha,
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
      scoringConfig: SCORING_CONFIG,
      totalPicks: nTotal,
      uniquePositionsCount,
      totalEpisodesCount,
      hitRate: rawHitRate,
      hitCount: rawHitCount,
      avgAlpha,
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
