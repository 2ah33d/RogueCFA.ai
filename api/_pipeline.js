/* ════════════════════════════════════════════════════════════════
   Date Utilities (Weekend Guard for BNN MarketCall broadcasts)
   ════════════════════════════════════════════════════════════════ */

/**
 * Returns latest weekday date string (YYYY-MM-DD).
 * MarketCall only airs Mon-Fri. If invoked on Sat/Sun, resolves to Friday.
 */
export function getLatestMarketCallDateStr(d = new Date()) {
  const dateObj = new Date(d);
  const day = dateObj.getUTCDay();
  if (day === 6) { // Saturday -> Friday
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
  } else if (day === 0) { // Sunday -> Friday
    dateObj.setUTCDate(dateObj.getUTCDate() - 2);
  }
  return dateObj.toISOString().split('T')[0];
}

/* ════════════════════════════════════════════════════════════════
   Timing instrumentation
   ════════════════════════════════════════════════════════════════ */

/**
 * Creates a timing tracker that logs stage durations to console.
 * Usage:
 *   const timer = createTimer();
 *   timer.start('MP3 download');
 *   ... await work ...
 *   timer.end('MP3 download');   // logs: [TIMING] MP3 download: 12345ms
 *   const report = timer.report(); // returns { stages: [...], totalMs }
 */
export function createTimer(onProgress) {
  const stages = [];
  const active = new Map();
  const t0 = Date.now();

  return {
    start(label) {
      active.set(label, Date.now());
      if (onProgress) onProgress(label);
    },
    end(label) {
      const started = active.get(label);
      if (started !== undefined) {
        const ms = Date.now() - started;
        stages.push({ label, ms });
        active.delete(label);
        console.log(`[TIMING] ${label}: ${ms}ms`);
      }
    },
    report() {
      return { stages, totalMs: Date.now() - t0 };
    },
  };
}

/* ════════════════════════════════════════════════════════════════
   HTML entity decoding
   ════════════════════════════════════════════════════════════════ */

function decodeHTMLEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(dec));
}

/* ════════════════════════════════════════════════════════════════
   YouTube video discovery
   ════════════════════════════════════════════════════════════════ */

const YOUTUBE_BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; RogueCFA/1.0; +https://github.com/2ah33d/RogueCFA.ai)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function findRecentMarketCallVideos(youtubeKey, timer) {
  timer?.start('YouTube video search');
  const candidateMap = new Map();

  /* Strategy 1: Check BNN Bloomberg's Uploads playlist directly (UU... instead of UC...). */
  try {
    const uploadsPlaylistId = BNN_CHANNEL_ID.replace(/^UC/, 'UU');
    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    playlistUrl.searchParams.set('part', 'snippet');
    playlistUrl.searchParams.set('playlistId', uploadsPlaylistId);
    playlistUrl.searchParams.set('maxResults', '25');
    playlistUrl.searchParams.set('key', youtubeKey);

    const res = await fetch(playlistUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      for (const item of items) {
        const title = (item.snippet?.title || '').toLowerCase();
        const desc = (item.snippet?.description || '').toLowerCase();
        if (title.includes('market call') || title.includes('marketcall') || desc.includes('market call') || desc.includes('marketcall')) {
          const videoId = item.snippet?.resourceId?.videoId;
          if (videoId && !candidateMap.has(videoId)) {
            candidateMap.set(videoId, {
              videoId,
              videoTitle: decodeHTMLEntities(item.snippet.title || ''),
              episodeDate: item.snippet.publishedAt ? item.snippet.publishedAt.split('T')[0] : '',
              description: decodeHTMLEntities(item.snippet.description || ''),
            });
          }
        }
      }
    } else if (res.status === 403 || res.status === 401) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`YouTube API key rejected: ${errBody.error?.message || res.statusText}`);
    }
  } catch (err) {
    if (err.message && err.message.includes('rejected')) throw err;
    console.warn('Uploads playlist lookup failed, trying search fallback:', err.message);
  }

  /* Strategy 2: Global YouTube search ordered by date (no channelId filter to bypass channel lag). */
  if (candidateMap.size < 5) {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', 'BNN Bloomberg Market Call');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('order', 'date');
    searchUrl.searchParams.set('maxResults', '20');
    searchUrl.searchParams.set('key', youtubeKey);

    const searchRes = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(10000) });
    if (!searchRes.ok) {
      const errBody = await searchRes.json().catch(() => ({}));
      const detail = errBody.error?.message || searchRes.statusText;
      if (searchRes.status === 403 || searchRes.status === 401) {
        if (candidateMap.size === 0) throw new Error(`YouTube API key rejected: ${detail}`);
      } else {
        if (candidateMap.size === 0) throw new Error(`YouTube search failed: ${detail}`);
      }
    } else {
      const searchData = await searchRes.json();
      const videos = searchData.items || [];
      for (const v of videos) {
        const title = (v.snippet?.title || '').toLowerCase();
        const desc = (v.snippet?.description || '').toLowerCase();
        const channel = (v.snippet?.channelTitle || '').toLowerCase();
        const isBnnOrRelevant = channel.includes('bnn') || channel.includes('bloomberg') || channel.includes('market call') || channel.includes('marketcall');
        const hasMarketCall = title.includes('market call') || title.includes('marketcall') || desc.includes('market call') || desc.includes('marketcall');
        if (isBnnOrRelevant && hasMarketCall) {
          const videoId = v.id?.videoId;
          if (videoId && !candidateMap.has(videoId)) {
            candidateMap.set(videoId, {
              videoId,
              videoTitle: decodeHTMLEntities(v.snippet.title || ''),
              episodeDate: v.snippet.publishedAt ? v.snippet.publishedAt.split('T')[0] : '',
              description: decodeHTMLEntities(v.snippet.description || ''),
            });
          }
        }
      }
    }
  }

  timer?.end('YouTube video search');
  return Array.from(candidateMap.values()).slice(0, 8);
}

