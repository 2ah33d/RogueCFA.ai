export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { llmKey, provider, systemPrompt, userPrompt, mathScore } = req.body || {};

  if (!llmKey || !provider || !systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const rawText = await callLLM(provider, llmKey, systemPrompt, userPrompt);
    const narrative = extractJSON(rawText);

    if (!narrative) {
      return res.status(422).json({
        error: 'AI returned an unparseable response. Try again or switch providers.',
      });
    }

    /* Merge: math engine owns the score, LLM owns the narrative */
    const result = {
      /* Math-layer fields (authoritative — never overridden by LLM) */
      ticker: mathScore?.ticker || narrative.ticker || '',
      score: mathScore?.score ?? 0,
      grade: mathScore?.grade || 'C',
      signal: mathScore?.signal || 'WATCH',
      score_breakdown: mathScore?.breakdown || {},
      hasAlphaVantage: mathScore?.hasAlphaVantage || false,

      /* LLM narrative fields */
      thesis: narrative.thesis || '',
      sentiment_summary: narrative.sentiment_summary || '',
      timeframe_verdict: narrative.timeframe_verdict || '',
      key_risks: Array.isArray(narrative.key_risks) ? narrative.key_risks : [],
      key_catalysts: Array.isArray(narrative.key_catalysts) ? narrative.key_catalysts : [],
      watch_for: narrative.watch_for || '',

      /* Legacy compat — keep analyst_consensus if LLM returns it */
      analyst_consensus: narrative.analyst_consensus || null,
    };

    return res.status(200).json({ result });
  } catch (error) {
    if (isAuthError(error)) {
      const label =
        provider === 'gemini'
          ? 'Gemini'
          : provider === 'claude'
            ? 'Claude'
            : 'OpenAI';
      return res.status(401).json({
        error: `Your ${label} key was rejected. Check it in Settings.`,
      });
    }
    if (error.status === 429) {
      return res.status(429).json({
        error: `${provider} rate limit reached. Wait a moment and retry.`,
      });
    }
    return res.status(500).json({
      error: `Scoring failed: ${error.message}`,
    });
  }
}

/* ────────────────────────────────────────────
   Provider routing
   ──────────────────────────────────────────── */

function isAuthError(err) {
  return err.status === 401 || err.status === 403;
}

async function callLLM(provider, key, systemPrompt, userPrompt) {
  switch (provider) {
    case 'gemini':
      return callGemini(key, systemPrompt, userPrompt);
    case 'claude':
      return callClaude(key, systemPrompt, userPrompt);
    case 'openai':
      return callOpenAI(key, systemPrompt, userPrompt);
    default:
      throw Object.assign(new Error(`Unknown provider: ${provider}`), {
        status: 400,
      });
  }
}

/* ── Gemini ── */
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
    const detail = errBody.error?.message || response.statusText || response.status;
    throw Object.assign(
      new Error(`Gemini API error: ${detail}`),
      { status: response.status }
    );
  }

  const data = await response.json();
  return extractTextFromResponse(data);
}

/* ── Shared response text extractor ── */
function extractTextFromResponse(data) {
  if (!data) return '';

  let text = '';
  if (Array.isArray(data.content)) {
    const textBlock = data.content.find((b) => b.type === 'text' || typeof b.text === 'string');
    text = textBlock?.text || '';
  }
  if (!text && Array.isArray(data.choices)) {
    text = data.choices[0]?.message?.content || '';
  }
  if (!text && Array.isArray(data.candidates)) {
    const parts = data.candidates[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const textPart = parts.find((p) => typeof p.text === 'string');
      text = textPart?.text || '';
    }
  }

  if (!text) {
    throw new Error(
      `AI returned no final text. Response shape: "${JSON.stringify(data).slice(0, 120)}..."`
    );
  }
  return text;
}

/* ── Claude ── */
async function callClaude(key, systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const detail = errBody.error?.message || response.statusText || response.status;
    throw Object.assign(
      new Error(`Claude API error: ${detail}`),
      { status: response.status }
    );
  }

  const data = await response.json();
  return extractTextFromResponse(data);
}

/* ── OpenAI ── */
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
    const detail = errBody.error?.message || response.statusText || response.status;
    throw Object.assign(
      new Error(`OpenAI API error: ${detail}`),
      { status: response.status }
    );
  }

  const data = await response.json();
  return extractTextFromResponse(data);
}

/* ────────────────────────────────────────────
   JSON extraction — handles markdown fences,
   preamble text, and raw JSON
   ──────────────────────────────────────────── */

function extractJSON(text) {
  if (!text) throw new Error('AI returned an empty response.');
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
      } catch (err) {
        throw new Error(`JSON malformed (${err.message}): "${match[0].slice(0, 80)}..."`);
      }
    }
    throw new Error(`No JSON found in response: "${text.slice(0, 80)}..."`);
  }
}
