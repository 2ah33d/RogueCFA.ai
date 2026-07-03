/* ────────────────────────────────────────────
   calculateScore — deterministic math-only scoring
   Produces a 0-100 score from hard data.
   No LLM involvement. Fully auditable.
   ──────────────────────────────────────────── */

/**
 * @param {Object} finnhubData - { profile, quote, recommendation, news }
 * @param {Object|null} alphaData - { overview, earnings } or null
 * @param {string} holdPeriod - '1M' | '3M' | '6M' | '1Y' | '3Y'
 * @returns {{ score, grade, signal, breakdown, hasAlphaVantage }}
 */
export function calculateScore(finnhubData, alphaData, holdPeriod) {
  const hasAV = Boolean(alphaData?.overview);

  const breakdown = hasAV
    ? calculateFullScore(finnhubData, alphaData, holdPeriod)
    : calculateBasicScore(finnhubData, holdPeriod);

  const score = Math.round(
    Math.max(0, Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0)))
  );

  const grade = scoreToGrade(score);
  const signal = scoreToSignal(score);

  return { score, grade, signal, breakdown, hasAlphaVantage: hasAV };
}

/* ────────────────────────────────────────────
   Full scoring (Finnhub + Alpha Vantage)
   Total: 100 points
   ──────────────────────────────────────────── */
function calculateFullScore(finnhubData, alphaData, holdPeriod) {
  const { recommendation, quote } = finnhubData;
  const { overview, earnings } = alphaData;

  return {
    consensus: calcConsensus(recommendation, 35),
    momentum: calcMomentum(quote, 20),
    valuation: calcValuation(overview, quote, 25),
    earnings: calcEarnings(earnings, overview, 20),
  };
}

/* ────────────────────────────────────────────
   Basic scoring (Finnhub only)
   Total: 100 points (redistributed weights)
   ──────────────────────────────────────────── */
function calculateBasicScore(finnhubData, holdPeriod) {
  const { recommendation, quote, news } = finnhubData;

  return {
    consensus: calcConsensus(recommendation, 45),
    momentum: calcMomentum(quote, 25),
    newsSentiment: calcNewsSentiment(news, 30),
  };
}

/* ────────────────────────────────────────────
   Sub-score calculators
   ──────────────────────────────────────────── */

/**
 * Analyst Consensus sub-score.
 * Ratio of (buy + strongBuy) / total analysts × maxPoints
 */
function calcConsensus(recommendation, maxPoints) {
  if (!Array.isArray(recommendation) || recommendation.length === 0) {
    return maxPoints * 0.5; /* No data → neutral midpoint */
  }

  const rec = recommendation[0];
  const strongBuy = rec.strongBuy || 0;
  const buy = rec.buy || 0;
  const hold = rec.hold || 0;
  const sell = rec.sell || 0;
  const strongSell = rec.strongSell || 0;
  const total = strongBuy + buy + hold + sell + strongSell;

  if (total === 0) return maxPoints * 0.5;

  /* Weighted: strongBuy=1.0, buy=0.75, hold=0.5, sell=0.25, strongSell=0 */
  const weighted =
    (strongBuy * 1.0 + buy * 0.75 + hold * 0.5 + sell * 0.25 + strongSell * 0) /
    total;

  return Math.round(weighted * maxPoints * 10) / 10;
}

/**
 * Price Momentum sub-score.
 * Position in 52-week range × maxPoints.
 * Higher position = more momentum = higher score.
 */
function calcMomentum(quote, maxPoints) {
  if (!quote) return maxPoints * 0.5;

  const current = quote.c || 0;
  const high = quote.h || 0;
  const low = quote.l || 0;
  const range = high - low;

  if (range <= 0 || current <= 0) return maxPoints * 0.5;

  const position = Math.max(0, Math.min(1, (current - low) / range));
  return Math.round(position * maxPoints * 10) / 10;
}