/* ════════════════════════════════════════════════════════════════
   Transcript fetching — YouTube auto-captions
   ════════════════════════════════════════════════════════════════ */

/**
 * Extract a balanced JSON object from a string that may have trailing content.
 */
function extractBalancedJSON(str) {
  let depth = 0;
  let start = str.indexOf('{');
  if (start === -1) return str;

  for (let i = start; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return str;
}

export async function fetchTranscript(videoId) {

  /* Strategy B: YouTube Page HTML with GDPR CONSENT cookies */
  try {
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(pageUrl, {
      headers: YOUTUBE_BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (pageRes.ok) {
      const html = await pageRes.text();
      const captionsMatch = html.match(/"captions":\s*(\{.*?"playerCaptionsTracklistRenderer".*?\})\s*,\s*"videoDetails"/s) ||
                            html.match(/"playerCaptionsTracklistRenderer":\s*(\{.*?\})/s);
      if (captionsMatch) {
        let captionsData;
        try {
          const jsonStr = extractBalancedJSON(captionsMatch[1]);
          captionsData = JSON.parse(jsonStr);
        } catch {
          /* ignore json parse error */
        }

        const trackList = captionsData?.playerCaptionsTracklistRenderer?.captionTracks || captionsData?.captionTracks;
        if (Array.isArray(trackList) && trackList.length > 0) {
          const asrTrack = trackList.find((t) => t.languageCode === 'en' && t.kind === 'asr');
          const enTrack = trackList.find((t) => t.languageCode === 'en');
          const track = asrTrack || enTrack || trackList[0];

          if (track?.baseUrl) {
            const captionUrl = track.baseUrl + '&fmt=json3';
            const captionRes = await fetch(captionUrl, {
              headers: YOUTUBE_BROWSER_HEADERS,
              signal: AbortSignal.timeout(8000),
            });
            if (captionRes.ok) {
              const captionData = await captionRes.json();
              const text = (captionData?.events || [])
                .filter((e) => e.segs)
                .map((e) => e.segs.map((s) => s.utf8 || '').join(''))
                .filter(Boolean)
                .join(' ');
              if (text.length >= 200) return text;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Primary transcript fetch failed, trying timedtext fallback:', err.message);
  }

  /* Strategy C: Direct YouTube timedtext endpoints with CONSENT cookies */
  return await fetchTimedText(videoId);
}

/**
 * Fallback: hit timedtext endpoints directly (checking both ASR and manual en tracks)
 */
async function fetchTimedText(videoId) {
  const fetchJson = async (url) => {
    const res = await fetch(url, {
      headers: YOUTUBE_BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.events) {
      const text = data.events
        .filter((e) => e.segs)
        .map((e) => e.segs.map((s) => s.utf8 || '').join(''))
        .filter((t) => t.trim())
        .join(' ');
      if (text.length >= 200) return text;
    }
    throw new Error('Insufficient length');
  };

  const fetchXml = async (url) => {
    const res = await fetch(url, {
      headers: YOUTUBE_BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xmlText = await res.text();
    const textMatches = xmlText.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
    if (textMatches) {
      const text = textMatches
        .map((m) => m.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .join(' ');
      if (text.length >= 200) return text;
    }
    throw new Error('Insufficient length');
  };

  try {
    return await Promise.any([
      fetchJson(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`),
      fetchJson(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`),
      fetchXml(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr`),
      fetchXml(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`)
    ]);
  } catch {
    return '';
  }
}

/* ════════════════════════════════════════════════════════════════
   RSS Podcast Fallback + Groq Whisper ASR (Architecture A)
   ════════════════════════════════════════════════════════════════ */

export async function fetchRssPodcastFallback(groqKey = '', timer) {
  const rssUrls = [
    'https://www.omnycontent.com/d/playlist/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae32016f1b9a/4ecaf48c-23a4-4f5e-84b3-ae3201711923/podcast.rss',
    'https://www.bnnbloomberg.ca/feed/podcast/market-call',
    'https://www.bnnbloomberg.ca/investing/rss/',
  ];

  for (const url of rssUrls) {
    try {
      timer?.start('RSS feed fetch');
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RogueCFA/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      timer?.end('RSS feed fetch');
      if (!res.ok) continue;

      const xml = await res.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

      const isOmny = url.includes('omnycontent.com');
      for (const itemXml of items) {
        if (isOmny || itemXml.toLowerCase().includes('market call') || itemXml.toLowerCase().includes('marketcall')) {
          /* If groqKey is present, attempt free Whisper audio transcription on the MP3 stream */
          if (groqKey && groqKey.startsWith('gsk_')) {
            const mp3Match = itemXml.match(/https?:\/\/[^"'\s<>]+\.mp3[^"'\s<>]*/i);
            if (mp3Match) {
              try {
                let mp3Url = mp3Match[0]
                  .replace(/&amp;/g, '&')   /* Decode XML entity — RSS feeds encode & as &amp; */
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>');
                /* Unwrap third-party Podtrac tracking redirect (dts.podtrac.com/redirect.mp3/) to hit clean OmnyStudio audio CDN directly */
                if (mp3Url.includes('dts.podtrac.com/redirect.mp3/')) {
                  const unwrapped = mp3Url.split('dts.podtrac.com/redirect.mp3/')[1];
                  if (unwrapped) {
                    mp3Url = unwrapped.startsWith('http') ? unwrapped : `https://${unwrapped}`;
                  }
                }

                timer?.start('MP3 download');
                const audioRes = await fetch(mp3Url, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RogueCFA/1.0)' },
                  redirect: 'follow',
                  signal: AbortSignal.timeout(20000)
                });
                if (!audioRes.ok) {
                  timer?.end('MP3 download');
                  return { text: '', groqDiagnostic: `BNN Bloomberg audio stream returned HTTP ${audioRes.status}` };
                }
                const audioBuffer = await audioRes.arrayBuffer();
                timer?.end('MP3 download');
                console.log(`[TIMING] MP3 size: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

                /*
                 * Nullify Xing/Info VBR header in the audio buffer.
                 * Podcast MP3s contain large ID3v2 tags (with embedded album art)
                 * that push the Xing frame well beyond 4KB. Search the first 512KB
                 * to guarantee we find and zero it. Without this, FFmpeg on Groq
                 * reads the Xing-declared duration (e.g. 2778s), expects that many
                 * frames in a byte-sliced chunk, and hangs → 502 after 150+ seconds.
                 */
                const HEADER_SCAN_BYTES = Math.min(524288, audioBuffer.byteLength);
                const headerRegion = new Uint8Array(audioBuffer, 0, HEADER_SCAN_BYTES);
                const markers = [
                  [0x58, 0x69, 0x6E, 0x67], /* "Xing" */
                  [0x49, 0x6E, 0x66, 0x6F], /* "Info" */
                ];
                for (const marker of markers) {
                  for (let i = 0; i < headerRegion.length - 3; i++) {
                    if (headerRegion[i] === marker[0] && headerRegion[i+1] === marker[1] &&
                        headerRegion[i+2] === marker[2] && headerRegion[i+3] === marker[3]) {
                      headerRegion[i] = 0; headerRegion[i+1] = 0;
                      headerRegion[i+2] = 0; headerRegion[i+3] = 0;
                    }
                  }
                }

                /*
                 * Split MP3 into 21MB chunks to comply with Groq's 25MB limit.
                 * A 43MB episode yields 2-3 chunks, all transcribed concurrently
                 * via Promise.all — typically completes in ~15-20s total.
                 * The Xing/Info header nullification above prevents Groq 502 hangs.
                 */
                const CHUNK_LIMIT_BYTES = 21 * 1024 * 1024;
                const chunks = [];
                let offset = 0;
                while (offset < audioBuffer.byteLength) {
                  const end = Math.min(offset + CHUNK_LIMIT_BYTES, audioBuffer.byteLength);
                  chunks.push(audioBuffer.slice(offset, end));
                  offset = end;
                }
                console.log(`[TIMING] Audio split into ${chunks.length} chunks (${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB total)`);

                /* Transcribe a single audio chunk via Groq Whisper Turbo */
                const transcribeChunk = async (chunkBuf, idx) => {
                  const formData = new FormData();
                  formData.append('file', new Blob([chunkBuf], { type: 'audio/mpeg' }), `marketcall_part${idx}.mp3`);
                  formData.append('model', 'whisper-large-v3-turbo');
                  formData.append('response_format', 'json');

                  let res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${groqKey}` },
                    body: formData,
                    signal: AbortSignal.timeout(45000),
                  });

                  if (!res.ok && res.status === 400) {
                    /* Fallback to distil-whisper if turbo model string is rejected */
                    formData.set('model', 'distil-whisper-large-v3-en');
                    res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${groqKey}` },
                      body: formData,
                      signal: AbortSignal.timeout(45000),
                    });
                  }

                  if (res.ok) {
                    const data = await res.json().catch(() => null);
                    return { text: data?.text || '', error: null };
                  }
                  const errData = await res.json().catch(() => ({}));
                  return { text: '', error: `Groq API error (${res.status} chunk ${idx}): ${errData.error?.message || res.statusText}` };
                };

                /* Transcribe ALL chunks concurrently — with 2-3 chunks this completes in ~15-20s */
                timer?.start('Whisper transcription');
                const results = await Promise.all(chunks.map((buf, i) => transcribeChunk(buf, i + 1)));
                timer?.end('Whisper transcription');

                const firstError = results.find(r => r.error);
                if (firstError && !results.some(r => r.text && r.text.length >= 200)) {
                  return { text: '', groqDiagnostic: firstError.error };
                }

                const combinedText = results.map(r => r.text).filter(Boolean).join('\n\n');
                if (combinedText.length >= 200) {
                  return { text: combinedText, groqDiagnostic: null };
                }
                return { text: '', groqDiagnostic: 'Groq API returned an empty audio transcription payload.' };
              } catch (asrErr) {
                const isTimeout = asrErr.name === 'TimeoutError' || asrErr.message?.toLowerCase().includes('timeout') || asrErr.message?.toLowerCase().includes('aborted');
                return {
                  text: '',
                  groqDiagnostic: isTimeout
                    ? 'Downloading and transcribing the complete MP3 file exceeded Vercel\'s serverless execution timeout.'
                    : `Groq MP3 transcription exception: ${asrErr.message}`
                };
              }
            }
          }

          /* Text-based RSS description fallback */
          const contentMatches = itemXml.match(/<(?:content:encoded|description)[^>]*>([\s\S]*?)<\/(?:content:encoded|description)>/gi);
          if (contentMatches) {
            const text = contentMatches
              .map((m) => m.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim())
              .filter((t) => t.length > 50)
              .join(' ');
            if (text.length >= 100) {
              return { text, groqDiagnostic: null };
            }
          }
        }
      }
    } catch (rssErr) {
      /* If groqKey was provided, surface the error instead of silently swallowing */
      if (groqKey && groqKey.startsWith('gsk_')) {
        return { text: '', groqDiagnostic: `RSS/MP3 fetch exception: ${rssErr.message}` };
      }
      /* continue to next RSS URL for non-Groq paths */
    }
  }
  return { text: '', groqDiagnostic: groqKey ? 'No MarketCall episode found in any RSS feed.' : null };
}

/* ════════════════════════════════════════════════════════════════
   Transcript cleaning
   ════════════════════════════════════════════════════════════════ */

export function cleanRawTranscript(rawText) {
  return rawText
    .replace(/\[music\]/gi, '')
    .replace(/\[applause\]/gi, '')
    .replace(/\[laughter\]/gi, '')
    .replace(/\[inaudible\]/gi, '')
    .replace(/\[silence\]/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ════════════════════════════════════════════════════════════════
   YouTube Analyst Name Extraction & Phonetic Overrides
   ════════════════════════════════════════════════════════════════ */

export const PHONETIC_ANALYST_OVERRIDES = {
  'julian nono-wamden': 'Julian Klymochko',
  'julian nono wamden': 'Julian Klymochko',
  'julian nono': 'Julian Klymochko',
  'julian namboothiri': 'Julian Klymochko',
};

/**
 * Extracts official guest analyst name directly from YouTube video title & description.
 * Overrides phonetic audio Whisper transcription mishearings.
 */
export function extractAnalystFromYouTubeTitle(videoTitle, description = '') {
  if (!videoTitle || typeof videoTitle !== 'string') return null;

  const cleanTitle = decodeHTMLEntities(videoTitle).trim();

  // Pattern 1: "Market Call: Julian Klymochko on U.S. equities" or "MarketCall: Eric Nuttall's Top Picks"
  const p1 = cleanTitle.match(/market\s*call\s*[:\-–—]\s*([^'":\-–—\d\(\)]+?)(?:\s+(?:on|'s|takes|shares|talks|with|gives|top|picks|discusses)|$)/i);
  if (p1 && p1[1]) {
    const candidate = p1[1].trim();
    const words = candidate.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && !/^(today|bnn|market|call|top|picks)$/i.test(words[0])) {
      return candidate;
    }
  }

  // Pattern 2: "Julian Klymochko on U.S. Equities - MarketCall"
  const p2 = cleanTitle.match(/^([^:\-–—\d\(\)]+?)\s+(?:on|takes|shares|talks|with|gives|top|picks|discusses)\s+.*(?:market\s*call)/i);
  if (p2 && p2[1]) {
    const candidate = p2[1].trim();
    const words = candidate.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      return candidate;
    }
  }

  // Pattern 3: "BNN Bloomberg MarketCall - Julian Klymochko"
  const p3 = cleanTitle.match(/(?:market\s*call|bnn\s+bloomberg)\s*[\-–—:]\s*([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (p3 && p3[1]) {
    const candidate = p3[1].trim();
    if (!/^(top|picks|market|call|bnn|bloomberg)$/i.test(candidate.split(/\s+/)[0])) {
      return candidate;
    }
  }

  // Pattern 4: Search description for "Guest: Julian Klymochko"
  if (description && typeof description === 'string') {
    const p4 = description.match(/(?:guest|analyst|featured|interview(?:ing)?)\s*[:\-–—]?\s*([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (p4 && p4[1]) {
      return p4[1].trim();
    }
  }

  return null;
}

export function sanitizeAnalystName(rawGuest, videoTitle = '', description = '') {
  if (!rawGuest) return 'BNN Bloomberg Guest';
  const lower = rawGuest.trim().toLowerCase();
  if (PHONETIC_ANALYST_OVERRIDES[lower]) {
    return PHONETIC_ANALYST_OVERRIDES[lower];
  }

  const ytName = extractAnalystFromYouTubeTitle(videoTitle, description);
  if (ytName) {
    return ytName;
  }

  return rawGuest.trim();
}

/* ════════════════════════════════════════════════════════════════
   Digest prompt construction
   ════════════════════════════════════════════════════════════════ */

export function buildDigestPrompt(transcript, videoTitle = '', description = '') {
  const officialGuest = extractAnalystFromYouTubeTitle(videoTitle, description);

  const systemPrompt = `You are a financial research assistant that summarizes BNN Bloomberg MarketCall episodes.
Your job is to produce a structured digest from the provided episode transcript.

STRICT RULES:
1. ONLY reference what the guest ACTUALLY SAID in the transcript. Do NOT add outside analysis, opinion, or information not present in the transcript.
2. PRESERVE THE OFFICIAL GUEST NAME: ${officialGuest ? `The verified official guest name extracted from YouTube is "${officialGuest}". ALWAYS set "guest": "${officialGuest}".` : `Extract the guest's official real name from YouTube title/transcript accurately.`} Do NOT output phonetic Whisper mishearings (e.g. "Julian Nono-Wamden").
3. NORMALIZE ALL NAMES — this transcript comes from automatic speech-to-text and WILL contain phonetic errors in company names, tickers, and people's names. Before writing any field:
   - For every company/stock mentioned, silently resolve it to its real, correct company name and ticker using your own knowledge of public markets (e.g. "Barrick Gould" → Barrick Gold / ABX; a garbled ticker spoken aloud like "boy alphabet" → Alphabet / GOOGL).
   - Do the same for any person named in the transcript (other analysts, hosts, companies' executives, etc.), not just the guest.
   - If you cannot confidently resolve a name, keep the closest plausible real match — never invent a company or person that doesn't exist, and never leave an obvious phonetic garble in the output.
   - Write ONLY the corrected forms in every output field. Do not mention or explain the correction inline in the prose.
4. Preserve the guest's SPECIFIC language and reasoning — not generic boilerplate. Instead of "the guest is bullish on energy", quote their actual logic: their stated thesis, metrics, catalysts, and price targets.
5. Every stock pick MUST include the guest's stated reasoning (WHY they like it). A bare ticker list is worthless.
6. Output 500–1000 words total.
7. If the guest mentions a price target, timeframe, or specific catalyst, include it.
8. CRITICAL DISTINCTION FOR PICKS VS CALLER Q&A:
   - "picks": MUST contain EXACTLY the guest's NEW official featured Top Picks (typically 3 stocks) introduced for today's market.
   - "callerMentions": MUST contain any additional stocks discussed by the guest when answering caller questions or viewer emails during the Q&A segment. DO NOT mix caller Q&A stocks into "picks".
9. EXCLUDE PAST PICKS REVIEWS: Do NOT include historical "Past Picks" reviewed during the episode. "picks" MUST ONLY contain NEW, CURRENT actionable Top Picks.
10. CRITICAL JSON ESCAPING & STRUCTURE: Ensure your output is perfectly valid JSON. Do NOT use unescaped double quotes inside strings (escape them as \"). ALWAYS close all open arrays with ] before closing the root object with }.

OUTPUT FORMAT — respond with valid JSON only, no markdown fences:
{
  "guest": "${officialGuest || 'Full Name'}",
  "firm": "Firm/Title",
  "episodeFocus": "Stated theme of the episode, e.g. Technical Analysis / Energy Sector Outlook",
  "marketOutlook": "100-150 word executive summary of the guest's market view. The first sentence MUST be a sharp 15-25 word standalone takeaway sentence (avoid broken abbreviations like e.g. or i.e. in the opening sentence).",
  "picks": [
    {
      "ticker": "TICKER",
      "company": "Company Name",
      "reasoning": "80-150 words condensing the guest's own logic for this official top pick — WHY they like it, any stated price target or timeframe, any specific catalyst or metric they referenced."
    }
  ],
  "callerMentions": [
    {
      "ticker": "TICKER",
      "company": "Company Name",
      "reasoning": "60-120 words condensing what the guest said about this stock when answering a caller question (buy/sell/hold stance, technicals/fundamentals, risks or valuation concerns)."
    }
  ],
  "closingNotes": "Optional 50-100 words. Any general macro risks or concluding thoughts the guest mentioned. Empty string if none.",
  "corrections": [
    {
      "heard": "phonetic text from transcript",
      "corrected": "actual name/ticker",
      "type": "ticker|company|person"
    }
  ]
}`;

  const userPrompt = `Here is the transcript from today's BNN Bloomberg MarketCall episode${videoTitle ? ` titled "${videoTitle}"` : ''}:

---BEGIN TRANSCRIPT---
${transcript}
---END TRANSCRIPT---

Produce the structured digest following the exact JSON format specified. Remember: "picks" must ONLY contain NEW official featured Top Picks (usually 3), EXCLUDING any past picks reviews from prior months. All caller Q&A stock discussions belong in "callerMentions".`;

  return { systemPrompt, userPrompt };
}

/* ════════════════════════════════════════════════════════════════
   LLM routing — mirrors api/score.js patterns
   ════════════════════════════════════════════════════════════════ */

export async function callLLM(provider, key, systemPrompt, userPrompt, timer) {
  timer?.start('LLM synthesis');
  let result;
  switch (provider) {
    case 'gemini':
      result = await callGemini(key, systemPrompt, userPrompt);
      break;
    case 'claude':
      result = await callClaude(key, systemPrompt, userPrompt);
      break;
    case 'openai':
      result = await callOpenAI(key, systemPrompt, userPrompt);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
  timer?.end('LLM synthesis');
  return result; /* { text: string, usage: { input_tokens, output_tokens } } */
}

async function callGemini(key, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(150000),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(`Gemini API error: ${errBody.error?.message || response.statusText}`),
      { status: response.status }
    );
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const textPart = parts.find((p) => typeof p.text === 'string');
    if (textPart) {
      const usage = data.usageMetadata
        ? {
            input_tokens: data.usageMetadata.promptTokenCount || 0,
            output_tokens: data.usageMetadata.candidatesTokenCount || 0,
          }
        : null;
      return { text: textPart.text, usage };
    }
  }
  throw new Error('Gemini returned no text content.');
}

async function callClaude(key, systemPrompt, userPrompt) {
  const models = [
    'claude-haiku-4-5-20251001',
    'claude-haiku-4-5',
    'claude-sonnet-5',
  ];

  let lastErr = null;
  for (const model of models) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(150000),
    });

    if (response.ok) {
      const data = await response.json();
      const textBlock = data.content?.find((b) => b.type === 'text');
      if (textBlock) {
        const usage = data.usage
          ? {
              input_tokens: data.usage.input_tokens || 0,
              output_tokens: data.usage.output_tokens || 0,
            }
          : null;
        return { text: textBlock.text, usage };
      }
      throw new Error('Claude returned no text content.');
    }

    const errBody = await response.json().catch(() => ({}));
    const detail = errBody.error?.message || response.statusText;
    lastErr = Object.assign(
      new Error(`Claude API error (${model}): ${detail}`),
      { status: response.status }
    );
    if (response.status === 404) {
      continue;
    }
    throw lastErr;
  }
  
  throw lastErr || new Error('Claude API request failed.');
}

async function callOpenAI(key, systemPrompt, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(150000),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(`OpenAI API error: ${errBody.error?.message || response.statusText}`),
      { status: response.status }
    );
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const usage = data.usage
    ? {
        input_tokens: data.usage.prompt_tokens || 0,
        output_tokens: data.usage.completion_tokens || 0,
      }
    : null;
  return { text, usage };
}

/* ════════════════════════════════════════════════════════════════
   JSON extraction
   ════════════════════════════════════════════════════════════════ */

export function extractJSON(text) {
  if (!text) throw new Error('LLM returned an empty response.');
  let str = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.slice(firstBrace, lastBrace + 1);
  }

  /* Step 1: Direct JSON parse */
  try {
    return JSON.parse(str);
  } catch {}

  /* Step 2: Trailing comma cleanup */
  let repaired = str.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(repaired);
  } catch {}

  /* Step 3: Fast regex missing bracket repair (}\n}) */
  let repairedBracket = repaired.replace(/\}\s*\}$/, '}\n  ]\n}');
  try {
    return JSON.parse(repairedBracket);
  } catch {}

  /* Step 4: Full character scanner & stack auto-balancer */
  let out = '';
  let inString = false;
  let isEscaped = false;
  let stack = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (char === '\n') { out += '\\n'; continue; }
      if (char === '\r') { out += '\\r'; continue; }
      if (char === '\t') { out += '\\t'; continue; }
      if (char === '\\') { isEscaped = !isEscaped; out += char; }
      else if (char === '"') {
        if (isEscaped) { out += char; isEscaped = false; }
        else {
          const rest = str.slice(i + 1).trimStart();
          const nextChar = rest[0];
          if (!nextChar || [',', '}', ']', ':'].includes(nextChar)) {
            inString = false;
            out += char;
          } else {
            out += '\\"';
          }
        }
      } else { isEscaped = false; out += char; }
    } else {
      if (char === '"') { inString = true; out += char; }
      else if (char === '{' || char === '[') { stack.push(char === '{' ? '}' : ']'); out += char; }
      else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ']') stack.pop();
        out += char;
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === ']') {
          stack.pop();
          out += '\n  ]\n';
        }
        if (stack.length > 0 && stack[stack.length - 1] === '}') {
          stack.pop();
        }
        out += char;
      } else { out += char; }
    }
  }
  if (inString) out += '"';
  out = out.replace(/,\s*$/, '');
  while (stack.length > 0) { out += '\n' + stack.pop(); }
  out = out.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(out);
  } catch (err) {
    const parseErr = new Error(`JSON malformed: ${err.message}`);
    parseErr.rawText = out || str;
    throw parseErr;
  }
}

/* ════════════════════════════════════════════════════════════════
   Preserved 3rd-Party Volunteer Proxy Extraction Code (Inactive)
   Kept for future offline or optional deep-fallback use.
   ════════════════════════════════════════════════════════════════ */
export async function _fetchViaProxiesInactive(videoId) {
  const proxyHosts = [
    { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
    { type: 'piped', url: 'https://pipedapi.leptons.xyz' },
    { type: 'piped', url: 'https://pipedapi.syncp.link' },
    { type: 'piped', url: 'https://piped-api.lunar.icu' },
    { type: 'piped', url: 'https://api-piped.mha.fi' },
    { type: 'invidious', url: 'https://inv.tux.zone' },
    { type: 'invidious', url: 'https://invidious.nerdvpn.de' },
    { type: 'invidious', url: 'https://vid.puppycraft.me' },
  ];

  for (const host of proxyHosts) {
    try {
      if (host.type === 'piped') {
        const res = await fetch(`${host.url}/streams/${videoId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const subs = data?.subtitles || [];
          const enSub = subs.find((s) => s.code === 'en' && s.autoGenerated) || subs.find((s) => s.code?.startsWith('en'));
          if (enSub && enSub.url) {
            const subRes = await fetch(enSub.url, { signal: AbortSignal.timeout(5000) });
            if (subRes.ok) {
              const subData = await subRes.json().catch(() => null);
              if (Array.isArray(subData) && subData.length > 5) {
                const text = subData.map((item) => item.utf8 || item.text || '').filter(Boolean).join(' ');
                if (text.length >= 200) return text;
              } else if (typeof subData === 'object' && subData?.events) {
                const text = subData.events
                  .filter((e) => e.segs)
                  .map((e) => e.segs.map((s) => s.utf8 || '').join(''))
                  .filter(Boolean)
                  .join(' ');
                if (text.length >= 200) return text;
              }
            }
          }
        }
      } else if (host.type === 'invidious') {
        const res = await fetch(`${host.url}/api/v1/captions/${videoId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const captions = data?.captions || [];
          const enCap = captions.find((c) => c.languageCode === 'en');
          if (enCap && enCap.url) {
            const capUrl = enCap.url.startsWith('http') ? enCap.url : `${host.url}${enCap.url}`;
            const capRes = await fetch(capUrl, { signal: AbortSignal.timeout(5000) });
            if (capRes.ok) {
              const vttText = await capRes.text();
              const cleanLines = vttText
                .split('\n')
                .filter((line) => !line.includes('-->') && !line.startsWith('WEBVTT') && line.trim() !== '')
                .map((line) => line.replace(/<[^>]+>/g, '').trim())
                .filter(Boolean);
              const text = cleanLines.join(' ');
              if (text.length >= 200) return text;
            }
          }
        }
      }
    } catch {
      /* continue to next proxy host */
    }
  }
  return '';
}
