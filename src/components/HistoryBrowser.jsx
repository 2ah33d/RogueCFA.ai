import React, { useState, useEffect } from 'react';

/**
 * HistoryBrowser.jsx — Linear.app aesthetic: pill trigger, 8px dropdown, monochrome palette.
 */
export default function HistoryBrowser({ selectedDate, onSelectDigest, className = '' }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-dim">
        <span className="w-1.5 h-1.5 rounded-full bg-dim animate-ping" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (error || history.length === 0) {
    return null;
  }

  const currentSelection = history.find((h) => h.episodeDate === selectedDate) || history[0];

  return (
    <div className={`relative text-xs ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-dim text-[11px] uppercase tracking-wider font-semibold">
          Date:
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3.5 py-1 bg-surface border border-edge hover:border-white/20 rounded-full text-prime font-medium transition-colors"
          >
            <span className="font-mono text-xs font-medium">{selectedDate || (currentSelection ? currentSelection.episodeDate : 'Latest')}</span>
            <span className="text-[10px] text-dim font-mono bg-surface-elevated border border-edge px-2 py-0.5 rounded-full">
              {history.length} Saved
            </span>
            <span className="text-dim text-[10px]">▼</span>
          </button>

          {isOpen && (
            <div className="absolute right-0 sm:right-auto sm:left-0 mt-1.5 w-72 max-h-80 overflow-y-auto bg-surface-elevated border border-edge rounded-lg shadow-linear-hover z-40 py-1 divide-y divide-edge">
              <div className="px-3 py-2 bg-surface text-[10px] uppercase font-semibold text-dim tracking-wider">
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
                    className={`w-full text-left px-3 py-2.5 hover:bg-surface-card transition-colors flex items-start justify-between gap-2 ${
                      isSelected ? 'bg-surface-card text-prime font-medium border-l-2 border-white/40' : 'text-dim'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-prime text-xs font-medium">{item.episodeDate}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-surface-elevated text-dim font-medium px-1.5 py-0.5 rounded-full border border-edge">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-dim truncate max-w-[180px] mt-0.5 font-sans">
                        {guestName}
                      </p>
                    </div>
                    <span className="text-[10px] text-dim shrink-0 mt-0.5 font-mono">
                      {pickCount} pick{pickCount === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
