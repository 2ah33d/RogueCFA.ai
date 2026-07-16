import React, { useState } from 'react';

/**
 * DigestPickCard — Expandable card for a single stock pick from the digest.
 * Collapsed: ticker + company + first line preview
 * Expanded: full reasoning + "Score This" button
 *
 * @param {Object} props
 * @param {string} props.ticker - Stock ticker symbol
 * @param {string} props.company - Company name
 * @param {string} props.reasoning - Full reasoning text (80-150 words)
 * @param {string} [props.guestName] - Guest name for ScoreForm pre-fill
 * @param {Function} props.onScoreTicker - Called with (ticker, guestName)
 * @param {number} props.index - Pick index for staggered animation
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

  /* First ~80 chars for the collapsed preview */
  const preview = reasoning
    ? reasoning.length > 80
      ? reasoning.slice(0, 80).trim() + '…'
      : reasoning
    : 'No reasoning provided.';

  return (
    <div
      className={`group bg-surface-card border ${
        isCallerMention ? 'border-purple-500/20 hover:border-purple-500/40' : 'border-edge hover:border-accent/30'
      } rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-accent/5 animate-slide-up`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-3.5 transition-colors"
      >
        {/* Ticker badge */}
        <div className="flex-shrink-0 mt-0.5">
          <span className={`inline-flex items-center font-mono font-bold text-sm ${
            isCallerMention
              ? 'text-purple-400 bg-purple-500/10 border border-purple-500/25 group-hover:bg-purple-500/15'
              : 'text-accent bg-accent/10 border border-accent/25 group-hover:bg-accent/15'
          } px-2.5 py-1 rounded-lg transition-colors`}>
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
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
                Caller Q&amp;A
              </span>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-dim leading-relaxed line-clamp-2">
              {preview}
            </p>
          )}
        </div>

        {/* Expand/collapse chevron */}
        <div className="flex-shrink-0 mt-1">
          <svg
            className={`w-4 h-4 text-faint transition-transform duration-300 ${
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
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? '500px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="px-5 pb-4 pt-0">
          {/* Divider */}
          <div className="border-t border-edge/50 mb-3" />

          {/* Full reasoning */}
          <blockquote className="text-sm text-prime/90 leading-relaxed pl-3
                                 border-l-2 border-accent/30 mb-4 italic">
            {reasoning || 'No detailed reasoning available.'}
          </blockquote>

          {/* Score This button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onScoreTicker) onScoreTicker(ticker, guestName);
            }}
            className="inline-flex items-center gap-2 px-4 py-2
                       bg-gradient-to-r from-accent to-accent-muted
                       text-white text-xs font-semibold rounded-lg
                       hover:from-accent-hover hover:to-accent
                       transition-all duration-200
                       shadow-md shadow-accent/20 hover:shadow-accent/30
                       active:scale-[0.97]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Score This Pick
          </button>
        </div>
      </div>
    </div>
  );
}
