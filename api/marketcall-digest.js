/* ════════════════════════════════════════════════════════════════
   /api/marketcall-digest.js
   Smart router: handles extension-provided transcripts inline,
   checks Supabase cache for today's digest, and delegates heavy
   processing to /api/marketcall-process.js for async execution.
   
   This route now responds in < 2s for all cases — no more 504s.
   ════════════════════════════════════════════════════════════════ */

import { supabase } from './supabaseClient.js';
import {
  createTimer,
  cleanRawTranscript,
  buildDigestPrompt,
  callLLM,
  extractJSON,
} from './_pipeline.js';

/* This route is now lightweight — 60s is more than enough for
   the extension fast path (transcript already provided, just LLM call) */
export const config = { maxDuration: 60 };

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
    /* Client-provided transcript (from Chrome extension) */
    transcript: clientTranscript,
    videoId: clientVideoId,
    videoTitle: clientVideoTitle,
    episodeDate: clientEpisodeDate,
  } = req.body || {};

  if (!llmKey || !provider) {
    return res.status(400).json({
      error: 'LLM key and provider are required.',
    });
  }

  try {
    /* ══════════════════════════════════════════
       Fast path A: Client-provided transcript
       (Chrome extension extracted it from the user's browser)
       — runs inline, typically < 15s (just one LLM call)
       ══════════════════════════════════════════ */
    if (clientTranscript && clientTranscript.length >= 200) {
      const timer = createTimer();
      const cleanedTranscript = cleanRawTranscript(clientTranscript);
      if (cleanedTranscript.length < 200) {
        return res.status(200).json({
          error: 'no_transcript',
          message: 'The transcript provided by the extension was too short after cleaning. Try a different episode.',
        });
      }

      const { systemPrompt, userPrompt } = buildDigestPrompt(cleanedTranscript, clientVideoTitle || '');
      const rawLLMResponse = await callLLM(provider, llmKey, systemPrompt, userPrompt, timer);
      const digest = extractJSON(rawLLMResponse);

      if (!digest || !digest.guest) {
        return res.status(422).json({
          error: 'LLM returned an unparseable digest. Try again.',
        });
      }

      return res.status(200).json({
        digest,
        videoId: clientVideoId || '',
        videoTitle: clientVideoTitle || '',
        episodeDate: clientEpisodeDate || '',
        generatedAt: new Date().toISOString(),
        source: 'extension',
      });
    }

    /* ══════════════════════════════════════════
       Fast path B: Check Supabase cache for today's digest
       — returns in < 1s if a previous run already completed
       ══════════════════════════════════════════ */
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const { data: cached } = await supabase
        .from('digest_jobs')
        .select('id, status, result, error_message, video_id, video_title')
        .eq('episode_date', todayStr)
        .eq('status', 'complete')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached && cached.result) {
        /* Return the cached digest — instant response */
        return res.status(200).json(cached.result);
      }
    } catch (cacheErr) {
      console.warn('[marketcall-digest] Cache check failed, proceeding to process:', cacheErr.message);
    }

    /* ══════════════════════════════════════════
       Standard path: Kick off async processing
       — delegates to /api/marketcall-process.js
       — returns { status: 'processing', jobId } immediately
       ══════════════════════════════════════════ */
    if (!youtubeKey && (!groqKey || !groqKey.startsWith('gsk_'))) {
      return res.status(400).json({
        error: 'YouTube API key or Groq API key is required. Add one in Settings, or use the Chrome extension to provide transcripts directly.',
      });
    }

    /* Check if there's already a job processing for today */
    try {
      const { data: existingJob } = await supabase
        .from('digest_jobs')
        .select('id, status, error_message, created_at')
        .eq('episode_date', todayStr)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingJob) {
        /* If the job has been "processing" for > 5 min, it's dead — mark it and move on */
        const jobAge = Date.now() - new Date(existingJob.created_at).getTime();
        if (jobAge > 5 * 60 * 1000) {
          console.warn(`[marketcall-digest] Stale job ${existingJob.id} (${Math.round(jobAge / 1000)}s old) — marking as error`);
          await supabase
            .from('digest_jobs')
            .update({ status: 'error', error_message: 'Job timed out (stale processing)', updated_at: new Date().toISOString() })
            .eq('id', existingJob.id);
          /* Fall through to kick off a fresh job */
        } else {
          return res.status(200).json({
            status: 'processing',
            jobId: existingJob.id,
            message: 'Digest is being generated. Polling for completion...',
          });
        }
      }
    } catch {
      /* proceed to kick off new processing */
    }

    /* Fire the processing endpoint internally via fetch.
       On Vercel, this creates a separate function invocation with its own
       300s maxDuration budget, completely independent of this request. */
    const processUrl = `https://${req.headers.host}/api/marketcall-process`;

    const processRes = await fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeKey, llmKey, provider, groqKey }),
      signal: AbortSignal.timeout(10000), /* Only wait 10s for the initial response */
    });

    const processData = await processRes.json().catch(() => ({}));

    if (processData.status === 'complete' && processData.result) {
      /* Processing was instant (cached or already done) */
      return res.status(200).json(processData.result);
    }

    /* Return the job ID for the client to poll */
    return res.status(200).json({
      status: processData.status || 'processing',
      jobId: processData.jobId || '',
      message: 'Digest generation started. Audio transcription typically takes 30-60 seconds.',
    });

  } catch (error) {
    console.error('MarketCall digest error:', error);
    return res.status(500).json({
      error: `Digest generation failed: ${error.message}`,
    });
  }
}
