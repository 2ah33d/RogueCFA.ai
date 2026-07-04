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
  earnings: { bg: 'bg-purple-400', label: 'Earnings' },
  newsSentiment: { bg: 'bg-blue-400', label: 'News Sentiment' },
};

/* ── Score Breakdown Bar ── */
function ScoreBreakdownBar({ breakdown }) {
  if (!breakdown || Object.keys(breakdown).length === 0) return null;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-faint uppercase tracking-wider">
        Score Breakdown
      </h4>
      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-surface-elevated">
        {Object.entries(breakdown).map(([key, value]) => {
          const config = BREAKDOWN_COLORS[key] || { bg: 'bg-dim', label: key };
          const pct = (value / 100) * 100; /* value is out of its max weight, total is ~100 */
          return (
            <div
              key={key}
              className={`${config.bg} transition-all duration-700 ease-out`}
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
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${config.bg}`} />
              <span className="text-xs text-dim">
                {config.label}: <span className="text-prime font-medium">{value.toFixed(1)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Scorecard({ data, holdPeriod, className = '' }) {
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
    scoredAt,
  } = data;

  const s = SIGNAL[signal] || SIGNAL.WATCH;

  const isTSX =
    ticker?.toUpperCase().endsWith('.TO') ||
    ticker?.toUpperCase().endsWith('.V') ||
    exchange?.toUpperCase().includes('TORONTO') ||
    exchange?.toUpperCase().includes('TSX') ||
    currency === 'CAD' ||
    country === 'CA';

  /* SVG score ring */
  const RADIUS = 44;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeOffset = CIRCUMFERENCE - (clampedScore / 100) * CIRCUMFERENCE;

  return (
    <article
      className={`bg-surface-card border border-edge rounded-2xl overflow-hidden
                   shadow-xl shadow-black/20 animate-slide-up ${className}`}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-edge flex items-start justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h3 className="text-2xl font-bold text-prime font-mono tracking-wide">
              {ticker}
            </h3>
            {entryPrice != null && (
              <span className="text-base font-semibold text-prime font-mono bg-surface-elevated px-2.5 py-0.5 rounded border border-edge">
                {isTSX ? 'CAD ' : ''}${Number(entryPrice).toFixed(2)}
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full
                          text-xs font-bold uppercase tracking-wider
                          ${s.badgeBg} border ${s.badgeBorder} ${s.textClass}
                          animate-pulse-signal`}
            >
              {s.label}
            </span>
            {isTSX && (
              <span
                className="inline-flex items-center gap-1 text-xs font-bold font-mono
                            text-red-400 bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 rounded-full shadow-sm"
                title="Toronto Stock Exchange / Canadian Asset"
              >
                🇨A TSX
              </span>
            )}
          </div>
          {companyName && companyName !== ticker && (
            <p className="text-sm text-dim">{companyName}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {isTSX && (
              <span
                className="inline-flex items-center gap-1 text-xs font-mono
                            text-red-300 bg-red-950/40 border border-red-800/50 px-2 py-0.5 rounded-full"
              >
                🇨A CAD Currency & TSX Peer Framing
              </span>
            )}
            {limitedData && (
              <span
                className="inline-flex items-center gap-1 text-xs
                            text-signal-watch bg-signal-watch/10
                            border border-signal-watch/20 px-2 py-0.5 rounded-full"
              >
                ⚠ Limited Data
              </span>
            )}
            {coverageDepth != null && coverageDepth <= 10 && (
              <span
                className="inline-flex items-center gap-1 text-xs
                            text-signal-watch bg-signal-watch/10
                            border border-signal-watch/20 px-2 py-0.5 rounded-full"
                title={`Analyst consensus weighted at ${(coverageModifier * 100).toFixed(0)}% due to low coverage depth (${coverageDepth} analysts)`}
              >
                📉 Low Coverage ({coverageDepth} Analysts — {(coverageModifier * 100).toFixed(0)}% Wt)
              </span>
            )}
            {hasAlphaVantage === false && (
              <span
                className="inline-flex items-center gap-1 text-xs
                            text-faint bg-surface-elevated
                            border border-edge px-2 py-0.5 rounded-full"
              >
                Finnhub Only
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-faint whitespace-nowrap">
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
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-extrabold ${s.textClass}`}>
              {clampedScore}
            </span>
            <span className="text-xs text-faint">/100</span>
          </div>
        </div>

        {/* Grade + consensus */}
        <div className="space-y-3 min-w-0">
          <div>
            <span className="text-xs text-faint uppercase tracking-wider">
              Grade
            </span>
            <p className="text-3xl font-extrabold text-prime">{grade}</p>
          </div>
          {consensus && (
            <div>
              <span className="text-xs text-faint uppercase tracking-wider">
                Consensus
              </span>
              <p className="text-sm text-dim leading-snug">{consensus.label}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5 space-y-5">
        {/* Score Breakdown Bar */}
        <ScoreBreakdownBar breakdown={breakdown} />

        {/* Investment Thesis */}
        {thesis && (
          <div>
            <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">
              Investment Thesis
            </h4>
            <p className="text-sm text-prime leading-relaxed font-medium">
              {thesis}
            </p>
          </div>
        )}

        {/* Sentiment */}
        {sentiment && (
          <div>
            <h4 className="text-xs font-semibold text-faint uppercase tracking-wider mb-1.5">
              Sentiment
            </h4>
            <p className="text-sm text-dim leading-relaxed">{sentiment}</p>
          </div>
        )}

        {/* Timeframe verdict */}
        {verdict && (
          <div>
            <h4 className="text-xs font-semibold text-faint uppercase tracking-wider mb-1.5">
              Timeframe Verdict
            </h4>
            <p className="text-sm text-prime leading-relaxed font-medium">
              {verdict}
            </p>
          </div>
        )}

        {/* Watch For */}
        {watchFor && (
          <div className="bg-surface-elevated/50 border border-edge rounded-lg px-4 py-3">
            <h4 className="text-xs font-semibold text-signal-watch uppercase tracking-wider mb-1">
              👁 Watch For
            </h4>
            <p className="text-sm text-prime leading-relaxed">{watchFor}</p>
          </div>
        )}

        {/* Risks / Catalysts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {risks && risks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-signal-avoid/80 uppercase tracking-wider mb-2">
                Key Risks
              </h4>
              <ul className="space-y-1.5">
                {risks.map((risk, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-dim"
                  >
                    <span className="text-signal-avoid mt-0.5 text-xs">▸</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {catalysts && catalysts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-signal-buy/80 uppercase tracking-wider mb-2">
                Key Catalysts
              </h4>
              <ul className="space-y-1.5">
                {catalysts.map((catalyst, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-dim"
                  >
                    <span className="text-signal-buy mt-0.5 text-xs">▸</span>
                    {catalyst}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-3 bg-surface/50 border-t border-edge">
        <div className="flex items-center justify-between">
          <span className="text-xs text-faint">
            {scoredAt ? new Date(scoredAt).toLocaleString() : ''}
          </span>
          <span className="text-xs text-faint italic">Not financial advice</span>
        </div>
      </div>
    </article>
  );
}
