/* ════════════════════════════════════════════════════════════════
   _score.dormant.js — RogueCFA Ticker Scoring Engine (DORMANT)
   Saved copy of original scoring engine. To re-enable scoring,
   copy this file back to /api/score.js and restore UI buttons.
   ════════════════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { llmKey: bodyKey, provider: bodyProvider, systemPrompt, userPrompt, mathScore } = req.body || {};
  let provider, llmKey;
  if (bodyKey && bodyKey.trim()) {
    llmKey = bodyKey.trim();
    provider = bodyProvider || 'gemini';
  } else {
    provider = process.env.CRON_LLM_PROVIDER || process.env.LLM_PROVIDER || 'claude';
    llmKey = provider === 'groq'
      ? (process.env.CRON_GROQ_KEY || process.env.CRON_LLM_KEY || process.env.LLM_KEY)
      : (process.env.CRON_LLM_KEY || process.env.LLM_KEY || process.env.OPENAI_API_KEY);
  }

  if (!llmKey || !provider || !systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'Missing required fields or LLM key.' });
  }

  try {
    const rawText = await callLLM(provider, llmKey, systemPrompt, userPrompt);
    const narrative = extractJSON(rawText);

    if (!narrative) {
      return res.status(422).json({
        error: 'AI returned an unparseable response. Try again or switch providers.',
      });
    }

    if (mathScore?.isComparison) {
      return res.status(200).json({
        result: {
          winner: narrative.winner || '',
          comparative_summary: narrative.comparative_summary || '',
          key_tradeoffs: Array.isArray(narrative.key_tradeoffs) ? narrative.key_tradeoffs : [],
        },
      });
    }

    /* Merge: math engine owns the score, LLM owns the narrative */
    const result = {
      /* Math-layer fields (authoritative — included if mathScore passed) */
      ...(mathScore
        ? {
            ticker: mathScore.ticker || narrative.ticker || '',
            score: mathScore.score ?? 0,
            grade: mathScore.grade || 'C',
            signal: mathScore.signal || 'WATCH',
            score_breakdown: mathScore.breakdown || {},
            coverageDepth: mathScore.coverageDepth ?? null,
            coverageModifier: mathScore.coverageModifier ?? 1.0,
            hasAlphaVantage: mathScore.hasAlphaVantage || false,
          }
        : {}),

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
        error: `[DIAGNOSTIC: Your ${label} API Key was rejected (HTTP ${error.status || 401}).] REMEDIATION: Open Settings (gear icon at top right) and verify that your ${label} key is valid, active, and has sufficient billing credits enabled.`,
      });
    }
    if (error.status === 429) {
      return res.status(429).json({
        error: `[DIAGNOSTIC: ${provider.toUpperCase()} Rate Limit Exceeded (HTTP 429).] REMEDIATION: You have exceeded the requests-per-minute threshold on your ${provider} API tier. Please wait 30-60 seconds before scoring another ticker, or switch providers in Settings.`,
      });
    }
    return res.status(500).json({
      error: `[DIAGNOSTIC: AI Scoring Engine Failure — ${error.message || 'Unknown internal error'}] REMEDIATION: Verify your LLM API Key in Settings or check if the target ticker has sufficient market data for evaluation.`,
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
  const models = [
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
    });

    if (response.ok) {
      const data = await response.json();
      return extractTextFromResponse(data);
    }

    const errBody = await response.json().catch(() => ({}));
    const detail = errBody.error?.message || response.statusText || response.status;
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
   JSON extraction & self-healing repair — handles
   markdown fences, preamble text, unescaped quotes,
   trailing commas, and raw JSON
   ──────────────────────────────────────────── */

function repairJSON(str) {
  if (!str) return str;
  let cleaned = str;

  /* 1. Remove trailing commas before closing braces/brackets */
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  /* 2. Replace unescaped control characters (newlines/tabs) */
  cleaned = cleaned.replace(/[\u0000-\u001F]+/g, (ch) => {
    if (ch === '\n' || ch === '\r\n') return '\\n';
    if (ch === '\t') return '\\t';
    return '';
  });

  /* 3. Fix missing or unquoted string values e.g. "company": AeroVironm" -> "company": "AeroVironm" */
  let unquotedFixed = cleaned.replace(/:\s*(?!(?:true|false|null|-?\d+(?:\.\d+)?)\b)([A-Za-z][^,\{\}\[\]"\r\n]*?)(?=\s*[,}\]\n])/g, ': "$1"');
  cleaned = unquotedFixed.replace(/:\s*([A-Za-z0-9_\-\. ]+)"/g, ': "$1"');

  /* 4. State machine to fix unescaped double quotes inside string literals */
  let inString = false;
  let escaped = false;
  let res = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) {
        res += ch;
        escaped = false;
      } else if (ch === '\\') {
        res += ch;
        escaped = true;
      } else if (ch === '"') {
        let nextChar = '';
        for (let j = i + 1; j < cleaned.length; j++) {
          const c = cleaned[j];
          if (!/\s/.test(c)) {
            nextChar = c;
            break;
          }
        }
        if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
          inString = false;
          res += ch;
        } else {
          res += "'";
        }
      } else {
        res += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
      }
      res += ch;
    }
  }

  return res;
}

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
      } catch {
        try {
          const repaired = repairJSON(match[0]);
          return JSON.parse(repaired);
        } catch (err) {
          throw new Error(`JSON malformed (${err.message}): "${match[0].slice(0, 80)}..."`);
        }
      }
    }
    throw new Error(`No JSON found in response: "${text.slice(0, 80)}..."`);
  }
}
