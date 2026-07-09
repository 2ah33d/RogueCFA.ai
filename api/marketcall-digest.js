/* ════════════════════════════════════════════════════════════════
   /api/marketcall-digest.js
   Vercel serverless function: YouTube search → transcript → LLM digest
   ════════════════════════════════════════════════════════════════ */

const BNN_CHANNEL_ID = 'UCo7DCnBKIHEtJNSQbFXFJnA';

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { youtubeKey, llmKey, provider } = req.body || {};

  if (!youtubeKey) {
    return res.status(400).json({
      error: 'YouTube API key is required. Add it in Settings to use the MarketCall Digest.',
    });
  }
  if (!llmKey || !provider) {
    return res.status(400).json({
      error: 'LLM key and provider are required.',
    });
  }

  try {
    /* ──────────────────────────────────────────
       Step 1: Find most recent MarketCall video
       (Multi-strategy: Uploads playlist first, then global search)
       ────────────────────────────────────────── */
    const videoInfo = await findLatestMarketCallVideo(youtubeKey);

    if (!videoInfo || !videoInfo.videoId) {
      return res.status(200).json({
        error: 'no_episode',
        message: "No MarketCall episodes found on BNN Bloomberg's channel recently. Verified both recent channel uploads and global search.",
      });
    }

    const { videoId, videoTitle, episodeDate } = videoInfo;

    /* ──────────────────────────────────────────
       Step 2: Fetch auto-generated transcript
       ────────────────────────────────────────── */
    const transcript = await fetchTranscript(videoId);

    if (!transcript || transcript.length < 100) {
      return res.status(200).json({
        error: 'no_transcript',
        message: `Found episode "${videoTitle}" (${episodeDate ? 'aired ' + episodeDate : 'recent'}), but YouTube auto-captions aren't available yet. Auto-captions can take 1-2 hours after broadcast. Try again shortly.`,
        videoId,
        videoTitle,
        episodeDate,
      });
    }

    /* ──────────────────────────────────────────
       Step 3: Clean transcript
       ────────────────────────────────────────── */
    const cleanedTranscript = cleanRawTranscript(transcript);

    if (cleanedTranscript.length < 200) {
      return res.status(200).json({
        error: 'no_transcript',
        message: `Found episode "${videoTitle}", but the extracted transcript is too short or incomplete. Captions may still be processing.`,
        videoId,
        videoTitle,
        episodeDate,
      });
    }

    /* ──────────────────────────────────────────
       Step 4: Build prompt & call LLM
       ────────────────────────────────────────── */
    const { systemPrompt, userPrompt } = buildDigestPrompt(cleanedTranscript, videoTitle);
    const rawLLMResponse = await callLLM(provider, llmKey, systemPrompt, userPrompt);
    const digest = extractJSON(rawLLMResponse);

    if (!digest || !digest.guest) {
      return res.status(422).json({
        error: 'LLM returned an unparseable digest. Try again.',
      });
    }

    return res.status(200).json({
      digest,
      videoId,
      videoTitle,
      episodeDate,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('MarketCall digest error:', error);
    return res.status(500).json({
      error: `Digest generation failed: ${error.message}`,
    });
  }
}

/* ════════════════════════════════════════════════════════════════
   Transcript fetching — uses YouTube's internal timedtext endpoint
   No API key needed, no OAuth required.
   ════════════════════════════════════════════════════════════════ */

async function findLatestMarketCallVideo(youtubeKey) {
  /* Strategy 1: Check BNN Bloomberg's Uploads playlist directly (UU... instead of UC...).
     Uploads playlist has 0 indexing delay and only uses 1 quota unit. */
  try {
    const uploadsPlaylistId = BNN_CHANNEL_ID.replace(/^UC/, 'UU');
    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    playlistUrl.searchParams.set('part', 'snippet');
    playlistUrl.searchParams.set('playlistId', uploadsPlaylistId);
    playlistUrl.searchParams.set('maxResults', '20');
    playlistUrl.searchParams.set('key', youtubeKey);

    const res = await fetch(playlistUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      const match = items.find((item) => {
        const title = (item.snippet?.title || '').toLowerCase();
        const desc = (item.snippet?.description || '').toLowerCase();
        return title.includes('market call') || title.includes('marketcall') || desc.includes('market call') || desc.includes('marketcall');
      });
      if (match && match.snippet?.resourceId?.videoId) {
        return {
          videoId: match.snippet.resourceId.videoId,
          videoTitle: match.snippet.title || '',
          episodeDate: match.snippet.publishedAt ? match.snippet.publishedAt.split('T')[0] : '',
        };
      }
    } else if (res.status === 403 || res.status === 401) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`YouTube API key rejected: ${errBody.error?.message || res.statusText}`);
    }
  } catch (err) {
    if (err.message && err.message.includes('rejected')) throw err;
    console.warn('Uploads playlist lookup failed or had no MarketCall, trying search fallback:', err.message);
  }

  /* Strategy 2: Global YouTube search ordered by date (no channelId filter to bypass channel-search indexing lag). */
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('q', 'BNN Bloomberg Market Call');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('order', 'date');
  searchUrl.searchParams.set('maxResults', '15');
  searchUrl.searchParams.set('key', youtubeKey);

  const searchRes = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(10000) });
  if (!searchRes.ok) {
    const errBody = await searchRes.json().catch(() => ({}));
    const detail = errBody.error?.message || searchRes.statusText;
    if (searchRes.status === 403 || searchRes.status === 401) {
      throw new Error(`YouTube API key rejected: ${detail}`);
    }
    throw new Error(`YouTube search failed: ${detail}`);
  }

  const searchData = await searchRes.json();
  const videos = searchData.items || [];
  const marketCallVideo = videos.find((v) => {
    const title = (v.snippet?.title || '').toLowerCase();
    const desc = (v.snippet?.description || '').toLowerCase();
    const channel = (v.snippet?.channelTitle || '').toLowerCase();
    const isBnnOrRelevant = channel.includes('bnn') || channel.includes('bloomberg') || channel.includes('market call') || channel.includes('marketcall');
    const hasMarketCall = title.includes('market call') || title.includes('marketcall') || desc.includes('market call') || desc.includes('marketcall');
    return isBnnOrRelevant && hasMarketCall;
  });

  if (!marketCallVideo || !marketCallVideo.id?.videoId) return null;
  return {
    videoId: marketCallVideo.id.videoId,
    videoTitle: marketCallVideo.snippet?.title || '',
    episodeDate: marketCallVideo.snippet?.publishedAt ? marketCallVideo.snippet.publishedAt.split('T')[0] : '',
  };
}

