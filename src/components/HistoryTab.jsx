import React, { useState, useEffect } from 'react';
import { getHistory, clearHistory } from '../lib/historyManager';
import Scorecard from './Scorecard';

export default function HistoryTab({ onSelectTicker, className = '' }) {
  const [history, setHistory] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearHistory();
    setHistory([]);
    setConfirmClear(false);
  };

  /* Calculate summary stats */
  const totalScored = history.length;
  let correctCount = 0;
  let resolvedCount = 0;
  let buyReturnSum = 0;
  let buyReturnCount = 0;

  for (const item of history) {
    if (item.outcome !== null) {
      resolvedCount++;
      if (item.outcome === 'CORRECT') {
        correctCount++;
      }
    }
    if (item.signal === 'BUY_SIGNAL' && item.actualReturn != null && !isNaN(item.actualReturn)) {
      buyReturnSum += Number(item.actualReturn);
      buyReturnCount++;
    }
  }

  const correctPct = resolvedCount > 0 ? ((correctCount / resolvedCount) * 100).toFixed(0) : '0';
  const avgBuyReturn = buyReturnCount > 0 ? (buyReturnSum / buyReturnCount).toFixed(2) : '0.00';

  if (totalScored === 0) {
    return (
      <div className={`w-full max-w-5xl mx-auto p-12 text-center bg-surface-card border border-edge rounded-2xl shadow-xl animate-fade-in ${className}`}>
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-xl font-bold text-prime font-mono mb-2">No scoring history yet.</h3>
        <p className="text-sm text-dim max-w-md mx-auto">
          Score a ticker on the main scorecard view to get started. Every evaluation will be logged here automatically with price outcome tracking.
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto space-y-6 animate-fade-in ${className}`}>
      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-surface-card border border-edge rounded-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent text-2xl">
            📈
          </div>
          <div>
            <span className="text-xs font-mono text-faint uppercase block">Total Scored</span>
            <span className="text-3xl font-mono font-bold text-prime">{totalScored}</span>
            <span className="text-[11px] text-dim block mt-0.5">Historical evaluations</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-edge pt-4 md:pt-0 md:pl-6">
          <div className="p-3 bg-signal-buy/10 border border-signal-buy/20 rounded-xl text-signal-buy text-2xl">
            🎯
          </div>
          <div>
            <span className="text-xs font-mono text-faint uppercase block">Correct %</span>
            <span className="text-3xl font-mono font-bold text-signal-buy">{correctPct}%</span>
            <span className="text-[11px] text-dim block mt-0.5">
              {correctCount} of {resolvedCount} resolved calls
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-edge pt-4 md:pt-0 md:pl-6">
          <div className="p-3 bg-signal-watch/10 border border-signal-watch/20 rounded-xl text-signal-watch text-2xl">
            💰
          </div>
          <div>
            <span className="text-xs font-mono text-faint uppercase block">Avg BUY Return</span>
            <span className={`text-3xl font-mono font-bold ${Number(avgBuyReturn) >= 0 ? 'text-signal-buy' : 'text-signal-avoid'}`}>
              {Number(avgBuyReturn) >= 0 ? '+' : ''}{avgBuyReturn}%
            </span>
            <span className="text-[11px] text-dim block mt-0.5">Across BUY_SIGNAL calls</span>
          </div>
        </div>
      </div>

      {/* Table Header & Controls */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-lg font-bold font-mono text-prime flex items-center gap-2">
          <span>Score History & Outcomes</span>
          <span className="text-xs font-mono font-normal text-dim bg-surface-card px-2.5 py-0.5 rounded-full border border-edge">
            Auto-saved
          </span>
        </h3>

        <div className="flex items-center gap-3">
          {confirmClear ? (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-xs text-red-400 font-semibold">Delete all history?</span>
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1 text-xs font-mono font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-md"
              >
                Yes, Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1 text-xs font-mono bg-surface-elevated hover:bg-surface-card text-dim hover:text-prime rounded-lg transition-colors border border-edge"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className="px-3.5 py-1.5 text-xs font-mono text-dim hover:text-red-400 bg-surface-card hover:bg-red-950/20 border border-edge hover:border-red-800/40 rounded-lg transition-all"
            >
              🗑️ Clear History
            </button>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-surface-card border border-edge rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-elevated border-b border-edge text-faint font-mono uppercase text-[11px]">
                <th className="py-3.5 px-4 font-semibold w-10 text-center">#</th>
                <th className="py-3.5 px-4 font-semibold">Ticker</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Hold Period</th>
                <th className="py-3.5 px-4 font-semibold">Score</th>
                <th className="py-3.5 px-4 font-semibold">Signal</th>
                <th className="py-3.5 px-4 font-semibold text-right">Return</th>
                <th className="py-3.5 px-6 font-semibold">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {history.map((entry, idx) => {
                const isExpanded = expandedId === entry.id;
                const dateStr = entry.date
                  ? new Date(entry.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A';

                /* Outcome Badge Logic */
                let outcomeBadge = null;
                if (entry.outcome === 'CORRECT') {
                  outcomeBadge = (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-signal-buy bg-signal-buy/15 border border-signal-buy/40 px-2.5 py-1 rounded-full shadow-sm">
                      ✅ CORRECT
                    </span>
                  );
                } else if (entry.outcome === 'INCORRECT') {
                  outcomeBadge = (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-signal-avoid bg-signal-avoid/15 border border-signal-avoid/40 px-2.5 py-1 rounded-full shadow-sm">
                      ❌ INCORRECT
                    </span>
                  );
                } else if (entry.outcome === 'NEUTRAL') {
                  outcomeBadge = (
                    <span className="inline-flex items-center gap-1 font-mono font-medium text-[11px] text-signal-watch bg-signal-watch/15 border border-signal-watch/40 px-2.5 py-1 rounded-full shadow-sm">
                      ℹ️ NEUTRAL
                    </span>
                  );
                } else {
                  /* Pending: targetDate in future */
                  let countdownText = 'Pending';
                  if (entry.targetDate) {
                    const diffTime = new Date(entry.targetDate).getTime() - new Date().getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 0) {
                      countdownText = `⏳ Pending (${diffDays}d left)`;
                    } else {
                      countdownText = `⏳ Resolving...`;
                    }
                  }
                  outcomeBadge = (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-dim bg-surface-elevated border border-edge px-2.5 py-1 rounded-full">
                      {countdownText}
                    </span>
                  );
                }

                return (
                  <React.Fragment key={entry.id || idx}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="hover:bg-surface-elevated/50 transition-colors cursor-pointer select-none group"
                    >
                      <td className="py-4 px-4 text-center font-mono text-dim group-hover:text-prime">
                        <span className="inline-block transition-transform duration-200">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-prime text-sm">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectTicker) onSelectTicker(entry.ticker);
                          }}
                          className="hover:text-accent underline decoration-accent/40 transition-colors text-left"
                          title={`Click to score ${entry.ticker}`}
                        >
                          {entry.ticker}
                        </button>
                        <span className="block text-[10px] text-faint font-normal truncate max-w-[120px]">
                          {entry.companyName || entry.ticker}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-dim whitespace-nowrap">{dateStr}</td>
                      <td className="py-4 px-4 font-mono text-prime font-medium">{entry.holdPeriod || '6M'}</td>
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-base text-prime">{entry.score}</span>
                        <span className="text-xs text-faint font-mono">/100 ({entry.grade})</span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase ${
                            entry.signal === 'BUY_SIGNAL'
                              ? 'bg-signal-buy/15 text-signal-buy border border-signal-buy/40'
                              : entry.signal === 'AVOID'
                                ? 'bg-signal-avoid/15 text-signal-avoid border border-signal-avoid/40'
                                : 'bg-signal-watch/15 text-signal-watch border border-signal-watch/40'
                          }`}
                        >
                          {entry.signal === 'BUY_SIGNAL' ? 'BUY' : entry.signal || 'WATCH'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold">
                        {entry.actualReturn != null && !isNaN(entry.actualReturn) ? (
                          <span
                            className={
                              entry.actualReturn > 0
                                ? 'text-signal-buy'
                                : entry.actualReturn < 0
                                  ? 'text-signal-avoid'
                                  : 'text-prime'
                            }
                          >
                            {entry.actualReturn >= 0 ? '+' : ''}
                            {entry.actualReturn}%
                          </span>
                        ) : (
                          <span className="text-faint font-normal">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6">{outcomeBadge}</td>
                    </tr>

                    {/* Expandable Row Content */}
                    {isExpanded && (
                      <tr className="bg-surface-elevated/30 border-b border-edge">
                        <td colSpan={8} className="p-6">
                          <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between text-xs font-mono text-dim bg-surface-card p-3 rounded-xl border border-edge">
                              <div>
                                <span className="text-faint">Scored Price: </span>
                                <span className="text-prime font-bold">
                                  {entry.priceAtScore > 0 ? `$${Number(entry.priceAtScore).toFixed(2)}` : 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-faint">Current/Final Price: </span>
                                <span className="text-prime font-bold">
                                  {entry.finalPrice > 0 ? `$${Number(entry.finalPrice).toFixed(2)}` : 'Pending'}
                                </span>
                              </div>
                              <div>
                                <span className="text-faint">Target Resolution Date: </span>
                                <span className="text-prime font-bold">
                                  {entry.targetDate ? new Date(entry.targetDate).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                            </div>

                            <Scorecard
                              data={entry.scorecardData || entry}
                              holdPeriod={entry.holdPeriod || '6M'}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
