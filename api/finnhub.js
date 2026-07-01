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

  const symbol = ticker.toUpperCase().trim();
  const BASE = 'https://finnhub.io/api/v1';

  /* Date range for company news — last 30 days */
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const toDate = today.toISOString().split('T')[0];
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

  try {
    const [profileRes, quoteRes, recRes, newsRes] = await Promise.all([
      fetch(`${BASE}/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`${BASE}/quote?symbol=${symbol}&token=${finnhubKey}`),
      fetch(`${BASE}/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
      fetch(
        `${BASE}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`
      ),
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

    const [profile, quote, recommendation, news] = await Promise.all([
      profileRes.json(),
      quoteRes.json(),
      recRes.json(),
      newsRes.json(),
    ]);

    /* ── Validate ticker exists ── */
    if (!profile || !profile.ticker) {
      return res.status(404).json({
        error: `Ticker "${symbol}" not recognized. Try the exchange-qualified symbol (e.g., SHOP for NYSE, SHOP.TO for TSX).`,
      });
    }

    return res.status(200).json({
      profile,
      quote,
      recommendation: Array.isArray(recommendation) ? recommendation : [],
      news: Array.isArray(news) ? news.slice(0, 20) : [],
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to fetch Finnhub data: ${error.message}`,
    });
  }
}
