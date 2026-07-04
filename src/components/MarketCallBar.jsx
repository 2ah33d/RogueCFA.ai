import React, { useState, useEffect } from 'react';
import { saveBnnPicks, getGuestTrackRecord } from '../lib/guestTracker';
import GuestBadge from './GuestBadge';

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
          /* Filter for picks that have at least one ticker */
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

  /* If BNN fetch fails or returns empty: section hidden silently, no error shown */
  if (error || (!loading && picks.length === 0)) {
    return null;
  }

  if (loading) {
    return (
      <div className={`w-full max-w-4xl mx-auto mb-6 px-4 py-3 bg-surface-card border border-edge rounded-xl animate-pulse ${className}`}>
        <div className="h-4 bg-surface-elevated rounded w-48 mb-3"></div>
        <div className="flex gap-2 overflow-hidden">
          <div className="h-8 bg-surface-elevated rounded-full w-44"></div>
          <div className="h-8 bg-surface-elevated rounded-full w-52"></div>
          <div className="h-8 bg-surface-elevated rounded-full w-40"></div>
        </div>
      </div>
    );
  }

  return (
    <section className={`w-full max-w-4xl mx-auto mb-6 px-4 py-3.5 bg-surface-card/80 border border-edge rounded-xl shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-prime font-mono">
            Today&apos;s MarketCall Picks
          </h4>
          <span className="text-[10px] text-faint font-mono bg-surface-elevated px-1.5 py-0.5 rounded border border-edge">
            BNN Bloomberg
          </span>
        </div>
        <span className="text-[11px] text-dim italic">
          Click ticker to score • Click analyst for track record
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {picks.map((pick, idx) => {
          const ticker = pick.tickers[0];
          const record = getGuestTrackRecord(pick.guest, picks);

          return (
            <div
              key={`${ticker}-${pick.guest}-${idx}`}
              className="inline-flex items-center bg-surface-elevated hover:bg-surface-card border border-edge hover:border-accent/40 rounded-full pl-3 pr-1.5 py-1 text-xs transition-all shadow-sm group"
            >
              <button
                type="button"
                onClick={() => onSelectTicker && onSelectTicker(ticker, pick.guest)}
                className="flex items-center gap-1.5 font-medium text-prime hover:text-accent transition-colors text-left"
                title={`Click to score ${ticker}`}
              >
                <span className="font-mono font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  [{ticker}]
                </span>
                <span className="truncate max-w-[140px] font-semibold">
                  {pick.guest}
                </span>
                <span className="text-faint text-[10px]">
                  {pick.date || 'Recent'}
                </span>
              </button>

              <div className="ml-2 pl-2 border-l border-edge flex items-center">
                <GuestBadge
                  guestName={pick.guest}
                  record={record}
                  onClick={() => onSelectGuest && onSelectGuest(pick.guest)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
