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
   Time-horizon focus instructions
   ──────────────────────────────────────────── */
const TIME_FOCUS = {
  short: `HOLD PERIOD FOCUS (Short Term — 1 to 3 Months):
Focus your analysis on near-term catalysts, upcoming earnings dates, recent momentum, and news events within the next 90 days. Discount long-term structural factors. Flag any binary events (earnings, FDA decisions, macro releases) within the window.`,

  mid: `HOLD PERIOD FOCUS (Mid Term — 6 Months):
Balance near-term catalysts with business model durability. Give equal weight to current momentum and structural positioning. Flag risks in both the 0-90 day and 90-180 day windows.`,

  long: `HOLD PERIOD FOCUS (Long Term — 1 to 3 Years):
Ignore short-term price action and news noise. Focus on structural durability of the business model, management quality signals from the data, sector tailwinds, and whether the valuation supports a multi-year thesis.`,
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

  return lines.join('\n').slice(0, 2000);
}

function formatConsensus(recommendation) {
  if (!recommendation || recommendation.length === 0) {
    return { text: 'No analyst consensus data available.', count: 0, details: null };
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
    details: { strongBuy, buy, hold, sell, strongSell, total },
  };
}

function formatEarnings(earnings) {
  if (!Array.isArray(earnings) || earnings.length === 0) {
    return 'No quarterly earnings data available.';
  }

  return earnings.map((q, i) => {
    const beat = q.reportedEPS != null && q.estimatedEPS != null
      ? (q.reportedEPS > q.estimatedEPS ? 'BEAT' : q.reportedEPS === q.estimatedEPS ? 'MET' : 'MISSED')
      : 'N/A';
    return `Q${i + 1} (${q.date}): Reported EPS $${q.reportedEPS ?? 'N/A'} vs Est $${q.estimatedEPS ?? 'N/A'} → ${beat} (${q.surprisePercentage != null ? q.surprisePercentage.toFixed(1) + '%' : 'N/A'} surprise)`;
  }).join('\n');
}

function formatBreakdown(breakdown) {
  return Object.entries(breakdown)
    .map(([key, value]) => `  - ${key}: ${value.toFixed(1)}`)
    .join('\n');
}

/* ────────────────────────────────────────────
   buildPrompt — v2 architecture
   Math score is pre-calculated. LLM explains it.
   ──────────────────────────────────────────── */

