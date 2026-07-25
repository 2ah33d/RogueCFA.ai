import { useState } from 'react';
import { saveKeys, saveProvider, saveYoutubeKey } from '../lib/storage';
import ProviderSelect from './ProviderSelect';

export default function KeySetup({ onComplete, className = '' }) {
  const [finnhubKey, setFinnhubKey] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [alphaVantageKey, setAlphaVantageKey] = useState('');
  const [youtubeKey, setYoutubeKey] = useState('');
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
    saveKeys(finnhubKey, llmKey, alphaVantageKey);
    saveProvider(provider);
    saveYoutubeKey(youtubeKey);
    onComplete();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in ${className}`}>
      <div className="w-full max-w-md mx-4 bg-surface-card border border-edge rounded-lg p-6 md:p-8 shadow-google-hover animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-xl font-bold text-prime">
              RogueCFA
            </span>
          </div>
          <h1 className="text-xl font-bold text-prime mb-1">Welcome</h1>
          <p className="text-dim text-xs leading-relaxed">
            Enter your API keys to get started. Keys are stored locally in your browser.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label htmlFor="key-finnhub" className="block text-xs font-semibold text-dim uppercase tracking-wider mb-1">
              Finnhub API Key *
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
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-lg text-prime placeholder-faint focus:outline-none focus:border-accent text-sm font-mono"
              autoComplete="off"
            />
            <a
              href="https://finnhub.io/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:text-accent-hover transition-colors mt-1 inline-block"
            >
              Get a free Finnhub key →
            </a>
          </div>

          <div>
            <label htmlFor="key-llm" className="block text-xs font-semibold text-dim uppercase tracking-wider mb-1">
              LLM API Key ({provider}) *
            </label>
            <input
              id="key-llm"
              type="password"
              value={llmKey}
              onChange={(e) => {
                setLlmKey(e.target.value);
                setError('');
              }}
              placeholder="Your LLM API key"
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-lg text-prime placeholder-faint focus:outline-none focus:border-accent text-sm font-mono"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="key-provider" className="block text-xs font-semibold text-dim uppercase tracking-wider mb-1">
              LLM Provider
            </label>
            <ProviderSelect value={provider} onChange={setProvider} />
          </div>

          <div>
            <label htmlFor="key-youtube" className="block text-xs font-semibold text-dim uppercase tracking-wider mb-1">
              YouTube Data API Key <span className="text-faint font-normal lowercase">(Optional — for Digest)</span>
            </label>
            <input
              id="key-youtube"
              type="password"
              value={youtubeKey}
              onChange={(e) => setYoutubeKey(e.target.value)}
              placeholder="Optional — enables MarketCall Digest"
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-lg text-prime placeholder-faint focus:outline-none focus:border-accent text-sm font-mono"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="key-alpha" className="block text-xs font-semibold text-dim uppercase tracking-wider mb-1">
              Alpha Vantage Key <span className="text-faint font-normal lowercase">(Optional)</span>
            </label>
            <input
              id="key-alpha"
              type="password"
              value={alphaVantageKey}
              onChange={(e) => setAlphaVantageKey(e.target.value)}
              placeholder="Optional — earnings & fundamentals"
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-lg text-prime placeholder-faint focus:outline-none focus:border-accent text-sm font-mono"
              autoComplete="off"
            />
          </div>

          {error && <p className="text-xs text-danger font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full py-2.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-hover transition-colors mt-2"
          >
            Save Keys &amp; Continue
          </button>
        </form>
      </div>
    </div>
  );
}
