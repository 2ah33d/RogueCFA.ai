/* ════════════════════════════════════════════════════════════════
   digestBuilder.js
   Constructs the summarization prompt for MarketCall transcripts
   and cleans raw YouTube caption segments.
   ════════════════════════════════════════════════════════════════ */

/**
 * Clean raw YouTube transcript segments into a single readable text block.
 * Strips [music], [applause], duplicate overlapping segments, and timestamps.
 *
 * @param {Array<{text: string, offset?: number, duration?: number}>} segments
 * @returns {string} Cleaned transcript text
 */
export function cleanTranscript(segments) {
  if (!segments || !Array.isArray(segments)) return '';

  const seen = new Set();
  const lines = [];

  for (const seg of segments) {
    if (!seg || typeof seg.text !== 'string') continue;

    let text = seg.text
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
      .replace(/\n/g, ' ')
      .trim();

    if (!text || text.length < 2) continue;

    /* Deduplicate overlapping caption chunks */
    const key = text.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    lines.push(text);
  }

  return lines.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Build the system + user prompt pair for digest summarization.
 * The LLM receives the full transcript and must produce a structured digest.
 *
 * @param {string} transcript - Cleaned transcript text
 * @param {string} videoTitle - YouTube video title (for context)
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildDigestPrompt(transcript, videoTitle = '') {
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
