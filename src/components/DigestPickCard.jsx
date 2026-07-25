import React, { useState } from 'react';

/**
 * DigestPickCard — Expandable card for a single stock pick from the digest.
 * Google Antigravity aesthetic: 16px radius, soft elevation shadow, rounded pill CTA.
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
    <div className="bg-surface-card rounded-2xl overflow-hidden shadow-antigravity transition-all hover:shadow-antigravity-hover">
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-3 transition-colors"
      >
        {/* Ticker badge — Flat grey pill chip */}
        <div className="flex-shrink-0 mt-0.5">
          <span className="inline-flex items-center font-mono font-semibold text-xs text-prime bg-surface-elevated px-3 py-1 rounded-full">
            {ticker}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-medium text-prime truncate">
              {company || ticker}
            </h4>
            {isCallerMention && (
              <span className="text-[10px] font-normal px-2.5 py-0.5 rounded-full bg-surface-elevated text-dim">
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
            className={`w-4 h-4 text-dim transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-surface-elevated/40">
          <blockquote className="text-xs text-dim leading-relaxed pl-3 border-l-2 border-accent/40 my-3 italic font-sans">
            {reasoning || 'No detailed reasoning available.'}
          </blockquote>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onScoreTicker) onScoreTicker(ticker, guestName);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-[#1E1F22] text-xs font-semibold rounded-full hover:bg-accent-hover transition-colors shadow-antigravity"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Score This Pick
          </button>
        </div>
      )}
    </div>
  );
}
