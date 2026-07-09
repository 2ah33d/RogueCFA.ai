import React from 'react';

/**
 * AnalystBubble — Prominent, future-proof analyst profile card.
 * Designed for the DigestView but reusable anywhere.
 *
 * When the analyst tracking system is complete, pass the `trackRecord`
 * prop (same shape as getGuestTrackRecord() output) to render live stats.
 * Until then, placeholder slots show gracefully.
 *
 * @param {Object} props
 * @param {string} props.guestName - Analyst's full name
 * @param {string} props.firm - Firm / title
 * @param {string} [props.episodeFocus] - Episode theme
 * @param {string} [props.date] - Episode date
 * @param {Object} [props.trackRecord] - { hitRate, avgReturn, totalPicks, resolvedPicks, correctPicks }
 * @param {Function} [props.onSelectGuest] - Called with guestName when bubble is clicked
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
      className={`w-full text-left group relative overflow-hidden
                  bg-gradient-to-br from-surface-elevated to-surface-card
                  border border-edge hover:border-accent/50
                  rounded-2xl p-5 transition-all duration-300
                  shadow-lg shadow-black/10 hover:shadow-accent/10
                  hover:translate-y-[-1px] ${className}`}
      title={`View ${guestName}'s track record`}
    >
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-accent-hover to-accent-muted opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Avatar initial */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-accent-muted
                          flex items-center justify-center shadow-md shadow-accent/20
                          flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {guestName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-bold text-prime truncate group-hover:text-accent transition-colors">
              {guestName}
            </h3>
            <p className="text-xs text-dim truncate mt-0.5">
              {firm || 'BNN MarketCall Guest'}
            </p>
            {episodeFocus && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono font-semibold
                             text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-full">
                📺 {episodeFocus}
              </span>
            )}
          </div>
        </div>

        {/* Right: Stats area (future-proof) */}
        <div className="flex-shrink-0 text-right">
          {date && (
            <span className="text-[10px] text-faint font-mono block mb-1.5">
              {date}
            </span>
          )}

          {hasStats ? (
            /* Live stats from track record system */
            <div className="space-y-1">
              <div className="flex items-baseline justify-end gap-1.5">
                <span
                  className={`text-lg font-mono font-bold ${
                    trackRecord.hitRate >= 0.6
                      ? 'text-signal-buy'
                      : trackRecord.hitRate <= 0.4
                        ? 'text-signal-avoid'
                        : 'text-signal-watch'
                  }`}
                >
                  {(trackRecord.hitRate * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-dim font-mono">hit rate</span>
              </div>
              <div className="text-[10px] text-dim font-mono">
                {trackRecord.correctPicks}/{trackRecord.resolvedPicks} resolved
              </div>
              {trackRecord.avgReturn != null && (
                <div className={`text-[10px] font-mono font-semibold ${
                  trackRecord.avgReturn > 0 ? 'text-signal-buy' : trackRecord.avgReturn < 0 ? 'text-signal-avoid' : 'text-dim'
                }`}>
                  avg {trackRecord.avgReturn >= 0 ? '+' : ''}{trackRecord.avgReturn}%
                </div>
              )}
            </div>
          ) : (
            /* Placeholder — will populate when track record system is built */
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-dim
                             bg-surface-elevated border border-edge px-2 py-0.5 rounded-full">
                📊 View Track Record
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-3 pt-2.5 border-t border-edge/50 flex items-center justify-between">
        <span className="text-[10px] text-faint">
          Click to view full analyst profile & historical picks
        </span>
        <svg className="w-3.5 h-3.5 text-faint group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
