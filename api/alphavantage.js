export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { alphaVantageKey, ticker } = req.body || {};

  if (!alphaVantageKey || !ticker) {
    return res.status(400).json({ error: 'Missing alphaVantageKey or ticker.' });
  }

  const symbol = ticker.toUpperCase().trim();
  const BASE = 'https://www.alphavantage.co/query';

  try {
    /* Fetch OVERVIEW and EARNINGS in parallel (2 API calls) */
    const [overviewRes, earningsRes] = await Promise.all([
      fetch(`${BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${alphaVantageKey}`),
      fetch(`${BASE}?function=EARNINGS&symbol=${symbol}&apikey=${alphaVantageKey}`),
    ]);

    const overview = await overviewRes.json();
    const earnings = await earningsRes.json();

    /* Alpha Vantage returns a "Note" field when rate limited */
    if (overview.Note || overview['Information']) {
      return res.status(429).json({
        error: '[DIAGNOSTIC: Alpha Vantage API Rate Limit Reached (25 req/day or 5 req/min on Free Tier).] REMEDIATION: Alpha Vantage fundamental ratios will degrade gracefully until the rate window resets.',
      });
    }

    /* If the ticker isn't found, OVERVIEW returns an empty or near-empty object */
    if (!overview.Symbol && !overview.Name) {
      return res.status(200).json({
        overview: null,
        earnings: null,
      });
    }

    /* Extract the fields we care about from OVERVIEW */
    const parsedOverview = {
      symbol: overview.Symbol || symbol,
      name: overview.Name || '',
      sector: overview.Sector || '',
      industry: overview.Industry || '',
      marketCap: parseFloat(overview.MarketCapitalization) || null,
      peRatio: parseFloat(overview.PERatio) || null,
      pegRatio: parseFloat(overview.PEGRatio) || null,
      eps: parseFloat(overview.EPS) || null,
      dividendYield: parseFloat(overview.DividendYield) || null,
      profitMargin: parseFloat(overview.ProfitMargin) || null,
      revenueGrowthYoY: parseFloat(overview.QuarterlyRevenueGrowthYOY) || null,
      earningsGrowthYoY: parseFloat(overview.QuarterlyEarningsGrowthYOY) || null,
      analystTargetPrice: parseFloat(overview.AnalystTargetPrice) || null,
      fiftyTwoWeekHigh: parseFloat(overview['52WeekHigh']) || null,
      fiftyTwoWeekLow: parseFloat(overview['52WeekLow']) || null,
      beta: parseFloat(overview.Beta) || null,
      forwardPE: parseFloat(overview.ForwardPE) || null,
      returnOnEquity: parseFloat(overview.ReturnOnEquityTTM) || null,
      returnOnAssets: parseFloat(overview.ReturnOnAssetsTTM) || null,
    };

    /* Extract last 4 quarters of earnings for beat/miss tracking */
    const quarterlyEarnings = (earnings.quarterlyEarnings || [])
      .slice(0, 4)
      .map((q) => ({
        date: q.fiscalDateEnding || q.reportedDate || '',
        reportedEPS: parseFloat(q.reportedEPS) || null,
        estimatedEPS: parseFloat(q.estimatedEPS) || null,
        surprise: parseFloat(q.surprise) || null,
        surprisePercentage: parseFloat(q.surprisePercentage) || null,
      }));

    return res.status(200).json({
      overview: parsedOverview,
      earnings: quarterlyEarnings,
    });
  } catch (error) {
    return res.status(500).json({
      error: `[DIAGNOSTIC: Alpha Vantage Proxy Error — ${error.message}] REMEDIATION: Verify Vercel serverless function connectivity or check API key syntax.`,
    });
  }
}
