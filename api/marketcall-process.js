/* ════════════════════════════════════════════════════════════════
   /api/marketcall-process.js
   Heavy processing endpoint: runs the full digest pipeline
   (RSS → MP3 → Groq Whisper → LLM) INLINE, writing results to
   Supabase digest_jobs table.
   
   Called directly by the client as fire-and-forget. The client
   does NOT wait for this response — it polls /api/marketcall-status
   for completion instead. This function runs for up to 300s.
   
   No waitUntil, no background task magic — just inline execution.
   ════════════════════════════════════════════════════════════════ */

import { supabase } from './supabaseClient.js';
import {
  createTimer,
  findRecentMarketCallVideos,
  fetchTranscript,
  fetchRssPodcastFallback,
  cleanRawTranscript,
  buildDigestPrompt,
  callLLM,
  extractJSON,
} from './_pipeline.js';

export const config = { maxDuration: 300 };

/**
 * Generate a deterministic job ID (same logic as digest route).
 */
function generateJobId(episodeDate) {
  const dateStr = episodeDate || new Date().toISOString().split('T')[0];
  const windowKey = Math.floor(Date.now() / 600000);
  const hash = (windowKey * 2654435761 >>> 0).toString(36).slice(0, 4);
  return `mc-${dateStr}-${hash}`;
}

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let youtubeKey, llmKey, provider, groqKey;
  let isDebug = false;

  if (req.method === 'GET') {
    /* ── Cron Invocation ── */
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized cron trigger' });
    }
    youtubeKey = process.env.CRON_YOUTUBE_KEY;
    llmKey = process.env.CRON_LLM_KEY;
    provider = process.env.CRON_LLM_PROVIDER || 'gemini';
    groqKey = process.env.CRON_GROQ_KEY;
  } else {
    /* ── Standard or Debug Client Invocation (POST) ── */
    const body = req.body || {};
    youtubeKey = body.youtubeKey;
    llmKey = body.llmKey;
    provider = body.provider;
    groqKey = body.groqKey;

    if (body.debugSecret && body.debugSecret === process.env.DEBUG_SECRET) {
      isDebug = true;
    }
  }

  if (!llmKey || !provider) {
    return res.status(400).json({ error: 'LLM key and provider are required.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const jobId = isDebug ? `debug-${Date.now()}` : generateJobId(todayStr);

  /* ── Check if this job is already completed (skip if debug) ── */
  if (!isDebug) {
    try {
      const { data: existing } = await supabase
        .from('digest_jobs')
        .select('id, status, result')
        .eq('id', jobId)
        .maybeSingle();

      if (existing?.status === 'complete' && existing.result) {
        return res.status(200).json({
          jobId,
          status: 'complete',
          result: existing.result,
        });
      }
      /* If 'processing' by another invocation, also return early */
      if (existing?.status === 'processing') {
        const age = Date.now() - new Date(existing.created_at || 0).getTime();
        if (age < 4 * 60 * 1000) {
          return res.status(200).json({ jobId, status: 'processing' });
        }
      }
    } catch (dbErr) {
      console.warn('[marketcall-process] Supabase check failed:', dbErr.message);
    }
  }

  /* ── Ensure the job row exists as 'processing' ── */
  try {
    await supabase
      .from('digest_jobs')
      .upsert({
        id: jobId,
        episode_date: todayStr,
        status: 'processing',
        result: null,
        error_message: null,
        is_debug: isDebug,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
  } catch (dbErr) {
    console.warn('[marketcall-process] Failed to write job row:', dbErr.message);
  }

  /* ══════════════════════════════════════════════════════════════
     Run the full pipeline INLINE — no waitUntil needed.
     This function has maxDuration: 300, so the pipeline has
     the full budget. The client doesn't wait for this response;
     it polls /api/marketcall-status independently.
     ══════════════════════════════════════════════════════════════ */
  const timer = createTimer((stage) => {
    supabase.from('digest_jobs').update({ current_stage: stage }).eq('id', jobId)
      .then(({ error }) => {
        if (error) console.warn('[marketcall-process] stage update failed:', error.message);
      });
  });

  try {
    let selectedVideo = null;
    let cleanedTranscript = null;
    let groqDiagnosticMsg = '';

    /* ── Step 1: Find candidate videos ── */
    let candidateVideos = [];
    if (youtubeKey) {
      candidateVideos = await findRecentMarketCallVideos(youtubeKey, timer);
    }

    /* ── Step 2: Priority 1 — Groq Whisper MP3 transcription ── */
    if (groqKey && groqKey.startsWith('gsk_')) {
      timer.start('Groq Whisper pipeline');
      const rssResult = await fetchRssPodcastFallback(groqKey, timer);
      timer.end('Groq Whisper pipeline');

      if (rssResult && rssResult.text && rssResult.text.length >= 200) {
        selectedVideo = candidateVideos[0] || {
          videoId: '',
          videoTitle: 'BNN Bloomberg MarketCall (Official MP3 Audio Feed)',
          episodeDate: todayStr,
        };
        cleanedTranscript = cleanRawTranscript(rssResult.text);
      } else if (rssResult && rssResult.groqDiagnostic) {
        groqDiagnosticMsg = ` [DIAGNOSTIC: Groq Whisper MP3 transcription issue: ${rssResult.groqDiagnostic}]`;
      }
    }

    /* ── Step 3: Priority 2 — YouTube Auto-Captions ── */
    if (!selectedVideo || !cleanedTranscript) {
      if (candidateVideos.length > 0) {
        timer.start('YouTube caption fetch');
        const firstCandidate = candidateVideos[0];
        const firstRaw = await fetchTranscript(firstCandidate.videoId);
        timer.end('YouTube caption fetch');
        if (firstRaw && firstRaw.length >= 100) {
          const cleaned = cleanRawTranscript(firstRaw);
          if (cleaned && cleaned.length >= 200) {
            selectedVideo = firstCandidate;
            cleanedTranscript = cleaned;
          }
        }
      }
    }

    /* ── Step 4: Priority 3 — Try older candidates ── */
    if (!selectedVideo || !cleanedTranscript) {
      if (!groqKey || !groqKey.startsWith('gsk_')) {
        const maxCandidates = Math.min(candidateVideos.length, 3);
        for (let i = 1; i < maxCandidates; i++) {
          /* Fail fast if approaching 300s Vercel limit */
          if (timer.report().totalMs > 240000) {
            groqDiagnosticMsg += ' [DIAGNOSTIC: Fallback loop aborted to prevent Vercel 300s hard timeout.]';
            break;
          }
          const candidate = candidateVideos[i];
          const raw = await fetchTranscript(candidate.videoId);
          if (raw && raw.length >= 100) {
            const cleaned = cleanRawTranscript(raw);
            if (cleaned && cleaned.length >= 200) {
              selectedVideo = candidate;
              cleanedTranscript = cleaned;
              break;
            }
          }
        }
      }
    }

    /* ── Step 5: Final RSS text fallback ── */
    if (!selectedVideo || !cleanedTranscript) {
      if (!groqKey || !groqKey.startsWith('gsk_')) {
        if (timer.report().totalMs <= 240000) {
          const rssFallback = await fetchRssPodcastFallback('', timer);
          if (rssFallback && rssFallback.text && rssFallback.text.length >= 150) {
            selectedVideo = candidateVideos[0] || {
              videoId: '',
              videoTitle: 'BNN Bloomberg MarketCall (Audio/RSS Feed)',
              episodeDate: todayStr,
            };
            cleanedTranscript = cleanRawTranscript(rssFallback.text);
          }
        } else {
          groqDiagnosticMsg += ' [DIAGNOSTIC: Skipped RSS fallback to prevent Vercel 300s hard timeout.]';
        }
      }
    }

    /* ── No transcript available ── */
    if (!selectedVideo || !cleanedTranscript) {
      const newest = candidateVideos[0] || {};
      const missingGroqMsg = !groqKey || !groqKey.startsWith('gsk_')
        ? ' [DIAGNOSTIC: No free Groq API Key (gsk_...) was found in your Settings.]'
        : (groqDiagnosticMsg || ' [DIAGNOSTIC: Groq Whisper audio transcription was attempted but did not yield full text.]');

      const errorMsg = `Found "${newest.videoTitle || 'Market Call'}" (${newest.episodeDate ? 'aired ' + newest.episodeDate : 'recent'}), but full audio/captions are not ready yet.${missingGroqMsg}`;

      await updateJob(jobId, 'error', null, errorMsg, newest.videoId, newest.videoTitle);
      return res.status(200).json({ jobId, status: 'error', error: errorMsg });
    }

    /* ── Step 6: Build prompt & call LLM ── */
    const { systemPrompt, userPrompt } = buildDigestPrompt(cleanedTranscript, selectedVideo.videoTitle);
    const rawLLMResponse = await callLLM(provider, llmKey, systemPrompt, userPrompt, timer);
    const digest = extractJSON(rawLLMResponse);

    if (!digest || !digest.guest) {
      const errMsg = `LLM returned an unparseable digest.${groqDiagnosticMsg}`;
      await updateJob(jobId, 'error', null, errMsg);
      return res.status(200).json({ jobId, status: 'error', error: errMsg });
    }

    /* ── Success ── */
    const result = {
      digest,
      videoId: selectedVideo.videoId,
      videoTitle: selectedVideo.videoTitle,
      episodeDate: selectedVideo.episodeDate || todayStr,
      generatedAt: new Date().toISOString(),
      source: 'server',
      timing: timer.report(),
    };

    await updateJob(jobId, 'complete', result, null, selectedVideo.videoId, selectedVideo.videoTitle);
    console.log('[marketcall-process] Pipeline complete:', JSON.stringify(timer.report()));
    return res.status(200).json({ jobId, status: 'complete', result });

  } catch (error) {
    console.error('[marketcall-process] Pipeline error:', error);
    const errMsg = `Pipeline failed: ${error.message}`;
    await updateJob(jobId, 'error', null, errMsg);
    return res.status(200).json({ jobId, status: 'error', error: errMsg, rawResponse: error.rawText });
  }
}

/* ════════════════════════════════════════════════════════════════
   Supabase job state helpers
   ════════════════════════════════════════════════════════════════ */

async function updateJob(jobId, status, result, errorMessage, videoId, videoTitle) {
  try {
    const update = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (result !== undefined && result !== null) update.result = result;
    if (errorMessage !== undefined && errorMessage !== null) update.error_message = errorMessage;
    if (videoId !== undefined) update.video_id = videoId;
    if (videoTitle !== undefined) update.video_title = videoTitle;

    await supabase
      .from('digest_jobs')
      .update(update)
      .eq('id', jobId);
  } catch (err) {
    console.error('[marketcall-process] Failed to update job:', err.message);
  }
}
