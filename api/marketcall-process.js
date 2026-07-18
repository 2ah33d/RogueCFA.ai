/* ════════════════════════════════════════════════════════════════
   /api/marketcall-process.js
   Heavy processing endpoint: kicks off the full digest pipeline
   (RSS → MP3 → Groq Whisper → LLM) as a background task via
   waitUntil, writing results to Supabase digest_jobs table.
   
   The client gets an immediate { jobId, status: 'processing' }
   response and polls /api/marketcall-status for completion.
   ════════════════════════════════════════════════════════════════ */

import { waitUntil } from '@vercel/functions';
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
 * Generate a deterministic job ID for today's episode.
 * Format: mc-YYYY-MM-DD-<4-char hash>
 * The hash incorporates a timestamp window so retries within the same
 * 10-minute window reuse the same job ID (dedup), but a retry 10+ min
 * later gets a fresh job.
 */
function generateJobId(episodeDate) {
  const dateStr = episodeDate || new Date().toISOString().split('T')[0];
  const windowKey = Math.floor(Date.now() / 600000); // 10-minute windows
  const hash = (windowKey * 2654435761 >>> 0).toString(36).slice(0, 4);
  return `mc-${dateStr}-${hash}`;
}

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    youtubeKey, llmKey, provider, groqKey,
  } = req.body || {};

  if (!llmKey || !provider) {
    return res.status(400).json({ error: 'LLM key and provider are required.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const jobId = generateJobId(todayStr);

  /* ── Check if this job is already running or completed ── */
  try {
    const { data: existing } = await supabase
      .from('digest_jobs')
      .select('id, status, result, error_message')
      .eq('id', jobId)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'complete' && existing.result) {
        return res.status(200).json({
          jobId,
          status: 'complete',
          result: existing.result,
        });
      }
      if (existing.status === 'processing') {
        return res.status(200).json({ jobId, status: 'processing' });
      }
      /* If status is 'error', allow re-processing by falling through */
    }
  } catch (dbErr) {
    console.warn('[marketcall-process] Supabase check failed, proceeding anyway:', dbErr.message);
  }

  /* ── Create/upsert the job row as 'processing' ── */
  try {
    await supabase
      .from('digest_jobs')
      .upsert({
        id: jobId,
        episode_date: todayStr,
        status: 'processing',
        result: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
  } catch (dbErr) {
    console.warn('[marketcall-process] Failed to write job row:', dbErr.message);
  }

  /* ── Return immediately, then process in the background via waitUntil ── */
  const processingPromise = runPipeline({ youtubeKey, llmKey, provider, groqKey, jobId, todayStr });

  /* Vercel waitUntil: keeps the function alive after res.end() for up to maxDuration */
  try {
    waitUntil(processingPromise);
  } catch (err) {
    console.warn('[marketcall-process] waitUntil failed, running inline fallback', err);
    await processingPromise;
  }

  return res.status(202).json({ jobId, status: 'processing' });
}

/* ════════════════════════════════════════════════════════════════
   Full pipeline execution — runs in background via waitUntil
   ════════════════════════════════════════════════════════════════ */

async function runPipeline({ youtubeKey, llmKey, provider, groqKey, jobId, todayStr }) {
  const timer = createTimer();

  try {
    let selectedVideo = null;
    let cleanedTranscript = null;
    let groqDiagnosticMsg = '';

    /* ── Step 1: Find candidate videos (only if youtubeKey provided) ── */
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
        for (let i = 1; i < candidateVideos.length; i++) {
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
        const rssFallback = await fetchRssPodcastFallback('', timer);
        if (rssFallback && rssFallback.text && rssFallback.text.length >= 150) {
          selectedVideo = candidateVideos[0] || {
            videoId: '',
            videoTitle: 'BNN Bloomberg MarketCall (Audio/RSS Feed)',
            episodeDate: todayStr,
          };
          cleanedTranscript = cleanRawTranscript(rssFallback.text);
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
      return;
    }

    /* ── Step 6: Build prompt & call LLM ── */
    const { systemPrompt, userPrompt } = buildDigestPrompt(cleanedTranscript, selectedVideo.videoTitle);
    const rawLLMResponse = await callLLM(provider, llmKey, systemPrompt, userPrompt, timer);
    const digest = extractJSON(rawLLMResponse);

    if (!digest || !digest.guest) {
      await updateJob(jobId, 'error', null, `LLM returned an unparseable digest.${groqDiagnosticMsg}`);
      return;
    }

    /* ── Success — write result ── */
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

  } catch (error) {
    console.error('[marketcall-process] Pipeline error:', error);
    await updateJob(jobId, 'error', null, `Pipeline failed: ${error.message}`);
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
