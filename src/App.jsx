import { useState, useCallback, useEffect } from 'react';
import {
  hasKeys as checkHasKeys,
  getKeys,
  getProvider,
} from './lib/storage';
import { fetchTickerData } from './lib/finnhub';
import { fetchAlphaVantageData } from './lib/alphavantage';
import { calculateScore } from './lib/calculateScore';
import { buildPrompt, buildComparisonPrompt } from './lib/promptBuilder';
import { scoreWithLLM } from './lib/scorer';
import { resolveOutcomes, saveScoreToHistory } from './lib/historyManager';
import KeySetup from './components/KeySetup';
import ScoreForm from './components/ScoreForm';
import ScorecardGrid from './components/ScorecardGrid';
import Disclaimer from './components/Disclaimer';
import SettingsPanel from './components/SettingsPanel';
import HistoryTab from './components/HistoryTab';
import ComparisonMatrix from './components/ComparisonMatrix';
import MarketCallBar from './components/MarketCallBar';
import GuestModal from './components/GuestModal';
import DigestView from './components/DigestView';

/* ════════════════════════════════════════════════════════════════
   THEME — Every colour lives here as a CSS custom property.
   Change values to restyle the entire app without touching
   component logic. Format: space-separated RGB channels so
   Tailwind opacity modifiers (e.g. bg-accent/20) work.
   ════════════════════════════════════════════════════════════════ */
const THEME = `
:root {
  /* ——— Surfaces ——— */
  --c-surface:          6 6 14;        /* #06060e  — page background        */
  --c-surface-card:     13 13 31;      /* #0d0d1f  — card / panel fill      */
  --c-surface-elevated: 22 22 51;      /* #161633  — elevated elements      */

  /* ——— Borders ——— */
  --c-edge:             37 37 71;      /* #252547                           */

  /* ——— Text ——— */
  --c-prime:            228 228 237;   /* #e4e4ed  — primary text           */
  --c-dim:              152 152 184;   /* #9898b8  — secondary text         */
  --c-faint:            90 90 122;     /* #5a5a7a  — muted / placeholder    */

  /* ——— Accent (Indigo) ——— */
  --c-accent:           99 102 241;    /* #6366f1                           */
  --c-accent-hover:     129 140 248;   /* #818cf8                           */
  --c-accent-muted:     79 70 229;     /* #4f46e5                           */

  /* ——— Signal colours ——— */
  --c-signal-buy:       52 211 153;    /* #34d399  — green (BUY_SIGNAL)     */
  --c-signal-watch:     251 191 36;    /* #fbbf24  — yellow (WATCH)         */
  --c-signal-avoid:     248 113 113;   /* #f87171  — red (AVOID)            */

  /* ——— Danger ——— */
  --c-danger:           239 68 68;     /* #ef4444                           */
}
`;

/* ════════════════════════════════════════════════════════════════
   Toast notification (inline component — no extra file needed)
   ════════════════════════════════════════════════════════════════ */
