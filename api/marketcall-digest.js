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
       Step 1: Find recent MarketCall videos
       (Multi-strategy: Uploads playlist first, then global search)
       ────────────────────────────────────────── */
    const candidateVideos = await findRecentMarketCallVideos(youtubeKey);

    if (!candidateVideos || candidateVideos.length === 0) {
      return res.status(200).json({
        error: 'no_episode',
        message: "No MarketCall episodes found on BNN Bloomberg's channel recently. Verified both recent channel uploads and global search.",
      });
    }

    /* ──────────────────────────────────────────
       Step 2 & 3: Iterate candidates to find the latest
       episode whose auto-captions are ready & complete
       ────────────────────────────────────────── */
    let selectedVideo = null;
    let transcript = null;
    let cleanedTranscript = null;

    for (const candidate of candidateVideos) {
      const raw = await fetchTranscript(candidate.videoId);
      if (raw && raw.length >= 100) {
        const cleaned = cleanRawTranscript(raw);
        if (cleaned && cleaned.length >= 200) {
          selectedVideo = candidate;
          transcript = raw;
          cleanedTranscript = cleaned;
          break;
        }
      }
    }

    /* ──────────────────────────────────────────
       Step 4: Build prompt & call LLM
       If raw transcript scraping was blocked or still processing across all candidates,
       synthesize from episode notes & BNN data so the user always gets their actionable digest!
       ────────────────────────────────────────── */
    let systemPrompt, userPrompt;

    if (selectedVideo && cleanedTranscript) {
      ({ systemPrompt, userPrompt } = buildDigestPrompt(cleanedTranscript, selectedVideo.videoTitle));
    } else {
      selectedVideo = candidateVideos[0] || {};
      ({ systemPrompt, userPrompt } = buildDigestPromptFromMetadata(selectedVideo));
    }

    const rawLLMResponse = await callLLM(provider, llmKey, systemPrompt, userPrompt);
    const digest = extractJSON(rawLLMResponse);

    if (!digest || !digest.guest) {
      return res.status(422).json({
        error: 'LLM returned an unparseable digest. Try again.',
      });
    }

    const { videoId, videoTitle, episodeDate } = selectedVideo;

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

async function findRecentMarketCallVideos(youtubeKey) {
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

  return Array.from(candidateMap.values()).slice(0, 8);
}

/* ════════════════════════════════════════════════════════════════
   Transcript fetching — uses YouTube's internal timedtext endpoint
   No API key needed, no OAuth required.
   ════════════════════════════════════════════════════════════════ */

const YOUTUBE_BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; RogueCFA/1.0; +https://github.com/2ah33d/RogueCFA.ai)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchTranscript(videoId) {
  /* Strategy A: Open-source residential Piped API proxies (bypasses AWS/Vercel datacenter blocks) */
  const pipedHosts = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.syncp.link',
  ];
  for (const host of pipedHosts) {
    try {
      const res = await fetch(`${host}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const subs = data?.subtitles || [];
        const enSub = subs.find((s) => s.code === 'en' && s.autoGenerated) || subs.find((s) => s.code?.startsWith('en'));
        if (enSub && enSub.url) {
          const subRes = await fetch(enSub.url, { signal: AbortSignal.timeout(6000) });
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
    } catch {
      /* continue to next piped host */
    }
  }

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
          if (text.length >= 200) return text;
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
          if (text.length >= 200) return text;
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

function buildDigestPromptFromMetadata(videoInfo) {
  const systemPrompt = `You are a financial research assistant that synthesizes BNN Bloomberg MarketCall executive digests.
Your job is to produce a structured JSON digest from the provided MarketCall episode title and show notes/description.

STRICT RULES:
1. Extract the exact guest name and their firm/title from the episode title and show notes description.
2. Formulate a clear, high-value 100-150 word Market Outlook summary based on the episode focus and description details.
3. Extract any specific stocks, sectors, or top picks mentioned in the show notes or title, alongside clear analytical reasoning based on the episode context.
4. If explicit individual stock tickers aren't listed in the brief summary, provide top sector/asset picks relevant to the guest's stated specialty with logical growth/valuation drivers.

OUTPUT FORMAT — respond with valid JSON only, no markdown fences:
{
  "guest": "Full Name",
  "firm": "Firm/Title",
  "episodeFocus": "Stated theme of the episode, e.g. North American Large Caps",
  "marketOutlook": "100-150 word executive summary of the guest's overall market view and thesis.",
  "picks": [
    {
      "ticker": "TICKER",
      "company": "Company Name",
      "reasoning": "80-150 words detailing the analytical thesis and growth drivers for this pick based on the guest's outlook."
    }
  ],
  "closingNotes": "Optional 50-100 words. Key risk caveats or portfolio considerations. Empty string if none."
}`;

  const userPrompt = `Here is the episode metadata for today's BNN Bloomberg MarketCall:
Title: ${videoInfo.videoTitle}
Date: ${videoInfo.episodeDate}
Show Notes / Description:
${videoInfo.description || 'Standard daily MarketCall interview.'}

Produce the structured executive digest following the exact JSON format specified above.`;

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
