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
  const [customDateInput, setCustomDateInput] = useState(new Date().toISOString().split('T')[0]);
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

  const handleCustomDateSubmit = (e) => {
    e.preventDefault();
    if (!customDateInput) return;
    setIsOpen(false);

    /* Check if selected custom date exists in history list */
    const existing = history.find((h) => h.episodeDate === customDateInput);
    if (existing) {
      if (onSelectDigest) onSelectDigest(existing);
    } else {
      if (onSelectDigest) {
        onSelectDigest({
          id: `custom-${customDateInput}`,
          episodeDate: customDateInput,
          isCustomDate: true,
          digest: null,
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-dim font-sans py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-dim animate-ping" />
        <span>Loading history...</span>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const historyList = [...(history || [])];

  /* If todayStr is not in history list, prepend a placeholder trigger item */
  if (!historyList.some((h) => h.episodeDate === selectedDate || h.episodeDate === todayStr)) {
    historyList.unshift({
      id: `today-trigger-${todayStr}`,
      episodeDate: todayStr,
      isTodayTrigger: true,
      digest: {
        guest: "Check / Generate Today's Episode",
        picks: [],
      },
    });
  }

  const currentSelection = historyList.find((h) => h.episodeDate === selectedDate) || historyList[0];
  const displayDate = selectedDate || (currentSelection ? currentSelection.episodeDate : 'Latest Episode');

  return (
    <div ref={dropdownRef} className={`relative text-xs font-sans ${className}`}>
      {/* Dropdown Toggle Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3.5 inline-flex items-center gap-2 bg-surface-card hover:bg-surface-elevated rounded-full text-xs font-medium text-prime shadow-antigravity transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group"
      >
        <span className="text-xs font-semibold text-prime">{displayDate}</span>
        <span className="text-xs text-dim font-normal">· {history.length} Saved</span>
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
            className="absolute left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface-elevated border border-surface-card/80 rounded-2xl shadow-antigravity-elevated z-50 p-3 divide-y divide-surface-card/60 font-sans"
          >
            {/* Calendar & Custom Date Picker */}
            <div className="pb-3 space-y-2">
              <label className="block text-[10px] uppercase font-semibold text-dim tracking-wider">
                📅 Select / Type Custom Date
              </label>
              <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDateInput}
                  onChange={(e) => setCustomDateInput(e.target.value)}
                  className="flex-1 bg-surface-card border border-edge rounded-lg px-2.5 py-1.5 text-xs text-prime focus:outline-none focus:border-accent font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-text text-xs font-semibold rounded-lg transition-colors shrink-0"
                >
                  Load
                </button>
              </form>
            </div>

            {/* Saved Episode History List */}
            <div className="pt-2">
              <div className="px-1 py-1 text-[10px] uppercase font-semibold text-dim tracking-wider">
                Saved Episodes (Last 30 Days)
              </div>
              {historyList.map((item, idx) => {
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
                    className={`w-full text-left px-3 py-2 rounded-xl hover:bg-surface-card transition-colors flex items-start justify-between gap-2 my-0.5 ${
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
