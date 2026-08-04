import React, { useMemo, useState } from 'react';
import { calculateGoldenGoose, synthesizeGoldenPickThesis } from '../lib/goldenGoose';
import { getKeys, getProvider } from '../lib/storage';

/**
 * GoldenGoosePanel — Displays Golden Goose Picks & Warning Sells
 * derived deterministically from multi-episode MarketCall caller mentions + top picks.
 *
 * @param {Object} props
 * @param {Array<Object>} props.episodes - List of MarketCall episodes
 * @param {Function} props.onScoreTicker - (ticker) => void — trigger RogueCFA scoring
 * @param {Function} props.onSelectGuest - (guestName) => void — open guest profile
 */
export default function GoldenGoosePanel({ episodes = [], onScoreTicker, onSelectGuest }) {
  const [showAllRankings, setShowAllRankings] = useState(false);
  const [synthesizedTheses, setSynthesizedTheses] = useState({});
  const [synthesizingMap, setSynthesizingMap] = useState({});

  const { goldenPicks, warningSells, allScores, episodeCount } = useMemo(() => {
    return calculateGoldenGoose(episodes, 7); // 7-day rolling window covers 5 weekday episodes
  }, [episodes]);

  const handleSynthesize = async (pick) => {
    const ticker = pick.ticker;
    const { llmKey } = getKeys();
    const provider = getProvider();

    setSynthesizingMap((prev) => ({ ...prev, [ticker]: true }));
    try {
      const thesis = await synthesizeGoldenPickThesis(
        ticker,
        pick.companyName,
        pick.allReasonings || [...pick.topPickReasonings, ...pick.callerReasonings],
        llmKey,
        provider
      );
      setSynthesizedTheses((prev) => ({ ...prev, [ticker]: thesis }));
    } catch (err) {
      console.warn('Synthesis failed:', err);
    } finally {
      setSynthesizingMap((prev) => ({ ...prev, [ticker]: false }));
    }
  };

  if (!episodes || episodes.length === 0) {
    return (
      <div className="bg-surface-card border border-edge/60 rounded-2xl p-6 text-center shadow-antigravity my-6">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
          🪿
        </div>
        <h3 className="text-base font-bold text-prime mb-1">Golden Goose Signals Pending</h3>
        <p className="text-xs text-dim max-w-md mx-auto">
          Load recent BNN MarketCall episode digests from history to compute multi-analyst convergence and caller validation signals.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-8 space-y-6 font-sans">
      {/* ── Header Bar ── */}
      <div className="bg-gradient-to-r from-amber-950/40 via-surface-card to-surface-card border border-amber-500/30 rounded-2xl p-6 shadow-antigravity relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🪿</span>
              <h2 className="text-lg font-bold text-prime tracking-tight">Golden Goose Radar</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-amber-500/15 border border-amber-500/40 text-amber-400 rounded-full">
                7-Day Window (5 Episodes)
              </span>
            </div>
            <p className="text-xs text-dim">
              Multi-analyst convergence engine ($0.00 LLM cost) tracking caller validation across {episodeCount} episode{episodeCount === 1 ? '' : 's'}.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 bg-surface-elevated/80 border border-edge rounded-xl text-dim">
              <span className="text-amber-400 font-bold mr-1.5">+{goldenPicks.length}</span>
              <span>Golden Pick{goldenPicks.length === 1 ? '' : 's'}</span>
            </div>
            {warningSells.length > 0 && (
              <div className="px-3 py-1.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-400">
                <span className="font-bold mr-1.5">{warningSells.length}</span>
                <span>Warning Sell{warningSells.length === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Golden Picks Section ── */}
      {goldenPicks.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span>🏆 Top Golden Goose Signals</span>
              <span className="text-xs font-normal text-dim uppercase">({goldenPicks.length} Tickers)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goldenPicks.map((pick) => {
              const ticker = pick.ticker;
              const isSynthesizing = synthesizingMap[ticker];
              const thesis = synthesizedTheses[ticker];

              return (
                <div
                  key={ticker}
                  className="bg-surface-card border border-amber-500/40 hover:border-amber-400/80 rounded-2xl p-5 shadow-lg shadow-amber-950/20 transition-all group relative flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header: Ticker & Score & Fire Logo */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-extrabold font-mono text-prime group-hover:text-amber-400 transition-colors">
                            {ticker}
                          </span>
                          
                          {/* Fire Logo for Persistent Multi-Week Picks */}
                          {pick.isPersistentHotPick && (
                            <span
                              className="px-2 py-0.5 text-[10px] font-mono font-bold bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/50 text-orange-300 rounded-md flex items-center gap-1 shadow-sm"
                              title="Persistent Hot Pick: Mentioned across multiple weeks or episodes spanning >7 days"
                            >
                              <span>🔥</span>
                              <span>{pick.streakDays > 0 ? `${pick.streakDays}D STREAK` : 'MULTI-WEEK'}</span>
                            </span>
                          )}

                          {pick.convergenceBonusApplied && (
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-400/20 border border-amber-400/50 text-amber-300 rounded-md">
                              +4.5 CONVERGENCE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dim line-clamp-1">{pick.companyName}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black font-mono text-amber-400">
                          +{pick.score} <span className="text-[10px] text-faint font-normal">PTS</span>
                        </div>
                        <div className="text-[10px] font-mono text-dim">
                          {pick.positiveEpisodes} episode{pick.positiveEpisodes === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    {/* Convergence & Analyst Highlights */}
                    <div className="space-y-2 mb-4">
                      <div className="text-[11px] text-dim font-medium flex flex-wrap items-center gap-1.5">
                        <span className="text-faint">Participating Analysts:</span>
                        {pick.participatingAnalysts.map((analyst, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSelectGuest && onSelectGuest(analyst)}
                            className="px-2 py-0.5 bg-surface-elevated hover:bg-amber-400/20 border border-edge text-prime hover:text-amber-300 rounded-md text-[11px] transition-colors"
                          >
                            {analyst}
                          </button>
                        ))}
                      </div>

                      {/* Excerpt logic */}
                      {pick.topPickReasonings.length > 0 && !thesis && (
                        <div className="bg-surface-elevated/60 border border-edge/40 rounded-xl p-2.5 text-xs text-dim italic line-clamp-2">
                          "{pick.topPickReasonings[0].text}"
                          <span className="not-italic text-[10px] text-faint ml-1">— {pick.topPickReasonings[0].analyst}</span>
                        </div>
                      )}

                      {/* AI Synthesized Multi-Episode Thesis Box */}
                      {thesis && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 leading-relaxed shadow-sm">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                            <span>✨ AI Synthesized Multi-Episode Outlook</span>
                          </div>
                          <p>{thesis}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="space-y-2">
                    {/* Optional Synthesize Button if multiple reasonings exist */}
                    {pick.allReasonings && pick.allReasonings.length >= 2 && !thesis && (
                      <button
                        type="button"
                        onClick={() => handleSynthesize(pick)}
                        disabled={isSynthesizing}
                        className="w-full py-1.5 px-3 bg-surface-elevated hover:bg-surface-elevated/80 border border-edge text-dim hover:text-prime text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        {isSynthesizing ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Synthesizing ({pick.allReasonings.length} Mentions)...</span>
                          </>
                        ) : (
                          <>
                            <span>✨ Synthesize {pick.allReasonings.length} Analyst Mentions (~300 tokens)</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Score Action Button */}
                    <button
                      type="button"
                      onClick={() => onScoreTicker && onScoreTicker(ticker)}
                      className="w-full py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
                    >
                      <span>Score {ticker} with RogueCFA AI</span>
                      <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-surface-card border border-edge rounded-xl p-4 text-center text-xs text-dim">
          No strong Golden Goose convergence signals detected in the selected 7-day window.
        </div>
      )}

      {/* ── Warning Sells Section ── */}
      {warningSells.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <span>⚠️ Multi-Episode Warning Sells</span>
            <span className="text-xs font-normal text-dim">({warningSells.length})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warningSells.map((sell) => (
              <div
                key={sell.ticker}
                className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-base font-bold font-mono text-rose-300">{sell.ticker}</span>
                      <p className="text-xs text-dim">{sell.companyName}</p>
                    </div>
                    <span className="text-sm font-black font-mono text-rose-400">{sell.score} PTS</span>
                  </div>
                  <p className="text-xs text-rose-200/80 mb-3">
                    Flagged across {sell.negativeEpisodes} distinct episode{sell.negativeEpisodes === 1 ? '' : 's'} with Sell/Avoid analyst stances.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onScoreTicker && onScoreTicker(sell.ticker)}
                  className="w-full py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg transition-all"
                >
                  Verify {sell.ticker} Score
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── All Ranked Tickers Drawer Toggle ── */}
      {allScores.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAllRankings(!showAllRankings)}
            className="w-full py-2.5 px-4 bg-surface-card hover:bg-surface-elevated border border-edge text-dim hover:text-prime text-xs font-medium rounded-xl transition-all flex items-center justify-between"
          >
            <span>View All Evaluated Tickers ({allScores.length})</span>
            <svg
              className={`w-4 h-4 transition-transform ${showAllRankings ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAllRankings && (
            <div className="mt-3 bg-surface-card border border-edge rounded-2xl overflow-hidden shadow-inner">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-elevated border-b border-edge text-dim uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Ticker</th>
                    <th className="py-2.5 px-4">Company</th>
                    <th className="py-2.5 px-4 text-center">Score</th>
                    <th className="py-2.5 px-4 text-center">Episodes</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/40">
                  {allScores.map((item) => (
                    <tr key={item.ticker} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-prime">
                        <span className="inline-flex items-center gap-1">
                          {item.isPersistentHotPick && <span>🔥</span>}
                          {item.ticker}
                        </span>
                        {item.convergenceBonusApplied && (
                          <span className="ml-1.5 px-1.5 py-0.2 text-[9px] bg-amber-500/20 text-amber-300 rounded">
                            CONVERGENCE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-dim max-w-[180px] truncate">{item.companyName}</td>
                      <td className={`py-2.5 px-4 text-center font-bold ${item.score > 0 ? 'text-amber-400' : item.score < 0 ? 'text-rose-400' : 'text-dim'}`}>
                        {item.score > 0 ? `+${item.score}` : item.score}
                      </td>
                      <td className="py-2.5 px-4 text-center text-dim">{item.totalEpisodes}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onScoreTicker && onScoreTicker(item.ticker)}
                          className="px-2.5 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-[11px] font-semibold rounded-md transition-all"
                        >
                          Score
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
