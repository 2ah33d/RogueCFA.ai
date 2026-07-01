import { useState } from 'react';
import {
  getKeys,
  getProvider,
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
  const { finnhubKey, llmKey } = getKeys();
  const [provider, setProvider] = useState(getProvider());
  const [confirmClearKeys, setConfirmClearKeys] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  const handleProviderChange = (val) => {
    setProvider(val);
    saveProvider(val);
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
          {/* API keys (read-only display) */}
          <section>
            <h3 className="text-xs font-semibold text-faint uppercase tracking-wider mb-3">
              API Keys
            </h3>
            <div className="space-y-3">
              <div className="bg-surface rounded-lg p-3 border border-edge">
                <div className="text-xs text-faint mb-1">Finnhub</div>
                <div className="text-sm text-prime font-mono">
                  {maskKey(finnhubKey)}
                </div>
              </div>
              <div className="bg-surface rounded-lg p-3 border border-edge">
                <div className="text-xs text-faint mb-1">
                  LLM ({provider})
                </div>
                <div className="text-sm text-prime font-mono">
                  {maskKey(llmKey)}
                </div>
              </div>
            </div>
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
            🔒 Keys are stored in your browser only. Clearing keys will require
            re-entry on next use.
          </p>
        </div>
      </div>
    </>
  );
}
