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
import LandingPage from './components/LandingPage';

/* ── Google Antigravity System Tokens ── */
const THEME = `
:root {
  /* ——— Surfaces (Google Antigravity Soft Charcoal & Slate) ——— */
  --c-surface:          30 31 34;      /* #1E1F22 — Base background (faint warmth) */
  --c-surface-card:     42 44 49;      /* #2A2C31 — Card / panel surface */
  --c-surface-elevated: 48 50 57;      /* #303239 — Elevated surface (dropdowns, modals) */

  /* ——— Borders (Minimal to none — depth comes from soft elevation shadows) ——— */
  --c-edge:             255 255 255 / 0.04;

  /* ——— Text ——— */
  --c-prime:            227 227 227;   /* #E3E3E3 — Soft off-white primary text */
  --c-dim:              154 160 166;   /* #9AA0A6 — Soft muted grey secondary text */
  --c-faint:            110 115 122 / 0.5;  /* #6E737B — Soft dimmed placeholder text */

  /* ——— Accent (Google Soft Muted Blue #8AB4F8) ——— */
  --c-accent:           138 180 248;   /* #8AB4F8 — Soft Google dark mode blue */
  --c-accent-hover:     168 199 250;   /* #A8C7FA — Soft blue hover */
  --c-accent-muted:     138 180 248 / 0.15;

  /* ——— Functional Status Colours (Antigravity Soft Tint Pattern) ——— */
  --c-signal-buy:       129 201 149;   /* #81C995 — Soft muted green */
  --c-signal-watch:     253 226 147;   /* #FDE293 — Soft muted yellow */
  --c-signal-avoid:     242 139 130;   /* #F28B82 — Soft muted red */

  /* ——— Danger ——— */
  --c-danger:           242 139 130;   /* #F28B82 */
}
`;

