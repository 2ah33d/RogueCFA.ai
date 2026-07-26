import React from 'react';
import { getGuestTrackRecord } from '../lib/guestTracker';

/**
 * GuestBadge — Google Antigravity aesthetic: soft pill chip with elevation shadow.
 */
export default function GuestBadge({ guestName, record, onClick, className = '' }) {
  const data = record || (guestName ? getGuestTrackRecord(guestName) : null);

  if (!data) return null;

  const hasEnoughData = data.resolvedPicks >= 3 && data.hitRate !== null;
  const picksUsed = data.dataUsedPicks || data.totalPicks || 0;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(data.guestName || guestName);
      }}
      className={`inline-flex items-center gap-2 text-[11px] font-sans font-normal rounded-full px-3 py-1 transition-all bg-surface-elevated text-dim hover:text-prime shadow-antigravity ${className}`}
      title={
        hasEnoughData
          ? `${data.guestName} (${data.firm || 'Analyst'}): ${(data.hitRate * 100).toFixed(0)}% accuracy (${data.correctPicks}/${data.resolvedPicks} resolved). Click for track record.`
          : `${data.guestName}: Track record summary. Click for full ledger.`
      }
    >
      {hasEnoughData ? (
        <>
          <span className="font-semibold text-signal-buy">{(data.hitRate * 100).toFixed(0)}% win</span>
          <span className="text-dim text-[10px] border-l border-surface-card pl-2 font-medium">
            {picksUsed} picks
          </span>
        </>
      ) : (
        <>
          <span className="font-normal text-dim">Track Record</span>
          <span className="text-dim text-[10px] font-medium">({picksUsed})</span>
        </>
      )}
    </button>
  );
}
