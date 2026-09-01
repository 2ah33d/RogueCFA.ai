export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    verdict: 'MAINTENANCE',
    summary: "sorry, we're still working on this part of the website",
    message: "sorry, we're still working on this part of the website",
    result: {
      thesis: "sorry, we're still working on this part of the website",
      sentiment_summary: "sorry, we're still working on this part of the website",
      timeframe_verdict: "MAINTENANCE",
      key_risks: [],
      key_catalysts: [],
      watch_for: "Feature under active development.",
    },
  });
}
