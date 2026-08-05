/* ════════════════════════════════════════════════════════════════
   goldenGoose.js — Golden Goose v2
   Layer 1: Deterministic shortlist builder ($0 cost, 0 threshold decisions)
   Layer 2: LLM Eyes prompt builder & response validator (Claude Sonnet 5)
   ════════════════════════════════════════════════════════════════ */

export const STANCE_WEIGHT = {
  buy: 1.0,
  hold: 0.3,
  sell: -1.0,
};

export const SOURCE_MULTIPLIER = {
  pick: 1.5,           // formal top pick — always bullish
  caller_mention: 1.0, // guest responding to caller Q&A — can be buy/hold/sell
};

export const BUY_HOLD_MIN_MENTIONS = 2;

/**
 * Standardize ticker symbol for comparison (e.g. SHOP -> SHOP, SHOP.TO -> SHOP.TO)
 */
export function normalizeTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return '';
  return ticker.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Normalize stance string to standard categories ('buy', 'hold', 'sell')
 */
export function normalizeStance(stance) {
  if (!stance || typeof stance !== 'string') return 'buy';
  const s = stance.toLowerCase().trim();
  if (s.includes('sell') || s.includes('avoid') || s.includes('trim') || s.includes('bear')) {
    return 'sell';
  }
  if (s.includes('hold') || s.includes('neutral') || s.includes('wait')) {
    return 'hold';
  }
  return 'buy';
}

/**
 * Calculate deterministic weighted score for a single mention.
 */
export function weightedScore(mention) {
  const stanceWeight = STANCE_WEIGHT[mention.stance] ?? 0;
  const sourceMultiplier = SOURCE_MULTIPLIER[mention.mentionType] ?? 1.0;
  return stanceWeight * sourceMultiplier;
}

/**
 * Layer 1: Build deterministic shortlists for Buy/Hold candidates and Sell candidates.
 * No threshold decisions — only counts, weights, and shortlists.
 *
 * @param {Array<Object>} episodes - Array of episode objects
 * @param {number} windowDays - Rolling window size in days (default: 7)
 * @returns {{ buyHoldCandidates: Array, sellCandidates: Array }}
 */
export function buildShortlists(episodes = [], windowDays = 7) {
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return { buyHoldCandidates: [], sellCandidates: [] };
  }

  const cutoff = Date.now() - windowDays * 86_400_000;
  const tickerAgg = {};

  for (const episode of episodes) {
    if (!episode) continue;
    const epDateStr = episode.episodeDate || episode.air_date || episode.date;
    if (epDateStr && new Date(epDateStr).getTime() < cutoff) continue;

    const guestName = episode.guest || episode.analyst_name || 'Guest Analyst';
    const digest = episode.digest || episode;

    const topPicks = Array.isArray(digest.picks)
      ? digest.picks
      : Array.isArray(digest.top_picks)
      ? digest.top_picks
      : [];

    const callerMentions = Array.isArray(digest.callerMentions)
      ? digest.callerMentions
      : Array.isArray(digest.caller_mentions)
      ? digest.caller_mentions
      : [];

    /* Exclude pastPicks / recap section entirely — only current picks & callerMentions */
    const allMentions = [
      ...topPicks.map((p) => ({ ...p, mentionType: 'pick' })),
      ...callerMentions.map((c) => ({ ...c, mentionType: 'caller_mention' })),
    ];

    for (const m of allMentions) {
      const ticker = normalizeTicker(m.ticker);
      if (!ticker) continue;

      const stance = normalizeStance(m.stance || m.rating || (m.mentionType === 'pick' ? 'buy' : 'buy'));
      const epDate = epDateStr || 'Recent';

      /* Dedup key incorporates mentionType:
         Same guest naming a ticker as a pick + answering a caller question = 2 mentions.
         Same guest answering 2 callers on same ticker in same episode = 1 mention. */
      const epKey = `${epDate}_${guestName}_${ticker}_${m.mentionType}`;

      if (!tickerAgg[ticker]) {
        tickerAgg[ticker] = {
          ticker,
          company: m.company || m.companyName || m.company_name || ticker,
          seenEpKeys: new Set(),
          mentions: [],
        };
      }

      const agg = tickerAgg[ticker];
      agg.mentions.push({
        guest: guestName,
        date: epDate,
        stance,
        mentionType: m.mentionType,
        reasoning: m.reasoning || m.summary || m.thesis || m.commentary || 'Mentioned during broadcast.',
        epKey,
      });
      agg.seenEpKeys.add(epKey);
    }
  }

  const buyHoldCandidates = [];
  const sellCandidates = [];

  for (const agg of Object.values(tickerAgg)) {
    /* One mention per unique epKey — dedup happens here */
    const deduped = [...agg.seenEpKeys].map((key) => agg.mentions.find((m) => m.epKey === key));

    const buyHoldCount = deduped.filter((m) => m.stance === 'buy' || m.stance === 'hold').length;
    const sellCount = deduped.filter((m) => m.stance === 'sell').length;
    const weightedTotal = deduped.reduce((sum, m) => sum + weightedScore(m), 0);

    const candidate = {
      ticker: agg.ticker,
      company: agg.company,
      mentionCount: deduped.length,
      distinctGuestCount: new Set(deduped.map((m) => m.guest)).size,
      weightedScore: Math.round(weightedTotal * 10) / 10,
      mentions: deduped,
    };

    if (buyHoldCount >= BUY_HOLD_MIN_MENTIONS) {
      buyHoldCandidates.push(candidate);
    }

    if (sellCount >= 1) {
      sellCandidates.push(candidate);
    }
  }

  buyHoldCandidates.sort((a, b) => b.weightedScore - a.weightedScore);
  sellCandidates.sort((a, b) => a.weightedScore - b.weightedScore);

  return { buyHoldCandidates, sellCandidates };
}

