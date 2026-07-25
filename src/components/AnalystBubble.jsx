import React from 'react';

/**
 * AnalystBubble — Linear.app aesthetic: monochrome 8px card, pill chips, clean typography.
 */
export default function AnalystBubble({
  guestName,
  firm,
  episodeFocus,
  date,
  trackRecord,
  onSelectGuest,
  className = '',
}) {
  if (!guestName) return null;

  const hasStats = trackRecord && trackRecord.resolvedPicks >= 3 && trackRecord.hitRate !== null;

  return (
    <button
      type="button"
      onClick={() => onSelectGuest && onSelectGuest(guestName)}
      className={`w-full text-left group bg-surface-card border border-edge hover:border-white/20 rounded-lg p-4 transition-all hover:shadow-linear-hover ${className}`}
      title={`View ${guestName}'s track record`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar initial */}
          <div className="w-9 h-9 rounded-lg bg-surface-elevated border border-edge text-prime font-semibold flex items-center justify-center flex-shrink-0">
            <span className="text-prime font-semibold text-sm">
              {guestName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-prime truncate group-hover:text-white transition-colors font-sans">
              {guestName}
            </h3>
            <p className="text-xs text-dim truncate mt-0.5 font-sans">
              {firm || 'BNN MarketCall Guest'}
            </p>
            {episodeFocus && (
              <span className="inline-flex items-center mt-1.5 text-xs text-dim bg-surface-elevated border border-edge px-2.5 py-0.5 rounded-full font-sans">
                {episodeFocus}
              </span>
            )}
          </div>
        </div>

        {/* Right: Stats area */}
        <div className="flex-shrink-0 text-right">
          {date && (
            <span className="text-xs text-dim font-mono block mb-1">
              {date}
            </span>
          )}

          {hasStats ? (
            <div className="space-y-0.5 font-mono">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={`text-base font-bold ${
                    trackRecord.hitRate >= 0.6
                      ? 'text-signal-buy'
                      : trackRecord.hitRate <= 0.4
                        ? 'text-signal-avoid'
                        : 'text-signal-watch'
                  }`}
                >
                  {(trackRecord.hitRate * 100).toFixed(0)}%
                </span>
                <span className="text-[11px] text-dim">win rate</span>
              </div>
              <div className="text-[11px] text-dim">
                {trackRecord.correctPicks}/{trackRecord.resolvedPicks} picks
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center text-xs text-dim font-normal bg-surface-elevated border border-edge px-2.5 py-1 rounded-full">
              Track Record
            </span>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-3 pt-2 border-t border-edge flex items-center justify-between font-sans">
        <span className="text-xs text-dim">
          Click to view full analyst profile &amp; pick history
        </span>
        <svg className="w-3.5 h-3.5 text-dim group-hover:text-prime transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
