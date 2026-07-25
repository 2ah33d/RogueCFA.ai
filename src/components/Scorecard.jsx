import React, { useEffect, useRef } from 'react';
import { saveScoreToHistory } from '../lib/historyManager';

const HOLD_LABELS = {
  '1M': '1 Month',
  '3M': '3 Months',
  '6M': '6 Months',
  '1Y': '1 Year',
  '3Y': '3 Years',
};

const SIGNAL = {
  BUY_SIGNAL: {
    label: 'BUY',
    textClass: 'text-signal-buy',
    badgeBg: 'bg-signal-buy/10',
    badgeBorder: 'border-signal-buy/30',
    strokeVar: '--c-signal-buy',
  },
  WATCH: {
    label: 'WATCH',
    textClass: 'text-signal-watch',
    badgeBg: 'bg-signal-watch/10',
    badgeBorder: 'border-signal-watch/30',
    strokeVar: '--c-signal-watch',
  },
  AVOID: {
    label: 'AVOID',
    textClass: 'text-signal-avoid',
    badgeBg: 'bg-signal-avoid/10',
    badgeBorder: 'border-signal-avoid/30',
    strokeVar: '--c-signal-avoid',
  },
};

/* Score breakdown segment colors */
const BREAKDOWN_COLORS = {
  consensus: { bg: 'bg-accent', label: 'Consensus' },
  momentum: { bg: 'bg-signal-watch', label: 'Momentum' },
  valuation: { bg: 'bg-signal-buy', label: 'Valuation' },
  earnings: { bg: 'bg-purple-500', label: 'Earnings' },
  newsSentiment: { bg: 'bg-blue-500', label: 'News Sentiment' },
};

