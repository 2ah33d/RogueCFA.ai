import React from 'react';
import { getGuestTrackRecord } from '../lib/guestTracker';

/**
 * GuestBadge — Full-round pill chip displaying analyst accuracy summary.
 * Linear.app aesthetic: monochrome pill chip, 8% white opacity border.
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
      className={`inline-flex items-center gap-1.5 text-[11px] font-normal rounded-full px-2.5 py-0.5 transition-colors bg-surface-elevated border border-edge text-dim hover:text-prime hover:border-white/20 ${className}`}
      title={
        hasEnoughData
          ? `${data.guestName} (${data.firm || 'Analyst'}): ${(data.hitRate * 100).toFixed(0)}% accuracy (${data.correctPicks}/${data.resolvedPicks} resolved). Click for track record.`
          : `${data.guestName}: Track record summary. Click for full ledger.`
      }
    >
      {hasEnoughData ? (
        <>
          <span className="font-mono font-medium text-prime">{(data.hitRate * 100).toFixed(0)}% win</span>
          <span className="text-dim text-[10px] border-l border-edge pl-1.5 font-mono">
            {picksUsed} picks
          </span>
        </>
      ) : (
        <>
          <span className="font-normal text-dim">Track Record</span>
          <span className="text-dim font-mono text-[10px]">({picksUsed})</span>
        </>
      )}
    </button>
  );
}
