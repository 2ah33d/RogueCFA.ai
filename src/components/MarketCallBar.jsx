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
      <div className={`w-full max-w-4xl mx-auto mb-6 p-4 bg-surface-card border border-edge rounded-lg animate-pulse ${className}`}>
        <div className="h-4 bg-surface-elevated rounded w-48 mb-3" />
        <div className="flex gap-2 overflow-hidden">
          <div className="h-8 bg-surface-elevated rounded-lg w-44" />
          <div className="h-8 bg-surface-elevated rounded-lg w-52" />
          <div className="h-8 bg-surface-elevated rounded-lg w-40" />
        </div>
      </div>
    );
  }

  return (
    <section className={`w-full max-w-4xl mx-auto mb-6 p-4 bg-surface-card border border-edge rounded-lg transition-shadow hover:shadow-google-hover ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-dim">
            Today&apos;s MarketCall Picks
          </h4>
          <span className="text-[11px] text-faint bg-surface-elevated px-2 py-0.5 rounded-lg border border-edge">
            BNN Bloomberg
          </span>
        </div>
        <span className="text-[11px] text-dim">
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
              className="inline-flex items-center bg-surface-elevated hover:bg-surface-card border border-edge hover:border-accent/40 rounded-lg pl-2.5 pr-1.5 py-1 text-xs transition-all"
            >
              <button
                type="button"
                onClick={() => onSelectTicker && onSelectTicker(ticker, pick.guest)}
                className="flex items-center gap-1.5 font-medium text-prime hover:text-accent transition-colors text-left"
                title={`Click to score ${ticker}`}
              >
                <span className="font-mono font-semibold text-dim bg-surface-card border border-edge px-1.5 py-0.5 rounded-lg">
                  {ticker}
                </span>
                <span className="truncate max-w-[140px] font-medium">
                  {pick.guest}
                </span>
                <span className="text-faint text-[11px]">
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
