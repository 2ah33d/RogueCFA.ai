import React, { useState } from 'react';

/**
 * DigestPickCard — Expandable card for a single stock pick from the digest.
 * Google Minimal aesthetic: flat grey ticker chip, 8px radius, crisp border.
 */
export default function DigestPickCard({
  ticker,
  company,
  reasoning,
  guestName,
  onScoreTicker,
  index = 0,
  isCallerMention = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const preview = reasoning
    ? reasoning.length > 80
      ? reasoning.slice(0, 80).trim() + '…'
      : reasoning
    : 'No reasoning provided.';

  return (
    <div className="bg-surface-card border border-edge rounded-lg overflow-hidden transition-shadow hover:shadow-google-hover">
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
      >
        {/* Ticker badge — Flat grey background #F1F3F4, text #5F6368 */}
        <div className="flex-shrink-0 mt-0.5">
          <span className="inline-flex items-center font-mono font-semibold text-xs text-dim bg-surface-elevated border border-edge px-2.5 py-1 rounded-lg">
            {ticker}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-prime truncate">
              {company || ticker}
            </h4>
            {isCallerMention && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-surface-elevated border border-edge text-faint">
                Caller Q&amp;A
              </span>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-dim leading-relaxed line-clamp-2 font-sans">
              {preview}
            </p>
          )}
        </div>

        {/* Expand/collapse chevron */}
        <div className="flex-shrink-0 mt-1">
          <svg
            className={`w-4 h-4 text-faint transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-edge/60">
          <blockquote className="text-xs text-prime/90 leading-relaxed pl-3 border-l-2 border-accent/40 my-3 italic font-sans">
            {reasoning || 'No detailed reasoning available.'}
          </blockquote>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onScoreTicker) onScoreTicker(ticker, guestName);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Score This Pick
          </button>
        </div>
      )}
    </div>
  );
}
