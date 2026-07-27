import React, { useState, useEffect } from 'react';

/**
 * AnalystBubble — Displays analyst identity, real Supabase-persisted credibility score (/100),
 * and episode focus topic.
 */
export default function AnalystBubble({
  guestName,
  firm,
  episodeFocus,
  date,
  trackRecord: initialTrackRecord,
  onSelectGuest,
  className = '',
}) {
  const [record, setRecord] = useState(initialTrackRecord || null);
  const [loading, setLoading] = useState(!initialTrackRecord?.credibilityScore);

  useEffect(() => {
    let isMounted = true;
    if (!guestName) return;

    if (initialTrackRecord && (initialTrackRecord.credibilityScore != null || initialTrackRecord.hitRate != null)) {
      setRecord(initialTrackRecord);
      setLoading(false);
      return;
    }

    setLoading(true);

    fetch(`/api/analyst-record?guest=${encodeURIComponent(guestName)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data && (data.credibilityScore != null || data.hitRate != null || Array.isArray(data.picks))) {
          setRecord(data);
        }
      })
      .catch((err) => {
        console.warn('[AnalystBubble] Failed to fetch analyst record:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [guestName, initialTrackRecord]);

  if (!guestName) return null;

  /* Calculate overall credibility score (/100) from real data */
  let score = null;
  if (record?.credibilityScore != null) {
    score = Math.round(record.credibilityScore);
  } else if (record?.hitRate != null) {
    score = Math.round(record.hitRate * 100);
  } else if (record?.optimalHorizonHitRate != null) {
    score = Math.round(record.optimalHorizonHitRate * 100);
  }

  /* Color range coding: >= 80 Green, 65-79 Yellow/Watch, < 65 Red */
  let badgeStyle = 'bg-surface-elevated text-dim border-edge';
  let badgeText = '--/100';

  if (loading && score == null) {
    badgeStyle = 'bg-surface-elevated text-dim border-edge animate-pulse';
    badgeText = 'Loading...';
  } else if (score != null) {
    badgeText = `${score}/100`;
    if (score >= 80) {
      badgeStyle = 'bg-signal-buy/15 text-signal-buy border-signal-buy/30';
    } else if (score >= 65) {
      badgeStyle = 'bg-signal-watch/15 text-signal-watch border-signal-watch/30';
    } else {
      badgeStyle = 'bg-signal-avoid/15 text-signal-avoid border-signal-avoid/30';
    }
  } else {
    badgeText = 'Unrated';
    badgeStyle = 'bg-surface-elevated/80 text-dim border-edge/60';
  }

  return (
    <button
      type="button"
      onClick={() => onSelectGuest && onSelectGuest(guestName)}
      className={`w-full text-left group bg-surface-card rounded-2xl p-5 shadow-antigravity hover:shadow-antigravity-hover border border-surface-elevated/40 hover:border-surface-elevated transition-all font-sans cursor-pointer ${className}`}
      title={`View ${guestName}'s track record & score details`}
    >
      <div className="space-y-3.5">
        {/* Top Header: Identity & Win Rate / Credibility Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-left">
            <h3 className="text-base font-bold text-prime group-hover:text-white transition-colors leading-snug">
              {guestName}
            </h3>
            <p className="text-xs text-dim leading-relaxed mt-0.5 text-left">
              {firm || record?.firm || 'BNN MarketCall Guest'}
            </p>
          </div>

          {/* Credibility Score Badge (/100 with range color) */}
          <div className="flex-shrink-0 text-right space-y-1">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-sm ${badgeStyle}`}>
              <span className="text-[10px] uppercase tracking-wider font-semibold opacity-90">Score:</span>
              <span className="text-xs font-bold font-mono">{badgeText}</span>
            </div>
            {date && (
              <span className="text-[10px] text-dim/70 font-medium block text-right">
                {date}
              </span>
            )}
          </div>
        </div>

        {/* Episode Focus */}
        {episodeFocus && (
          <div className="text-xs text-dim bg-surface-elevated/60 px-3.5 py-2.5 rounded-xl leading-relaxed font-sans text-left border border-edge/40">
            <span className="text-[10px] uppercase font-semibold text-dim block mb-0.5 tracking-wider">Episode Focus</span>
            {episodeFocus}
          </div>
        )}
      </div>

      {/* Bottom hint with neutral arrow */}
      <div className="mt-4 pt-3 border-t border-surface-elevated/40 flex items-center justify-between text-xs text-dim group-hover:text-prime transition-colors">
        <span className="font-medium text-dim group-hover:text-prime">View full analyst profile &amp; pick history</span>
        <svg className="w-4 h-4 text-dim group-hover:text-prime group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
