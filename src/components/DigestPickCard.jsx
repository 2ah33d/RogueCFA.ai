import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * DigestPickCard — Premium Framer Motion layoutId morphing.
 * 1. Scrolls original card smoothly to vertical center of screen on click.
 * 2. Shared layoutId morphs the bubble container directly into the centered expanded view.
 * 3. Soft background backdrop (bg-[#1E1F22]/75 + backdrop-blur-md) maintains dark-mode warm aesthetic.
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
  const cardRef = useRef(null);
  const layoutKey = `pick-card-${ticker}-${index}`;

  const preview = reasoning
    ? reasoning.length > 100
      ? reasoning.slice(0, 100).trim() + '…'
      : reasoning
    : 'No reasoning provided.';

  const handleOpen = useCallback(() => {
    /* 1. Scroll card smoothly to vertical center of screen */
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    /* 2. Trigger shared layout morph after short delay */
    setTimeout(() => {
      setExpanded(true);
    }, 90);
  }, []);

  const handleClose = useCallback(() => {
    setExpanded(false);
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
      {/* Collapsed card — morph origin */}
      {!expanded ? (
        <motion.div
          ref={cardRef}
          layoutId={layoutKey}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="bg-surface-card rounded-2xl overflow-hidden shadow-antigravity font-sans cursor-pointer group"
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
        >
          <div className="w-full text-left px-5 py-5 flex items-start gap-4">
            {/* Ticker badge */}
            <div className="flex-shrink-0 mt-0.5">
              <span className="inline-flex items-center font-bold text-sm text-prime bg-surface-elevated px-4 py-1.5 rounded-full">
                {ticker}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h4 className="text-base font-medium text-prime truncate">
                  {company || ticker}
                </h4>
                {isCallerMention && (
                  <span className="text-[10px] font-normal px-2.5 py-0.5 rounded-full bg-surface-elevated text-dim">
                    Caller Q&amp;A
                  </span>
                )}
              </div>
              <p className="text-sm text-dim leading-relaxed line-clamp-2">
                {preview}
              </p>
            </div>

            {/* Expand icon */}
            <div className="flex-shrink-0 mt-1.5">
              <svg
                className="w-5 h-5 text-dim group-hover:text-prime transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Placeholder in list layout to prevent height jump when item morphs out */
        <div className="h-[88px] w-full rounded-2xl bg-surface-card/30 opacity-50" />
      )}

      {/* Expanded Modal Overlay via Portal */}
      {createPortal(
        <AnimatePresence>
          {expanded && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
              {/* Soft Theme Backdrop — #1E1F22/75 + backdrop-blur-md (No pitch-black block) */}
              <motion.div
                key="pick-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="fixed inset-0 bg-[#1E1F22]/75 backdrop-blur-md"
                onClick={handleClose}
              />

              {/* Expanded Card — Morphs directly from original card bounds */}
              <motion.div
                key="pick-expanded-panel"
                layoutId={layoutKey}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="relative z-10 w-full max-w-xl bg-surface-card rounded-2xl p-6 sm:p-8 shadow-antigravity-elevated overflow-hidden font-sans"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.08, duration: 0.2 }}
                  className="flex items-start justify-between gap-4 mb-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center font-bold text-sm text-prime bg-surface-elevated px-4 py-1.5 rounded-full mt-0.5 flex-shrink-0">
                      {ticker}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-prime leading-snug">
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
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-dim hover:text-prime hover:bg-surface-elevated transition-colors"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>

                {/* Reasoning Content — Fades in smoothly as box expands */}
                <motion.blockquote
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.12, duration: 0.22 }}
                  className="text-sm text-prime leading-relaxed pl-4 border-l-2 border-accent/40 mb-6 font-sans"
                >
                  {reasoning || 'No detailed reasoning available.'}
                </motion.blockquote>

                {/* CTA Button */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.15, duration: 0.22 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                    if (onScoreTicker) onScoreTicker(ticker, guestName);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-[#1E1F22] text-sm font-semibold rounded-full hover:bg-accent-hover transition-colors shadow-antigravity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Score This Pick
                </motion.button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
