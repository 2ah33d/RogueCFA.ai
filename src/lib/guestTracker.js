import { getHistory } from './historyManager';

const BNN_STORAGE_KEY = 'roguecfa_bnn_picks';

/**
 * Save BNN picks to localStorage so guestTracker can access them globally.
 */
export function saveBnnPicks(picksArray) {
  try {
    if (!Array.isArray(picksArray)) return;
    localStorage.setItem(BNN_STORAGE_KEY, JSON.stringify(picksArray));
  } catch (err) {
    console.warn('Failed to save BNN picks to localStorage:', err.message);
  }
}

/**
 * Load stored BNN picks from localStorage.
 */
export function getStoredBnnPicks() {
  try {
    const raw = localStorage.getItem(BNN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load BNN picks from localStorage:', err.message);
    return [];
  }
}

/**
 * Calculate the track record for a BNN MarketCall guest analyst.
 * Matches guest picks against roguecfa_history in localStorage.
 */
export function getGuestTrackRecord(guestName, providedBnnPicks = null) {
  const defaultResult = {
    guestName: guestName || 'Unknown Analyst',
    totalPicks: 0,
    resolvedPicks: 0,
    correctPicks: 0,
    hitRate: null,
    avgReturn: 0,
    picks: [],
  };

  if (!guestName || typeof guestName !== 'string') {
    return defaultResult;
  }

  const trimmedGuest = guestName.trim().toLowerCase();
  const bnnPicks = Array.isArray(providedBnnPicks) ? providedBnnPicks : getStoredBnnPicks();

  /* 1. Gather all unique ticker symbols associated with this guest */
  const guestTickers = new Set();
  const guestPickDates = new Map();

  for (const item of bnnPicks) {
    if (item && typeof item.guest === 'string' && item.guest.trim().toLowerCase() === trimmedGuest) {
      if (Array.isArray(item.tickers)) {
        for (const t of item.tickers) {
          if (t && typeof t === 'string') {
            const cleanTicker = t.toUpperCase().replace(/\.(TO|TSX|V|CN)$/i, '').trim();
            guestTickers.add(cleanTicker);
            if (!guestPickDates.has(cleanTicker)) {
              guestPickDates.set(cleanTicker, item.date || 'Recent');
            }
          }
        }
      }
    }
  }

  /* 2. Load scoring history from localStorage */
  const history = getHistory();
  const matchedPicks = [];
  let resolvedCount = 0;
  let correctCount = 0;
  let totalReturn = 0;
  let returnCount = 0;

  for (const entry of history) {
    if (!entry || !entry.ticker) continue;
    const entryTicker = entry.ticker.toUpperCase().replace(/\.(TO|TSX|V|CN)$/i, '').trim();

    /* Match if ticker is in guest's BNN picks OR if the history entry was explicitly tagged with this guest */
    const isExplicitGuest = typeof entry.guest === 'string' && entry.guest.trim().toLowerCase() === trimmedGuest;
    if (guestTickers.has(entryTicker) || isExplicitGuest) {
      const outcome = entry.outcome || null;
      let actualReturn = entry.actualReturn != null ? Number(entry.actualReturn) : null;

      if (actualReturn === null && entry.finalPrice != null && entry.priceAtScore > 0) {
        actualReturn = Number((((entry.finalPrice - entry.priceAtScore) / entry.priceAtScore) * 100).toFixed(2));
      }

      if (outcome !== null) {
        resolvedCount++;
        if (outcome === 'CORRECT') {
          correctCount++;
        }
        if (actualReturn != null && !isNaN(actualReturn)) {
          totalReturn += actualReturn;
          returnCount++;
        }
      }

      matchedPicks.push({
        ticker: entry.ticker,
        date: entry.date || guestPickDates.get(entryTicker) || 'N/A',
        score: entry.score != null ? entry.score : 'N/A',
        outcome: outcome,
        actualReturn: actualReturn != null && !isNaN(actualReturn) ? actualReturn : null,
      });
    }
  }

  /* Also include BNN picks that haven't been scored in history yet */
  for (const t of guestTickers) {
    const alreadyMatched = matchedPicks.some((p) => p.ticker.replace(/\.(TO|TSX|V|CN)$/i, '') === t);
    if (!alreadyMatched) {
      matchedPicks.push({
        ticker: t,
        date: guestPickDates.get(t) || 'Recent',
        score: null,
        outcome: null,
        actualReturn: null,
      });
    }
  }

  const totalPicks = matchedPicks.length;
  const hitRate = resolvedCount >= 3 ? Number((correctCount / resolvedCount).toFixed(2)) : null;
  const avgReturn = returnCount > 0 ? Number((totalReturn / returnCount).toFixed(2)) : 0;

  return {
    guestName: guestName.trim(),
    totalPicks,
    resolvedPicks: resolvedCount,
    correctPicks: correctCount,
    hitRate,
    avgReturn,
    picks: matchedPicks,
  };
}
