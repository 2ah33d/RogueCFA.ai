/* ════════════════════════════════════════════════════════════════
   goldenGoose.js
   Deterministic Weekly Golden-Pick & Warning-Sell Scoring Engine
   (PRD Task 3.5 / Feature 3 — $0.00 LLM Cost)
   Updated: 7-Day Rolling Window & Persistent Multi-Week 🔥 Fire Streak Signals
   ════════════════════════════════════════════════════════════════ */

/**
 * Configurable Constants per PRD Spec
 */
export const W_FREQUENCY = 1.0;
export const W_PENALTY = -2.0;
export const W_CONVERGENCE = 4.5;
export const DEFAULT_WINDOW_DAYS = 7; // 7 days ensures coverage of 5 weekday MarketCall episodes

/**
 * Standardize ticker symbol for comparison (e.g. SHOP -> SHOP, SHOP.TO -> SHOP.TO)
 */
export function normalizeTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return '';
  return ticker.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Normalize stance string to standard categories
 * @param {string} stance 
 * @returns {'buy' | 'sell' | 'hold' | 'unsure'}
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
  if (s.includes('unsure') || s.includes('ambiguous') || s.includes('uncertain')) {
    return 'unsure';
  }
  return 'buy';
}

/**
 * Calculate Golden Goose & Warning Sell signals across recent MarketCall episodes.
 *
 * @param {Array<Object>} episodes - Array of episode objects with { episodeDate, guest, firm, picks, callerMentions }
 * @param {number} windowDays - Rolling window size in days (default: 7)
 * @returns {Object} { goldenPicks, warningSells, allScores, episodeCount, windowDays }
 */