/**
 * Layer 2: Construct the LLM Eyes prompt.
 */
export function buildLLMEyesPrompt({ buyHoldCandidates, sellCandidates }, windowDays = 7) {
  const allowedTickers = [
    ...buyHoldCandidates.map((c) => c.ticker),
    ...sellCandidates.map((c) => c.ticker),
  ];

  const formatCandidate = (c) => `
Ticker: ${c.ticker} (${c.company})
Deterministic weighted score: ${c.weightedScore} | ${c.mentionCount} mention(s) across ${c.distinctGuestCount} distinct analyst(s)
Mentions:
${c.mentions.map((m) => `  - [${m.mentionType}, ${m.stance}] ${m.guest} (${m.date}): "${m.reasoning}"`).join('\n')}`;

  const prompt = `You are evaluating stock tickers for RogueCFA's "Golden Goose" weekly watchlist, based on BNN Bloomberg MarketCall episodes from the past ${windowDays} days.

You may ONLY reference tickers from this exact list: ${allowedTickers.join(', ')}.
Never introduce a ticker that isn't on this list, even if one appears inside the reasoning text below.

=== BUY/HOLD CANDIDATES (2+ mentions, sorted by weighted score) ===
${buyHoldCandidates.map(formatCandidate).join('\n---\n') || '(none this window)'}

=== SELL CANDIDATES (all sell mentions, unfiltered by count) ===
${sellCandidates.map(formatCandidate).join('\n---\n') || '(none this window)'}

Your task:
1. From the buy/hold candidates, select tickers showing genuine, substantive conviction — not just repeated hedge language. If every mention for a ticker is "hold" with no actual "buy" among them, EXCLUDE it, even though it met the mention-count threshold. A pure hold-only pattern is not a golden goose signal.
2. From the sell candidates, decide which are worth surfacing as warnings. These were NOT pre-filtered by frequency — a single sell mention can still be worth including if the reasoning cites a specific, substantive concern. Skip vague or low-conviction one-off caller answers.
3. There is no target count for either list. Some weeks may have 4-5 genuine golden picks, others may have 1 or 0 — let the actual conviction in the reasoning drive the count, not a quota. Same logic applies to warnings.

Respond in this exact JSON shape, using ONLY tickers from the allowed list above, with no text before or after the JSON:
{
  "goldenPicks": [{ "ticker": "...", "rationale": "1-2 sentences, must reference specific reasoning provided above" }],
  "warningSells": [{ "ticker": "...", "rationale": "1-2 sentences, must reference specific reasoning provided above" }]
}`;

  return { prompt, allowedTickers };
}

/**
 * Validate LLM Eyes JSON response against allowedTickers list.
 */
export function validateLLMEyesResponse(llmJson, allowedTickers) {
  const allowedSet = new Set(allowedTickers);
  const filterValid = (arr) => (arr || []).filter((item) => item && item.ticker && allowedSet.has(item.ticker));

  const allItems = [...(llmJson?.goldenPicks || []), ...(llmJson?.warningSells || [])];
  const rejectedTickers = allItems
    .filter((item) => item && item.ticker && !allowedSet.has(item.ticker))
    .map((item) => item.ticker);

  return {
    goldenPicks: filterValid(llmJson?.goldenPicks),
    warningSells: filterValid(llmJson?.warningSells),
    _rejectedTickers: rejectedTickers,
  };
}

/**
 * Legacy compatibility fallback calculation (deterministic threshold mode).
 */
export function calculateGoldenGoose(episodes = [], windowDays = 7) {
  const { buyHoldCandidates, sellCandidates } = buildShortlists(episodes, windowDays);
  return {
    goldenPicks: buyHoldCandidates.map((c) => ({
      ticker: c.ticker,
      companyName: c.company,
      score: c.weightedScore,
      totalEpisodes: c.mentionCount,
      participatingAnalysts: Array.from(new Set(c.mentions.map((m) => m.guest))),
      allReasonings: c.mentions,
      topPickReasonings: c.mentions.filter((m) => m.mentionType === 'pick'),
      callerReasonings: c.mentions.filter((m) => m.mentionType === 'caller_mention'),
      isGoldenPick: true,
      isWarningSell: false,
    })),
    warningSells: sellCandidates.map((c) => ({
      ticker: c.ticker,
      companyName: c.company,
      score: c.weightedScore,
      totalEpisodes: c.mentionCount,
      participatingAnalysts: Array.from(new Set(c.mentions.map((m) => m.guest))),
      allReasonings: c.mentions,
      isGoldenPick: false,
      isWarningSell: true,
    })),
    allScores: [...buyHoldCandidates, ...sellCandidates],
    episodeCount: episodes.length,
    windowDays,
  };
}
