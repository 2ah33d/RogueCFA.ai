import React from 'react';

/**
 * AnalystBubble — Google Antigravity aesthetic: 16px radius, soft elevation shadow, soft tint status pill.
 * Clean, non-malformed layout for firm names and multi-line episode focus topics.
 * Video thumbnail is rendered in the DigestView header bar instead.
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
      className={`w-full text-left group bg-surface-card rounded-2xl p-5 shadow-antigravity hover:shadow-antigravity-hover transition-all font-sans ${className}`}
      title={`View ${guestName}'s track record`}
    >
      <div className="space-y-3">
        {/* Top Header: Identity & Win Rate Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-left">
            <h3 className="text-sm font-semibold text-prime group-hover:text-white transition-colors leading-snug">
              {guestName}
            </h3>
            <p className="text-xs text-dim leading-relaxed mt-0.5 text-left">
              {firm || 'BNN MarketCall Guest'}
            </p>
          </div>

          {/* Right: Date & Win Rate badge */}
          <div className="flex-shrink-0 text-right">
            {date && (
              <span className="text-[11px] text-dim font-medium block mb-1">
                {date}
              </span>
            )}
            {hasStats ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-signal-buy/15">
                <span className="text-xs font-bold text-signal-buy">
                  {(trackRecord.hitRate * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-signal-buy/80 font-semibold">win</span>
              </div>
            ) : (
              <span className="inline-flex items-center text-[10px] text-dim font-normal bg-surface-elevated px-2.5 py-0.5 rounded-full">
                Track Record
              </span>
            )}
          </div>
        </div>

        {/* Episode Focus — Clean Card Tag (No malformed oval wrapping) */}
        {episodeFocus && (
          <div className="text-xs text-dim bg-surface-elevated/60 px-3 py-2 rounded-xl leading-relaxed font-sans text-left">
            <span className="text-[10px] uppercase font-semibold text-dim block mb-0.5 tracking-wider">Episode Focus</span>
            {episodeFocus}
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="mt-4 pt-3 border-t border-surface-elevated/40 flex items-center justify-between text-xs text-dim">
        <span>Click to view full analyst profile &amp; pick history</span>
        <svg className="w-4 h-4 text-dim group-hover:text-prime transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
