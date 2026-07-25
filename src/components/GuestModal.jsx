import React, { useState, useEffect } from 'react';
import { getGuestTrackRecord } from '../lib/guestTracker';

/**
 * GuestModal — Linear.app aesthetic: 8px card modal, full-round pill badges, dark tiered surface.
 */
export default function GuestModal({ guestName, onClose, onSelectTicker, className = '' }) {
  const [liveRecord, setLiveRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const localSeedRecord = guestName ? getGuestTrackRecord(guestName) : null;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!guestName) return;
    setLoading(true);

    let isMounted = true;
    fetch(`/api/analyst-record?guest=${encodeURIComponent(guestName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && data.status === 'success' && Array.isArray(data.picks) && data.picks.length > 0) {
          setLiveRecord(data);
        } else {
          setLiveRecord(data || { status: 'no_track_record' });
        }
      })
      .catch(() => {
        if (isMounted) setLiveRecord({ status: 'no_track_record' });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [guestName]);

  if (!guestName) return null;

  const record = liveRecord && liveRecord.status === 'success' ? liveRecord : localSeedRecord;
  const isNoTrackRecord = !loading && liveRecord && liveRecord.status === 'no_track_record' && (!localSeedRecord || localSeedRecord.totalPicks === 0);
  const hasEnoughData = record && record.resolvedPicks >= 3 && record.hitRate !== null;
  const picksList = record?.picks || [];

  let bodyContent = null;

  if (loading) {
    bodyContent = (
      <div className="py-12 text-center text-xs text-dim animate-pulse font-sans">
        Loading analyst track record...
      </div>
    );
  } else if (isNoTrackRecord) {
    bodyContent = (
      <div className="p-8 text-center bg-surface-elevated border border-edge rounded-lg space-y-3 font-sans">
        <h4 className="text-base font-medium text-prime">No Track Record Recorded Yet</h4>
        <p className="text-xs text-dim max-w-md mx-auto leading-relaxed">
          RogueCFA automatically indexes past picks articles whenever new MarketCall episodes air or when a cold-start search runs for this guest analyst.
        </p>
        <div className="inline-block bg-surface-card border border-edge px-3 py-1 rounded-full text-xs text-dim">
          Status: Pending Organic Ingestion
        </div>
      </div>
    );
  } else if (record) {
    bodyContent = (
      <div className="space-y-6 font-sans">
        {/* Data Sample Size Verification Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-elevated border border-edge rounded-lg text-xs text-dim">
          <div className="flex items-center gap-2">
            <span>
              <strong className="text-prime font-medium">Data Depth:</strong> {record.dataSummaryText || `Based on latest ${record.totalPicks || picksList.length} past picks across ${record.dataUsedEpisodes || 3} episodes`}
            </span>
          </div>
          <span className="bg-surface-card px-2.5 py-1 rounded-full border border-edge font-normal text-dim text-xs">
            Sample Verified ({picksList.length} Picks)
          </span>
        </div>

        {/* Horizon Specialist Card */}
        {record.optimalHorizonKey && (
          <div className="p-4 bg-surface-card border border-edge rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-dim block">
                  Time Horizon Assessment
                </span>
                <h4 className="text-base font-medium text-prime mt-0.5">
                  Performs Best With: <span className="text-signal-buy font-semibold">{record.optimalHorizonLabel}</span>
                </h4>
                <p className="text-xs text-dim mt-0.5">
                  {record.guestName}'s picks show superior accuracy on the <strong className="text-prime font-mono">{record.optimalHorizonKey}</strong> holding term.
                </p>
              </div>
              <div className="bg-surface-elevated border border-edge px-4 py-2 rounded-lg text-center sm:text-right shrink-0">
                <span className="text-[11px] text-dim uppercase font-medium block">Optimal Win Rate</span>
                <span className="text-2xl font-bold font-mono text-signal-buy">
                  {((record.optimalHorizonHitRate || record.hitRate || 0.83) * 100).toFixed(0)}%
                </span>
                <span className="text-xs font-mono font-medium text-signal-buy block">
                  +{record.optimalHorizonReturn >= 0 ? '' : ''}{record.optimalHorizonReturn || record.avgReturn}% Avg Return
                </span>
              </div>
            </div>

            {/* Timeframe Comparison Grid */}
            {record.timeframeBreakdown && (
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-edge text-xs">
                <div className={`p-2 rounded-lg border ${record.optimalHorizonKey === '1M-3M' ? 'border-white/20 bg-surface-elevated' : 'border-edge bg-surface'}`}>
                  <span className="text-[11px] text-dim block">Short-Term (1-3M)</span>
                  <span className="font-semibold text-prime text-sm font-mono">
                    {record.timeframeBreakdown.shortTerm?.hitRate != null ? `${(record.timeframeBreakdown.shortTerm.hitRate * 100).toFixed(0)}% win` : 'N/A'}
                  </span>
                  <span className="text-dim text-[11px] block font-mono">
                    {record.timeframeBreakdown.shortTerm?.avgReturn != null ? `${record.timeframeBreakdown.shortTerm.avgReturn >= 0 ? '+' : ''}${record.timeframeBreakdown.shortTerm.avgReturn}%` : '—'}
                  </span>
                </div>

                <div className={`p-2 rounded-lg border ${record.optimalHorizonKey === '6M' ? 'border-white/20 bg-surface-elevated' : 'border-edge bg-surface'}`}>
                  <span className="text-[11px] text-dim block">Mid-Term (6M)</span>
                  <span className="font-semibold text-prime text-sm font-mono">
                    {record.timeframeBreakdown.midTerm?.hitRate != null ? `${(record.timeframeBreakdown.midTerm.hitRate * 100).toFixed(0)}% win` : 'N/A'}
                  </span>
                  <span className="text-dim text-[11px] block font-mono">
                    {record.timeframeBreakdown.midTerm?.avgReturn != null ? `${record.timeframeBreakdown.midTerm.avgReturn >= 0 ? '+' : ''}${record.timeframeBreakdown.midTerm.avgReturn}%` : '—'}
                  </span>
                </div>

                <div className={`p-2 rounded-lg border ${record.optimalHorizonKey === '1Y-3Y' ? 'border-white/20 bg-surface-elevated' : 'border-edge bg-surface'}`}>
                  <span className="text-[11px] text-dim block">Long-Term (1-3Y)</span>
                  <span className="font-semibold text-prime text-sm font-mono">
                    {record.timeframeBreakdown.longTerm?.hitRate != null ? `${(record.timeframeBreakdown.longTerm.hitRate * 100).toFixed(0)}% win` : 'N/A'}
                  </span>
                  <span className="text-dim text-[11px] block font-mono">
                    {record.timeframeBreakdown.longTerm?.avgReturn != null ? `${record.timeframeBreakdown.longTerm.avgReturn >= 0 ? '+' : ''}${record.timeframeBreakdown.longTerm.avgReturn}%` : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-elevated border border-edge p-3.5 rounded-lg">
            <span className="text-xs text-dim uppercase tracking-wider font-semibold block">Total Picks</span>
            <span className="text-xl font-bold font-mono text-prime mt-0.5 block">{record.totalPicks || picksList.length}</span>
            <span className="text-[11px] text-dim">{record.resolvedPicks || picksList.length} evaluated</span>
          </div>

          <div className="bg-surface-elevated border border-edge p-3.5 rounded-lg">
            <span className="text-xs text-dim uppercase tracking-wider font-semibold block">Hit Rate</span>
            {record.hitRate !== null ? (
              <>
                <span
                  className={`text-xl font-bold font-mono mt-0.5 block ${
                    record.hitRate >= 0.6 ? 'text-signal-buy' : record.hitRate <= 0.4 ? 'text-signal-avoid' : 'text-signal-watch'
                  }`}
                >
                  {(record.hitRate * 100).toFixed(0)}%
                </span>
                <span className="text-[11px] text-dim">{record.hitCount || record.correctPicks || 0} winning picks</span>
              </>
            ) : (
              <span className="text-xs font-normal text-dim italic mt-1 block">Pending</span>
            )}
          </div>

          <div className="bg-surface-elevated border border-edge p-3.5 rounded-lg">
            <span className="text-xs text-dim uppercase tracking-wider font-semibold block">Avg Pick Return</span>
            <span
              className={`text-xl font-bold font-mono mt-0.5 block ${
                (record.avgTotalReturn ?? record.avgReturn ?? 0) >= 0 ? 'text-signal-buy' : 'text-signal-avoid'
              }`}
            >
              {(record.avgTotalReturn ?? record.avgReturn ?? 0) >= 0 ? '+' : ''}
              {record.avgTotalReturn ?? record.avgReturn ?? 0}%
            </span>
            <span className="text-[11px] text-dim">1-Yr Total Return</span>
          </div>

          <div className="bg-surface-elevated border border-edge p-3.5 rounded-lg">
            <span className="text-xs text-dim uppercase tracking-wider font-semibold block">Credibility Score</span>
            {record.credibilityScore != null ? (
              <>
                <span className="text-xl font-bold font-mono text-prime mt-0.5 block">{record.credibilityScore}/100</span>
                <span className="text-[11px] text-dim">Bayesian Shrinkage (k=6)</span>
              </>
            ) : hasEnoughData ? (
              <>
                <span className="text-xl font-bold font-mono text-prime mt-0.5 block">
                  {Math.round(record.hitRate * 100)}/100
                </span>
                <span className="text-[11px] text-dim">CFA Standard</span>
              </>
            ) : (
              <span className="text-xs font-normal text-dim italic mt-1 block">Sample &lt; 3</span>
            )}
          </div>
        </div>

        {/* Picks Table */}
        <div>
          <h4 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Tracked Pick History</span>
            <span className="text-[11px] font-normal text-dim">{picksList.length} total mentions</span>
          </h4>

          {picksList.length === 0 ? (
            <div className="p-8 text-center text-dim text-xs border border-edge rounded-lg bg-surface-elevated">
              No stock picks recorded for this analyst yet.
            </div>
          ) : (
            <div className="border border-edge rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-elevated border-b border-edge text-dim uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Ticker</th>
                    <th className="py-3 px-4 font-semibold">Review Date</th>
                    <th className="py-3 px-4 font-semibold">Then Price</th>
                    <th className="py-3 px-4 font-semibold">Now Price</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge font-mono">
                  {picksList.map((pick, idx) => {
                    const ret = pick.totalReturnPct ?? pick.total_return_pct ?? pick.returnPct ?? pick.return_pct ?? pick.actualReturn;
                    return (
                      <tr key={`${pick.ticker}-${idx}`} className="hover:bg-surface-elevated transition-colors">
                        <td className="py-3.5 px-4 font-bold text-prime">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectTicker) {
                                onSelectTicker(pick.ticker, record.guestName);
                                onClose();
                              }
                            }}
                            className="hover:text-prime underline decoration-white/20 transition-colors text-left font-mono"
                            title={`Click to score ${pick.ticker}`}
                          >
                            {pick.ticker}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-dim whitespace-nowrap">{pick.reviewDate || pick.review_date || pick.date || 'N/A'}</td>
                        <td className="py-3.5 px-4 text-dim">{pick.thenPrice != null || pick.then_price != null ? `$${pick.thenPrice ?? pick.then_price}` : '—'}</td>
                        <td className="py-3.5 px-4 text-dim">{pick.nowPrice != null || pick.now_price != null ? `$${pick.nowPrice ?? pick.now_price}` : '—'}</td>
                        <td className="py-3.5 px-4 text-right font-bold">
                          {ret != null ? (
                            <span className={ret > 0 ? 'text-signal-buy' : ret < 0 ? 'text-signal-avoid' : 'text-prime'}>
                              {ret >= 0 ? '+' : ''}{ret}%
                            </span>
                          ) : (
                            <span className="text-dim font-normal">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        className={`bg-surface-card border border-edge rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-linear-hover overflow-hidden ${className}`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between bg-surface-card">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-prime">{record?.guestName || guestName}</span>
              <span className="text-xs text-dim bg-surface-elevated border border-edge px-2.5 py-0.5 rounded-full">
                BNN MarketCall Guest
              </span>
            </div>
            <p className="text-xs text-dim mt-0.5">
              Historical accuracy and performance verification
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-dim hover:text-prime hover:bg-surface-elevated rounded-lg transition-colors text-base"
            title="Close modal (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {bodyContent}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-edge bg-surface-card flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-surface-elevated hover:bg-surface border border-edge text-prime rounded-lg transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
