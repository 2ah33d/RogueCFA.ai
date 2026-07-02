/* ────────────────────────────────────────────
   localStorage key constants
   ──────────────────────────────────────────── */
const KEYS = {
  FINNHUB: 'roguecfa_finnhub_key',
  LLM: 'roguecfa_llm_key',
  PROVIDER: 'roguecfa_llm_provider',
  HISTORY: 'roguecfa_history',
};

/* ── API keys ── */

export function getKeys() {
  return {
    finnhubKey: localStorage.getItem(KEYS.FINNHUB) || '',
    llmKey: localStorage.getItem(KEYS.LLM) || '',
  };
}

export function saveKeys(finnhubKey, llmKey) {
  localStorage.setItem(KEYS.FINNHUB, finnhubKey.trim());
  localStorage.setItem(KEYS.LLM, llmKey.trim());
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
