import { buildShortlists, buildLLMEyesPrompt, validateLLMEyesResponse } from '../src/lib/goldenGoose.js';
import { supabase } from './_supabaseClient.js';

export default async function handler(req, res) {
  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { windowDays = 7, llmKey: bodyKey, provider: bodyProvider } = req.body || {};

    /* Fetch recent episodes from Supabase digest_jobs */
    const cutoffDate = new Date(Date.now() - (windowDays + 2) * 86_400_000).toISOString().split('T')[0];

    const { data: dbRows, error: dbError } = await supabase
      .from('digest_jobs')
      .select('id, episode_date, video_id, video_title, result')
      .eq('status', 'complete')
      .gte('episode_date', cutoffDate)
      .order('episode_date', { ascending: false });

    if (dbError) {
      console.error('[goldengoose-api] Database query error:', dbError.message);
    }

    const episodes = (dbRows || []).map((row) => ({
      episodeDate: row.episode_date,
      videoId: row.video_id,
      videoTitle: row.video_title,
      guest: row.result?.digest?.guest || 'Guest Analyst',
      picks: row.result?.digest?.picks || row.result?.digest?.top_picks || [],
      callerMentions: row.result?.digest?.callerMentions || row.result?.digest?.caller_mentions || [],
    }));

    /* Layer 1: Build Shortlists */
    const shortlists = buildShortlists(episodes, windowDays);
    const { buyHoldCandidates, sellCandidates } = shortlists;

    /* If both shortlists are empty, exit early ($0 cost) */
    if (buyHoldCandidates.length === 0 && sellCandidates.length === 0) {
      return res.status(200).json({
        result: {
          goldenPicks: [],
          warningSells: [],
          _rejectedTickers: [],
          shortlists,
        },
      });
    }

    /* Layer 2: Build LLM Eyes Prompt */
    const { prompt, allowedTickers } = buildLLMEyesPrompt({ buyHoldCandidates, sellCandidates }, windowDays);

    /* Resolve Key & Provider (Defaults to claude-sonnet-5 / Anthropic API) */
    const provider = bodyProvider || 'claude';
    const apiKey = (bodyKey && bodyKey.trim())
      ? bodyKey.trim()
      : (process.env.ANTHROPIC_API_KEY || process.env.CRON_LLM_KEY || process.env.LLM_KEY);

    if (!apiKey) {
      /* Fallback: Return candidate shortlists if no API key is available */
      return res.status(200).json({
        result: {
          goldenPicks: buyHoldCandidates.map((c) => ({
            ticker: c.ticker,
            rationale: `Deterministic shortlist candidate with ${c.mentionCount} mention(s) across ${c.distinctGuestCount} analyst(s).`,
          })),
          warningSells: sellCandidates.map((c) => ({
            ticker: c.ticker,
            rationale: `Deterministic sell candidate with ${c.mentionCount} sell mention(s).`,
          })),
          _rejectedTickers: [],
          shortlists,
        },
      });
    }

    let rawText = '';

    if (provider === 'claude' || provider === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[goldengoose-api] Claude API error:', response.status, errText);
        throw new Error(`Claude API returned HTTP ${response.status}: ${errText.slice(0, 150)}`);
      }

      const data = await response.json();
      rawText = data.content?.find((block) => block.type === 'text')?.text ?? '{}';
    } else if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    }

    const cleanText = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (err) {
      console.error('[goldengoose-api] Failed to parse LLM eyes response:', err, rawText);
      return res.status(200).json({
        result: {
          goldenPicks: [],
          warningSells: [],
          _rejectedTickers: [],
          _parseError: true,
          shortlists,
        },
      });
    }

    /* Validate LLM response against allowed tickers */
    const validated = validateLLMEyesResponse(parsed, allowedTickers);

    /* Surface _rejectedTickers in response so hallucinated off-list tickers are tracked */
    return res.status(200).json({
      result: {
        ...validated,
        shortlists,
      },
    });
  } catch (err) {
    console.error('[goldengoose-api] Error running LLM eyes:', err);
    return res.status(500).json({ error: `Golden Goose LLM eyes failed: ${err.message}` });
  }
}
