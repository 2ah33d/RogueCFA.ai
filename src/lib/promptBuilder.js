/* ────────────────────────────────────────────
   Hold-period definitions
   ──────────────────────────────────────────── */
export const HOLD_PERIODS = {
  '1M': { label: '1 Month', category: 'short' },
  '3M': { label: '3 Months', category: 'short' },
  '6M': { label: '6 Months', category: 'mid' },
  '1Y': { label: '1 Year', category: 'long' },
  '3Y': { label: '3 Years', category: 'long' },
};

/* ────────────────────────────────────────────
   Time-horizon prompt instructions
   ──────────────────────────────────────────── */
const TIME_INSTRUCTIONS = {
  short: `TIME-HORIZON WEIGHTING (Short Term — 1 to 3 Months):
- Recent news sentiment: 40 %
- Analyst consensus direction-of-change: 35 %
- Price momentum / 52-week position: 15 %
- Company guidance / structural factors: 10 %
INSTRUCTION: Weight recent news sentiment and analyst consensus direction-of-change most heavily. Flag any catalysts or risks materializing within 90 days. Price momentum and 52-week positioning are relevant. Discount long-term structural factors.`,

  mid: `TIME-HORIZON WEIGHTING (Mid Term — 6 Months):
- Recent news sentiment: 27.5 %
- Analyst consensus direction: 27.5 %
- Price momentum / 52-week position: 15 %
- Company guidance / structural positioning: 30 %
INSTRUCTION: Balance short-term catalysts with structural positioning. Give equal consideration to news momentum and business model durability. Flag risks in both the 0-90 day and 90-180 day windows.`,

  long: `TIME-HORIZON WEIGHTING (Long Term — 1 to 3 Years):
- Company guidance / structural durability: 50 %
- Sector and macro tailwinds: 15 %
- Analyst consensus count and stability: 20 %
- Recent news (discounted): 15 %
INSTRUCTION: Ignore short-term price action and news noise. Focus on whether the business model has structural durability, management guidance quality, and sector tailwinds. Analyst consensus stability matters more than direction-of-change.`,
};

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */

function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
}

function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${Number(cap).toLocaleString()}`;
}

function formatNews(newsItems) {
  if (!newsItems || newsItems.length === 0) return 'No recent news available.';

  const lines = newsItems.slice(0, 15).map((item, i) => {
    const headline = sanitize(item.headline || '');
    const summary = sanitize(item.summary || '').slice(0, 150);
    const date = item.datetime
      ? new Date(item.datetime * 1000).toLocaleDateString('en-US')
      : '';
    return `${i + 1}. [${date}] ${headline}${summary ? ` — ${summary}` : ''}`;
  });

  /* Cap at 2000 chars per PRD security spec */
  return lines.join('\n').slice(0, 2000);
}

function formatConsensus(recommendation) {
  if (!recommendation || recommendation.length === 0) {
    return { text: 'No analyst consensus data available.', count: 0 };
  }

  const latest = recommendation[0];
  const strongBuy = latest.strongBuy || 0;
  const buy = latest.buy || 0;
  const hold = latest.hold || 0;
  const sell = latest.sell || 0;
  const strongSell = latest.strongSell || 0;
  const total = strongBuy + buy + hold + sell + strongSell;

  return {
    text: `ANALYST CONSENSUS (most recent period — ${latest.period || 'N/A'}):
