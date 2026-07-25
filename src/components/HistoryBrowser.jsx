import React, { useState, useEffect } from 'react';

/**
 * HistoryBrowser.jsx — Component for browsing past completed MarketCall digests.
 * Fetches from read-only GET /api/marketcall-history.
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
      <div className="flex items-center gap-2 font-mono text-xs text-dim">
        <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (error || history.length === 0) {
    return null; // Degrade gracefully if no history or API error
  }

  const currentSelection = history.find((h) => h.episodeDate === selectedDate) || history[0];

  return (
    <div className={`relative font-mono text-xs ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-dim text-[11px] uppercase tracking-wider font-semibold">
          Digest Date:
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-elevated hover:bg-surface-card border border-edge hover:border-accent/40 rounded-lg text-prime font-semibold transition-colors"
          >
            <span>📅 {selectedDate || (currentSelection ? currentSelection.episodeDate : 'Latest')}</span>
            <span className="text-[10px] text-accent font-mono font-bold bg-accent/10 px-1.5 py-0.5 rounded">
              {history.length} Saved
            </span>
            <span className="text-dim text-[10px] ml-1">▼</span>
          </button>

          {isOpen && (
            <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-surface-card border border-edge rounded-xl shadow-2xl z-40 py-1 divide-y divide-edge/40 animate-fade-in">
              <div className="px-3 py-2 bg-surface-elevated/60 text-[10px] uppercase font-bold text-accent tracking-wider">
                Select Episode Date (Last 30 Days)
              </div>
              {history.map((item) => {
                const isSelected = item.episodeDate === selectedDate || (!selectedDate && item === history[0]);
                const guestName = item.digest?.guest || 'MarketCall Analyst';
                const pickCount = Array.isArray(item.digest?.top_picks) ? item.digest.top_picks.length : 0;

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
                    className={`w-full text-left px-3 py-2.5 hover:bg-surface-elevated transition-colors flex items-start justify-between gap-2 ${
                      isSelected ? 'bg-accent/10 text-prime font-bold border-l-2 border-accent' : 'text-dim'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-prime font-semibold">{item.episodeDate}</span>
                        {isSelected && (
                          <span className="text-[9px] bg-accent/20 text-accent font-bold px-1.5 py-0.2 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-faint truncate max-w-[180px] mt-0.5">
                        {guestName}
                      </p>
                    </div>
                    <span className="text-[10px] text-accent/80 shrink-0 mt-0.5">
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
