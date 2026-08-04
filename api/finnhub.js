export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { finnhubKey: bodyKey, ticker } = req.body || {};
  const finnhubKey = bodyKey || process.env.FINNHUB_KEY || process.env.VITE_FINNHUB_KEY;

  if (!finnhubKey || !ticker) {
    return res.status(400).json({ error: 'Missing Finnhub API key or ticker symbol.' });
  }

  const symbol = ticker.toUpperCase().trim().replace(/\.(TO|TSX)$/i, '');
  const BASE = 'https://finnhub.io/api/v1';

  /* Date range for company news — last 30 days */
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const toDate = today.toISOString().split('T')[0];
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

  const fetchWithTimeout = (url, timeoutMs = 6000) =>
    fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);

  try {
    /* ── Fetch essential endpoints (profile2 & quote) and secondary endpoints with timeout protection ── */
    const results = await Promise.allSettled([
      fetchWithTimeout(`${BASE}/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
      fetchWithTimeout(`${BASE}/quote?symbol=${symbol}&token=${finnhubKey}`),
      fetchWithTimeout(`${BASE}/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
      fetchWithTimeout(
        `${BASE}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`
      ),
      fetchWithTimeout(`${BASE}/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`),
    ]);

    const profileRes = results[0]?.value;
    const quoteRes = results[1]?.value;
    const recRes = results[2]?.value;
    const newsRes = results[3]?.value;
    const metricRes = results[4]?.value;

    /* ── Auth / rate-limit errors ── */
    if (profileRes && (profileRes.status === 401 || profileRes.status === 403)) {
      return res.status(401).json({
        error: '[DIAGNOSTIC: Invalid or Unauthorized Finnhub API Key (HTTP 401/403).] REMEDIATION: Open Settings (gear icon at top right) and verify your Finnhub API key string or add FINNHUB_KEY in Vercel.',
      });
    }
    if (profileRes && profileRes.status === 429) {
      return res.status(429).json({
        error: '[DIAGNOSTIC: Finnhub API Rate Limit Exceeded (HTTP 429).] REMEDIATION: Finnhub free tier allows 60 requests per minute. Please wait 30-60 seconds before scoring more tickers.',
      });
    }

    const profile = profileRes?.ok ? await profileRes.json().catch(() => null) : null;
    const quote = quoteRes?.ok ? await quoteRes.json().catch(() => ({})) : {};
    const recommendation = recRes?.ok ? await recRes.json().catch(() => []) : [];
    const news = newsRes?.ok ? await newsRes.json().catch(() => []) : [];
    const metricData = metricRes?.ok ? await metricRes.json().catch(() => ({})) : {};

    /* ── Validate ticker exists ── */
    if (!profile || !profile.ticker) {
      return res.status(404).json({
        error: `[DIAGNOSTIC: Ticker "${symbol}" returned no profile from Finnhub.] REMEDIATION: Verify the ticker symbol spelling. If searching a Canadian asset, toggle the 'TSX-First (.TO)' checkbox or explicitly append .TO / .V.`,
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
      error: `[DIAGNOSTIC: Finnhub Proxy Network Error — ${error.message}] REMEDIATION: Check your network connection or verify Vercel serverless function connectivity.`,
    });
  }
}
