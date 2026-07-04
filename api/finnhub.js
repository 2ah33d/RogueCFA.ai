export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { finnhubKey, ticker } = req.body || {};

  if (!finnhubKey || !ticker) {
    return res.status(400).json({ error: 'Missing finnhubKey or ticker.' });
  }

  const symbol = ticker.toUpperCase().trim().replace(/\.(TO|TSX)$/i, '');
  const BASE = 'https://finnhub.io/api/v1';

  /* Date range for company news — last 30 days */
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const toDate = today.toISOString().split('T')[0];
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

  try {
    const [profileRes, quoteRes, recRes, newsRes, metricRes] = await Promise.all([
      fetch(`${BASE}/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`${BASE}/quote?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`${BASE}/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
      fetch(
        `${BASE}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`
      ),
      fetch(`${BASE}/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`),
    ]);

    /* ── Auth / rate-limit errors (check first response as proxy) ── */
    if (profileRes.status === 401 || profileRes.status === 403) {
      return res.status(401).json({
        error: 'Invalid Finnhub API key. Check your key in Settings.',
      });
    }
    if (profileRes.status === 429) {
      return res.status(429).json({
        error: 'Finnhub rate limit hit. Wait 60 seconds and retry.',
      });
    }

    const [profile, quote, recommendation, news, metricData] = await Promise.all([
      profileRes.json(),
      quoteRes.json(),
      recRes.json(),
      newsRes.json(),
      metricRes.json().catch(() => ({})),
    ]);

    /* ── Validate ticker exists ── */
    if (!profile || !profile.ticker) {
      return res.status(404).json({
        error: `Ticker "${symbol}" not recognized. Try the exchange-qualified symbol (e.g., SHOP for NYSE, SHOP.TO for TSX).`,
      });
    }

    /* Attach true 52-week high/low from metric to quote.h52 and quote.l52 without falling back to intraday prices or date strings */
    const h52Val = parseFloat(quote?.h52 ?? metricData?.metric?.['52WeekHigh']);
    const l52Val = parseFloat(quote?.l52 ?? metricData?.metric?.['52WeekLow']);
    const h52 = !isNaN(h52Val) && h52Val > 0 ? h52Val : null;
    const l52 = !isNaN(l52Val) && l52Val > 0 ? l52Val : null;

    return res.status(200).json({
      profile,
      quote: {
        ...quote,
        h52,
        l52,
      },
      recommendation: Array.isArray(recommendation) ? recommendation : [],
      news: Array.isArray(news) ? news.slice(0, 20) : [],
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to fetch Finnhub data: ${error.message}`,
    });
  }
}
