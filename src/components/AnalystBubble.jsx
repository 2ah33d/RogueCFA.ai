import React, { useState } from 'react';

/**
 * AnalystBubble — Google Antigravity aesthetic: 16px radius, soft elevation shadow, soft tint status pill.
 * Renders the YouTube episode broadcast thumbnail (with analyst headshot) if videoId or thumbnailUrl is available.
 * If no thumbnail is present, removes the single-letter avatar square.
 */
export default function AnalystBubble({
  guestName,
  firm,
  episodeFocus,
  date,
  trackRecord,
  videoId,
  thumbnailUrl,
  onSelectGuest,
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  if (!guestName) return null;

  const hasStats = trackRecord && trackRecord.resolvedPicks >= 3 && trackRecord.hitRate !== null;
  const thumb = thumbnailUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);
  const showThumb = Boolean(thumb && !imgError);

  return (
    <button
      type="button"
      onClick={() => onSelectGuest && onSelectGuest(guestName)}
      className={`w-full text-left group bg-surface-card rounded-2xl p-5 shadow-antigravity hover:shadow-antigravity-hover transition-all font-sans ${className}`}
      title={`View ${guestName}'s track record`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-start gap-3.5 min-w-0">
          {/* YouTube Episode Broadcast Thumbnail (contains Analyst Headshot) */}
          {showThumb && (
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-elevated flex-shrink-0 shadow-inner border border-surface-elevated/40">
              <img
                src={thumb}
                alt={`${guestName} BNN MarketCall`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setImgError(true)}
              />
            </div>
          )}

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-prime truncate group-hover:text-white transition-colors">
              {guestName}
            </h3>
            <p className="text-xs text-dim truncate mt-0.5">
              {firm || 'BNN MarketCall Guest'}
            </p>
            {episodeFocus && (
              <span className="inline-flex items-center mt-2 text-xs text-dim bg-surface-elevated px-3 py-0.5 rounded-full font-medium">
                {episodeFocus}
              </span>
            )}
          </div>
        </div>

        {/* Right: Stats area */}
        <div className="flex-shrink-0 text-right">
          {date && (
            <span className="text-xs text-dim font-medium block mb-1">
              {date}
            </span>
          )}

          {hasStats ? (
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-signal-buy/15">
                <span className="text-sm font-bold text-signal-buy">
                  {(trackRecord.hitRate * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-signal-buy/80 font-semibold">win rate</span>
              </div>
              <div className="text-[11px] text-dim block mt-0.5 font-medium">
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
      <div className="mt-4 pt-3 border-t border-surface-elevated/40 flex items-center justify-between">
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
