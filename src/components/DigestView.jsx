import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getKeys, getYoutubeKey, getGroqKey, getProvider, getDigestCache, saveDigestCache } from '../lib/storage';
import { getGuestTrackRecord } from '../lib/guestTracker';
import { calculateDigestCost } from '../lib/tokenPricing';
import AnalystBubble from './AnalystBubble';
import DigestPickCard from './DigestPickCard';
import HistoryBrowser from './HistoryBrowser';

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
  const todayStr = new Date().toISOString().split('T')[0];
  const [digest, setDigest] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  /* Async polling state */
  const [activeJobId, setActiveJobId] = useState(null);
  const [pollingElapsed, setPollingElapsed] = useState(0);
  const [lastKnownStage, setLastKnownStage] = useState('Initializing pipeline...');
  const pollingRef = useRef(null);
  const elapsedRef = useRef(null);
  const stageRef = useRef('Initializing pipeline...');

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
      if (cached.episodeDate) setSelectedDate(cached.episodeDate);
      setHasAttempted(true);
    }
  }, [todayStr]);

  const handleRefresh = () => {
    setDigest(null);
    setHasAttempted(false);
    setError(null);
  };

  const fetchDigest = useCallback(async (force = false, targetDate = null) => {
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
      const payload = { youtubeKey, llmKey, provider, groqKey, force, bypassCache: force };
      if (targetDate) {
        payload.episodeDate = targetDate;
      }

      const res = await fetch('/api/marketcall-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

        /* Fire-and-forget: kick off the heavy processing endpoint. */
        fetch('/api/marketcall-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
     Bails out after 270s to prevent infinite spinning.
     ══════════════════════════════════════════ */
  const MAX_POLL_SECONDS = 270;

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
          message: `Background processing timed out after ${MAX_POLL_SECONDS}s while stuck at: "${stageRef.current}". The server may have crashed. Please try again.`,
        });
        stopPolling();
      }
    }, 1000);

    /* Poll for status */
    const poll = async () => {
      try {
        const res = await fetch(`/api/marketcall-status?jobId=${encodeURIComponent(activeJobId)}`);
        const data = await res.json();

        if (data.currentStage) {
          setLastKnownStage(data.currentStage);
          stageRef.current = data.currentStage;
        }

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

  /** Trigger immediate fetch/check for newer episode */
  const handleCheckNewer = useCallback(() => {
    stopPolling();
    setError(null);
    setDigest(null);
    fetchDigest(true);
  }, [fetchDigest]);

  /* Try to get track record for the guest */
  const trackRecord = digest?.guest ? getGuestTrackRecord(digest.guest) : null;

  /* ── Loading state (includes async polling progress) ── */
  if (loading) {
    const isPolling = !!activeJobId;
    const progressMessage = isPolling
      ? lastKnownStage
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
        <div className="bg-surface-card rounded-2xl p-5 shadow-antigravity">
          <div className="h-4 bg-surface-elevated rounded w-48 mb-3" />
          <div className="h-3 bg-surface-elevated rounded w-32 mb-4" />
          <div className="h-12 bg-surface-elevated rounded w-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-card rounded-xl p-4 shadow-antigravity">
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
                  onClick={handleCheckNewer}
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
                  onClick={handleCheckNewer}
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

  /* ── No digest loaded (unsaved date or initial state) — show explicit generation prompt ── */
  if (!digest) {
    const isUnsavedDate = selectedDate && selectedDate !== todayStr;
    return (
      <div className="w-full max-w-3xl mx-auto animate-fade-in font-sans">
        <div className="bg-surface-card rounded-2xl p-8 text-center space-y-5 shadow-antigravity border border-surface-elevated/60">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-accent/15 flex items-center justify-center font-mono font-bold text-lg text-accent">
            <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-prime">
              {isUnsavedDate ? "This digest hasn't been saved yet" : 'BNN Bloomberg MarketCall Digest'}
            </h3>
            <p className="text-xs text-dim max-w-md mx-auto leading-relaxed">
              {isUnsavedDate
                ? `No saved MarketCall episode digest was found for ${selectedDate}. Click below if you would like to generate it.`
                : "Click below to fetch and summarize today's episode audio stream with Groq Whisper & AI."}
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fetchDigest(false, selectedDate || todayStr)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-text text-xs font-semibold rounded-full shadow-antigravity hover:bg-accent-hover transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{isUnsavedDate ? 'Click to Generate Digest' : "Check Newer / Generate Today's Digest"}</span>
            </button>
            {isUnsavedDate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(todayStr);
                  setVideoInfo({
                    videoId: '',
                    videoTitle: `BNN Bloomberg Market Call (${todayStr})`,
                    episodeDate: todayStr,
                  });
                  setDigest(null);
                  fetchDigest(false, todayStr);
                }}
                className="inline-flex items-center gap-2 px-5 py-3 bg-surface-elevated hover:bg-surface-elevated/80 text-prime text-xs font-semibold rounded-full shadow-antigravity transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                <span>Back to Today</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 px-5 py-3 bg-surface-elevated text-dim hover:text-prime text-xs font-semibold rounded-full shadow-antigravity transition-all cursor-pointer"
            >
              Open Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectHistoricalDigest = (historicalItem) => {
    if (historicalItem?.isTodayTrigger) {
      handleCheckNewer();
      return;
    }
    const epDate = historicalItem?.episodeDate || todayStr;
    setSelectedDate(epDate);

    if (historicalItem && historicalItem.digest) {
      setDigest(historicalItem.digest);
      setVideoInfo({
        videoId: historicalItem.videoId,
        videoTitle: historicalItem.videoTitle,
        episodeDate: epDate,
      });
    } else if (epDate) {
      setVideoInfo({
        videoId: '',
        videoTitle: `BNN Bloomberg Market Call (${epDate})`,
        episodeDate: epDate,
      });
      setDigest(null);
      /* Do NOT auto-fetch on unsaved dates; user will confirm via prompt screen */
    }
  };

  const handleRenewDigest = () => {
    const epDate = videoInfo?.episodeDate || selectedDate || todayStr;
    setDigest(null);
    fetchDigest(true, epDate);
  };

/**
 * Helper to split text into real sentences without breaking on common abbreviations
 * like e.g., i.e., U.S., S&P 500, numbers, etc.
 */
function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text.trim();

  // Temporarily mask periods inside known abbreviations & decimal numbers
  const masked = cleaned
    .replace(/\b(e\.g|i\.e|u\.s|vs|inc|ltd|corp|co|mr|mrs|dr|prof)\./gi, '$1___DOT___')
    .replace(/(\d)\.(\d)/g, '$1___DOT___$2');

  // Split on actual sentence endings (. ! ?) followed by whitespace + capital letter or end of text
  const parts = masked.split(/(?<=[.!?])\s+(?=[A-Z0-9"']|$)/);

  return parts
    .map((s) => s.replace(/___DOT___/g, '.').trim())
    .filter(Boolean);
}

/**
 * Helper to render Market Outlook cleanly:
 * 1. Safely extracts a top TL;DR takeaway banner without splitting abbreviations (e.g. / i.e. / U.S.)
 * 2. Formats remaining body into clean, well-spaced paragraphs.
 */
function renderScannableOutlook(outlook) {
  if (!outlook) return null;

  let tldrText = null;
  let bodyText = '';

  if (typeof outlook === 'object' && outlook !== null) {
    tldrText = outlook.takeaway || outlook.tldr || outlook.keyTakeaway || null;
    bodyText = outlook.summary || outlook.details || outlook.body || '';
  } else if (typeof outlook === 'string') {
    const trimmed = outlook.trim();
    // Check for explicit "TL;DR:" or "Key Takeaway:" prefix
    const tldrMatch = trimmed.match(/^(?:TL;?DR|KEY TAKEAWAY):\s*([^\n]+)(?:\n+([\s\S]+))?$/i);
    if (tldrMatch) {
      tldrText = tldrMatch[1].trim();
      bodyText = (tldrMatch[2] || '').trim();
    } else {
      const sentences = splitIntoSentences(trimmed);
      if (sentences.length > 1) {
        tldrText = sentences[0];
        bodyText = sentences.slice(1).join(' ');
      } else {
        bodyText = trimmed;
      }
    }
  }

  // Create clean paragraph blocks for the body
  let paragraphs = bodyText ? bodyText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean) : [];
  if (paragraphs.length <= 1 && bodyText) {
    const bodySentences = splitIntoSentences(bodyText);
    if (bodySentences.length > 2) {
      const midPoint = Math.ceil(bodySentences.length / 2);
      paragraphs = [
        bodySentences.slice(0, midPoint).join(' '),
        bodySentences.slice(midPoint).join(' '),
      ];
    } else if (bodySentences.length > 0) {
      paragraphs = [bodySentences.join(' ')];
    }
  }

  return (
    <div className="space-y-4 font-sans">
      {/* TL;DR Key Takeaway Box */}
      {tldrText && (
        <div className="bg-surface-elevated/70 border-l-4 border-accent p-4 rounded-r-2xl shadow-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/15 px-2.5 py-0.5 rounded-full">
              TL;DR Key Takeaway
            </span>
          </div>
          <p className="text-sm sm:text-base font-medium text-prime leading-relaxed">
            {tldrText}
          </p>
        </div>
      )}

      {/* Main body text split cleanly into paragraphs */}
      {paragraphs.length > 0 && (
        <div className="space-y-3 text-sm sm:text-base text-dim leading-relaxed font-normal">
          {paragraphs.map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}
        </div>
      )}
    </div>
  );
}

  /* ── Digest loaded ── */
  const activeProviderKey = getProvider();
  const realUsage = digest?.usage || null;
  const costInfo = calculateDigestCost(
    activeProviderKey,
    realUsage?.input_tokens || digest?.inputTokens || 4850,
    realUsage?.output_tokens || digest?.outputTokens || 420
  );
  const isEstimated = !realUsage;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-2 sm:px-4 animate-fade-in font-sans">
      {/* Top Header Control Bar — Clean layout with merged BNN Source & Action button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-elevated/40">
        <div className="space-y-2">
          {/* Title */}
          <h1 className="text-2xl font-bold tracking-tight text-prime">
            MarketCall Digest
          </h1>

          {/* Subtitle Control Row — Perfectly aligned Date Selector + Merged BNN Source & Check Newer Button */}
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <HistoryBrowser
              selectedDate={videoInfo?.episodeDate}
              onSelectDigest={handleSelectHistoricalDigest}
            />

            {/* Merged BNN Bloomberg Source & Check Newer Action Button */}
            <button
              type="button"
              onClick={handleCheckNewer}
              className="h-8 px-3.5 inline-flex items-center gap-2 bg-surface-card hover:bg-surface-elevated rounded-full text-xs font-medium text-prime shadow-antigravity transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shrink-0"
              title="Check YouTube & Supabase for a newer BNN Bloomberg MarketCall episode"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-dim font-medium">
                {videoInfo?.source === 'bnn_web_player' ? 'BNN Web Media' : videoInfo?.source === 'bnn_rss_podcast' ? 'BNN RSS Audio' : 'BNN Bloomberg'}
              </span>
              <span className="w-px h-3.5 bg-surface-elevated shrink-0" />
              <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-semibold text-prime">Check Newer</span>
            </button>

            {/* Renew / Re-generate Digest Button */}
            <button
              type="button"
              onClick={handleRenewDigest}
              className="h-8 px-3.5 inline-flex items-center gap-2 bg-surface-card hover:bg-surface-elevated rounded-full text-xs font-medium text-prime shadow-antigravity transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shrink-0 group"
              title="Clean up malformed jobs for this date and re-generate a fresh digest"
            >
              <svg className="w-3.5 h-3.5 text-dim group-hover:text-prime shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-semibold text-prime">Renew Digest</span>
            </button>
          </div>
        </div>

        {/* Video Preview Column — Soft floating shadow, no red play button */}
        {videoInfo?.videoId && (
          <div className="flex items-center gap-3.5 bg-surface-card p-3 rounded-2xl shadow-antigravity shrink-0">
            <a
              href={`https://www.youtube.com/watch?v=${videoInfo.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-36 h-20 rounded-xl overflow-hidden shadow-md shadow-black/30 border-0 relative group block shrink-0 transition-all duration-300"
              title={videoInfo?.videoTitle || 'Watch Full Episode'}
            >
              <img
                src={`https://img.youtube.com/vi/${videoInfo.videoId}/mqdefault.jpg`}
                alt="Episode thumbnail"
                className="w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
            </a>
            <div className="flex flex-col gap-1 pr-1 max-w-[170px]">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-dim">Full Broadcast</span>
              <a
                href={`https://www.youtube.com/watch?v=${videoInfo.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-prime hover:text-white transition-colors flex items-center gap-1 leading-snug line-clamp-2"
              >
                Watch Episode ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Outlook — Expanded font size & scannable layout */}
          {digest.marketOutlook && (
            <div className="bg-surface-card rounded-2xl p-6 sm:p-7 shadow-antigravity space-y-4 border border-surface-elevated/40">
              <h3 className="text-xs font-semibold text-dim uppercase tracking-wider flex items-center gap-2">
                <span>Market Outlook</span>
              </h3>
              {renderScannableOutlook(digest.marketOutlook)}
            </div>
          )}

          {/* Top Picks */}
          {Array.isArray(digest.picks) && digest.picks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Top Picks</span>
                <span className="text-[11px] font-normal text-dim">
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
              <h3 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Caller Mentions (Q&amp;A)</span>
                <span className="text-[11px] font-normal text-dim">
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
            <div className="bg-surface-card rounded-2xl p-6 sm:p-7 shadow-antigravity space-y-3 border border-surface-elevated/40">
              <h3 className="text-xs font-semibold text-dim uppercase tracking-wider">
                Closing Notes
              </h3>
              <p className="text-sm sm:text-base text-dim leading-relaxed italic font-normal">
                {digest.closingNotes}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Column (1/3 width) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Analyst Bubble */}
          <AnalystBubble
            guestName={digest.guest}
            firm={digest.firm}
            episodeFocus={digest.episodeFocus}
            date={videoInfo?.episodeDate || todayStr}
            trackRecord={trackRecord}
            onSelectGuest={onSelectGuest}
          />

          {/* Episode Info & Actionable Digest Stats Card — Soft elevation shadow, clean sans-serif typography */}
          <div className="bg-surface-card rounded-2xl p-6 shadow-antigravity space-y-4 font-sans">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wider">
              Digest Overview
            </h3>

            <div className="space-y-3">
              <div className="bg-surface-elevated p-3.5 sm:p-4 rounded-xl shadow-inner flex items-center justify-between">
                <span className="text-xs sm:text-sm text-dim font-medium">Coverage Density</span>
                <span className="text-xs sm:text-sm font-semibold text-prime">
                  {(digest.picks?.length || 0)} Picks • {(digest.callerMentions || digest.caller_mentions || []).length} Q&amp;A
                </span>
              </div>

              <div className="bg-surface-elevated p-3.5 sm:p-4 rounded-xl shadow-inner flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-dim font-medium">Generation Cost</span>
                  <span className="text-[11px] text-dim/70 font-normal">
                    {costInfo.providerName}{isEstimated ? ' (est.)' : ''}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-prime">{costInfo.formattedCost}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
