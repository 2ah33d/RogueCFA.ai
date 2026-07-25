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
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm
                     bg-surface-card border-l border-edge shadow-google-hover
                     animate-slide-right flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-edge">
          <h2 className="text-base font-semibold text-prime">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-dim hover:text-prime hover:bg-surface-elevated
                       transition-colors text-base"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 font-sans">
          {/* API keys */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-dim uppercase tracking-wider">
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
              <form onSubmit={handleSaveKeys} className="space-y-3 bg-surface-elevated p-3.5 rounded-lg border border-edge animate-fade-in">
                <div>
                  <label className="block text-[11px] font-medium text-dim mb-1">
                    Finnhub API Key <span className="text-danger">*</span>
                  </label>
                  <input
                    type="password"
                    value={finnhubKey}
                    onChange={(e) => setFinnhubKey(e.target.value)}
                    placeholder="Your Finnhub API key"
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
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
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
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
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
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
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
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
                    className="w-full px-3 py-1.5 bg-surface border border-edge rounded-lg text-xs text-prime font-mono placeholder-faint focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    Save Keys
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-2 bg-surface border border-edge text-dim hover:text-prime text-xs font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2.5">
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-0.5">Finnhub</div>
                    <div className="text-xs text-prime font-mono">
                      {maskKey(finnhubKey)}
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-0.5">
                      LLM ({provider})
                    </div>
                    <div className="text-xs text-prime font-mono">
                      {maskKey(llmKey)}
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-0.5">YouTube Data API</div>
                    <div className="text-xs text-prime font-mono">
                      {youtubeKey ? maskKey(youtubeKey) : <span className="text-faint italic">Not set</span>}
                    </div>
                  </div>
                  {!youtubeKey && (
                    <button
                      onClick={() => setIsEditingKeys(true)}
                      className="text-xs font-semibold text-accent hover:text-accent-hover bg-surface-elevated border border-edge px-2 py-1 rounded-lg"
                    >
                      + Add Key
                    </button>
                  )}
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-0.5">Alpha Vantage</div>
                    <div className="text-xs text-prime font-mono">
                      {alphaVantageKey ? maskKey(alphaVantageKey) : <span className="text-faint italic">Not set</span>}
                    </div>
                  </div>
                  {!alphaVantageKey && (
                    <button
                      onClick={() => setIsEditingKeys(true)}
                      className="text-xs font-semibold text-accent hover:text-accent-hover bg-surface-elevated border border-edge px-2 py-1 rounded-lg"
                    >
                      + Add Key
                    </button>
                  )}
                </div>
                <div className="bg-surface rounded-lg p-3 border border-edge flex items-center justify-between">
                  <div>
                    <div className="text-xs text-faint mb-0.5">Groq Whisper</div>
                    <div className="text-xs text-prime font-mono">
                      {groqKey ? maskKey(groqKey) : <span className="text-faint italic">Not set</span>}
                    </div>
                  </div>
                  {!groqKey && (
                    <button
                      onClick={() => setIsEditingKeys(true)}
                      className="text-xs font-semibold text-accent hover:text-accent-hover bg-surface-elevated border border-edge px-2 py-1 rounded-lg"
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
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wider mb-2.5">
              LLM Provider
            </h3>
            <ProviderSelect value={provider} onChange={handleProviderChange} />
          </section>

          {/* Danger zone */}
          <section className="border-t border-edge pt-5 space-y-2.5">
            {debugSecret && (
              <div className="bg-surface rounded-lg border border-accent p-3 mb-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold tracking-wider text-accent uppercase">
                    Debug Mode Active
                  </span>
                </div>
                <button
                  onClick={handleDebugRun}
                  disabled={debugLoading}
                  className="w-full py-2 bg-surface-elevated border border-edge text-accent rounded-lg text-xs font-semibold hover:bg-surface-card transition-colors disabled:opacity-50"
                >
                  {debugLoading ? 'Running Pipeline...' : 'Force Regenerate'}
                </button>
                {debugResult && (
                  <pre className="mt-3 text-[10px] bg-surface-elevated border border-edge p-2.5 rounded-lg text-faint overflow-x-auto max-h-48 font-mono">
                    {JSON.stringify(debugResult, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={handleClearHistory}
              className="w-full py-2.5 px-4 bg-surface border border-edge rounded-lg
                         text-dim hover:text-prime transition-colors text-xs font-medium"
            >
              {historyCleared ? '✓ History cleared' : 'Clear Score History'}
            </button>

            <button
              onClick={handleClearKeys}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-medium transition-colors ${
                confirmClearKeys
                  ? 'bg-danger/10 border border-danger/30 text-danger'
                  : 'bg-surface border border-edge text-dim hover:text-danger'
              }`}
            >
              {confirmClearKeys
                ? 'Click again to confirm — sign out'
                : 'Clear All Keys'}
            </button>
          </section>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-edge">
          <p className="text-xs text-faint text-center leading-relaxed">
            Keys are stored in your browser only.
          </p>
        </div>
      </div>
    </>
  );
}