function Toast({ message, type = 'error', onDismiss }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 6000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  const palette = {
    error:   'border-danger/30 bg-danger/10 text-danger',
    success: 'border-signal-buy/30 bg-signal-buy/10 text-signal-buy',
    warning: 'border-signal-watch/30 bg-signal-watch/10 text-signal-watch',
  };

  return (
    <div
      className={`px-4 py-3 rounded-xl border text-sm shadow-lg
                   backdrop-blur-sm animate-slide-right
                   ${palette[type] || palette.error}`}
    >
      <div className="flex items-start gap-2">
        <span className="flex-1 break-words">{message}</span>
        <button
          onClick={onDismiss}
          className="opacity-60 hover:opacity-100 transition-opacity text-xs mt-0.5
                     flex-shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   App
   ════════════════════════════════════════════════════════════════ */
export default function App() {
  const [keysReady, setKeysReady] = useState(checkHasKeys());
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('score'); /* 'score' | 'history' | 'digest' */
  const [scorecards, setScorecards] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loadingTickers, setLoadingTickers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [currentHoldPeriod, setCurrentHoldPeriod] = useState('6M');
  const [prefilledTicker, setPrefilledTicker] = useState('');
  const [prefilledGuest, setPrefilledGuest] = useState(null);
  const [selectedGuest, setSelectedGuest] = useState(null);

  /* ── Outcome resolution on app load ── */
  useEffect(() => {
    const { finnhubKey } = getKeys();
    if (finnhubKey) {
      resolveOutcomes(finnhubKey);
    }
  }, []);

  /* ── Toast helpers ── */
  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ── Core scoring pipeline (v2 architecture) ── */
  const handleScore = useCallback(
    async (tickers, holdPeriod, guestName = null) => {
      setLoading(true);
      setScorecards([]);
      setComparisonResult(null);
      setCurrentHoldPeriod(holdPeriod);
      setActiveTab('score');

      const { finnhubKey, llmKey, alphaVantageKey } = getKeys();
      const provider = getProvider();
      const computedCards = [];

      for (const ticker of tickers) {
        setLoadingTickers((prev) => [...prev, ticker]);

        try {
          /* 1. Fetch Finnhub data via proxy */
          const tickerData = await fetchTickerData(ticker, finnhubKey);

          /* 2. Fetch Alpha Vantage data (optional — silently degrades) */
          const alphaData = await fetchAlphaVantageData(ticker, alphaVantageKey);

          /* 3. MATH LAYER: Calculate deterministic score */
          const mathResult = calculateScore(tickerData, alphaData, holdPeriod);

          /* 4. Build prompt (passes math score + all data to LLM) */
          const { systemPrompt, userPrompt, limitedData, companyName } =
            buildPrompt(tickerData, alphaData, mathResult, holdPeriod, ticker);

          /* 5. LLM LAYER: Get narrative explanation */
          const result = await scoreWithLLM(
            systemPrompt,
            userPrompt,
            llmKey,
            provider,
            { ticker: ticker.toUpperCase(), ...mathResult }
          );

          /* 6. Enrich and display */
          const enriched = {
            ...result,
            entryPrice: tickerData?.quote?.c || null,
            exchange: tickerData?.profile?.exchange || null,
            currency: tickerData?.profile?.currency || null,
            country: tickerData?.profile?.country || null,
            limitedData,
            companyName: companyName || result.ticker,
            guest: guestName || prefilledGuest || null,
            scoredAt: new Date().toISOString(),
          };

          setScorecards((prev) => [...prev, enriched]);
          computedCards.push(enriched);
          saveScoreToHistory(enriched, holdPeriod);
        } catch (err) {
          addToast(`${ticker}: ${err.message}`);
        } finally {
          setLoadingTickers((prev) => prev.filter((t) => t !== ticker));
        }
      }

      /* Trigger Head-to-Head Comparative Narrative if multiple tickers succeeded */
      if (computedCards.length > 1) {
        try {
          const { systemPrompt, userPrompt } = buildComparisonPrompt(computedCards, holdPeriod);
          const compRes = await scoreWithLLM(
            systemPrompt,
            userPrompt,
            llmKey,
            provider,
            { isComparison: true, ticker: 'COMPARISON' }
          );
          setComparisonResult(compRes);
        } catch (err) {
          console.warn('Comparative analysis summary failed:', err.message);
        }
      }

      setLoading(false);
    },
    [addToast, prefilledGuest]
  );

  /* ── Key management ── */
  const handleKeysCleared = useCallback(() => {
    setKeysReady(false);
    setShowSettings(false);
    setScorecards([]);
  }, []);

  /* ── Render ── */
  return (
    <>
      <style>{THEME}</style>

      <div className="min-h-screen bg-surface text-prime flex flex-col">
        {/* Key setup modal (first visit) */}
        {!keysReady && <KeySetup onComplete={() => setKeysReady(true)} />}

        {/* ── Header ── */}
        <header
          className="w-full border-b border-edge bg-surface-card/50
                      backdrop-blur-md sticky top-0 z-30"
        >
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent
                            to-accent-muted flex items-center justify-center
                            shadow-lg shadow-accent/20"
              >
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="text-lg font-bold text-prime">
                RogueCFA<span className="text-accent">.ai</span>
              </span>
            </div>

            <nav className="flex items-center gap-1 bg-surface-elevated p-1 rounded-xl border border-edge text-xs font-semibold">
              <button
                onClick={() => setActiveTab('score')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'score'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-dim hover:text-prime'
                }`}
              >
                Score Ticker
              </button>
              <button
                onClick={() => setActiveTab('digest')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'digest'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-dim hover:text-prime'
                }`}
              >
                📺 Latest Picks
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'history'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-dim hover:text-prime'
                }`}
              >
                📊 Score History
              </button>
            </nav>

            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg
                         text-dim hover:text-prime hover:bg-surface-elevated
                         transition-colors"
              aria-label="Open settings"
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
                  strokeWidth={1.5}
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55
                     0 1.02.398 1.11.94l.213 1.281c.063.374.313.686
                     .645.87.074.04.147.083.22.127.324.196.72.257
                     1.075.124l1.217-.456a1.125 1.125 0
                     011.37.49l1.296 2.247a1.125 1.125 0
                     01-.26 1.431l-1.003.827c-.293.24-.438.613
                     -.431.992a6.759 6.759 0 010
                     .255c-.007.378.138.75.43.99l1.005.828c.424.35
                     .534.954.26 1.43l-1.298 2.247a1.125 1.125 0
                     01-1.369.491l-1.217-.456c-.355-.133-.75-.072
                     -1.076.124a6.57 6.57 0
                     01-.22.128c-.331.183-.581.495-.644.869l-.213
                     1.28c-.09.543-.56.941-1.11.941h-2.594c-.55
                     0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374
                     -.312-.686-.644-.87a6.52 6.52 0
                     01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217
                     .456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125
                     1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613
                     .43-.992a6.932 6.932 0 010-.255c.007-.378-.138
                     -.75-.43-.99l-1.004-.828a1.125 1.125 0
                     01-.26-1.43l1.297-2.247a1.125 1.125 0
                     011.37-.491l1.216.456c.356.133.751.072
                     1.076-.124.072-.044.146-.087.22-.128.332-.183
                     .582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main
          className="flex-1 w-full max-w-6xl mx-auto px-4 py-10
                      flex flex-col items-center gap-10"
        >
          {activeTab === 'score' ? (
            <>
              {/* Hero (hidden once results appear) */}
              {scorecards.length === 0 && loadingTickers.length === 0 && (
                <div className="text-center space-y-3 animate-fade-in">
                  <h2 className="text-3xl md:text-4xl font-extrabold text-prime">
                    AI-Powered Stock Scoring
                  </h2>
                  <p className="text-dim text-lg max-w-lg mx-auto leading-relaxed">
                    Enter a ticker, pick your hold period, and get an instant
                    investment scorecard backed by live data and AI analysis.
                  </p>
                </div>
              )}

              {/* BNN MarketCall Picks Strip */}
              <MarketCallBar
                onSelectTicker={(ticker, guest) => {
                  setPrefilledTicker(ticker);
                  setPrefilledGuest(guest);
                }}
                onSelectGuest={(guest) => setSelectedGuest(guest)}
              />

              <ScoreForm
                onScore={handleScore}
                loading={loading}
                prefilledTicker={prefilledTicker}
                prefilledGuest={prefilledGuest}
              />

              {scorecards.length > 1 && (
                <ComparisonMatrix
                  scorecards={scorecards}
                  comparisonResult={comparisonResult}
                />
              )}

              <ScorecardGrid
                scorecards={scorecards}
                loadingTickers={loadingTickers}
                holdPeriod={currentHoldPeriod}
                onSelectGuest={(guest) => setSelectedGuest(guest)}
              />
            </>
          ) : activeTab === 'digest' ? (
            <DigestView
              onScoreTicker={(ticker, guestName) => {
                setPrefilledTicker(ticker);
                setPrefilledGuest(guestName || null);
                setActiveTab('score');
              }}
              onSelectGuest={(guest) => setSelectedGuest(guest)}
              onOpenSettings={() => setShowSettings(true)}
            />
          ) : (
            <HistoryTab
              onSelectTicker={(ticker) => {
                setPrefilledTicker(ticker);
                setActiveTab('score');
              }}
            />
          )}
        </main>

        {/* ── Disclaimer ── */}
        <Disclaimer />

        {/* ── Settings panel ── */}
        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onKeysCleared={handleKeysCleared}
          />
        )}

        {/* ── Guest Track Record Modal ── */}
        {selectedGuest && (
          <GuestModal
            guestName={selectedGuest}
            onClose={() => setSelectedGuest(null)}
            onSelectTicker={(ticker, guest) => {
              setPrefilledTicker(ticker);
              setPrefilledGuest(guest);
              setActiveTab('score');
            }}
          />
        )}

        {/* ── Toast stack ── */}
        {toasts.length > 0 && (
          <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <Toast
                  message={toast.message}
                  type={toast.type}
                  onDismiss={() => removeToast(toast.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
