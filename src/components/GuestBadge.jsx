import React from 'react';
import { getGuestTrackRecord } from '../lib/guestTracker';

/**
 * GuestBadge — Flat 8px chip displaying analyst accuracy summary.
 * Google Minimal aesthetic: quiet grey chip, 8px radius, crisp 1px border.
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
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2 py-0.5 transition-colors bg-surface-card border border-edge text-dim hover:text-prime hover:border-accent/40 ${className}`}
      title={
        hasEnoughData
          ? `${data.guestName} (${data.firm || 'Analyst'}): ${(data.hitRate * 100).toFixed(0)}% accuracy (${data.correctPicks}/${data.resolvedPicks} resolved). Click for track record.`
          : `${data.guestName}: Track record summary. Click for full ledger.`
      }
    >
      {hasEnoughData ? (
        <>
          <span className="font-mono font-semibold text-prime">{(data.hitRate * 100).toFixed(0)}% win</span>
          <span className="text-faint text-[10px] border-l border-edge pl-1 font-mono">
            {picksUsed} picks
          </span>
        </>
      ) : (
        <>
          <span className="font-medium text-dim">Track Record</span>
          <span className="text-faint font-mono text-[10px]">({picksUsed})</span>
        </>
      )}
    </button>
  );
}