/**
 * Valuation sub-score (requires Alpha Vantage).
 * Based on analyst target price upside and P/E reasonableness.
 */
function calcValuation(overview, quote, maxPoints) {
  if (!overview) return 0;

  let valScore = 0;
  const current = quote?.c || 0;

  /* Target price upside (0-15 points) */
  if (overview.analystTargetPrice && current > 0) {
    const upside = (overview.analystTargetPrice - current) / current;
    /* Cap upside contribution: 30%+ upside → full 15 pts */
    const upsidePts = Math.min(15, Math.max(0, (upside / 0.3) * 15));
    valScore += upsidePts;
  } else {
    valScore += 7.5; /* No data → neutral */
  }

  /* P/E reasonableness (0-10 points) */
  if (overview.peRatio && overview.peRatio > 0) {
    /* P/E 10-20 → full points, <10 or >40 → fewer points */
    if (overview.peRatio <= 20) {
      valScore += 10;
    } else if (overview.peRatio <= 30) {
      valScore += 7;
    } else if (overview.peRatio <= 50) {
      valScore += 4;
    } else {
      valScore += 2;
    }
  } else {
    valScore += 5; /* No data → neutral */
  }

  return Math.round(Math.min(maxPoints, valScore) * 10) / 10;
}

/**
 * Earnings Quality sub-score (requires Alpha Vantage).
 * Based on earnings beat rate and EPS growth.
 */
function calcEarnings(earnings, overview, maxPoints) {
  let earningsScore = 0;

  /* Earnings beat rate (0-10 points) */
  if (Array.isArray(earnings) && earnings.length > 0) {
    const beats = earnings.filter(
      (q) => q.reportedEPS != null && q.estimatedEPS != null && q.reportedEPS > q.estimatedEPS
    ).length;
    const beatRate = beats / earnings.length;
    earningsScore += beatRate * 10;
  } else {
    earningsScore += 5; /* No data → neutral */
  }

  /* EPS / earnings growth trend (0-10 points) */
  if (overview?.earningsGrowthYoY != null) {
    const growth = overview.earningsGrowthYoY;
    if (growth > 0.2) earningsScore += 10;
    else if (growth > 0.1) earningsScore += 8;
    else if (growth > 0) earningsScore += 6;
    else if (growth > -0.1) earningsScore += 4;
    else earningsScore += 2;
  } else {
    earningsScore += 5; /* No data → neutral */
  }

  return Math.round(Math.min(maxPoints, earningsScore) * 10) / 10;
}

/**
 * Basic news sentiment (Finnhub-only fallback).
 * Simple keyword-based positive/negative ratio from headlines.
 */
function calcNewsSentiment(news, maxPoints) {
  if (!Array.isArray(news) || news.length === 0) {
    return maxPoints * 0.5; /* No news → neutral */
  }

  const positiveWords = /\b(surge|soar|beat|upgrade|bull|gain|record|growth|strong|profit|buy|outperform|raise|boost|accelerat|expand)\b/i;
  const negativeWords = /\b(crash|plunge|miss|downgrade|bear|loss|decline|weak|sell|underperform|cut|slash|drop|fall|warn|risk|concern)\b/i;

  let positive = 0;
  let negative = 0;

  for (const item of news.slice(0, 15)) {
    const text = `${item.headline || ''} ${item.summary || ''}`;
    if (positiveWords.test(text)) positive++;
    if (negativeWords.test(text)) negative++;
  }

  const total = positive + negative;
  if (total === 0) return maxPoints * 0.5;

  const ratio = positive / total; /* 0 = all negative, 1 = all positive */
  return Math.round(ratio * maxPoints * 10) / 10;
}

/* ────────────────────────────────────────────
   Grade and Signal mappings
   ──────────────────────────────────────────── */

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function scoreToSignal(score) {
  if (score >= 70) return 'BUY_SIGNAL';
  if (score >= 45) return 'WATCH';
  return 'AVOID';
}
