/**
 * Send the constructed prompt to the LLM via the Vercel proxy.
 * Returns the merged scorecard (math score + LLM narrative).
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} llmKey
 * @param {string} provider
 * @param {Object} mathScore - { ticker, score, grade, signal, breakdown, hasAlphaVantage }
 */
export async function scoreWithLLM(systemPrompt, userPrompt, llmKey, provider, mathScore) {
  const response = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      llmKey,
      provider,
      systemPrompt,
      userPrompt,
      mathScore,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Scoring failed (${response.status})`);
  }

  const data = await response.json();
  return data.result;
}
