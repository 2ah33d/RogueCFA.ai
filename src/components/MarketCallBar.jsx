import React, { useState, useEffect } from 'react';
import { saveBnnPicks, getGuestTrackRecord } from '../lib/guestTracker';

/**
 * MarketCallBar — Tool screen strip: clean plain text with subtle dividers (Google Antigravity style).
 */
export default function MarketCallBar({ onSelectTicker, onSelectGuest, className = '' }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchBnnPicks() {
      try {
        const res = await fetch('/api/bnn');
        if (!res.ok) {
          if (isMounted) setError(true);
          return;
        }
        const data = await res.json();
        if (data && data.error) {
          if (isMounted) setError(true);
          return;
        }
        if (Array.isArray(data) && data.length > 0) {
          saveBnnPicks(data);
          const validPicks = data.filter((p) => Array.isArray(p.tickers) && p.tickers.length > 0);
          if (isMounted) {
            setPicks(validPicks.slice(0, 5));
          }
        } else {
          if (isMounted) setError(true);
        }
      } catch (err) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchBnnPicks();
    return () => {
      isMounted = false;
    };
  }, []);

  if (error || (!loading && picks.length === 0)) {
    return null;
  }

  if (loading) {
    return (
      <div className={`w-full max-w-2xl mx-auto py-2 border-b border-surface-card/40 animate-pulse ${className}`}>
        <div className="h-4 bg-surface-elevated rounded-lg w-48" />
      </div>
    );
  }

  return (
    <section className={`w-full max-w-2xl mx-auto py-3 border-b border-surface-card/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-dim">
          BNN Picks:
        </span>
      </div>

      {/* Clean text row with subtle dividers */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {picks.map((pick, idx) => {
          const ticker = pick.tickers[0];
          const record = getGuestTrackRecord(pick.guest, picks);
          const winRate = record && record.hitRate !== null ? `${(record.hitRate * 100).toFixed(0)}%` : null;

          return (
            <div key={`${ticker}-${pick.guest}-${idx}`} className="flex items-center gap-1.5 text-dim">
              <button
                type="button"
                onClick={() => onSelectTicker && onSelectTicker(ticker, pick.guest)}
                className="font-mono font-bold text-prime hover:text-white transition-colors"
                title={`Click to score ${ticker}`}
              >
                {ticker}
              </button>
              <button
                type="button"
                onClick={() => onSelectGuest && onSelectGuest(pick.guest)}
                className="hover:text-prime transition-colors truncate max-w-[110px]"
                title={`View ${pick.guest}'s track record`}
              >
                {pick.guest}
              </button>
              {winRate && (
                <span className="font-mono text-[10px] text-signal-buy font-semibold bg-signal-buy/15 px-2 py-0.5 rounded-full">
                  {winRate}
                </span>
              )}
              {idx < picks.length - 1 && (
                <span className="text-dim/40 ml-1">·</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
