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
      <div className={`w-full max-w-5xl mx-auto p-12 text-center bg-surface-card border border-edge rounded-lg animate-fade-in ${className}`}>
        <div className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">HISTORICAL EVALUATIONS</div>
        <h3 className="text-xl font-bold text-prime mb-2">No scoring history yet.</h3>
        <p className="text-sm text-dim max-w-md mx-auto">
          Score a ticker on the main scorecard view to get started. Every evaluation will be logged here automatically with price outcome tracking.
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto space-y-6 animate-fade-in ${className}`}>
      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-surface-card border border-edge rounded-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface-elevated border border-edge rounded-lg text-prime font-mono font-bold text-sm">
            SUM
          </div>
          <div>
            <span className="text-xs text-dim uppercase tracking-wider font-semibold block">Total Scored</span>
            <span className="text-2xl font-bold font-mono text-prime">{totalScored}</span>
            <span className="text-xs text-faint block mt-0.5 font-sans">Historical evaluations</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-edge pt-4 md:pt-0 md:pl-6">
          <div className="p-3 bg-surface-elevated border border-edge rounded-lg text-signal-buy font-mono font-bold text-sm">
            ACC
          </div>
          <div>
            <span className="text-xs text-dim uppercase tracking-wider font-semibold block">Correct %</span>
            <span className="text-2xl font-bold font-mono text-signal-buy">{correctPct}%</span>
            <span className="text-xs text-faint block mt-0.5 font-sans">
              {correctCount} of {resolvedCount} resolved calls
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-edge pt-4 md:pt-0 md:pl-6">
          <div className="p-3 bg-surface-elevated border border-edge rounded-lg text-prime font-mono text-sm">
            RET
          </div>
          <div>
            <span className="text-xs text-dim uppercase tracking-wider font-semibold block">Avg BUY Return</span>
            <span className={`text-2xl font-bold font-mono ${Number(avgBuyReturn) >= 0 ? 'text-signal-buy' : 'text-signal-avoid'}`}>
              {Number(avgBuyReturn) >= 0 ? '+' : ''}{avgBuyReturn}%
            </span>
            <span className="text-xs text-faint block mt-0.5 font-sans">Across BUY calls</span>
          </div>
        </div>
      </div>

      {/* Table Header & Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-prime">
            Score History &amp; Outcomes
          </h3>
          <span className="text-xs text-dim bg-surface-card px-2.5 py-0.5 rounded-lg border border-edge font-medium">
            Auto-saved
          </span>
        </div>

        <div className="flex items-center gap-3">
          {confirmClear ? (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-xs text-danger font-medium">Delete all history?</span>
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1 text-xs font-medium bg-danger text-white rounded-lg transition-colors"
              >
                Yes, Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1 text-xs bg-surface-card hover:bg-surface-elevated text-dim hover:text-prime rounded-lg transition-colors border border-edge"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 text-xs text-dim hover:text-danger bg-surface-card hover:bg-surface-elevated border border-edge rounded-lg transition-colors font-medium"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-surface-card border border-edge rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-elevated border-b border-edge text-dim uppercase tracking-wider text-[11px]">
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
            <tbody className="divide-y divide-edge font-mono">
              {history.map((entry, idx) => {
                const isExpanded = expandedId === entry.id;
                const dateStr = entry.date
                  ? new Date(entry.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A';

                let outcomeBadge = null;
                if (entry.outcome === 'CORRECT') {
                  outcomeBadge = (
                    <span className="inline-flex items-center text-xs font-semibold text-signal-buy bg-signal-buy/10 border border-signal-buy/30 px-2.5 py-0.5 rounded-lg">
                      CORRECT
                    </span>
                  );
                } else if (entry.outcome === 'INCORRECT') {
                  outcomeBadge = (
                    <span className="inline-flex items-center text-xs font-semibold text-signal-avoid bg-signal-avoid/10 border border-signal-avoid/30 px-2.5 py-0.5 rounded-lg">
                      INCORRECT
                    </span>
                  );
                } else if (entry.outcome === 'NEUTRAL') {
                  outcomeBadge = (
                    <span className="inline-flex items-center text-xs font-semibold text-signal-watch bg-signal-watch/10 border border-signal-watch/30 px-2.5 py-0.5 rounded-lg">
                      NEUTRAL
                    </span>
                  );
                } else {
                  let countdownText = 'Pending';
                  if (entry.targetDate) {
                    const diffTime = new Date(entry.targetDate).getTime() - new Date().getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 0) {
                      countdownText = `Pending (${diffDays}d left)`;
                    } else {
                      countdownText = `Resolving...`;
                    }
                  }
                  outcomeBadge = (
                    <span className="inline-flex items-center text-xs text-dim bg-surface-elevated border border-edge px-2.5 py-0.5 rounded-lg font-sans">
                      {countdownText}
                    </span>
                  );
                }

                return (
                  <React.Fragment key={entry.id || idx}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="hover:bg-surface-elevated/60 transition-colors cursor-pointer select-none group"
                    >
                      <td className="py-4 px-4 text-center text-dim group-hover:text-prime font-mono">
                        <span>{isExpanded ? '▼' : '▶'}</span>
                      </td>
                      <td className="py-4 px-4 font-bold text-prime text-sm">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectTicker) onSelectTicker(entry.ticker);
                          }}
                          className="hover:text-accent underline decoration-accent/40 transition-colors text-left font-mono"
                          title={`Click to score ${entry.ticker}`}
                        >
                          {entry.ticker}
                        </button>
                        <span className="block text-[11px] text-faint font-normal font-sans truncate max-w-[120px]">
                          {entry.companyName || entry.ticker}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-dim whitespace-nowrap font-mono">{dateStr}</td>
                      <td className="py-4 px-4 text-prime font-mono">{entry.holdPeriod || '6M'}</td>
                      <td className="py-4 px-4 font-mono">
                        <span className="font-bold text-base text-prime">{entry.score}</span>
                        <span className="text-xs text-faint">/100 ({entry.grade})</span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg uppercase ${
                            entry.signal === 'BUY_SIGNAL'
                              ? 'bg-signal-buy/10 text-signal-buy border border-signal-buy/30'
                              : entry.signal === 'AVOID'
                                ? 'bg-signal-avoid/10 text-signal-avoid border border-signal-avoid/30'
                                : 'bg-signal-watch/10 text-signal-watch border border-signal-watch/30'
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
                      <tr className="bg-surface-elevated/40 border-b border-edge">
                        <td colSpan={8} className="p-6">
                          <div className="max-w-4xl mx-auto space-y-4 animate-fade-in font-sans">
                            <div className="flex items-center justify-between text-xs text-dim bg-surface-card p-3 rounded-lg border border-edge">
                              <div>
                                <span className="text-faint">Scored Price: </span>
                                <span className="text-prime font-bold font-mono">
                                  {entry.priceAtScore > 0 ? `$${Number(entry.priceAtScore).toFixed(2)}` : 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-faint">Current/Final Price: </span>
                                <span className="text-prime font-bold font-mono">
                                  {entry.finalPrice > 0 ? `$${Number(entry.finalPrice).toFixed(2)}` : 'Pending'}
                                </span>
                              </div>
                              <div>
                                <span className="text-faint">Target Resolution Date: </span>
                                <span className="text-prime font-bold font-mono">
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