- Strong Buy: ${strongBuy}
- Buy: ${buy}
- Hold: ${hold}
- Sell: ${sell}
- Strong Sell: ${strongSell}
- Total Analysts: ${total}`,
    count: total,
  };
}

/* ────────────────────────────────────────────
   buildPrompt — constructs system + user prompt
   ──────────────────────────────────────────── */

export function buildPrompt(tickerData, holdPeriod, ticker) {
  const { profile, quote, recommendation, news } = tickerData;
  const period = HOLD_PERIODS[holdPeriod] || HOLD_PERIODS['6M'];

  /* Price data */
  const current = quote?.c || 0;
  const high52w = quote?.h || 0;
  const low52w = quote?.l || 0;
  const range = high52w - low52w;
  const positionInRange =
    range > 0 ? ((current - low52w) / range * 100).toFixed(1) : 'N/A';
  const changePercent =
    quote?.dp != null ? quote.dp.toFixed(2) : 'N/A';

  /* Consensus */
  const consensus = formatConsensus(recommendation);

  /* News */
  const newsText = formatNews(news);

  /* ── System prompt ── */
  const systemPrompt = `You are a CFA-level equity analyst performing a structured investment analysis. Evaluate the provided stock data and produce a scored investment assessment.

SCORING RUBRIC (total: 100 points):
- Analyst Consensus Signal (35 pts): Strong Buy consensus with high coverage → 30-35. Mixed or moderate → 15-25. Strong Sell or very bearish → 0-10.
- News Sentiment (25 pts): Overwhelmingly positive recent news → 20-25. Neutral or mixed → 10-15. Negative sentiment dominant → 0-10.
- Price Momentum (20 pts): Near 52-week high with strength → 15-20. Mid-range → 8-12. Near 52-week low on weakness → 0-5.
- Qualitative Judgment (20 pts): Holistic assessment of data coherence, risk/catalyst balance, and time-horizon fit.

GRADE MAPPING:
- 90-100 → A
- 75-89  → B
- 60-74  → C
- 40-59  → D
- 0-39   → F

SIGNAL MAPPING:
- Score 70-100 → BUY_SIGNAL
- Score 45-69  → WATCH
- Score 0-44   → AVOID

${TIME_INSTRUCTIONS[period.category]}

Respond ONLY with valid JSON matching this exact schema. No preamble, no markdown fences, no explanation outside the JSON object. The "score" field must be an integer 0-100. The "grade" must be one of: A, B, C, D, F. The "signal" must be exactly one of: BUY_SIGNAL, WATCH, AVOID.

{
  "ticker": "string",
  "score": 0,
  "grade": "C",
  "analyst_consensus": {
    "buy": 0,
    "hold": 0,
    "sell": 0,
    "total": 0,
    "label": "string describing the consensus"
  },
  "sentiment_summary": "One sentence on recent news tone and key themes.",
  "timeframe_verdict": "One sentence specific to the ${period.label} hold period.",
  "key_risks": ["risk one", "risk two"],
  "key_catalysts": ["catalyst one", "catalyst two"],
  "signal": "BUY_SIGNAL"
}`;

  /* ── User prompt ── */
  const upperTicker = ticker.toUpperCase();
  const userPrompt = `Analyze the following stock for a ${period.label} hold period:

COMPANY PROFILE:
- Ticker: ${upperTicker}
- Company Name: ${profile?.name || 'Unknown'}
- Sector / Industry: ${profile?.finnhubIndustry || 'Unknown'}
- Market Cap: ${formatMarketCap(
    profile?.marketCapitalization
      ? profile.marketCapitalization * 1e6
      : null
  )}
- Exchange: ${profile?.exchange || 'Unknown'}
- Country: ${profile?.country || 'Unknown'}

CURRENT PRICE DATA:
- Current Price: $${current.toFixed(2)}
- Daily Change: ${changePercent}%
- 52-Week High: $${high52w.toFixed(2)}
- 52-Week Low: $${low52w.toFixed(2)}
- Position in 52-Week Range: ${positionInRange}%
- Previous Close: $${(quote?.pc || 0).toFixed(2)}

${consensus.text}

RECENT NEWS (last 30 days):
${newsText}
${
  consensus.count < 3
    ? '\n⚠ NOTE: Fewer than 3 analyst ratings are available for this ticker. Score reliability may be reduced. Apply wider uncertainty margins.'
    : ''
}

Score this ticker for a ${period.label} investment horizon.`;

  return {
    systemPrompt,
    userPrompt,
    limitedData: consensus.count < 3,
    companyName: profile?.name || upperTicker,
  };
}