/* ── Score Breakdown Bar ── */
function ScoreBreakdownBar({ breakdown }) {
  if (!breakdown || Object.keys(breakdown).length === 0) return null;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-dim uppercase tracking-wider">
        Score Breakdown
      </h4>
      {/* Stacked bar */}
      <div className="h-2.5 rounded-lg overflow-hidden flex bg-surface-elevated">
        {Object.entries(breakdown).map(([key, value]) => {
          const config = BREAKDOWN_COLORS[key] || { bg: 'bg-dim', label: key };
          const pct = (value / 100) * 100;
          return (
            <div
              key={key}
              className={`${config.bg} transition-all duration-500 ease-out`}
              style={{ width: `${pct}%` }}
              title={`${config.label}: ${value.toFixed(1)}`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(breakdown).map(([key, value]) => {
          const config = BREAKDOWN_COLORS[key] || { bg: 'bg-dim', label: key };
          return (
            <div key={key} className="flex items-center gap-1.5 font-sans">
              <div className={`w-2.5 h-2.5 rounded-sm ${config.bg}`} />
              <span className="text-xs text-dim">
                {config.label}: <span className="text-prime font-mono font-medium">{value.toFixed(1)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Scorecard({ data, holdPeriod, onSelectGuest, className = '' }) {
  const {
    ticker,
    score,
    grade,
    signal,
    score_breakdown: breakdown,
    hasAlphaVantage,
    analyst_consensus: consensus,
    thesis,
    sentiment_summary: sentiment,
    timeframe_verdict: verdict,
    key_risks: risks,
    key_catalysts: catalysts,
    watch_for: watchFor,
    companyName,
    limitedData,
    coverageDepth,
    coverageModifier,
    entryPrice,
    exchange,
    currency,
    country,
    guest,
    scoredAt,
  } = data || {};

  const savedRef = useRef(false);

  useEffect(() => {
    if (data && data.ticker && data.score != null && !savedRef.current) {
      savedRef.current = true;
      saveScoreToHistory(data, holdPeriod || '6M');
    }
  }, [data, holdPeriod]);

  if (!data || !ticker) return null;

  const s = SIGNAL[signal] || SIGNAL.WATCH;

  const isTSX =
    ticker?.toUpperCase().endsWith('.TO') ||
    ticker?.toUpperCase().endsWith('.V') ||
    exchange?.toUpperCase().includes('TORONTO') ||
    exchange?.toUpperCase().includes('TSX') ||
    currency === 'CAD' ||
    country === 'CA';

  const RADIUS = 44;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeOffset = CIRCUMFERENCE - (clampedScore / 100) * CIRCUMFERENCE;

  return (
    <article
      className={`bg-surface-card border border-edge rounded-lg overflow-hidden transition-shadow hover:shadow-google-hover ${className}`}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-edge flex items-start justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h3 className="text-2xl font-bold text-prime font-mono tracking-wide">
              {ticker}
            </h3>
            {entryPrice != null && (
              <span className="text-sm font-semibold text-dim font-mono bg-surface-elevated px-2.5 py-0.5 rounded-lg border border-edge">
                {isTSX ? 'CAD ' : ''}${Number(entryPrice).toFixed(2)}
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-lg
                          text-xs font-semibold uppercase tracking-wider
                          ${s.badgeBg} border ${s.badgeBorder} ${s.textClass}`}
            >
              {s.label}
            </span>
            {isTSX && (
              <span
                className="inline-flex items-center text-xs font-medium text-dim bg-surface-elevated border border-edge px-2.5 py-0.5 rounded-lg"
                title="Toronto Stock Exchange / Canadian Asset"
              >
                TSX
              </span>
            )}
            {guest && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectGuest) onSelectGuest(guest);
                }}
                className="inline-flex items-center text-xs font-medium text-accent hover:text-accent-hover bg-surface-elevated border border-edge px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer"
                title={`BNN MarketCall pick by ${guest}. Click for track record.`}
              >
                BNN Pick: {guest}
              </button>
            )}
          </div>
          {companyName && companyName !== ticker && (
            <p className="text-sm text-dim">{companyName}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {isTSX && (
              <span className="inline-flex items-center text-xs text-faint bg-surface-elevated border border-edge px-2 py-0.5 rounded-lg">
                CAD Currency &amp; TSX Peer Framing
              </span>
            )}
            {limitedData && (
              <span className="inline-flex items-center text-xs text-signal-watch bg-signal-watch/10 border border-signal-watch/20 px-2 py-0.5 rounded-lg">
                Limited Data
              </span>
            )}
            {coverageDepth != null && coverageDepth <= 10 && (
              <span
                className="inline-flex items-center text-xs text-signal-watch bg-signal-watch/10 border border-signal-watch/20 px-2 py-0.5 rounded-lg"
                title={`Analyst consensus weighted at ${(coverageModifier * 100).toFixed(0)}% due to low coverage depth (${coverageDepth} analysts)`}
              >
                Low Coverage ({coverageDepth} Analysts — {(coverageModifier * 100).toFixed(0)}% Wt)
              </span>
            )}
            {hasAlphaVantage === false && (
              <span className="inline-flex items-center text-xs text-faint bg-surface-elevated border border-edge px-2 py-0.5 rounded-lg">
                Finnhub Only
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-dim whitespace-nowrap font-medium">
          {HOLD_LABELS[holdPeriod] || holdPeriod}
        </span>
      </div>

      {/* ── Score ring + grade ── */}
      <div className="px-6 py-6 flex items-center gap-6 border-b border-edge">
        {/* Circular score gauge */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
            <circle
              cx="56"
              cy="56"
              r={RADIUS}
              fill="none"
              stroke="rgb(var(--c-edge))"
              strokeWidth="6"
            />
            <circle
              cx="56"
              cy="56"
              r={RADIUS}
              fill="none"
              stroke={`rgb(var(${s.strokeVar}))`}
              strokeWidth="6"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
            <span className={`text-3xl font-bold ${s.textClass}`}>
              {clampedScore}
            </span>
            <span className="text-xs text-faint">/100</span>
          </div>
        </div>

        {/* Grade + consensus */}
        <div className="space-y-3 min-w-0 font-sans">
          <div>
            <span className="text-xs text-dim uppercase tracking-wider font-semibold">
              Grade
            </span>
            <p className="text-3xl font-bold text-prime font-mono">{grade}</p>
          </div>
          {consensus && (
            <div>
              <span className="text-xs text-dim uppercase tracking-wider font-semibold">
                Consensus
              </span>
              <p className="text-sm text-dim leading-snug">{consensus.label}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5 space-y-5 font-sans">
        {/* Score Breakdown Bar */}
        <ScoreBreakdownBar breakdown={breakdown} />

        {/* Investment Thesis */}
        {thesis && (
          <div>
            <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-1.5">
              Investment Thesis
            </h4>
            <p className="text-sm text-prime leading-relaxed">
              {thesis}
            </p>
          </div>
        )}

        {/* Sentiment */}
        {sentiment && (
          <div>
            <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-1.5">
              Sentiment
            </h4>
            <p className="text-sm text-dim leading-relaxed">{sentiment}</p>
          </div>
        )}

        {/* Timeframe verdict */}
        {verdict && (
          <div>
            <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-1.5">
              Timeframe Verdict
            </h4>
            <p className="text-sm text-prime leading-relaxed font-medium">
              {verdict}
            </p>
          </div>
        )}

        {/* Watch For */}
        {watchFor && (
          <div className="bg-surface-elevated border border-edge rounded-lg px-4 py-3">
            <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-1">
              Watch For
            </h4>
            <p className="text-sm text-prime leading-relaxed">{watchFor}</p>
          </div>
        )}

        {/* Risks / Catalysts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {risks && risks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-2">
                Key Risks
              </h4>
              <ul className="space-y-1.5">
                {risks.map((risk, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-dim"
                  >
                    <span className="text-signal-avoid mt-0.5 text-xs">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {catalysts && catalysts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-2">
                Key Catalysts
              </h4>
              <ul className="space-y-1.5">
                {catalysts.map((catalyst, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-dim"
                  >
                    <span className="text-signal-buy mt-0.5 text-xs">•</span>
                    {catalyst}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-3 bg-surface border-t border-edge text-xs text-dim flex items-center justify-between font-sans">
        <span className="font-mono">
          {scoredAt ? new Date(scoredAt).toLocaleString() : ''}
        </span>
        <span className="italic">Not financial advice</span>
      </div>
    </article>
  );
}
