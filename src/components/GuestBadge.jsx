import React from 'react';
import { getGuestTrackRecord } from '../lib/guestTracker';

export default function GuestBadge({ guestName, record, onClick, className = '' }) {
  const data = record || (guestName ? getGuestTrackRecord(guestName) : null);

  if (!data) return null;

  const hasEnoughData = data.resolvedPicks >= 3 && data.hitRate !== null;
  const picksUsed = data.dataUsedPicks || data.totalPicks || 0;
  const episodesUsed = data.dataUsedEpisodes || 1;
  const optLabel = data.optimalHorizonLabel || 'Mid-Term Hold (6 Months)';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(data.guestName || guestName);
      }}
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold rounded-full px-2.5 py-0.5 transition-all
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
          ? `${data.guestName} (${data.firm || 'Analyst'}): ${(data.hitRate * 100).toFixed(0)}% accuracy (${data.correctPicks}/${data.resolvedPicks} resolved).\nData Sample: Latest ${picksUsed} picks across ${episodesUsed} episodes.\nSpecialist in: ${optLabel} (${(data.optimalHorizonHitRate * 100).toFixed(0)}% hit rate).\nClick for full track record breakdown.`
          : `${data.guestName}: Insufficient resolved picks (<3) to display hit rate. Click for track record.`
      }
    >
      {hasEnoughData ? (
        <>
          <span>{(data.hitRate * 100).toFixed(0)}% accuracy</span>
          <span className="opacity-80 border-l border-current/30 pl-1.5">
            {picksUsed} picks / {episodesUsed} eps
          </span>
          {data.optimalHorizonKey && (
            <span className="bg-current/10 px-1.5 py-0 rounded text-[9px] uppercase tracking-wider">
              Best: {data.optimalHorizonKey}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="font-bold">TR</span>
          <span>Track Record ({picksUsed} picks)</span>
        </>
      )}
    </button>
  );
}

