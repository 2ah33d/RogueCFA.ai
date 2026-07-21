import { useState } from 'react';
import {
  getKeys,
  getProvider,
  getYoutubeKey,
  getGroqKey,
  saveKeys,
  saveYoutubeKey,
  saveGroqKey,
  saveProvider,
  clearKeys,
  clearHistory,
} from '../lib/storage';
import ProviderSelect from './ProviderSelect';

function maskKey(key) {
  if (!key) return '—';
  if (key.length <= 8) return '••••••••';
  return '••••••••' + key.slice(-4);
}

export default function SettingsPanel({ onClose, onKeysCleared, className = '' }) {
  const storedKeys = getKeys();
  const storedYoutube = getYoutubeKey();
  const storedGroq = getGroqKey();
  const [finnhubKey, setFinnhubKey] = useState(storedKeys.finnhubKey);
  const [llmKey, setLlmKey] = useState(storedKeys.llmKey);
  const [alphaVantageKey, setAlphaVantageKey] = useState(storedKeys.alphaVantageKey);
  const [youtubeKey, setYoutubeKey] = useState(storedYoutube);
  const [groqKey, setGroqKey] = useState(storedGroq);
  
  const [provider, setProvider] = useState(getProvider());
  const [confirmClearKeys, setConfirmClearKeys] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);
  const [isEditingKeys, setIsEditingKeys] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* Debug Mode */
  const debugMatch = window.location.search.match(/debug=([^&]+)/);
  const debugSecret = debugMatch ? debugMatch[1] : null;
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugResult, setDebugResult] = useState(null);

  const handleDebugRun = async () => {
    setDebugLoading(true);
    setDebugResult(null);
    try {
      const res = await fetch('/api/marketcall-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeKey, llmKey, provider, groqKey, debugSecret
        })
      });
      const data = await res.json();
      setDebugResult(data);
    } catch (err) {
      setDebugResult({ error: err.message });
    } finally {
      setDebugLoading(false);
    }
  };

  const handleProviderChange = (val) => {
    setProvider(val);
    saveProvider(val);
  };

  const handleSaveKeys = (e) => {
    if (e) e.preventDefault();
    saveKeys(finnhubKey, llmKey, alphaVantageKey);
    saveYoutubeKey(youtubeKey);
    saveGroqKey(groqKey);
    setIsEditingKeys(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleCancelEdit = () => {
    const current = getKeys();
    setFinnhubKey(current.finnhubKey);
    setLlmKey(current.llmKey);
    setAlphaVantageKey(current.alphaVantageKey);
    setYoutubeKey(getYoutubeKey());
    setGroqKey(getGroqKey());
    setIsEditingKeys(false);
  };

  const handleClearKeys = () => {
    if (!confirmClearKeys) {
      setConfirmClearKeys(true);
      return;
    }
    clearKeys();
    onKeysCleared();
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistoryCleared(true);
    setTimeout(() => setHistoryCleared(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm
                     bg-surface-card border-l border-edge shadow-2xl
                     animate-slide-right flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-edge">
          <h2 className="text-lg font-semibold text-prime">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-dim hover:text-prime hover:bg-surface-elevated
                       transition-colors"
            aria-label="Close settings"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* API keys */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-faint uppercase tracking-wider">
                API Keys
              </h3>
              {saveSuccess && (
                <span className="text-xs font-semibold text-signal-buy animate-fade-in">
                  ✓ Saved!
                </span>
              )}
              {!isEditingKeys && (
                <button
                  type="button"
                  onClick={() => setIsEditingKeys(true)}
                  className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
                >
                  Edit / Add Keys
                </button>
              )}
            </div>

            {isEditingKeys ? (
              <form onSubmit={handleSaveKeys} className="space-y-3 bg-surface/50 p-3.5 rounded-xl border border-edge/80 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-medium text-dim mb-1">
                    Finnhub API Key <span className="text-danger">*</span>
                  </label>
                  <input
                    type="password"
                    value={finnhubKey}
                    onChange={(e) => setFinnhubKey(e.target.value)}
                    placeholder="Your Finnhub API key"
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded text-sm text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-dim mb-1">
                    LLM API Key ({provider}) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="Your LLM API key"
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded text-sm text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-dim mb-1">
                    YouTube Data API Key <span className="text-faint font-normal">(Digest)</span>
                  </label>
                  <input
                    type="password"
                    value={youtubeKey}
                    onChange={(e) => setYoutubeKey(e.target.value)}
                    placeholder="Optional — enables MarketCall Digest"
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded text-sm text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-dim mb-1">
                    Alpha Vantage Key <span className="text-faint font-normal">(Optional)</span>
                  </label>
                  <input
                    type="password"
                    value={alphaVantageKey}
                    onChange={(e) => setAlphaVantageKey(e.target.value)}
                    placeholder="Optional — earnings & fundamentals"
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded text-sm text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-dim mb-1">
                    Groq API Key <span className="text-faint font-normal">(Free Audio Whisper)</span>
                  </label>
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="Optional — gsk_... for free MP3 audio transcription"
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded text-sm text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-gradient-to-r from-accent to-accent-muted text-white text-xs font-semibold rounded-lg hover:from-accent-hover hover:to-accent transition-all shadow-md shadow-accent/20"
                  >
                    Save Keys
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-2 bg-surface border border-edge text-dim hover:text-prime text-xs font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-1">Finnhub</div>
                    <div className="text-sm text-prime font-mono">
                      {maskKey(finnhubKey)}
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-1">
                      LLM ({provider})
                    </div>
                    <div className="text-sm text-prime font-mono">
                      {maskKey(llmKey)}
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-1">YouTube Data API (MarketCall Digest)</div>
                    <div className="text-sm text-prime font-mono">
                      {youtubeKey ? maskKey(youtubeKey) : <span className="text-faint italic">Not set</span>}
                    </div>
                  </div>
                  {!youtubeKey && (
                    <button
                      onClick={() => setIsEditingKeys(true)}
                      className="text-xs font-semibold text-accent hover:text-accent-hover bg-accent/10 border border-accent/20 px-2 py-1 rounded"
                    >
                      + Add Key
                    </button>
                  )}
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-1">Alpha Vantage (optional)</div>
                    <div className="text-sm text-prime font-mono">
                      {alphaVantageKey ? maskKey(alphaVantageKey) : <span className="text-faint italic">Not set</span>}
                    </div>
                  </div>
                  {!alphaVantageKey && (
                    <button
                      onClick={() => setIsEditingKeys(true)}
                      className="text-xs font-semibold text-accent hover:text-accent-hover bg-accent/10 border border-accent/20 px-2 py-1 rounded"
                    >
                      + Add Key
                    </button>
                  )}
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-1">Groq Whisper (Free MP3 Transcription)</div>
                    <div className="text-sm text-prime font-mono">
                      {groqKey ? maskKey(groqKey) : <span className="text-faint italic">Not set</span>}
                    </div>
                  </div>
                  {!groqKey && (
                    <button
                      onClick={() => setIsEditingKeys(true)}
                      className="text-xs font-semibold text-accent hover:text-accent-hover bg-accent/10 border border-accent/20 px-2 py-1 rounded"
                    >
                      + Add Key
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Provider */}
          <section>
            <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-3">
              LLM Provider
            </h3>
            <ProviderSelect value={provider} onChange={handleProviderChange} />
          </section>

          {/* Danger zone */}
          <section className="border-t border-edge pt-6 space-y-3">
            {debugSecret && (
              <div className="bg-surface rounded-lg border border-accent p-3 mb-4 animate-fade-in shadow-[0_0_15px_rgba(var(--color-accent),0.15)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black tracking-widest text-accent uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                    Debug Mode Active
                  </span>
                </div>
                <button
                  onClick={handleDebugRun}
                  disabled={debugLoading}
                  className="w-full py-2.5 bg-accent/10 border border-accent/20 text-accent rounded-lg text-xs font-bold hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {debugLoading ? 'Running Pipeline (~40-90s)...' : 'Force Regenerate (Isolated)'}
                </button>
                {debugResult && (
                  <pre className="mt-3 text-[10px] bg-[#0a0a0a] border border-edge p-2.5 rounded-lg text-faint overflow-x-auto max-h-48 font-mono leading-relaxed">
                    {JSON.stringify(debugResult, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={handleClearHistory}
              className="w-full py-2.5 px-4 bg-surface border border-edge rounded-lg
                         text-dim hover:text-prime hover:border-edge
                         transition-colors text-sm"
            >
              {historyCleared ? '✓ History cleared' : 'Clear Score History'}
            </button>

            <button
              onClick={handleClearKeys}
              className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium
                          transition-all ${
                            confirmClearKeys
                              ? 'bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20'
                              : 'bg-surface border border-edge text-dim hover:text-danger hover:border-danger/30'
                          }`}
            >
              {confirmClearKeys
                ? 'Click again to confirm — this will sign you out'
                : 'Clear All Keys'}
            </button>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-edge">
          <p className="text-xs text-faint text-center leading-relaxed">
            Note: Keys are stored in your browser only. Clearing keys will require
            re-entry on next use.
          </p>
        </div>
      </div>
    </>
  );
}
