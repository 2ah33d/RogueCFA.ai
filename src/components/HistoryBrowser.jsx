import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * HistoryBrowser.jsx — Smooth Framer Motion dropdown menu.
 * Date integrated cleanly into closed pill with neutral readable badges (no blue-on-grey clutter).
 */
export default function HistoryBrowser({ selectedDate, onSelectDigest, className = '' }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch('/api/marketcall-history?limit=30')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[HistoryBrowser] Failed to load digest history:', err.message);
        setError('Unable to load digest history');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-dim font-sans py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-dim animate-ping" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (error || history.length === 0) {
    return null;
  }

  const currentSelection = history.find((h) => h.episodeDate === selectedDate) || history[0];
  const displayDate = selectedDate || (currentSelection ? currentSelection.episodeDate : 'Latest Episode');

  return (
    <div ref={dropdownRef} className={`relative text-xs font-sans ${className}`}>
      {/* Dropdown Toggle Pill — Integrated Date + Neutral Saved Count */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3.5 inline-flex items-center gap-2 bg-surface-card hover:bg-surface-elevated rounded-full text-xs font-medium text-prime shadow-antigravity transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group"
      >
        <span className="text-xs font-semibold text-prime">{displayDate}</span>
        <span className="text-[10px] font-medium text-dim bg-surface-elevated px-2 py-0.5 rounded-full">
          {history.length} Saved
        </span>
        <svg
          className="w-3 h-3 text-dim group-hover:text-prime transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-surface-elevated border border-surface-card/80 rounded-2xl shadow-antigravity-elevated z-50 p-2 divide-y divide-surface-card/60 font-sans"
          >
            <div className="px-3 py-2 text-[10px] uppercase font-semibold text-dim tracking-wider">
              Select Episode Date (Last 30 Days)
            </div>
            {history.map((item, idx) => {
              const isSelected = item.episodeDate === selectedDate || (!selectedDate && idx === 0);
              const guestName = item.digest?.guest || 'MarketCall Analyst';
              const picksList = Array.isArray(item.digest?.picks)
                ? item.digest.picks
                : Array.isArray(item.digest?.top_picks)
                  ? item.digest.top_picks
                  : [];
              const pickCount = picksList.length;

              return (
                <button
                  key={item.id || item.episodeDate}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onSelectDigest) {
                      onSelectDigest(item);
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-surface-card transition-colors flex items-start justify-between gap-2 ${
                    isSelected ? 'bg-surface-card text-prime font-medium' : 'text-dim'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-prime text-xs font-semibold">{item.episodeDate}</span>
                      {isSelected && (
                        <span className="text-[9px] bg-accent/15 text-accent font-semibold px-2 py-0.5 rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-dim truncate max-w-[180px] mt-0.5">
                      {guestName}
                    </p>
                  </div>
                  <span className="text-[10px] text-dim shrink-0 mt-0.5 font-medium">
                    {pickCount} pick{pickCount === 1 ? '' : 's'}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
