import { useState } from 'react';
import { saveKeys, saveProvider } from '../lib/storage';
import ProviderSelect from './ProviderSelect';

export default function KeySetup({ onComplete, className = '' }) {
  const [finnhubKey, setFinnhubKey] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!finnhubKey.trim()) {
      setError('Finnhub API key is required.');
      return;
    }
    if (!llmKey.trim()) {
      setError('LLM API key is required.');
      return;
    }
    saveKeys(finnhubKey, llmKey);
    saveProvider(provider);
    onComplete();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center
                   bg-black/70 backdrop-blur-sm animate-fade-in ${className}`}
    >
      <div
        className="w-full max-w-md mx-4 bg-surface-card border border-edge
                    rounded-2xl p-8 shadow-2xl shadow-accent/5 animate-slide-up"
      >
        {/* ── Brand header ── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent
                          to-accent-muted flex items-center justify-center
                          shadow-lg shadow-accent/25"
            >
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="text-xl font-bold text-prime">
              RogueCFA<span className="text-accent">.ai</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-prime mb-2">Welcome</h1>
          <p className="text-dim text-sm leading-relaxed">
            Enter your API keys to get started. Keys are stored locally in your
            browser — never sent to our servers.
          </p>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Finnhub key */}
          <div>
            <label
              htmlFor="key-finnhub"
              className="block text-sm font-medium text-dim mb-1.5"
            >
              Finnhub API Key
            </label>
            <input
              id="key-finnhub"
              type="password"
              value={finnhubKey}
              onChange={(e) => {
                setFinnhubKey(e.target.value);
                setError('');
              }}
              placeholder="Your Finnhub API key"
              className="w-full px-4 py-2.5 bg-surface border border-edge rounded-lg
                         text-prime placeholder-faint focus:outline-none
                         focus:border-accent focus:ring-1 focus:ring-accent/30
                         transition-colors"
              autoComplete="off"
            />
            <a
              href="https://finnhub.io/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:text-accent-hover
                         transition-colors mt-1 inline-block"
            >
              Get a free Finnhub key →
            </a>
          </div>

          {/* LLM key */}
          <div>
            <label
              htmlFor="key-llm"
              className="block text-sm font-medium text-dim mb-1.5"
            >
              LLM API Key
            </label>
            <input
              id="key-llm"
              type="password"
              value={llmKey}
              onChange={(e) => {
                setLlmKey(e.target.value);
                setError('');
              }}
              placeholder="Your LLM provider API key"
              className="w-full px-4 py-2.5 bg-surface border border-edge rounded-lg
                         text-prime placeholder-faint focus:outline-none
                         focus:border-accent focus:ring-1 focus:ring-accent/30
                         transition-colors"
              autoComplete="off"
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-dim mb-1.5">
              LLM Provider
            </label>
            <ProviderSelect value={provider} onChange={setProvider} />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-danger animate-fade-in">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-accent to-accent-muted
                       text-white font-semibold rounded-lg
                       hover:from-accent-hover hover:to-accent
                       transition-all duration-200
                       shadow-lg shadow-accent/20 hover:shadow-accent/30
                       active:scale-[0.98]"
          >
            Get Started
          </button>

          <p className="text-xs text-faint text-center leading-relaxed">
            🔒 Keys are stored in your browser's localStorage only. They are
            never sent to any server except the API provider during scoring.
          </p>
        </form>
      </div>
    </div>
  );
}
