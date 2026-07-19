import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getKeys, getYoutubeKey, getGroqKey, getProvider, getDigestCache, saveDigestCache } from '../lib/storage';
import { getGuestTrackRecord } from '../lib/guestTracker';
import AnalystBubble from './AnalystBubble';
import DigestPickCard from './DigestPickCard';

/**
 * DigestView — Main "Today's Picks" tab content.
 * Fetches & displays the daily MarketCall digest.
 *
 * @param {Object} props
 * @param {Function} props.onScoreTicker - (ticker, guestName) => void — switches to score tab
 * @param {Function} props.onSelectGuest - (guestName) => void — opens GuestModal
 * @param {Function} props.onOpenSettings - () => void — opens settings panel
 */
export default function DigestView({ onScoreTicker, onSelectGuest, onOpenSettings }) {
  const [digest, setDigest] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  /* Async polling state */
  const [activeJobId, setActiveJobId] = useState(null);
  const [pollingElapsed, setPollingElapsed] = useState(0);
  const pollingRef = useRef(null);
  const elapsedRef = useRef(null);

  const todayStr = new Date().toISOString().split('T')[0];

  /* Check cache on mount */
  useEffect(() => {
    const cached = getDigestCache('latest_marketcall') || getDigestCache(todayStr);
    if (cached && cached.digest) {
      setDigest(cached.digest);
      setVideoInfo({
        videoId: cached.videoId,
        videoTitle: cached.videoTitle,
        episodeDate: cached.episodeDate || todayStr,
      });
      setHasAttempted(true);
    }
  }, [todayStr]);

  const handleRefresh = () => {
    setDigest(null);
    setHasAttempted(false);
    setError(null);
  };

  const fetchDigest = useCallback(async () => {
    const youtubeKey = getYoutubeKey();
    const groqKey = getGroqKey();
    const { llmKey } = getKeys();
    const provider = getProvider();

    if (!youtubeKey) {
      setError({
        type: 'no_key',
        message: 'YouTube API key is required for the MarketCall Digest.',
      });
      setHasAttempted(true);
      return;
    }

    if (!llmKey) {
      setError({
        type: 'no_key',
        message: 'LLM API key is required. Set it up in Settings.',
      });
      setHasAttempted(true);
      return;
    }

    setLoading(true);
    setError(null);

    let isPollingTrans = false;

    try {
      const res = await fetch('/api/marketcall-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeKey, llmKey, provider, groqKey }),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        if (res.status === 504 || res.status === 500) {
          throw new Error(`Server timeout (${res.status}). Please try again.`);
        }
        throw new Error(`API returned non-JSON response (${res.status}): ${parseErr.message}`);
      }

      /* ── Async flow: API returned a job ID — kick off the processor ── */
      if (data.status === 'processing' && data.jobId) {
        setActiveJobId(data.jobId);
        setPollingElapsed(0);
        isPollingTrans = true;

        /* Fire-and-forget: kick off the heavy processing endpoint.
           We don't await this — the client polls /api/marketcall-status
           independently. The process function runs inline for up to 300s
           on the server, updating Supabase when done. */
        fetch('/api/marketcall-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeKey, llmKey, provider, groqKey }),
        }).catch(() => {
          /* Ignore — if this fails, the polling will detect 'not_found' or timeout */
        });

        /* Loading stays true, polling useEffect takes over */
        return;
      }

      if (data.error === 'no_episode') {
        setError({
          type: 'no_episode',
          message: data.message || 'No MarketCall episode found for today.',
        });
      } else if (data.error === 'no_transcript') {
        setError({
          type: 'no_transcript',
          message: data.message || 'Transcript not available yet.',
        });
        if (data.videoId) {
          setVideoInfo({ videoId: data.videoId, videoTitle: data.videoTitle });
        }
      } else if (data.error) {
        setError({
          type: 'api_error',
          message: data.error,
        });
      } else if (data.digest) {
        handleDigestReceived(data);
      }
    } catch (err) {
      setError({
        type: 'api_error',
        message: `Failed to fetch digest: ${err.message}`,
      });
    } finally {
      if (!isPollingTrans) {
        setLoading(false);
        setHasAttempted(true);
      }
    }
  }, [todayStr]);

  /** Shared handler for when a digest is received (from direct response or polling) */
  const handleDigestReceived = useCallback((data) => {
    const digestData = data.digest || data;
    setDigest(digestData);
    const epDate = data.episodeDate || todayStr;
    setVideoInfo({
      videoId: data.videoId,
      videoTitle: data.videoTitle,
      episodeDate: epDate,
    });
    const cacheData = {
      digest: digestData,
      videoId: data.videoId,
      videoTitle: data.videoTitle,
      episodeDate: epDate,
      generatedAt: data.generatedAt,
    };
    saveDigestCache('latest_marketcall', cacheData);
    saveDigestCache(epDate, cacheData);
  }, [todayStr]);

  /* ══════════════════════════════════════════
     Polling effect: when activeJobId is set,
     poll /api/marketcall-status every 5 seconds.
     Bails out after 180s to prevent infinite spinning.
     ══════════════════════════════════════════ */
  const MAX_POLL_SECONDS = 180;

  useEffect(() => {
    if (!activeJobId) return;

    /* Start elapsed counter */
    const startTime = Date.now();
    elapsedRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      setPollingElapsed(elapsed);

      /* Bail out if we've been waiting too long */
      if (elapsed > MAX_POLL_SECONDS) {
        setError({
          type: 'api_error',
          message: `Background processing timed out after ${MAX_POLL_SECONDS}s. The server may have crashed. Please try again.`,
        });
        stopPolling();
      }
    }, 1000);

    /* Poll for status */
    const poll = async () => {
      try {
        const res = await fetch(`/api/marketcall-status?jobId=${encodeURIComponent(activeJobId)}`);
        const data = await res.json();

        if (data.status === 'complete' && data.result) {
          /* Success — render the digest */
          handleDigestReceived(data.result);
          stopPolling();
          return;
        }

        if (data.status === 'error') {
          setError({
            type: data.error?.includes('no_transcript') ? 'no_transcript' : 'api_error',
            message: data.error || 'Processing failed. Please try again.',
          });
          stopPolling();
          return;
        }

        if (data.status === 'not_found') {
          setError({
            type: 'api_error',
            message: 'Job not found — the server may not have started processing. Please try again.',
          });
          stopPolling();
          return;
        }
      } catch (err) {
        console.warn('Status poll failed:', err.message);
        /* Don't stop polling on network glitch — it'll retry */
      }
    };

    /* Initial poll after a short delay, then every 5s */
    const initialTimeout = setTimeout(poll, 3000);
    pollingRef.current = setInterval(poll, 5000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(pollingRef.current);
      clearInterval(elapsedRef.current);
    };
  }, [activeJobId, handleDigestReceived]);

  const stopPolling = () => {
    setActiveJobId(null);
    setLoading(false);
    setHasAttempted(true);
    setPollingElapsed(0);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
  };

  /* Auto-fetch disabled per user request: only connect when user explicitly clicks Check Newer / Generate */
  useEffect(() => {
    /* Manual trigger only via buttons */
  }, [digest, hasAttempted, loading, fetchDigest]);

  /** Cancel polling on unmount or refresh */
  const handleRefreshFull = () => {
    stopPolling();
    handleRefresh();
  };

  /* Try to get track record for the guest */
  const trackRecord = digest?.guest ? getGuestTrackRecord(digest.guest) : null;

  /* ── Loading state (includes async polling progress) ── */
  if (loading) {
    const isPolling = !!activeJobId;
    const progressMessage = isPolling
      ? pollingElapsed < 10
        ? 'Downloading podcast audio stream…'
        : pollingElapsed < 30
        ? 'Transcribing audio with Groq Whisper AI…'
        : pollingElapsed < 60
        ? 'Synthesizing caller Q&A digest…'
        : 'Almost there — finalizing digest…'
      : 'Generating latest MarketCall digest…';

    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 text-sm text-dim">
            <svg className="animate-spin w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="font-mono text-xs">{progressMessage}</span>
          </div>
          {isPolling ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] text-faint font-mono">
                Elapsed: {pollingElapsed}s — audio transcription typically takes 30–60 seconds
              </p>
              {/* Progress bar */}
              <div className="max-w-xs mx-auto h-1 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-accent-muted rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(95, (pollingElapsed / 70) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-faint mt-1">
              Fetching transcript &amp; summarizing with AI — this takes 10-15 seconds
            </p>
          )}
        </div>

        {/* Skeleton cards */}
        <div className="bg-surface-card border border-edge rounded-2xl p-5">
          <div className="h-4 bg-surface-elevated rounded w-48 mb-3" />
          <div className="h-3 bg-surface-elevated rounded w-32 mb-4" />
          <div className="h-12 bg-surface-elevated rounded w-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-card border border-edge rounded-xl p-4">
              <div className="flex gap-3">
                <div className="h-8 w-16 bg-surface-elevated rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface-elevated rounded w-40" />
                  <div className="h-3 bg-surface-elevated rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* Helper to format diagnostic error notes */
  const renderDiagnostic = (message) => {
    if (!message) return null;
    const diagMatch = message.match(/\[DIAGNOSTIC:\s*([\s\S]*?)\]/i);
    if (!diagMatch) {
      return <p className="text-sm text-dim leading-relaxed mb-4 max-w-md mx-auto">{message}</p>;
    }
    const cleanMsg = message.replace(/\[DIAGNOSTIC:\s*[\s\S]*?\]/i, '').trim();
    const diagText = diagMatch[1].trim();

    return (
      <div className="space-y-3 mb-5 max-w-lg mx-auto text-left">
        {cleanMsg && <p className="text-sm text-dim leading-relaxed text-center">{cleanMsg}</p>}
        <div className="bg-surface-elevated border border-accent/40 rounded-xl p-4 shadow-inner">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-accent mb-1.5">
            <span>DIAGNOSTIC TRACE &amp; REMEDIATION</span>
          </div>
          <p className="font-mono text-xs text-prime leading-relaxed">{diagText}</p>
        </div>
      </div>
    );
  };

  /* ── Error / empty states ── */
  if (error && !digest) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-surface-card border border-edge rounded-2xl p-8 text-center">
          {error.type === 'no_key' ? (
            <>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-signal-watch/10 border border-signal-watch/30
                              flex items-center justify-center font-mono font-bold text-lg text-signal-watch">
                KEY
              </div>
              <h3 className="text-lg font-bold text-prime mb-2">YouTube API Key Required</h3>
              {renderDiagnostic(error.message)}
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5
                           bg-gradient-to-r from-accent to-accent-muted
                           text-white text-sm font-semibold rounded-lg
                           hover:from-accent-hover hover:to-accent
                           transition-all shadow-md shadow-accent/20"
              >
                Open Settings
              </button>
              <p className="text-xs text-faint mt-3">
                Get a free key at{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  Google Cloud Console →
                </a>
              </p>
            </>
          ) : error.type === 'no_episode' ? (
            <>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-surface-elevated border border-edge
                              flex items-center justify-center font-mono font-bold text-lg text-faint">
                BNN
              </div>
              <h3 className="text-lg font-bold text-prime mb-2">No Recent Episode Found</h3>
              {renderDiagnostic(error.message)}
            </>
          ) : error.type === 'no_transcript' ? (
            <>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-signal-watch/10 border border-signal-watch/30
                              flex items-center justify-center font-mono font-bold text-lg text-signal-watch">
                ...
              </div>
              <h3 className="text-lg font-bold text-prime mb-2">Transcript Not Ready</h3>
              {renderDiagnostic(error.message)}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasAttempted(false);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5
                             bg-surface-elevated border border-edge
                             text-prime text-sm font-semibold rounded-lg
                             hover:border-accent/50 hover:text-accent
                             transition-all"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-2 px-5 py-2.5
                             bg-accent/10 border border-accent/30
                             text-accent text-sm font-semibold rounded-lg
                             hover:bg-accent/20 transition-all"
                >
                  Open Settings {getGroqKey() ? '' : '(Add Groq Key)'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-danger/10 border border-danger/30
                              flex items-center justify-center font-mono font-bold text-lg text-danger">
                !
              </div>
              <h3 className="text-lg font-bold text-prime mb-2">Diagnostic Trace — API Error</h3>
              {renderDiagnostic(error.message)}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasAttempted(false);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5
                             bg-surface-elevated border border-edge
                             text-prime text-sm font-semibold rounded-lg
                             hover:border-accent/50 hover:text-accent
                             transition-all"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-2 px-5 py-2.5
                             bg-accent/10 border border-accent/30
                             text-accent text-sm font-semibold rounded-lg
                             hover:bg-accent/20 transition-all"
                >
                  Open Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── No digest loaded (e.g., auto-fetch disabled or cleared cache) — show prominent Check Newer button ── */
  if (!digest) {
    return (
      <div className="w-full max-w-3xl mx-auto animate-fade-in">
        <div className="bg-surface-card border border-edge rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center font-mono font-bold text-xl text-accent">
            AI
          </div>
          <div>
            <h3 className="text-xl font-bold text-prime">BNN Bloomberg MarketCall Digest</h3>
            <p className="text-xs text-dim max-w-md mx-auto mt-1 leading-relaxed">
              Click below to fetch and summarize today's episode audio stream with Groq Whisper &amp; AI.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={fetchDigest}
              className="inline-flex items-center gap-2 px-6 py-3
                         bg-accent text-on-accent text-sm font-semibold rounded-xl
                         shadow-lg shadow-accent/20 hover:bg-accent-hover hover:scale-[1.02]
                         active:scale-[0.98] transition-all"
            >
              Check Newer / Generate Today's Digest
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 px-5 py-3
                         bg-surface-elevated border border-edge
                         text-prime text-sm font-semibold rounded-xl
                         hover:border-accent/50 hover:text-accent transition-all"
            >
              Open Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Digest loaded ── */
  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-prime font-mono">
            Latest MarketCall Digest
          </h2>
          <span className="text-[10px] text-faint font-mono bg-surface-elevated px-1.5 py-0.5 rounded border border-edge">
            {videoInfo?.episodeDate || todayStr}
          </span>
          <button
            type="button"
            onClick={handleRefreshFull}
            className="text-[10px] text-accent hover:text-accent-hover font-mono px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 transition-colors flex items-center gap-1"
            title="Check YouTube for a newer episode"
          >
            Check Newer
          </button>
        </div>
        {videoInfo?.videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${videoInfo.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-dim hover:text-accent transition-colors font-mono flex items-center gap-1"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
              <path fill="rgb(var(--c-surface))" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            Watch Full Episode
          </a>
        )}
      </div>

      {/* Analyst Bubble */}
      <AnalystBubble
        guestName={digest.guest}
        firm={digest.firm}
        episodeFocus={digest.episodeFocus}
        date={videoInfo?.episodeDate || todayStr}
        trackRecord={trackRecord}
        onSelectGuest={onSelectGuest}
      />

      {/* Market Outlook */}
      {digest.marketOutlook && (
        <div className="bg-surface-card border border-edge rounded-xl p-5">
          <h3 className="text-xs font-bold font-mono text-faint uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Market Outlook
          </h3>
          <p className="text-sm text-prime/90 leading-relaxed">
            {digest.marketOutlook}
          </p>
        </div>
      )}

      {/* Picks */}
      {Array.isArray(digest.picks) && digest.picks.length > 0 && (
        <div>
          <h3 className="text-xs font-bold font-mono text-faint uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-buy" />
              Top Picks
            </span>
            <span className="text-[10px] font-normal text-dim">
              {digest.picks.length} pick{digest.picks.length !== 1 ? 's' : ''} • Click to expand
            </span>
          </h3>
          <div className="space-y-3">
            {digest.picks.map((pick, idx) => (
              <DigestPickCard
                key={`${pick.ticker}-${idx}`}
                ticker={pick.ticker}
                company={pick.company}
                reasoning={pick.reasoning}
                guestName={digest.guest}
                onScoreTicker={onScoreTicker}
                index={idx}
              />
            ))}
          </div>
        </div>
      )}

      {/* Caller Mentions (Q&A) */}
      {(Array.isArray(digest.callerMentions) && digest.callerMentions.length > 0 ? digest.callerMentions : Array.isArray(digest.caller_mentions) && digest.caller_mentions.length > 0 ? digest.caller_mentions : null) && (
        <div>
          <h3 className="text-xs font-bold font-mono text-faint uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Caller Mentions (Q&amp;A)
            </span>
            <span className="text-[10px] font-normal text-dim">
              {(digest.callerMentions || digest.caller_mentions).length} mention{(digest.callerMentions || digest.caller_mentions).length !== 1 ? 's' : ''} • Click to expand
            </span>
          </h3>
          <div className="space-y-3">
            {(digest.callerMentions || digest.caller_mentions).map((pick, idx) => (
              <DigestPickCard
                key={`caller-${pick.ticker}-${idx}`}
                ticker={pick.ticker}
                company={pick.company}
                reasoning={pick.reasoning}
                guestName={digest.guest}
                onScoreTicker={onScoreTicker}
                index={idx}
                isCallerMention={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closing Notes */}
      {digest.closingNotes && (
        <div className="bg-surface-card/60 border border-edge rounded-xl p-5">
          <h3 className="text-xs font-bold font-mono text-faint uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-watch" />
            Closing Notes
          </h3>
          <p className="text-sm text-dim leading-relaxed italic">
            {digest.closingNotes}
          </p>
        </div>
      )}

      {/* Footer — cost / time saved callout */}
      <div className="text-center pt-2 pb-4">
        <p className="text-[10px] text-faint font-mono">
          2-minute read replacing 45-minute broadcast • ~$0.04 per digest
        </p>
      </div>
    </div>
  );
}