export default function App() {
  /* ── State ── */
  const [keysReady, setKeysReady] = useState(checkHasKeys);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('landing'); /* Default root route: landing page */

  const [loading, setLoading] = useState(false);
  const [loadingTickers, setLoadingTickers] = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [currentHoldPeriod, setCurrentHoldPeriod] = useState('6M');
  const [toasts, setToasts] = useState([]);

  /* Prefilled inputs from BNN picks strip */
  const [prefilledTicker, setPrefilledTicker] = useState('');
  const [prefilledGuest, setPrefilledGuest] = useState(null);

  /* Modal for guest analyst track record */
  const [selectedGuest, setSelectedGuest] = useState(null);

  /* Resolve pending history outcomes on mount */
  useEffect(() => {
    resolveOutcomes().catch(() => {});
  }, []);

  /* Toast notification helper */
  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  /* Check keys on mount / when drawer closes */
  const refreshKeyStatus = useCallback(() => {
    setKeysReady(checkHasKeys());
  }, []);

  /* ── Batch Scoring Pipeline ── */
  const handleScore = useCallback(
    async (tickers, holdPeriod, analystGuest = null) => {
      const keys = getKeys();
      const provider = getProvider();

      if (!keys.finnhub) {
        addToast('Finnhub API Key is required to score tickers.');
        setShowSettings(true);
        return;
      }

      setLoading(true);
      setLoadingTickers(tickers);
      setScorecards([]);
      setComparisonResult(null);
      setCurrentHoldPeriod(holdPeriod);

      const activeGuest = analystGuest || prefilledGuest;

      const results = [];
      const failed = [];

      for (const ticker of tickers) {
        try {
          const finnhubData = await fetchTickerData(ticker, keys.finnhub);
          let alphaData = null;
          if (keys.alphavantage) {
            try {
              alphaData = await fetchAlphaVantageData(ticker, keys.alphavantage);
            } catch (err) {
              console.warn(`[App] AlphaVantage failed for ${ticker}, continuing with Finnhub data:`, err.message);
            }
          }

          const calc = calculateScore(finnhubData, alphaData, holdPeriod);
          const { systemPrompt, userPrompt } = buildPrompt(finnhubData, alphaData, calc, holdPeriod);
          const llmResult = await scoreWithLLM(provider, keys[provider] || keys.llm, systemPrompt, userPrompt);

          const scorecardData = {
            ...calc,
            ...llmResult,
            ticker,
            companyName: finnhubData.profile?.name || ticker,
            holdPeriod,
            scoredAt: new Date().toISOString(),
            guest: activeGuest,
          };

          results.push(scorecardData);
          saveScoreToHistory(scorecardData, holdPeriod);
        } catch (err) {
          console.error(`[App] Scoring failed for ${ticker}:`, err);
          failed.push({ ticker, reason: err.message || 'Scoring failed' });
        }
      }

      setScorecards(results);
      setLoadingTickers([]);

      if (results.length > 1) {
        try {
          const { systemPrompt, userPrompt } = buildComparisonPrompt(results, holdPeriod);
          const rawComp = await scoreWithLLM(provider, keys[provider] || keys.llm, systemPrompt, userPrompt);
          setComparisonResult(rawComp);
        } catch (err) {
          console.warn('[App] Comparative evaluation failed:', err.message);
        }
      }

      if (failed.length > 0) {
        const msg = failed.map((f) => `${f.ticker}: ${f.reason}`).join(' | ');
        addToast(`Could not score some tickers — ${msg}`);
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
          className="w-full border-b border-surface-card/40 bg-surface/80
                      backdrop-blur-md sticky top-0 z-30 shadow-antigravity"
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer select-none group"
              onClick={() => setActiveTab('landing')}
            >
              <img
                src="/logo.png"
                alt="RogueCFA Logo"
                className="w-8 h-8 object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
              />
              <span className="text-lg font-bold tracking-tight text-prime">
                RogueCFA
              </span>
            </div>

            <nav className="flex items-center gap-1 bg-surface-card p-1 rounded-full shadow-inner text-xs">
              <button
                onClick={() => setActiveTab('landing')}
                className={`px-4 py-1.5 rounded-full transition-all font-medium ${
                  activeTab === 'landing'
                    ? 'bg-surface-elevated text-prime font-semibold shadow-antigravity'
                    : 'text-dim hover:text-prime'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('score')}
                className={`px-4 py-1.5 rounded-full transition-all font-medium ${
                  activeTab === 'score'
                    ? 'bg-surface-elevated text-prime font-semibold shadow-antigravity'
                    : 'text-dim hover:text-prime'
                }`}
              >
                Score Ticker
              </button>
              <button
                onClick={() => setActiveTab('digest')}
                className={`px-4 py-1.5 rounded-full transition-all font-medium ${
                  activeTab === 'digest'
                    ? 'bg-surface-elevated text-prime font-semibold shadow-antigravity'
                    : 'text-dim hover:text-prime'
                }`}
              >
                Latest Picks
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-1.5 rounded-full transition-all font-medium ${
                  activeTab === 'history'
                    ? 'bg-surface-elevated text-prime font-semibold shadow-antigravity'
                    : 'text-dim hover:text-prime'
                }`}
              >
                Score History
              </button>
            </nav>

            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full
                         text-dim hover:text-prime hover:bg-surface-card
                         transition-all shadow-antigravity"
              aria-label="Open settings"
            >
              <svg
                className="w-4 h-4"
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
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 flex flex-col items-center gap-6">
          {activeTab === 'landing' ? (
            <LandingPage
              onLaunchTool={(tab = 'score') => setActiveTab(tab)}
              onSelectTicker={(ticker, guest) => {
                setPrefilledTicker(ticker);
                setPrefilledGuest(guest);
                setActiveTab('score');
              }}
              onSelectGuest={(guest) => setSelectedGuest(guest)}
            />
          ) : activeTab === 'score' ? (
            <>
              {/* Tool Screen: Dense, straight into function, NO HERO TITLE */}
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
              onScoreTicker={(ticker, guest) => {
                setPrefilledTicker(ticker);
                setPrefilledGuest(guest);
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

        {/* ── Footer ── */}
        <Disclaimer />

        {/* ── Settings Drawer ── */}
        {showSettings && (
          <SettingsPanel
            onClose={() => {
              setShowSettings(false);
              refreshKeyStatus();
            }}
            onKeysCleared={handleKeysCleared}
          />
        )}

        {/* ── Guest Analyst Modal ── */}
        {selectedGuest && (
          <GuestModal
            guestName={selectedGuest}
            onClose={() => setSelectedGuest(null)}
            onSelectTicker={(ticker, guest) => {
              setPrefilledTicker(ticker);
              if (guest) setPrefilledGuest(guest);
              setActiveTab('score');
            }}
          />
        )}

        {/* ── Toast Notifications ── */}
        {toasts.length > 0 && (
          <div className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full animate-fade-in font-sans">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="px-4 py-3 bg-surface-elevated rounded-2xl text-xs text-prime shadow-antigravity-elevated flex items-center justify-between gap-3 border-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-signal-avoid shrink-0" />
                  <span className="text-prime font-medium leading-snug">{t.message || t.msg}</span>
                </div>
                <button
                  onClick={() =>
                    setToasts((prev) => prev.filter((item) => item.id !== t.id))
                  }
                  className="text-dim hover:text-prime text-sm leading-none p-1 rounded-full hover:bg-surface-card transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
