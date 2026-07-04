import React from 'react';

export default function ComparisonMatrix({ scorecards, comparisonResult }) {
  if (!scorecards || scorecards.length < 2) return null;

  /* Find highest scoring ticker */
  const topScorecard = [...scorecards].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const winnerTicker = comparisonResult?.winner || topScorecard?.ticker;

  return (
    <section className="w-full bg-surface-card border border-edge rounded-2xl p-6 md:p-8 shadow-xl animate-slide-up space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-edge pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-bold uppercase tracking-wider mb-2">
            ⚖️ Head-to-Head Analysis
          </div>
          <h3 className="text-2xl font-bold text-prime font-mono">
            Comparative Matrix ({scorecards.length} Assets)
          </h3>
          <p className="text-xs text-dim mt-0.5">
            Side-by-side evaluation across deterministic math sub-scores and AI trade-off analysis.
          </p>
        </div>

        {winnerTicker && (
          <div className="bg-gradient-to-r from-signal-buy/20 to-surface-elevated border border-signal-buy/40 px-4 py-3 rounded-xl flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-signal-buy block">
                Top Quantitative Candidate
              </span>
              <span className="text-lg font-bold font-mono text-prime">
                {winnerTicker}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Side-by-Side Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-edge bg-surface/40 text-xs font-semibold text-faint uppercase tracking-wider">
              <th className="py-3.5 px-4">Metric / Sub-Score</th>
              {scorecards.map((card) => {
                const isWinner = card.ticker === winnerTicker;
                const isTSX =
                  card.ticker?.toUpperCase().endsWith('.TO') ||
                  card.ticker?.toUpperCase().endsWith('.V') ||
                  card.exchange?.toUpperCase().includes('TORONTO') ||
                  card.exchange?.toUpperCase().includes('TSX') ||
                  card.currency === 'CAD' ||
                  card.country === 'CA';
                return (
                  <th key={card.ticker} className={`py-3.5 px-4 text-center ${isWinner ? 'bg-accent/10 font-bold text-prime' : 'text-dim'}`}>
                    <div className="text-base font-mono font-bold text-prime flex items-center justify-center gap-1.5">
                      {card.ticker}
                      {isWinner && <span className="text-xs text-signal-buy">★</span>}
                      {isTSX && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-1 py-0 rounded">
                          🇨A
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-faint font-normal truncate max-w-[120px] mx-auto">
                      {card.companyName || card.ticker}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge text-sm">
            {/* Total Score */}
            <tr>
              <td className="py-4 px-4 font-semibold text-prime">Total Math Score</td>
              {scorecards.map((card) => {
                const isWinner = card.ticker === winnerTicker;
                return (
                  <td key={card.ticker} className={`py-4 px-4 text-center font-mono font-bold ${isWinner ? 'bg-accent/5 text-accent' : 'text-prime'}`}>
                    <span className="text-lg">{card.score}</span>
                    <span className="text-xs text-faint">/100 ({card.grade})</span>
                  </td>
                );
              })}
            </tr>

            {/* Signal */}
            <tr>
              <td className="py-3.5 px-4 font-medium text-dim">Signal</td>
              {scorecards.map((card) => (
                <td key={card.ticker} className="py-3.5 px-4 text-center">
                  <span
                    className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      card.signal === 'BUY_SIGNAL'
                        ? 'bg-signal-buy/10 text-signal-buy border border-signal-buy/30'
                        : card.signal === 'AVOID'
                          ? 'bg-signal-avoid/10 text-signal-avoid border border-signal-avoid/30'
                          : 'bg-signal-watch/10 text-signal-watch border border-signal-watch/30'
                    }`}
                  >
                    {card.signal === 'BUY_SIGNAL' ? 'BUY' : card.signal || 'WATCH'}
                  </span>
                </td>
              ))}
            </tr>

            {/* Consensus Sub-Score */}
            <tr>
              <td className="py-3.5 px-4 font-medium text-dim">Analyst Consensus</td>
              {scorecards.map((card) => (
                <td key={card.ticker} className="py-3.5 px-4 text-center font-mono text-prime">
                  {card.score_breakdown?.consensus ?? '—'} pts
                </td>
              ))}
            </tr>

            {/* Momentum Sub-Score */}
            <tr>
              <td className="py-3.5 px-4 font-medium text-dim">Price Momentum</td>
              {scorecards.map((card) => (
                <td key={card.ticker} className="py-3.5 px-4 text-center font-mono text-prime">
                  {card.score_breakdown?.momentum ?? '—'} pts
                </td>
              ))}
            </tr>

            {/* Valuation Sub-Score */}
            <tr>
              <td className="py-3.5 px-4 font-medium text-dim">Valuation Reasonableness</td>
              {scorecards.map((card) => (
                <td key={card.ticker} className="py-3.5 px-4 text-center font-mono text-prime">
                  {card.score_breakdown?.valuation != null ? `${card.score_breakdown.valuation} pts` : <span className="text-faint text-xs">Finnhub N/A</span>}
                </td>
              ))}
            </tr>

            {/* Earnings Sub-Score */}
            <tr>
              <td className="py-3.5 px-4 font-medium text-dim">Earnings Beat / Trend</td>
              {scorecards.map((card) => (
                <td key={card.ticker} className="py-3.5 px-4 text-center font-mono text-prime">
                  {card.score_breakdown?.earnings != null ? `${card.score_breakdown.earnings} pts` : <span className="text-faint text-xs">Finnhub N/A</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── AI Comparative Narrative ── */}
      {comparisonResult && (
        <div className="bg-surface-elevated/60 border border-edge rounded-xl p-5 space-y-4">
          {comparisonResult.comparative_summary && (
            <div>
              <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">
                Comparative Summary
              </h4>
              <p className="text-sm text-prime leading-relaxed">
                {comparisonResult.comparative_summary}
              </p>
            </div>
          )}

          {Array.isArray(comparisonResult.key_tradeoffs) && comparisonResult.key_tradeoffs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-faint uppercase tracking-wider mb-2">
                Relative Trade-Offs
              </h4>
              <ul className="space-y-1.5">
                {comparisonResult.key_tradeoffs.map((item, i) => (
                  <li key={i} className="text-sm text-dim flex items-start gap-2">
                    <span className="text-accent font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
