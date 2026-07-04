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
          {/* Summary Banner */}
          {hasEnoughData ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-elevated border border-edge rounded-xl">
              <div className="text-center sm:text-left">
                <span className="text-xs font-mono text-faint uppercase block mb-1">Hit Rate Accuracy</span>
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
                <span className="text-xs font-mono text-faint uppercase block mb-1">Total Tracked Picks</span>
                <span className="text-3xl font-mono font-bold text-prime">{record.totalPicks}</span>
                <span className="text-[11px] text-dim block mt-0.5">In RogueCFA history</span>
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
