import React from 'react';
import { getGuestTrackRecord } from '../lib/guestTracker';

export default function GuestBadge({ guestName, record, onClick, className = '' }) {
  const data = record || (guestName ? getGuestTrackRecord(guestName) : null);

  if (!data) return null;

  const hasEnoughData = data.resolvedPicks >= 3 && data.hitRate !== null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(data.guestName || guestName);
      }}
      className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold rounded-full px-2 py-0.5 transition-all
        ${
          hasEnoughData
            ? data.hitRate >= 0.6
              ? 'bg-signal-buy/15 text-signal-buy border border-signal-buy/40 hover:bg-signal-buy/25'
              : data.hitRate <= 0.4
                ? 'bg-signal-avoid/15 text-signal-avoid border border-signal-avoid/40 hover:bg-signal-avoid/25'
                : 'bg-signal-watch/15 text-signal-watch border border-signal-watch/40 hover:bg-signal-watch/25'
            : 'bg-surface-card text-dim border border-edge hover:text-prime hover:border-accent/40'
        } ${className}`}
      title={
        hasEnoughData
          ? `${data.guestName}: ${(data.hitRate * 100).toFixed(0)}% accuracy (${data.correctPicks}/${data.resolvedPicks} resolved picks). Click for full track record.`
          : `${data.guestName}: Insufficient resolved picks (<3) to display hit rate. Click for track record.`
      }
    >
      {hasEnoughData ? (
        <>
          <span>{(data.hitRate * 100).toFixed(0)}% hit rate</span>
          <span className="opacity-80">
            ({data.correctPicks}/{data.resolvedPicks} picks)
          </span>
        </>
      ) : (
        <>
          <span>📊</span>
          <span>Track Record</span>
        </>
      )}
    </button>
  );
}
