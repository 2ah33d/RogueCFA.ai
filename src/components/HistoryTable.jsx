import { useState, useCallback } from 'react';
import { getHistory, clearHistory } from '../lib/storage';
import { fetchTickerData } from '../lib/finnhub';

export default function HistoryTable({ finnhubKey, onSelectTicker }) {
  const [history, setHistory] = useState(() => getHistory());
  const [currentPrices, setCurrentPrices] = useState({});
  const [loadingOutcomes, setLoadingOutcomes] = useState(false);
  const [error, setError] = useState('');

  const handleUpdateOutcomes = useCallback(async () => {
    if (!finnhubKey) {
      setError('Finnhub API key required to fetch live outcome quotes.');
      return;
    }
    setError('');
    setLoadingOutcomes(true);

    const uniqueTickers = [...new Set(history.map((h) => h.ticker).filter(Boolean))];
    const newPrices = { ...currentPrices };

    for (const ticker of uniqueTickers) {
      try {
        const data = await fetchTickerData(ticker, finnhubKey);
        if (data.quote && data.quote.c != null) {
          newPrices[ticker] = data.quote.c;
        }
      } catch (err) {
        console.warn(`Failed to fetch outcome quote for ${ticker}:`, err.message);
      }
    }

    setCurrentPrices(newPrices);
    setLoadingOutcomes(false);
  }, [history, finnhubKey, currentPrices]);

  const handleClear = () => {
    clearHistory();
    setHistory([]);
    setCurrentPrices({});
  };

  if (history.length === 0) {
    return (
      <div className="bg-surface-card border border-edge rounded-2xl p-10 text-center animate-fade-in">
        <h3 className="text-xl font-bold text-prime mb-2">No Score History Found</h3>
        <p className="text-dim text-sm max-w-md mx-auto">
          Every ticker you score is logged locally. Score a stock to start tracking historical accuracy and outcomes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-edge rounded-2xl overflow-hidden shadow-xl animate-fade-in w-full">
      {/* ── Header ── */}
      <div className="p-6 border-b border-edge flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-prime">Score History & Outcome Tracking</h3>
          <p className="text-xs text-dim mt-0.5">
            Compare past AI scorecards against live market prices to verify signal accuracy.
          </p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={handleUpdateOutcomes}
            disabled={loadingOutcomes}
            className="px-4 py-2 bg-gradient-to-r from-accent to-accent-muted text-white text-sm font-semibold rounded-lg hover:from-accent-hover hover:to-accent transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {loadingOutcomes ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Fetching Prices...
              </>
            ) : (
              '🔄 Update Outcomes'
            )}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 bg-surface border border-edge text-dim hover:text-danger hover:border-danger/30 text-xs font-medium rounded-lg transition-colors"
          >
            Clear History
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-danger/10 border-b border-danger/20 text-danger text-sm">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-edge bg-surface/40 text-xs font-semibold text-faint uppercase tracking-wider">
              <th className="py-3.5 px-6">Date</th>
              <th className="py-3.5 px-4">Ticker</th>
              <th className="py-3.5 px-4">Score</th>
              <th className="py-3.5 px-4">Signal</th>
              <th className="py-3.5 px-4 text-right">Entry Price</th>
              <th className="py-3.5 px-4 text-right">Current Price</th>
              <th className="py-3.5 px-6">Outcome Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge text-sm">
            {history.map((entry, idx) => {
              const dateStr = entry.scoredAt
                ? new Date(entry.scoredAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'N/A';
              const entryPrice = entry.entryPrice != null ? parseFloat(entry.entryPrice) : null;
              const currentPrice = currentPrices[entry.ticker];

              let returnPct = null;
              if (entryPrice > 0 && currentPrice != null) {
                returnPct = ((currentPrice - entryPrice) / entryPrice) * 100;
              }

              let outcomeBadge = <span className="text-faint text-xs italic">Click Update Outcomes</span>;
              if (returnPct != null) {
                const isBuy = entry.signal === 'BUY_SIGNAL';
                const isAvoid = entry.signal === 'AVOID';
                const sign = returnPct >= 0 ? '+' : '';
                const pctStr = `${sign}${returnPct.toFixed(2)}%`;

                if (isBuy) {
                  if (returnPct >= 0) {
                    outcomeBadge = (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-signal-buy bg-signal-buy/10 border border-signal-buy/30 px-2.5 py-1 rounded-full">
                        ✅ HIT ({pctStr})
                      </span>
                    );
                  } else {
                    outcomeBadge = (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-signal-avoid bg-signal-avoid/10 border border-signal-avoid/30 px-2.5 py-1 rounded-full">
                        ❌ MISS ({pctStr})
                      </span>
                    );
                  }
                } else if (isAvoid) {
                  if (returnPct <= 0) {
                    outcomeBadge = (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-signal-buy bg-signal-buy/10 border border-signal-buy/30 px-2.5 py-1 rounded-full">
                        ✅ HIT (Avoided {pctStr})
                      </span>
                    );
                  } else {
                    outcomeBadge = (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-signal-avoid bg-signal-avoid/10 border border-signal-avoid/30 px-2.5 py-1 rounded-full">
                        ❌ MISS (Up {pctStr})
                      </span>
                    );
                  }
                } else {
                  outcomeBadge = (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-signal-watch bg-signal-watch/10 border border-signal-watch/30 px-2.5 py-1 rounded-full">
                      ℹ️ WATCH ({pctStr})
                    </span>
                  );
                }
              }

              const isTSX =
                entry.ticker?.toUpperCase().endsWith('.TO') ||
                entry.ticker?.toUpperCase().endsWith('.V') ||
                entry.exchange?.toUpperCase().includes('TORONTO') ||
                entry.exchange?.toUpperCase().includes('TSX') ||
                entry.currency === 'CAD' ||
                entry.country === 'CA';

              return (
                <tr key={entry.scoredAt || idx} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="py-4 px-6 text-dim text-xs whitespace-nowrap">{dateStr}</td>
                  <td className="py-4 px-4 font-mono font-bold text-prime">
                    <div className="flex items-center gap-1.5">
                      {onSelectTicker ? (
                        <button
                          onClick={() => onSelectTicker(entry.ticker)}
                          className="hover:text-accent transition-colors underline decoration-accent/30"
                        >
                          {entry.ticker}
                        </button>
                      ) : (
                        entry.ticker
                      )}
                      {isTSX && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-1 py-0 rounded">
                          🇨A
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-prime">{entry.score}</span>
                    <span className="text-xs text-faint">/100 ({entry.grade})</span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
                  <td className="py-4 px-4 text-right font-mono text-dim">
                    {entryPrice != null ? `${isTSX ? 'CAD ' : ''}$${entryPrice.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-prime">
                    {currentPrice != null ? `${isTSX ? 'CAD ' : ''}$${currentPrice.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-4 px-6">{outcomeBadge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