export function calculateGoldenGoose(episodes = [], windowDays = DEFAULT_WINDOW_DAYS) {
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return { goldenPicks: [], warningSells: [], allScores: [], episodeCount: 0, windowDays };
  }

  const now = new Date();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  
  const validEpisodes = episodes.filter(ep => {
    if (!ep) return false;
    const epDateStr = ep.episodeDate || ep.air_date || ep.date;
    if (!epDateStr) return true;
    const epDate = new Date(epDateStr);
    if (isNaN(epDate.getTime())) return true;
    return (now.getTime() - epDate.getTime()) <= windowMs + (24 * 60 * 60 * 1000); // 1-day buffer
  });

  const allTickerHistoryDates = new Map();

  episodes.forEach(ep => {
    if (!ep) return;
    const epDateStr = ep.episodeDate || ep.air_date || ep.date;
    if (!epDateStr) return;
    const epDateObj = new Date(epDateStr);
    if (isNaN(epDateObj.getTime())) return;
    const epTimestamp = epDateObj.getTime();

    const digest = ep.digest || ep;
    const topPicks = Array.isArray(digest.picks) ? digest.picks : (Array.isArray(digest.top_picks) ? digest.top_picks : []);
    const callerMentions = Array.isArray(digest.callerMentions) ? digest.callerMentions : (Array.isArray(digest.caller_mentions) ? digest.caller_mentions : []);

    const allItems = [...topPicks, ...callerMentions];
    allItems.forEach(item => {
      const ticker = normalizeTicker(item.ticker);
      if (!ticker) return;
      const stance = normalizeStance(item.stance || item.rating);
      if (stance === 'buy' || stance === 'hold') {
        if (!allTickerHistoryDates.has(ticker)) {
          allTickerHistoryDates.set(ticker, new Set());
        }
        allTickerHistoryDates.get(ticker).add(epTimestamp);
      }
    });
  });

  const tickerMap = new Map();

  validEpisodes.forEach((ep) => {
    const epDate = ep.episodeDate || ep.air_date || 'Recent';
    const guestName = ep.guest || ep.analyst_name || 'Guest Analyst';
    const digest = ep.digest || ep;

    const topPicks = Array.isArray(digest.picks) ? digest.picks : (Array.isArray(digest.top_picks) ? digest.top_picks : []);
    const callerMentions = Array.isArray(digest.callerMentions) ? digest.callerMentions : (Array.isArray(digest.caller_mentions) ? digest.caller_mentions : []);

    // 1. Process Formal Top Picks
    topPicks.forEach((pick) => {
      const ticker = normalizeTicker(pick.ticker);
      if (!ticker) return;
      
      if (!tickerMap.has(ticker)) {
        tickerMap.set(ticker, {
          ticker,
          companyName: pick.company || pick.companyName || pick.company_name || ticker,
          episodes: new Map(),
          topPickAnalysts: new Set(),
          callerAnalysts: new Set(),
          allAnalysts: new Set(),
          topPickReasonings: [],
          callerReasonings: []
        });
      }

      const item = tickerMap.get(ticker);
      item.topPickAnalysts.add(guestName);
      item.allAnalysts.add(guestName);
      if (pick.reasoning || pick.thesis) {
        item.topPickReasonings.push({ analyst: guestName, text: pick.reasoning || pick.thesis, date: epDate });
      }

      const epKey = `${epDate}_${guestName}`;
      item.episodes.set(epKey, {
        date: epDate,
        analyst: guestName,
        isTopPick: true,
        stance: normalizeStance(pick.stance || 'buy')
      });
    });

    // 2. Process Caller Mentions (Q&A)
    callerMentions.forEach((call) => {
      const ticker = normalizeTicker(call.ticker);
      if (!ticker) return;

      if (!tickerMap.has(ticker)) {
        tickerMap.set(ticker, {
          ticker,
          companyName: call.company || call.companyName || ticker,
          episodes: new Map(),
          topPickAnalysts: new Set(),
          callerAnalysts: new Set(),
          allAnalysts: new Set(),
          topPickReasonings: [],
          callerReasonings: []
        });
      }

      const item = tickerMap.get(ticker);
      item.callerAnalysts.add(guestName);
      item.allAnalysts.add(guestName);
      if (call.reasoning || call.summary || call.commentary) {
        item.callerReasonings.push({ analyst: guestName, text: call.reasoning || call.summary || call.commentary, date: epDate });
      }

      const epKey = `${epDate}_${guestName}`;
      if (!item.episodes.has(epKey)) {
        item.episodes.set(epKey, {
          date: epDate,
          analyst: guestName,
          isTopPick: false,
          stance: normalizeStance(call.stance || call.rating || 'buy')
        });
      }
    });
  });

  const scoredTickers = [];

  tickerMap.forEach((data, ticker) => {
    let score = 0;
    let positiveEpisodes = 0;
    let negativeEpisodes = 0;
    let neutralEpisodes = 0;

    data.episodes.forEach((epInfo) => {
      if (epInfo.stance === 'buy' || epInfo.stance === 'hold') {
        score += W_FREQUENCY;
        positiveEpisodes++;
      } else if (epInfo.stance === 'sell') {
        score += W_PENALTY;
        negativeEpisodes++;
      } else {
        neutralEpisodes++;
      }
    });

    let convergenceBonusApplied = false;

    if (data.callerAnalysts.size > 0 && data.topPickAnalysts.size > 0) {
      const distinctTopPick = Array.from(data.topPickAnalysts);
      const distinctCaller = Array.from(data.callerAnalysts);
      const hasDifferentAnalyst = distinctTopPick.some(tp => distinctCaller.some(c => c !== tp));

      if (hasDifferentAnalyst || data.allAnalysts.size >= 2) {
        score += W_CONVERGENCE;
        convergenceBonusApplied = true;
      }
    } else if (data.topPickAnalysts.size >= 2 || data.callerAnalysts.size >= 2) {
      score += W_CONVERGENCE;
      convergenceBonusApplied = true;
    }

    const finalScore = Math.round(score * 10) / 10;

    let isPersistentHotPick = false;
    let streakDays = 0;

    if (allTickerHistoryDates.has(ticker)) {
      const timestamps = Array.from(allTickerHistoryDates.get(ticker)).sort((a, b) => a - b);
      if (timestamps.length >= 2) {
        const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
        streakDays = Math.round(spanMs / (1000 * 60 * 60 * 24));
        if (streakDays >= 7 || timestamps.length >= 3) {
          isPersistentHotPick = true;
        }
      }
    }

    const allReasonings = [...data.topPickReasonings, ...data.callerReasonings];

    scoredTickers.push({
      ticker,
      companyName: data.companyName,
      score: finalScore,
      positiveEpisodes,
      negativeEpisodes,
      neutralEpisodes,
      totalEpisodes: data.episodes.size,
      convergenceBonusApplied,
      isPersistentHotPick,
      streakDays,
      participatingAnalysts: Array.from(data.allAnalysts),
      topPickAnalysts: Array.from(data.topPickAnalysts),
      callerAnalysts: Array.from(data.callerAnalysts),
      topPickReasonings: data.topPickReasonings,
      callerReasonings: data.callerReasonings,
      allReasonings,
      isGoldenPick: finalScore >= 3.5 && positiveEpisodes >= 1,
      isWarningSell: negativeEpisodes >= 2 || (negativeEpisodes >= 1 && finalScore < 0)
    });
  });

  scoredTickers.sort((a, b) => b.score - a.score);

  const goldenPicks = scoredTickers.filter(t => t.isGoldenPick || t.score >= 3.5);
  const warningSells = scoredTickers.filter(t => t.isWarningSell);

  return {
    goldenPicks,
    warningSells,
    allScores: scoredTickers,
    episodeCount: validEpisodes.length,
    windowDays
  };
}

/**
 * Synthesize multi-episode analyst commentary for a top Golden Pick or Warning Sell stock.
 * Extremely token-efficient: consumes ~300-500 input tokens max ($0.00005 on Gemini / Groq).
 *
 * @param {string} ticker
 * @param {string} companyName
 * @param {Array<{analyst: string, text: string, date: string}>} reasonings
 * @param {string} llmKey
 * @param {string} provider
 * @returns {Promise<string>} Synthesized 2-sentence thesis
 */
export async function synthesizeGoldenPickThesis(ticker, companyName, reasonings = [], llmKey, provider = 'gemini') {
  if (!reasonings || reasonings.length === 0) {
    return 'Multiple guest analysts cited this stock across recent episodes, showing strong consensus.';
  }

  const excerpts = reasonings.map((r, i) => `[Mention ${i + 1} - ${r.analyst} (${r.date})]: "${r.text}"`).join('\n');

  const prompt = `You are a CFA research analyst. Synthesize the following multi-analyst commentary excerpts for ${ticker} (${companyName}) into a concise, high-signal 2-sentence overarching investment outlook:\n\n${excerpts}\n\nRespond ONLY with 2 clear, high-signal sentences summarizing why analysts repeatedly recommended or flagged this stock.`;

  try {
    if (provider === 'gemini' && llmKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${llmKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
    }
  } catch (err) {
    console.warn('Synthesis failed, using fallback:', err);
  }

  // Pure deterministic fallback (0 tokens burned)
  return `Featured across ${reasonings.length} distinct analyst discussions this week, demonstrating strong multi-analyst conviction and caller interest.`;
}
