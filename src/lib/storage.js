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
  return {
    finnhubKey: localStorage.getItem(KEYS.FINNHUB) || '',
    llmKey: localStorage.getItem(KEYS.LLM) || '',
    alphaVantageKey: localStorage.getItem(KEYS.ALPHAVANTAGE) || '',
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
  return Boolean(
    localStorage.getItem(KEYS.FINNHUB) && localStorage.getItem(KEYS.LLM)
  );
}

export function clearKeys() {
  localStorage.removeItem(KEYS.FINNHUB);
  localStorage.removeItem(KEYS.LLM);
  localStorage.removeItem(KEYS.PROVIDER);
  localStorage.removeItem(KEYS.ALPHAVANTAGE);
}

/* ── LLM provider ── */

export function getProvider() {
  return localStorage.getItem(KEYS.PROVIDER) || 'gemini';
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
  return localStorage.getItem(KEYS.YOUTUBE) || '';
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
  return localStorage.getItem(KEYS.GROQ) || '';
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
