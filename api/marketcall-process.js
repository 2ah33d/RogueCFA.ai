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

import { supabase } from './_supabaseClient.js';
import {
  createTimer,
  findRecentMarketCallVideos,
  fetchTranscript,
  fetchRssPodcastFallback,
  cleanRawTranscript,
  buildDigestPrompt,
  callLLM,
  extractJSON,
  getLatestMarketCallDateStr,
  sanitizeAnalystName,
} from './_pipeline.js';
import { fetchYoutubeAudioMedia, transcribeYoutubeAudio } from './_youtubeFetcher.js';

export const config = { maxDuration: 300 };

/**
 * Generate a deterministic job ID (same logic as digest route).
 */
function generateJobId(episodeDate) {
  const dateStr = episodeDate || getLatestMarketCallDateStr();
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

  const rawDate = req.body?.episodeDate;
  const targetDateStr = (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate))
    ? rawDate
    : getLatestMarketCallDateStr();
  const jobId = isDebug ? `debug-${Date.now()}` : generateJobId(targetDateStr);

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
        episode_date: targetDateStr,
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

    /* ── LEGACY YOUTUBE FALLBACK (DEPRECATED): Primary pipeline is modal_app/live_capture.py ── */
    let candidateVideos = [];
    if (youtubeKey) {
      /* Deprecated: legacy YouTube video search preserved for manual/fallback reference */
      candidateVideos = await findRecentMarketCallVideos(youtubeKey, timer);
    }

    /* ── Legacy Fallback Step 2: YouTube + yt-dlp Micro-Worker + Groq Whisper (Deprecated) ── */
    if (groqKey && groqKey.startsWith('gsk_')) {
      try {
        timer.start('YouTube audio pipeline');
        const ytMedia = await fetchYoutubeAudioMedia(timer);
        if (ytMedia && ytMedia.streamUrl) {
          const episodeDate = ytMedia.episodeDate || todayStr;
          const ytTrans = await transcribeYoutubeAudio(ytMedia.streamUrl, groqKey, timer);
          if (ytTrans && ytTrans.text && ytTrans.text.length >= 200) {
            selectedVideo = {
              videoId: ytMedia.videoId || '',
              videoTitle: ytMedia.videoTitle || 'BNN Bloomberg MarketCall (YouTube)',
              episodeDate: episodeDate,
              source: 'youtube_ytdlp',
            };
            cleanedTranscript = cleanRawTranscript(ytTrans.text);
          }
        } else if (ytMedia && ytMedia.error) {
          groqDiagnosticMsg = ` [DIAGNOSTIC: ${ytMedia.error}]`;
        }
        timer.end('YouTube audio pipeline');
      } catch (ytErr) {
        console.warn('[marketcall-process] YouTube audio pipeline warning:', ytErr.message);
      }
    }

    /* ── Step 3: Priority 2 — Groq Whisper MP3 transcription ── */
    if ((!selectedVideo || !cleanedTranscript) && groqKey && groqKey.startsWith('gsk_')) {
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
    const { systemPrompt, userPrompt } = buildDigestPrompt(cleanedTranscript, selectedVideo.videoTitle, selectedVideo.description);
    const rawLLMResponse = await callLLM(provider, llmKey, systemPrompt, userPrompt, timer);
    const llmText = typeof rawLLMResponse === 'string' ? rawLLMResponse : rawLLMResponse.text;
    const llmUsage = typeof rawLLMResponse === 'object' ? rawLLMResponse.usage : null;
    const digest = extractJSON(llmText);

    if (!digest || !digest.guest) {
      const errMsg = `LLM returned an unparseable digest.${groqDiagnosticMsg}`;
      await updateJob(jobId, 'error', null, errMsg);
      return res.status(200).json({ jobId, status: 'error', error: errMsg });
    }

    /* Sanitize analyst name against YouTube video title & phonetic mishearing dictionary */
    if (digest && digest.guest) {
      digest.guest = sanitizeAnalystName(digest.guest, selectedVideo.videoTitle, selectedVideo.description);
    }

    /* Attach real token usage so frontend can show actual costs */
    if (llmUsage) {
      digest.usage = llmUsage;
    }

    /* ── Success ── */
    const result = {
      digest,
      videoId: selectedVideo.videoId,
      videoTitle: selectedVideo.videoTitle,
      episodeDate: selectedVideo.episodeDate || targetDateStr,
      generatedAt: new Date().toISOString(),
      source: 'server',
      timing: timer.report(),
    };

    await updateJob(jobId, 'complete', result, null, selectedVideo.videoId, selectedVideo.videoTitle);
    console.log('[marketcall-process] Pipeline complete:', JSON.stringify(timer.report()));

    /* ── Step 7: Track Record Processing (Passive & Cold-Start) ── */
    if (digest.guest) {
      /* Fire-and-forget background processing so digest response is never delayed */
      (async () => {
        try {
          const { normalizeAnalystName, parseBnnPastPicksArticle } = await import('./_bnnScraper.js');
          const cleanGuest = normalizeAnalystName(digest.guest);

          /* 1. Upsert today's top picks from digest into analyst_track_record */
          const picksList = Array.isArray(digest.picks) ? digest.picks : Array.isArray(digest.top_picks) ? digest.top_picks : [];
          if (picksList.length > 0) {
            const digestRows = picksList.map((p) => ({
              analyst_name: cleanGuest,
              ticker: (p.ticker || '').trim().toUpperCase(),
              company_name: p.companyName || p.company_name || p.name || p.ticker,
              pick_publish_date: targetDateStr,
              then_price: typeof p.thenPrice === 'number' ? p.thenPrice : typeof p.price === 'number' ? p.price : 100,
              now_price: typeof p.nowPrice === 'number' ? p.nowPrice : typeof p.price === 'number' ? p.price : 100,
              total_return_pct: typeof p.returnPct === 'number' ? p.returnPct : 0,
              source_article_url: `https://www.bnnbloomberg.ca/video/shows/market-call/`,
            })).filter((r) => r.ticker && r.analyst_name);

            if (digestRows.length > 0) {
              await supabase.from('analyst_track_record').upsert(digestRows, {
                onConflict: 'analyst_name, ticker, pick_publish_date',
                ignoreDuplicates: true,
              });
              console.log(`[marketcall-process] Direct digest capture inserted ${digestRows.length} rows for ${cleanGuest}`);
            }
          }

          /* 2. Cold-Start Capture: Check if analyst has < 10 existing track record rows */
          const { count: existingCount } = await supabase
            .from('analyst_track_record')
            .select('id', { count: 'exact', head: true })
            .ilike('analyst_name', `%${cleanGuest}%`);

          if (!existingCount || existingCount < 10) {
            console.log(`[marketcall-process] Cold-start triggered for analyst "${cleanGuest}" (count: ${existingCount || 0})`);
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const host = req.headers.host || 'localhost:3000';
            const coldstartUrl = `${protocol}://${host}/api/analyst-coldstart`;

            fetch(coldstartUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ analyst: cleanGuest }),
              signal: AbortSignal.timeout(15000),
            }).catch((csErr) => {
              console.warn('[marketcall-process] Non-blocking cold-start fetch failed:', csErr.message);
            });
          }
        } catch (trackErr) {
          console.warn('[marketcall-process] Track record processing warning:', trackErr.message);
        }
      })();
    }

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
