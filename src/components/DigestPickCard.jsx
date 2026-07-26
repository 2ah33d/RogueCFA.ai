import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * DigestPickCard — Expandable card for a single stock pick from the digest.
 * Clicking expands into a fullscreen modal overlay with smooth animation.
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
  const [animating, setAnimating] = useState(false);
  const [closing, setClosing] = useState(false);
  const cardRef = useRef(null);
  const [originRect, setOriginRect] = useState(null);

  const preview = reasoning
    ? reasoning.length > 80
      ? reasoning.slice(0, 80).trim() + '…'
      : reasoning
    : 'No reasoning provided.';

  const handleOpen = useCallback(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setOriginRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
    setExpanded(true);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 350);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setExpanded(false);
      setClosing(false);
    }, 250);
  }, []);

  /* Close on Escape key */
  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expanded, handleClose]);

  /* Lock body scroll when modal is open */
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [expanded]);

  return (
    <>
      {/* Collapsed card */}
      <div
        ref={cardRef}
        className="bg-surface-card rounded-2xl overflow-hidden shadow-antigravity transition-all hover:shadow-antigravity-hover font-sans cursor-pointer"
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
      >
        <div className="w-full text-left px-5 py-4 flex items-start gap-3">
          {/* Ticker badge */}
          <div className="flex-shrink-0 mt-0.5">
            <span className="inline-flex items-center font-bold text-xs text-prime bg-surface-elevated px-3 py-1 rounded-full">
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
            <p className="text-xs text-dim leading-relaxed line-clamp-2">
              {preview}
            </p>
          </div>

          {/* Expand icon */}
          <div className="flex-shrink-0 mt-1">
            <svg
              className="w-4 h-4 text-dim"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Fullscreen modal overlay */}
      {expanded && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 ${
            closing ? 'pick-modal-backdrop-exit' : 'pick-modal-backdrop-enter'
          }`}
          onClick={handleClose}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className={`relative w-full max-w-lg bg-surface-card rounded-2xl shadow-antigravity-elevated overflow-hidden font-sans ${
              closing ? 'pick-modal-exit' : 'pick-modal-enter'
            }`}
            onClick={(e) => e.stopPropagation()}
            style={
              animating && originRect
                ? {
                    transformOrigin: `${originRect.left + originRect.width / 2}px ${originRect.top + originRect.height / 2}px`,
                  }
                : undefined
            }
          >
            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center font-bold text-sm text-prime bg-surface-elevated px-4 py-1.5 rounded-full mt-0.5">
                  {ticker}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-prime leading-snug">
                    {company || ticker}
                  </h3>
                  {isCallerMention && (
                    <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-surface-elevated text-dim mt-1 inline-block">
                      Caller Q&amp;A
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-dim hover:text-prime hover:bg-surface-elevated transition-all"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 pb-6">
              <blockquote className="text-sm text-prime leading-relaxed pl-4 border-l-2 border-accent/40 mb-5">
                {reasoning || 'No detailed reasoning available.'}
              </blockquote>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                  if (onScoreTicker) onScoreTicker(ticker, guestName);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-[#1E1F22] text-sm font-semibold rounded-full hover:bg-accent-hover transition-colors shadow-antigravity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Score This Pick
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
