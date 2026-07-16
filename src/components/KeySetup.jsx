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
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center
                   bg-black/70 backdrop-blur-sm animate-fade-in ${className}`}
    >
      <div
        className="w-full max-w-md mx-4 bg-surface-card border border-edge
                    rounded-2xl p-8 shadow-2xl shadow-accent/5 animate-slide-up
                    max-h-[90vh] overflow-y-auto"
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

          {/* Alpha Vantage key (optional) */}
          <div className="border-t border-edge pt-4">
            <label
              htmlFor="key-alphavantage"
              className="block text-sm font-medium text-dim mb-1.5"
            >
              Alpha Vantage API Key{' '}
              <span className="text-faint font-normal">(Optional — richer analysis)</span>
            </label>
            <input
              id="key-alphavantage"
              type="password"
              value={alphaVantageKey}
              onChange={(e) => {
                setAlphaVantageKey(e.target.value);
                setError('');
              }}
              placeholder="Optional — adds earnings & fundamentals data"
              className="w-full px-4 py-2.5 bg-surface border border-edge rounded-lg
                         text-prime placeholder-faint focus:outline-none
                         focus:border-accent focus:ring-1 focus:ring-accent/30
                         transition-colors"
              autoComplete="off"
            />
            <a
              href="https://www.alphavantage.co/support/#api-key"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:text-accent-hover
                         transition-colors mt-1 inline-block"
            >
              Get a free Alpha Vantage key →
            </a>
            <p className="text-xs text-faint mt-1">
              Adds P/E ratio, earnings beat history, revenue growth, and more.
              Without it, scoring uses analyst consensus and price data only.
            </p>
          </div>

          {/* YouTube API key (optional) */}
          <div className="border-t border-edge pt-4">
            <label
              htmlFor="key-youtube"
              className="block text-sm font-medium text-dim mb-1.5"
            >
              YouTube API Key{' '}
              <span className="text-faint font-normal">(Optional — MarketCall Digest)</span>
            </label>
            <input
              id="key-youtube"
              type="password"
              value={youtubeKey}
              onChange={(e) => {
                setYoutubeKey(e.target.value);
                setError('');
              }}
              placeholder="Optional — enables daily MarketCall digest"
              className="w-full px-4 py-2.5 bg-surface border border-edge rounded-lg
                         text-prime placeholder-faint focus:outline-none
                         focus:border-accent focus:ring-1 focus:ring-accent/30
                         transition-colors"
              autoComplete="off"
            />
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:text-accent-hover
                         transition-colors mt-1 inline-block"
            >
              Get a free YouTube Data API key →
            </a>
            <p className="text-xs text-faint mt-1">
              Enables the &quot;Today&apos;s Picks&quot; tab — auto-fetches and summarizes
              BNN MarketCall episodes so you never need to watch the 45-min broadcast.
            </p>
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
            Note: Keys are stored in your browser's localStorage only. They are
            never sent to any server except the API provider during scoring.
          </p>
        </form>
      </div>
    </div>
  );
}
