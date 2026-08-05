import React, { useMemo, useState, useEffect } from 'react';
import { buildShortlists, buildLLMEyesPrompt, validateLLMEyesResponse } from '../lib/goldenGoose';
import { getKeys, getProvider } from '../lib/storage';

/**
 * GoldenGoosePanel — Golden Goose v2 UI Component
 * Replaces old deterministic threshold checks entirely with LLM-Eyes selection
 * over the deterministic candidate shortlist.
 *
 * @param {Object} props
 * @param {Array<Object>} props.episodes - List of MarketCall episodes
 * @param {Function} props.onScoreTicker - (ticker) => void — trigger RogueCFA scoring
 * @param {Function} props.onSelectGuest - (guestName) => void — open guest profile
 */
export default function GoldenGoosePanel({ episodes = [], onScoreTicker, onSelectGuest }) {
  const [showAllShortlists, setShowAllShortlists] = useState(false);
  const [llmResult, setLlmResult] = useState(null);
  const [loadingLLM, setLoadingLLM] = useState(false);
  const [llmError, setLlmError] = useState(null);

  /* Layer 1: Deterministic Shortlists */
  const { buyHoldCandidates, sellCandidates } = useMemo(() => {
    return buildShortlists(episodes, 7);
  }, [episodes]);

  /* Layer 2: LLM Eyes Evaluation */
  useEffect(() => {
    if (buyHoldCandidates.length === 0 && sellCandidates.length === 0) {
      setLlmResult({ goldenPicks: [], warningSells: [], _rejectedTickers: [] });
      return;
    }

    let isMounted = true;
    setLoadingLLM(true);
    setLlmError(null);

    const { llmKey } = getKeys();
    const provider = getProvider();

    fetch('/api/goldengoose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        windowDays: 7,
        llmKey,
        provider,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data && data.result) {
          setLlmResult(data.result);
        } else {
          /* Client-side fallback if backend route unavailable */
          setLlmResult({
            goldenPicks: buyHoldCandidates.map((c) => ({
              ticker: c.ticker,
              rationale: `Surfaced from deterministic shortlist (${c.mentionCount} mentions across ${c.distinctGuestCount} analysts).`,
            })),
            warningSells: sellCandidates.map((c) => ({
              ticker: c.ticker,
              rationale: `Surfaced from sell candidate shortlist (${c.mentionCount} sell mention).`,
            })),
            _rejectedTickers: [],
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[GoldenGoosePanel] LLM Eyes API call failed, using candidate shortlist:', err);
        setLlmResult({
          goldenPicks: buyHoldCandidates.map((c) => ({
            ticker: c.ticker,
            rationale: `Candidate shortlist (${c.mentionCount} mentions across ${c.distinctGuestCount} analysts).`,
          })),
          warningSells: sellCandidates.map((c) => ({
            ticker: c.ticker,
            rationale: `Candidate sell shortlist (${c.mentionCount} sell mention).`,
          })),
          _rejectedTickers: [],
        });
      })
      .finally(() => {
        if (isMounted) setLoadingLLM(false);
      });

    return () => {
      isMounted = false;
    };
  }, [buyHoldCandidates, sellCandidates]);

  if (!episodes || episodes.length === 0) {
    return (
      <div className="bg-surface-card border border-edge/60 rounded-2xl p-6 text-center shadow-antigravity my-6">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
          🪿
        </div>
        <h3 className="text-base font-bold text-prime mb-1">Golden Goose Signals Pending</h3>
        <p className="text-xs text-dim max-w-md mx-auto">
          Load recent BNN MarketCall episode digests from history to build deterministic shortlists and run LLM Eyes evaluation.
        </p>
      </div>
    );
  }

  const goldenPicks = llmResult?.goldenPicks || [];
  const warningSells = llmResult?.warningSells || [];
  const rejectedTickers = llmResult?._rejectedTickers || [];

  /* Create quick lookup map for candidate details */
  const candidateMap = new Map();
  [...buyHoldCandidates, ...sellCandidates].forEach((c) => candidateMap.set(c.ticker, c));

  return (
    <div className="w-full max-w-4xl mx-auto my-8 space-y-6 font-sans">
      {/* ── Header Bar ── */}
      <div className="bg-gradient-to-r from-amber-950/40 via-surface-card to-surface-card border border-amber-500/30 rounded-2xl p-6 shadow-antigravity relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🪿</span>
              <h2 className="text-lg font-bold text-prime tracking-tight">Golden Goose v2 Radar</h2>
              <span className="px-2.5 py-0.5 text-[10px] font-sans font-semibold uppercase bg-amber-500/15 border border-amber-500/40 text-amber-400 rounded-full">
                LLM Eyes (Claude Sonnet 5)
              </span>
            </div>
            <p className="text-xs text-dim">
              Layer 1 deterministic shortlist ({buyHoldCandidates.length} buy/hold, {sellCandidates.length} sell) → Layer 2 LLM conviction filtering.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-sans">
            <div className="px-3 py-1.5 bg-surface-elevated/80 border border-edge rounded-xl text-dim flex items-center gap-2">
              {loadingLLM && (
                <svg className="w-3.5 h-3.5 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              <span className="text-amber-400 font-bold">+{goldenPicks.length}</span>
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

        {/* Diagnostic Tracker: Rejected Off-List Tickers */}
        {rejectedTickers.length > 0 && (
          <div className="mt-3 bg-rose-950/30 border border-rose-500/30 rounded-xl p-2.5 text-[11px] text-rose-300 flex items-center gap-2">
            <span className="font-bold">⚠️ LLM Hallucination Guard:</span>
            <span>Rejected off-list ticker(s): {rejectedTickers.join(', ')}</span>
          </div>
        )}
      </div>

      {/* ── Golden Picks Section (LLM Eyes Curated) ── */}
      {goldenPicks.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span>🏆 LLM-Eyes Selected Golden Picks</span>
              <span className="text-xs font-normal text-dim uppercase">({goldenPicks.length} Tickers)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goldenPicks.map((pick) => {
              const cand = candidateMap.get(pick.ticker);
              const company = cand?.company || pick.ticker;

              return (
                <div
                  key={pick.ticker}
                  className="bg-surface-card border border-amber-500/40 hover:border-amber-400/80 rounded-2xl p-5 shadow-lg shadow-amber-950/20 transition-all group relative flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header: Ticker & Candidate Stats */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-extrabold font-mono text-prime group-hover:text-amber-400 transition-colors">
                            {pick.ticker}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-sans font-bold bg-amber-400/20 border border-amber-400/50 text-amber-300 rounded-md">
                            SONNET 5 CURATED
                          </span>
                        </div>
                        <p className="text-xs text-dim line-clamp-1">{company}</p>
                      </div>

                      {cand && (
                        <div className="text-right">
                          <div className="text-base font-black font-mono text-amber-400">
                            +{cand.weightedScore} <span className="text-[10px] text-faint font-normal">SCORE</span>
                          </div>
                          <div className="text-[10px] text-dim font-sans">
                            {cand.mentionCount} mention(s) · {cand.distinctGuestCount} guest(s)
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Rationale */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 leading-relaxed mb-4 shadow-sm">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                        <span>✨ Conviction Rationale</span>
                      </div>
                      <p>{pick.rationale}</p>
                    </div>

                    {/* Mention Excerpts */}
                    {cand?.mentions && cand.mentions.length > 0 && (
                      <div className="space-y-1.5 mb-4">
                        <div className="text-[10px] font-semibold text-faint uppercase">Analyst Commentary:</div>
                        {cand.mentions.slice(0, 2).map((m, idx) => (
                          <div key={idx} className="bg-surface-elevated/50 border border-edge/30 rounded-lg p-2 text-[11px] text-dim">
                            <span className="font-semibold text-prime">[{m.mentionType}, {m.stance.toUpperCase()}] {m.guest}:</span> "{m.reasoning}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score Action Button */}
                  <button
                    type="button"
                    onClick={() => onScoreTicker && onScoreTicker(pick.ticker)}
                    className="w-full py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
                  >
                    <span>Score {pick.ticker} with RogueCFA AI</span>
                    <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-surface-card border border-edge rounded-xl p-5 text-center text-xs text-dim">
          {loadingLLM ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Evaluating candidate shortlists with Claude Sonnet 5...</span>
            </div>
          ) : (
            <span>No tickers met the LLM-Eyes conviction criteria in the 7-day window.</span>
          )}
        </div>
      )}

      {/* ── Warning Sells Section (LLM Eyes Curated) ── */}
      {warningSells.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <span>⚠️ LLM-Eyes Warning Sells</span>
            <span className="text-xs font-normal text-dim">({warningSells.length})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warningSells.map((sell) => {
              const cand = candidateMap.get(sell.ticker);

              return (
                <div
                  key={sell.ticker}
                  className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-base font-bold font-mono text-rose-300">{sell.ticker}</span>
                        <p className="text-xs text-dim">{cand?.company || sell.ticker}</p>
                      </div>
                      {cand && (
                        <span className="text-xs font-bold font-mono text-rose-400">{cand.weightedScore} SCORE</span>
                      )}
                    </div>
                    <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5 text-xs text-rose-200/90 mb-3">
                      {sell.rationale}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onScoreTicker && onScoreTicker(sell.ticker)}
                    className="w-full py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg transition-all"
                  >
                    Verify {sell.ticker} Score
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Shortlist Candidates Drawer Toggle ── */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowAllShortlists(!showAllShortlists)}
          className="w-full py-2.5 px-4 bg-surface-card hover:bg-surface-elevated border border-edge text-dim hover:text-prime text-xs font-medium rounded-xl transition-all flex items-center justify-between"
        >
          <span>View Layer 1 Deterministic Shortlist Candidates ({buyHoldCandidates.length + sellCandidates.length})</span>
          <svg
            className={`w-4 h-4 transition-transform ${showAllShortlists ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAllShortlists && (
          <div className="mt-3 bg-surface-card border border-edge rounded-2xl overflow-hidden shadow-inner space-y-4 p-4">
            <div>
              <h4 className="text-xs font-semibold uppercase text-amber-400 mb-2">Buy/Hold Candidates (Min 2 Mentions)</h4>
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-elevated border-b border-edge text-dim uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Ticker</th>
                    <th className="py-2 px-3">Company</th>
                    <th className="py-2 px-3 text-center">Score</th>
                    <th className="py-2 px-3 text-center">Mentions</th>
                    <th className="py-2 px-3 text-center">Analysts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/40">
                  {buyHoldCandidates.map((cand) => (
                    <tr key={cand.ticker} className="hover:bg-surface-elevated/40">
                      <td className="py-2 px-3 font-bold text-prime">{cand.ticker}</td>
                      <td className="py-2 px-3 text-dim truncate max-w-[160px]">{cand.company}</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-400">+{cand.weightedScore}</td>
                      <td className="py-2 px-3 text-center text-dim">{cand.mentionCount}</td>
                      <td className="py-2 px-3 text-center text-dim">{cand.distinctGuestCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sellCandidates.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-rose-400 mb-2">Sell Candidates (Unfiltered)</h4>
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-surface-elevated border-b border-edge text-dim uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Ticker</th>
                      <th className="py-2 px-3">Company</th>
                      <th className="py-2 px-3 text-center">Score</th>
                      <th className="py-2 px-3 text-center">Mentions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge/40">
                    {sellCandidates.map((cand) => (
                      <tr key={cand.ticker} className="hover:bg-surface-elevated/40">
                        <td className="py-2 px-3 font-bold text-rose-300">{cand.ticker}</td>
                        <td className="py-2 px-3 text-dim truncate max-w-[160px]">{cand.company}</td>
                        <td className="py-2 px-3 text-center font-bold text-rose-400">{cand.weightedScore}</td>
                        <td className="py-2 px-3 text-center text-dim">{cand.mentionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
