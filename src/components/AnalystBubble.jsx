import React from 'react';

/**
 * AnalystBubble — Google Minimal analyst profile card.
 * Quiet white card, 1px border, 8px radius, clean typography.
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
      className={`w-full text-left group bg-surface-card border border-edge hover:border-accent/40 rounded-lg p-4 transition-all hover:shadow-google-hover ${className}`}
      title={`View ${guestName}'s track record`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Avatar initial */}
          <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-edge text-prime font-bold flex items-center justify-center flex-shrink-0">
            <span className="text-prime font-bold text-base">
              {guestName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-semibold text-prime truncate group-hover:text-accent transition-colors font-sans">
              {guestName}
            </h3>
            <p className="text-xs text-dim truncate mt-0.5 font-sans">
              {firm || 'BNN MarketCall Guest'}
            </p>
            {episodeFocus && (
              <span className="inline-flex items-center mt-1.5 text-xs text-dim bg-surface-elevated border border-edge px-2 py-0.5 rounded-lg font-sans">
                {episodeFocus}
              </span>
            )}
          </div>
        </div>

        {/* Right: Stats area */}
        <div className="flex-shrink-0 text-right">
          {date && (
            <span className="text-xs text-faint font-mono block mb-1">
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
              <div className="text-[11px] text-faint">
                {trackRecord.correctPicks}/{trackRecord.resolvedPicks} picks
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center text-xs text-accent font-medium bg-surface-elevated border border-edge px-2.5 py-1 rounded-lg">
              Track Record
            </span>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-3 pt-2.5 border-t border-edge flex items-center justify-between font-sans">
        <span className="text-xs text-dim">
          Click to view full analyst profile &amp; pick history
        </span>
        <svg className="w-3.5 h-3.5 text-dim group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
