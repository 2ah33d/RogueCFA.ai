import React from 'react';

/**
 * AnalystBubble — Google Antigravity aesthetic: 16px radius, soft elevation shadow, soft tint status pill.
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
      className={`w-full text-left group bg-surface-card rounded-2xl p-5 shadow-antigravity hover:shadow-antigravity-hover transition-all ${className}`}
      title={`View ${guestName}'s track record`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Avatar initial */}
          <div className="w-10 h-10 rounded-xl bg-surface-elevated text-prime font-semibold flex items-center justify-center flex-shrink-0 shadow-inner">
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
              <span className="inline-flex items-center mt-2 text-xs text-dim bg-surface-elevated px-3 py-0.5 rounded-full font-sans">
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
            <div className="space-y-1 font-mono">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-signal-buy/15">
                <span className="text-sm font-bold text-signal-buy">
                  {(trackRecord.hitRate * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-signal-buy/80 font-normal">win rate</span>
              </div>
              <div className="text-[11px] text-dim block mt-0.5">
                {trackRecord.correctPicks}/{trackRecord.resolvedPicks} picks evaluated
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center text-xs text-dim font-normal bg-surface-elevated px-3 py-1 rounded-full">
              Track Record
            </span>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-4 pt-3 border-t border-surface-elevated/40 flex items-center justify-between font-sans">
        <span className="text-xs text-dim">
          Click to view full analyst profile &amp; pick history
        </span>
        <svg className="w-4 h-4 text-dim group-hover:text-prime transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
