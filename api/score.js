export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { llmKey, provider, systemPrompt, userPrompt } = req.body || {};

  if (!llmKey || !provider || !systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const MAX_RETRIES = 1;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const rawText = await callLLM(provider, llmKey, systemPrompt, userPrompt);
      const parsed = extractJSON(rawText);

      if (!parsed) {
        if (attempt < MAX_RETRIES) continue;
        return res.status(422).json({
          error:
            'AI returned an unparseable response. Try again or switch providers.',
        });
      }

      /* Validate critical fields */
      if (
        typeof parsed.score !== 'number' ||
        !parsed.ticker ||
        !parsed.signal
      ) {
        if (attempt < MAX_RETRIES) continue;
        return res.status(422).json({
          error: 'AI response missing required fields. Try again.',
        });
      }

      return res.status(200).json({ result: parsed });
    } catch (error) {
      if (attempt < MAX_RETRIES && !isAuthError(error)) continue;

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
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      max_tokens: 1024,
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
  return data.content?.[0]?.text || '';
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
  return data.choices?.[0]?.message?.content || '';
}

/* ────────────────────────────────────────────
   JSON extraction — handles markdown fences,
   preamble text, and raw JSON
   ──────────────────────────────────────────── */

function extractJSON(text) {
  // Strip markdown fences first
  const stripped = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('No valid JSON found');
  }
}
