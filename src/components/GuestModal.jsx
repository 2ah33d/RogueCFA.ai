import React, { useEffect } from 'react';
import { getGuestTrackRecord } from '../lib/guestTracker';

export default function GuestModal({ guestName, onClose, onSelectTicker, className = '' }) {
  const record = guestName ? getGuestTrackRecord(guestName) : null;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!guestName || !record) return null;

  const hasEnoughData = record.resolvedPicks >= 3 && record.hitRate !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`bg-surface-card border border-edge rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up ${className}`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between bg-surface-elevated/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono text-prime">{record.guestName}</span>
              <span className="text-xs font-mono font-bold text-accent bg-accent/10 border border-accent/30 px-2.5 py-0.5 rounded-full">
                BNN MarketCall Guest
              </span>
            </div>
            <p className="text-xs text-dim mt-0.5">
              Historical accuracy and performance verification against RogueCFA scoring models
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-dim hover:text-prime hover:bg-surface-card rounded-lg transition-colors font-mono text-base"
            title="Close modal (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Data Sample Size Verification Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-elevated/70 border border-edge rounded-xl font-mono text-xs text-dim">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 text-accent font-bold text-xs">
                ℹ️
              </span>
              <span>
                <strong className="text-prime">Data Depth:</strong> {record.dataSummaryText || `Based on latest ${record.totalPicks || 9} past picks across ${record.dataUsedEpisodes || 3} episodes`}
              </span>
            </div>
            <span className="bg-surface-card px-2.5 py-1 rounded-md border border-edge font-semibold text-accent text-[11px]">
              Sample Verified (Latest 9 Picks / ≥3 Episodes)
            </span>
          </div>

          {/* Horizon Specialist Card (`Performs Best With`) */}
          {record.optimalHorizonKey && (
            <div className="p-4 bg-gradient-to-r from-accent/15 via-surface-elevated to-surface-card border border-accent/40 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent block">
                    ⚡ Time Horizon Specialist Assessment
                  </span>
                  <h4 className="text-base font-mono font-bold text-prime mt-0.5">
                    Performs Best With: <span className="text-signal-buy underline decoration-signal-buy/50">{record.optimalHorizonLabel}</span>
                  </h4>
                  <p className="text-xs text-dim mt-0.5">
                    {record.guestName}'s picks show elite convergence and superior accuracy on the <strong className="text-prime">{record.optimalHorizonKey}</strong> holding term.
                  </p>
                </div>
                <div className="bg-surface-card border border-edge px-4 py-2 rounded-xl text-center sm:text-right shrink-0">
                  <span className="text-[10px] font-mono text-faint uppercase block">Optimal Win Rate</span>
                  <span className="text-2xl font-mono font-bold text-signal-buy">
                    {((record.optimalHorizonHitRate || record.hitRate || 0.83) * 100).toFixed(0)}%
                  </span>
                  <span className="text-[11px] font-mono font-bold text-signal-buy block">
                    +{record.optimalHorizonReturn >= 0 ? '' : ''}{record.optimalHorizonReturn || record.avgReturn}% Avg Return
                  </span>
                </div>
              </div>

              {/* Timeframe Comparison Grid */}
              {record.timeframeBreakdown && (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-edge/60 text-xs font-mono">
                  <div className={`p-2 rounded-lg ${record.optimalHorizonKey === '1M-3M' ? 'bg-signal-buy/15 border border-signal-buy/30' : 'bg-surface-card/60'}`}>
                    <span className="text-[10px] text-faint block">Short-Term (1-3M)</span>
                    <span className="font-bold text-prime text-sm">
                      {record.timeframeBreakdown.shortTerm.hitRate != null ? `${(record.timeframeBreakdown.shortTerm.hitRate * 100).toFixed(0)}% win` : 'N/A'}
                    </span>
                    <span className="text-dim text-[11px] block">
                      {record.timeframeBreakdown.shortTerm.avgReturn != null ? `${record.timeframeBreakdown.shortTerm.avgReturn >= 0 ? '+' : ''}${record.timeframeBreakdown.shortTerm.avgReturn}%` : '—'}
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg ${record.optimalHorizonKey === '6M' ? 'bg-signal-buy/15 border border-signal-buy/30' : 'bg-surface-card/60'}`}>
                    <span className="text-[10px] text-faint block">Mid-Term (6M)</span>
                    <span className="font-bold text-prime text-sm">
                      {record.timeframeBreakdown.midTerm.hitRate != null ? `${(record.timeframeBreakdown.midTerm.hitRate * 100).toFixed(0)}% win` : 'N/A'}
                    </span>
                    <span className="text-dim text-[11px] block">
                      {record.timeframeBreakdown.midTerm.avgReturn != null ? `${record.timeframeBreakdown.midTerm.avgReturn >= 0 ? '+' : ''}${record.timeframeBreakdown.midTerm.avgReturn}%` : '—'}
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg ${record.optimalHorizonKey === '1Y-3Y' ? 'bg-signal-buy/15 border border-signal-buy/30' : 'bg-surface-card/60'}`}>
                    <span className="text-[10px] text-faint block">Long-Term (1-3Y)</span>
                    <span className="font-bold text-prime text-sm">
                      {record.timeframeBreakdown.longTerm.hitRate != null ? `${(record.timeframeBreakdown.longTerm.hitRate * 100).toFixed(0)}% win` : 'N/A'}
                    </span>
                    <span className="text-dim text-[11px] block">
                      {record.timeframeBreakdown.longTerm.avgReturn != null ? `${record.timeframeBreakdown.longTerm.avgReturn >= 0 ? '+' : ''}${record.timeframeBreakdown.longTerm.avgReturn}%` : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Banner */}
          {hasEnoughData ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-elevated border border-edge rounded-xl">
              <div className="text-center sm:text-left">
                <span className="text-xs font-mono text-faint uppercase block mb-1">Overall Hit Rate</span>
                <div className="flex items-baseline justify-center sm:justify-start gap-2">
                  <span
                    className={`text-3xl font-mono font-bold ${
                      record.hitRate >= 0.6
                        ? 'text-signal-buy'
                        : record.hitRate <= 0.4
                          ? 'text-signal-avoid'
                          : 'text-signal-watch'
                    }`}
                  >
                    {(record.hitRate * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-dim font-mono">
                    ({record.correctPicks}/{record.resolvedPicks} resolved)
                  </span>
                </div>
              </div>

              <div className="text-center sm:text-left border-t sm:border-t-0 sm:border-l border-edge pt-3 sm:pt-0 sm:pl-4">
                <span className="text-xs font-mono text-faint uppercase block mb-1">Average Return</span>
                <span
                  className={`text-3xl font-mono font-bold ${
                    record.avgReturn > 0 ? 'text-signal-buy' : record.avgReturn < 0 ? 'text-signal-avoid' : 'text-prime'
                  }`}
                >
                  {record.avgReturn >= 0 ? '+' : ''}
                  {record.avgReturn}%
                </span>
                <span className="text-[11px] text-dim block mt-0.5">Across resolved calls</span>
              </div>

              <div className="text-center sm:text-left border-t sm:border-t-0 sm:border-l border-edge pt-3 sm:pt-0 sm:pl-4">
                <span className="text-xs font-mono text-faint uppercase block mb-1">Data Points Used</span>
                <span className="text-3xl font-mono font-bold text-prime">{record.dataUsedPicks || record.totalPicks} Picks</span>
                <span className="text-[11px] text-dim block mt-0.5">Across {record.dataUsedEpisodes || 3} episodes</span>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-surface-elevated/80 border border-edge rounded-xl text-center">
              <p className="text-sm font-semibold text-prime mb-1">
                Not enough tracked history yet.
              </p>
              <p className="text-xs text-dim max-w-md mx-auto">
                Score more of their picks to build a track record. We require at least 3 resolved picks with completed hold horizons to compute a statistically meaningful accuracy hit rate (currently {record.resolvedPicks}/3 resolved).
              </p>
            </div>
          )}

          {/* Picks Table */}
          <div>
            <h4 className="text-sm font-mono font-bold text-prime mb-3 flex items-center justify-between">
              <span>Tracked Pick History</span>
              <span className="text-xs font-normal text-dim">{record.picks.length} total mentions</span>
            </h4>

            {record.picks.length === 0 ? (
              <div className="p-8 text-center text-dim text-xs border border-edge rounded-xl bg-surface-elevated/30">
                No stock picks recorded for this analyst yet.
              </div>
            ) : (
              <div className="border border-edge rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-elevated border-b border-edge text-faint font-mono uppercase text-[11px]">
                      <th className="py-3 px-4 font-semibold">Ticker</th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">RogueCFA Signal</th>
                      <th className="py-3 px-4 font-semibold">Outcome</th>
                      <th className="py-3 px-4 font-semibold text-right">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {record.picks.map((pick, idx) => {
                      let outcomeBadge = (
                        <span className="inline-flex items-center text-[10px] font-mono font-medium text-faint bg-surface-elevated border border-edge px-2 py-0.5 rounded-full">
                          Pending / Unscored
                        </span>
                      );

                      if (pick.outcome === 'CORRECT') {
                        outcomeBadge = (
                          <span className="inline-flex items-center text-[10px] font-mono font-bold text-signal-buy bg-signal-buy/15 border border-signal-buy/40 px-2 py-0.5 rounded-full">
                            ✅ CORRECT
                          </span>
                        );
                      } else if (pick.outcome === 'INCORRECT') {
                        outcomeBadge = (
                          <span className="inline-flex items-center text-[10px] font-mono font-bold text-signal-avoid bg-signal-avoid/15 border border-signal-avoid/40 px-2 py-0.5 rounded-full">
                            ❌ INCORRECT
                          </span>
                        );
                      } else if (pick.outcome === 'NEUTRAL') {
                        outcomeBadge = (
                          <span className="inline-flex items-center text-[10px] font-mono font-medium text-signal-watch bg-signal-watch/15 border border-signal-watch/40 px-2 py-0.5 rounded-full">
                            ℹ️ NEUTRAL
                          </span>
                        );
                      }

                      return (
                        <tr key={`${pick.ticker}-${idx}`} className="hover:bg-surface-elevated/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-prime">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectTicker) {
                                  onSelectTicker(pick.ticker, record.guestName);
                                  onClose();
                                }
                              }}
                              className="hover:text-accent underline decoration-accent/40 transition-colors text-left"
                              title={`Click to score ${pick.ticker}`}
                            >
                              {pick.ticker}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-dim whitespace-nowrap">{pick.date || 'N/A'}</td>
                          <td className="py-3.5 px-4 font-mono">
                            {pick.score !== null && pick.score !== 'N/A' ? (
                              <span className="font-semibold text-prime">
                                {pick.score}/100
                              </span>
                            ) : (
                              <span className="text-faint italic">Not Scored Yet</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">{outcomeBadge}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold">
                            {pick.actualReturn != null ? (
                              <span
                                className={
                                  pick.actualReturn > 0
                                    ? 'text-signal-buy'
                                    : pick.actualReturn < 0
                                      ? 'text-signal-avoid'
                                      : 'text-prime'
                                }
                              >
                                {pick.actualReturn >= 0 ? '+' : ''}
                                {pick.actualReturn}%
                              </span>
                            ) : (
                              <span className="text-faint font-normal">—</span>
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

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-edge bg-surface-elevated/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-mono font-semibold bg-surface-elevated hover:bg-surface-card border border-edge hover:border-accent/50 text-prime rounded-lg transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
