/* ────────────────────────────────────────────
   localStorage key constants
   ──────────────────────────────────────────── */
const KEYS = {
  FINNHUB: 'roguecfa_finnhub_key',
  LLM: 'roguecfa_llm_key',
  PROVIDER: 'roguecfa_llm_provider',
  ALPHAVANTAGE: 'roguecfa_alphavantage_key',
  YOUTUBE: 'roguecfa_youtube_key',
  GROQ: 'roguecfa_groq_key',
  HISTORY: 'roguecfa_history',
  DIGEST_PREFIX: 'marketcall_digest_',
};

/* ── API keys ── */

export function getKeys() {
  const finnhubKey = localStorage.getItem(KEYS.FINNHUB) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FINNHUB_KEY) || '';
  const llmKey = localStorage.getItem(KEYS.LLM) || (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_LLM_KEY || import.meta.env?.VITE_GEMINI_KEY)) || '';
  const alphaVantageKey = localStorage.getItem(KEYS.ALPHAVANTAGE) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALPHAVANTAGE_KEY) || '';
  return {
    finnhubKey,
    llmKey,
    alphaVantageKey,
    /* Property aliases for compatibility across all callers */
    finnhub: finnhubKey,
    llm: llmKey,
    alphavantage: alphaVantageKey,
  };
}

export function saveKeys(finnhubKey, llmKey, alphaVantageKey) {
  localStorage.setItem(KEYS.FINNHUB, finnhubKey.trim());
  localStorage.setItem(KEYS.LLM, llmKey.trim());
  if (alphaVantageKey !== undefined) {
    localStorage.setItem(KEYS.ALPHAVANTAGE, (alphaVantageKey || '').trim());
  }
}

export function hasKeys() {
  /* Bypass mandatory BYOK screen modal: environment variables and backend process.env fallbacks are available */
  return true;
}

export function clearKeys() {
  localStorage.removeItem(KEYS.FINNHUB);
  localStorage.removeItem(KEYS.LLM);
  localStorage.removeItem(KEYS.PROVIDER);
  localStorage.removeItem(KEYS.ALPHAVANTAGE);
  localStorage.removeItem(KEYS.YOUTUBE);
  localStorage.removeItem(KEYS.GROQ);
}

/* ── LLM provider ── */

export function getProvider() {
  return localStorage.getItem(KEYS.PROVIDER) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LLM_PROVIDER) || 'gemini';
}

export function saveProvider(provider) {
  localStorage.setItem(KEYS.PROVIDER, provider);
}

/* ── Score history ── */

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]');
  } catch {
    return [];
  }
}

export function addToHistory(entry) {
  const history = getHistory();
  history.unshift({
    ...entry,
    scoredAt: entry.scoredAt || new Date().toISOString(),
  });
  /* Keep last 50 entries */
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(history.slice(0, 50)));
}

export function clearHistory() {
  localStorage.removeItem(KEYS.HISTORY);
}

/* ── YouTube API key (optional — for MarketCall Digest) ── */

export function getYoutubeKey() {
  return localStorage.getItem(KEYS.YOUTUBE) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_YOUTUBE_KEY) || '';
}

export function saveYoutubeKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(KEYS.YOUTUBE, key.trim());
  } else {
    localStorage.removeItem(KEYS.YOUTUBE);
  }
}

/* ── Groq API key (for Free Whisper Audio Transcription) ── */

export function getGroqKey() {
  return localStorage.getItem(KEYS.GROQ) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_KEY) || '';
}

export function saveGroqKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(KEYS.GROQ, key.trim());
  } else {
    localStorage.removeItem(KEYS.GROQ);
  }
}

/* ── MarketCall Digest cache (per-date) ── */

export function getDigestCache(dateStr) {
  try {
    const raw = localStorage.getItem(KEYS.DIGEST_PREFIX + dateStr);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDigestCache(dateStr, digest) {
  try {
    if (!digest) {
      localStorage.removeItem(KEYS.DIGEST_PREFIX + dateStr);
      return;
    }
    localStorage.setItem(KEYS.DIGEST_PREFIX + dateStr, JSON.stringify(digest));
    /* Clean up old digest caches (keep last 7 days) */
    const today = new Date();
    for (let i = 8; i < 30; i++) {
      const old = new Date(today);
      old.setDate(old.getDate() - i);
      const oldKey = KEYS.DIGEST_PREFIX + old.toISOString().split('T')[0];
      localStorage.removeItem(oldKey);
    }
  } catch (err) {
    console.warn('Failed to cache digest:', err.message);
  }
}

export function clearAllDigestCaches() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEYS.DIGEST_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.warn('Failed to clear digest caches:', err.message);
  }
}