/* ════════════════════════════════════════════════════════════════
   Transcript fetching — uses YouTube's internal timedtext endpoint
   No API key needed, no OAuth required.
   ════════════════════════════════════════════════════════════════ */

const YOUTUBE_BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Dest': 'document',
};

async function fetchTranscript(videoId) {
  try {
    /* First, fetch the video page to extract the captions track URL */
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(pageUrl, {
      headers: YOUTUBE_BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch video page: ${pageRes.status}`);
    }

    const html = await pageRes.text();

    /* Extract captions JSON from the page source */
    const captionsMatch = html.match(/"captions":\s*(\{.*?"playerCaptionsTracklistRenderer".*?\})\s*,\s*"videoDetails"/s);
    if (!captionsMatch) {
      /* Try alternative: direct timedtext endpoint */
      return await fetchTimedText(videoId);
    }

    let captionsData;
    try {
      const jsonStr = extractBalancedJSON(captionsMatch[1]);
      captionsData = JSON.parse(jsonStr);
    } catch {
      return await fetchTimedText(videoId);
    }

    const trackList = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(trackList) || trackList.length === 0) {
      return await fetchTimedText(videoId);
    }

    /* Prefer English auto-generated (kind=asr), then any English track */
    const asrTrack = trackList.find(
      (t) => t.languageCode === 'en' && t.kind === 'asr'
    );
    const enTrack = trackList.find((t) => t.languageCode === 'en');
    const track = asrTrack || enTrack || trackList[0];

    if (!track?.baseUrl) {
      return await fetchTimedText(videoId);
    }

    /* Fetch the transcript JSON */
    const captionUrl = track.baseUrl + '&fmt=json3';
    const captionRes = await fetch(captionUrl, {
      headers: YOUTUBE_BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!captionRes.ok) {
      return await fetchTimedText(videoId);
    }

    const captionData = await captionRes.json();
    const events = captionData?.events || [];

    const segments = [];
    for (const event of events) {
      if (event.segs) {
        const text = event.segs.map((s) => s.utf8 || '').join('');
        if (text.trim()) {
          segments.push(text);
        }
      }
    }

    return segments.join(' ');
  } catch (err) {
    console.warn('Primary transcript fetch failed, trying fallback:', err.message);
    return await fetchTimedText(videoId);
  }
}

/**
 * Fallback: hit timedtext endpoints directly (checking both ASR and manual en tracks)
 */
async function fetchTimedText(videoId) {
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: YOUTUBE_BROWSER_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.events) {
          const text = data.events
            .filter((e) => e.segs)
            .map((e) => e.segs.map((s) => s.utf8 || '').join(''))
            .filter((t) => t.trim())
            .join(' ');
          if (text.length > 100) return text;
        }
      }
    } catch {
      /* continue to next url */
    }
  }

  /* Try XML formats if json3 didn't yield text */
  const xmlUrls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
  ];

  for (const xmlUrl of xmlUrls) {
    try {
      const xmlRes = await fetch(xmlUrl, {
        headers: YOUTUBE_BROWSER_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (xmlRes.ok) {
        const xmlText = await xmlRes.text();
        const textMatches = xmlText.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
        if (textMatches) {
          const text = textMatches
            .map((m) => m.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean)
            .join(' ');
          if (text.length > 100) return text;
        }
      }
    } catch {
      /* continue */
    }
  }

  return '';
}

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

/* ════════════════════════════════════════════════════════════════
   Transcript cleaning
   ════════════════════════════════════════════════════════════════ */

function cleanRawTranscript(rawText) {
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
   Digest prompt construction (server-side mirror of digestBuilder.js)
   ════════════════════════════════════════════════════════════════ */

function buildDigestPrompt(transcript, videoTitle = '') {
  const systemPrompt = `You are a financial research assistant that summarizes BNN Bloomberg MarketCall episodes.
Your job is to produce a structured digest from the provided episode transcript.

STRICT RULES:
1. ONLY reference what the guest ACTUALLY SAID in the transcript. Do NOT add outside analysis, opinion, or information not present in the transcript.
2. Preserve the guest's SPECIFIC language and reasoning — not generic boilerplate. Instead of "the guest is bullish on energy", quote their actual logic: their stated thesis, metrics, catalysts, and price targets.
3. Every stock pick MUST include the guest's stated reasoning (WHY they like it). A bare ticker list is worthless.
4. Output 500–1000 words total.
5. If the guest mentions a price target, timeframe, or specific catalyst, include it.
6. If there are caller Q&A segments, capture any meaningful insights in the closing notes.

OUTPUT FORMAT — respond with valid JSON only, no markdown fences:
{
  "guest": "Full Name",
  "firm": "Firm/Title",
  "episodeFocus": "Stated theme of the episode, e.g. Energy Sector Outlook",
  "marketOutlook": "100-150 word summary of the guest's overall market view/thesis, condensed from their opening remarks. Use their actual stated logic.",
  "picks": [
    {
      "ticker": "TICKER",
      "company": "Company Name",
      "reasoning": "80-150 words condensing the guest's own logic for this pick — WHY they like it, any stated price target or timeframe, any specific catalyst or metric they referenced."
    }
  ],
  "closingNotes": "Optional 50-100 words. Any caller Q&A insights or risk caveats the guest mentioned. Empty string if none."
}`;

  const userPrompt = `Here is the transcript from today's BNN Bloomberg MarketCall episode${videoTitle ? ` titled "${videoTitle}"` : ''}:

---BEGIN TRANSCRIPT---
${transcript}
---END TRANSCRIPT---

Produce the structured digest following the exact JSON format specified. Remember: preserve the guest's actual reasoning per pick, not generic summaries.`;

  return { systemPrompt, userPrompt };
}

/* ════════════════════════════════════════════════════════════════
   LLM routing — mirrors api/score.js patterns
   ════════════════════════════════════════════════════════════════ */

async function callLLM(provider, key, systemPrompt, userPrompt) {
  switch (provider) {
    case 'gemini':
      return callGemini(key, systemPrompt, userPrompt);
    case 'claude':
      return callClaude(key, systemPrompt, userPrompt);
    case 'openai':
      return callOpenAI(key, systemPrompt, userPrompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
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
    if (textPart) return textPart.text;
  }
  throw new Error('Gemini returned no text content.');
}

async function callClaude(key, systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(`Claude API error: ${errBody.error?.message || response.statusText}`),
      { status: response.status }
    );
  }

  const data = await response.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (textBlock) return textBlock.text;
  throw new Error('Claude returned no text content.');
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
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(`OpenAI API error: ${errBody.error?.message || response.statusText}`),
      { status: response.status }
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/* ════════════════════════════════════════════════════════════════
   JSON extraction (mirrors api/score.js)
   ════════════════════════════════════════════════════════════════ */

function extractJSON(text) {
  if (!text) throw new Error('LLM returned an empty response.');
  const stripped = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* Attempt repair for trailing commas */
        try {
          const repaired = match[0].replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(repaired);
        } catch (err) {
          throw new Error(`JSON malformed: ${err.message}`);
        }
      }
    }
    throw new Error(`No JSON found in LLM response.`);
  }
}
