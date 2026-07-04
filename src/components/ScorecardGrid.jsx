import Scorecard from './Scorecard';

/* ── Skeleton placeholder while a ticker is scoring ── */
function SkeletonCard() {
  return (
    <div
      className="bg-surface-card border border-edge rounded-2xl overflow-hidden
                  shadow-xl shadow-black/20 animate-pulse"
    >
      {/* Header skeleton */}
      <div className="px-6 pt-6 pb-4 border-b border-edge">
        <div className="h-7 w-24 bg-surface-elevated rounded mb-2" />
        <div className="h-4 w-40 bg-surface-elevated rounded" />
      </div>

      {/* Score ring skeleton */}
      <div className="px-6 py-6 flex items-center gap-6 border-b border-edge">
        <div className="w-28 h-28 rounded-full bg-surface-elevated flex-shrink-0" />
        <div className="space-y-3 flex-1">
          <div className="h-4 w-16 bg-surface-elevated rounded" />
          <div className="h-8 w-12 bg-surface-elevated rounded" />
          <div className="h-3 w-32 bg-surface-elevated rounded" />
        </div>
      </div>

      {/* Body skeleton */}
      <div className="px-6 py-5 space-y-4">
        <div className="h-3 w-full bg-surface-elevated rounded" />
        <div className="h-3 w-3/4 bg-surface-elevated rounded" />
        <div className="h-3 w-5/6 bg-surface-elevated rounded" />
        <div className="h-3 w-2/3 bg-surface-elevated rounded" />
      </div>
    </div>
  );
}

export default function ScorecardGrid({
  scorecards,
  loadingTickers,
  holdPeriod,
  onSelectGuest,
  className = '',
}) {
  const totalCards = scorecards.length + loadingTickers.length;
  if (totalCards === 0) return null;

  /* Responsive column rules */
  const gridCols =
    totalCards === 1
      ? 'grid-cols-1'
      : totalCards === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  const maxWidth =
    totalCards === 1
      ? 'max-w-xl'
      : totalCards === 2
        ? 'max-w-4xl'
        : 'max-w-6xl';

  return (
    <div className={`w-full mx-auto ${maxWidth} ${className}`}>
      <div className={`grid ${gridCols} gap-6`}>
        {/* Completed scorecards */}
        {scorecards.map((card, i) => (
          <Scorecard
            key={`${card.ticker}-${i}`}
            data={card}
            holdPeriod={holdPeriod}
            onSelectGuest={onSelectGuest}
          />
        ))}

        {/* Loading skeletons with ticker overlay */}
        {loadingTickers.map((ticker) => (
          <div key={`loading-${ticker}`} className="relative">
            <SkeletonCard />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="bg-surface-card/90 backdrop-blur-sm border border-edge
                            rounded-xl px-4 py-2.5 flex items-center gap-3"
              >
                <svg
                  className="animate-spin w-4 h-4 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-sm text-prime font-mono font-medium">
                  {ticker}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