export function buildPrompt(tickerData, alphaData, mathResult, holdPeriod, ticker) {
  const { profile, quote, recommendation, news } = tickerData;
  const period = HOLD_PERIODS[holdPeriod] || HOLD_PERIODS['6M'];
  const overview = alphaData?.overview || null;
  const earnings = alphaData?.earnings || null;

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
  const systemPrompt = `You are a CFA-level equity analyst. Your role is to EXPLAIN a pre-calculated investment score — not to generate one.

A deterministic math engine has already scored this stock at ${mathResult.score}/100 (Grade: ${mathResult.grade}, Signal: ${mathResult.signal}).

Score breakdown:
${formatBreakdown(mathResult.breakdown)}

Your job is to:
1. Explain WHY this score makes sense given the data below
2. Identify the STORY behind the numbers — what's driving the score up or down
3. Provide a concise investment thesis grounded ONLY in the provided data
4. Flag the single most important thing to watch during the ${period.label} hold period
5. List specific risks and catalysts from the data

${TIME_FOCUS[period.category]}

STRICT RULES — VIOLATION OF ANY RULE INVALIDATES YOUR RESPONSE:
- Do NOT reference any data not explicitly listed in the AVAILABLE DATA section below
- If you don't have data for a field, write "Insufficient data"
- Do NOT describe the 52-week range as "narrow" or "wide" — state exact numbers only
- Do NOT mention news events unless news data is explicitly provided below
- Do NOT invent earnings dates, product launches, or events not in the data
- Do NOT override the pre-calculated score, grade, or signal
- Ground every claim in a specific number from the data

Respond ONLY with valid JSON matching this exact schema. No preamble, no markdown fences, no explanation outside the JSON object.

{
  "thesis": "2-3 sentence investment thesis citing specific numbers from the data",
  "sentiment_summary": "One sentence on recent news tone from PROVIDED headlines only, or 'Insufficient data' if no news provided",
  "timeframe_verdict": "One sentence specific to the ${period.label} hold period",
  "key_risks": ["risk grounded in data", "risk grounded in data"],
  "key_catalysts": ["catalyst grounded in data", "catalyst grounded in data"],
  "watch_for": "The single most important thing to monitor during this hold period"
}`;

  /* ── User prompt ── */
  const upperTicker = ticker.toUpperCase();
  let userPrompt = `AVAILABLE DATA (use only this, infer nothing):

COMPANY PROFILE:
- Ticker: ${upperTicker}
- Company Name: ${profile?.name || 'Unknown'}
- Sector / Industry: ${profile?.finnhubIndustry || overview?.industry || 'Unknown'}
- Market Cap: ${formatMarketCap(
    profile?.marketCapitalization
      ? profile.marketCapitalization * 1e6
      : overview?.marketCap || null
  )}
- Exchange: ${profile?.exchange || 'Unknown'}
- Country: ${profile?.country || 'Unknown'}

CURRENT PRICE DATA:
- Current Price: $${current.toFixed(2)}
- Daily Change: ${changePercent}%
- 52-Week High: $${high52w.toFixed(2)}
- 52-Week Low: $${low52w.toFixed(2)}
- Position in 52-Week Range: ${positionInRange}% from low
- Previous Close: $${(quote?.pc || 0).toFixed(2)}

${consensus.text}`;

  /* Alpha Vantage fundamentals (if available) */
  if (overview) {
    userPrompt += `

FUNDAMENTAL DATA (Alpha Vantage):
- P/E Ratio: ${overview.peRatio ?? 'N/A'}
- Forward P/E: ${overview.forwardPE ?? 'N/A'}
- PEG Ratio: ${overview.pegRatio ?? 'N/A'}
- EPS (TTM): $${overview.eps ?? 'N/A'}
- Dividend Yield: ${overview.dividendYield != null ? (overview.dividendYield * 100).toFixed(2) + '%' : 'N/A'}
- Profit Margin: ${overview.profitMargin != null ? (overview.profitMargin * 100).toFixed(1) + '%' : 'N/A'}
- Revenue Growth (QoQ YoY): ${overview.revenueGrowthYoY != null ? (overview.revenueGrowthYoY * 100).toFixed(1) + '%' : 'N/A'}
- Earnings Growth (QoQ YoY): ${overview.earningsGrowthYoY != null ? (overview.earningsGrowthYoY * 100).toFixed(1) + '%' : 'N/A'}
- Analyst Target Price: $${overview.analystTargetPrice ?? 'N/A'}${overview.analystTargetPrice && current > 0 ? ` (${(((overview.analystTargetPrice - current) / current) * 100).toFixed(1)}% implied upside)` : ''}
- Beta: ${overview.beta ?? 'N/A'}
- Return on Equity: ${overview.returnOnEquity != null ? (overview.returnOnEquity * 100).toFixed(1) + '%' : 'N/A'}
- Return on Assets: ${overview.returnOnAssets != null ? (overview.returnOnAssets * 100).toFixed(1) + '%' : 'N/A'}`;
  }

  if (earnings && earnings.length > 0) {
    userPrompt += `

QUARTERLY EARNINGS (last ${earnings.length} quarters):
${formatEarnings(earnings)}`;
  }

  userPrompt += `

RECENT NEWS (last 30 days):
${newsText}

PRE-CALCULATED SCORE: ${mathResult.score}/100 (${mathResult.grade}) — ${mathResult.signal}
Score Breakdown:
${formatBreakdown(mathResult.breakdown)}
${
  consensus.count < 3
    ? '\n⚠ NOTE: Fewer than 3 analyst ratings available. Score reliability may be reduced.'
    : ''
}

Analyze this data for a ${period.label} investment horizon. Explain the score, provide a thesis, and flag risks.`;

  return {
    systemPrompt,
    userPrompt,
    limitedData: consensus.count < 3,
    companyName: profile?.name || overview?.name || upperTicker,
  };
}
