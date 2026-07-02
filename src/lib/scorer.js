/**
 * Send the constructed prompt to the LLM via the Vercel proxy.
 * Returns the parsed scorecard JSON object.
 */
export async function scoreWithLLM(systemPrompt, userPrompt, llmKey, provider) {
  const response = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      llmKey,
      provider,
      systemPrompt,
      userPrompt,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Scoring failed (${response.status})`);
  }

  const data = await response.json();
  return data.result;
}
