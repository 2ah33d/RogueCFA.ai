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
       Step 1: Find today's MarketCall video
       ────────────────────────────────────────── */
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    /* Search window: start of today (UTC) */
    const publishedAfter = todayStr + 'T00:00:00Z';

    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('channelId', BNN_CHANNEL_ID);
    searchUrl.searchParams.set('q', 'Market Call');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('publishedAfter', publishedAfter);
    searchUrl.searchParams.set('order', 'date');
    searchUrl.searchParams.set('maxResults', '5');
    searchUrl.searchParams.set('key', youtubeKey);

    const searchRes = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!searchRes.ok) {
      const errBody = await searchRes.json().catch(() => ({}));
      const detail = errBody.error?.message || searchRes.statusText;
      if (searchRes.status === 403 || searchRes.status === 401) {
        return res.status(401).json({
          error: `YouTube API key was rejected: ${detail}. Check your key in Settings.`,
        });
      }
      return res.status(502).json({
        error: `YouTube search failed: ${detail}`,
      });
    }

    const searchData = await searchRes.json();
    const videos = searchData.items || [];

    /* Filter for MarketCall episodes specifically */
    const marketCallVideo = videos.find((v) => {
      const title = (v.snippet?.title || '').toLowerCase();
      return title.includes('market call') || title.includes('marketcall');
    });

    if (!marketCallVideo) {
      return res.status(200).json({
        error: 'no_episode',
        message: "No MarketCall episode found for today. The show airs weekdays only — check back on a trading day.",
      });
    }

    const videoId = marketCallVideo.id?.videoId;
    const videoTitle = marketCallVideo.snippet?.title || '';

    if (!videoId) {
      return res.status(200).json({
        error: 'no_episode',
        message: 'Could not extract video ID from search results.',
      });
    }

    /* ──────────────────────────────────────────
       Step 2: Fetch auto-generated transcript
       ────────────────────────────────────────── */
    const transcript = await fetchTranscript(videoId);

    if (!transcript || transcript.length < 100) {
      return res.status(200).json({
        error: 'no_transcript',
        message: "Today's episode was found but the transcript isn't available yet. YouTube auto-captions can take 1-2 hours after upload. Try again later.",
        videoId,
        videoTitle,
      });
    }

    /* ──────────────────────────────────────────
       Step 3: Clean transcript
       ────────────────────────────────────────── */
    const cleanedTranscript = cleanRawTranscript(transcript);

    if (cleanedTranscript.length < 200) {
      return res.status(200).json({
        error: 'no_transcript',
        message: 'Transcript is too short — captions may still be processing. Try again later.',
        videoId,
        videoTitle,
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

async function fetchTranscript(videoId) {
  try {
    /* First, fetch the video page to extract the captions track URL */
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
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
      /* The match may include trailing content — find the balanced JSON */
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

    /* Fetch the transcript XML */
    const captionUrl = track.baseUrl + '&fmt=json3';
    const captionRes = await fetch(captionUrl, {
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
 * Fallback: hit timedtext endpoint directly
 */
async function fetchTimedText(videoId) {
  const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    /* Try XML format */
    const xmlUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr`;
    const xmlRes = await fetch(xmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!xmlRes.ok) return '';

    const xmlText = await xmlRes.text();
    /* Parse XML transcript: <text start="1.23" dur="2.34">caption text</text> */
    const textMatches = xmlText.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
    if (!textMatches) return '';

    return textMatches
      .map((m) => m.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join(' ');
  }

  const data = await res.json();
  const events = data?.events || [];

  return events
    .filter((e) => e.segs)
    .map((e) => e.segs.map((s) => s.utf8 || '').join(''))
    .filter((t) => t.trim())
    .join(' ');
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
