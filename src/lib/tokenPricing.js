/**
 * Token Pricing Utility — Exact LLM API cost calculations per provider.
 * Rates based on current official API pricing ($ per 1M tokens):
 * - Gemini 1.5 Flash: $0.075 / 1M input, $0.30 / 1M output
 * - Claude 3.5 Sonnet: $3.00 / 1M input, $15.00 / 1M output
 * - Groq (Llama 3.3 70B): $0.59 / 1M input, $0.79 / 1M output
 * - OpenAI (GPT-4o-mini): $0.15 / 1M input, $0.60 / 1M output
 */

export const PROVIDER_RATES = {
  gemini: {
    name: 'Gemini 1.5 Flash',
    inputPerM: 0.075,
    outputPerM: 0.30,
  },
  claude: {
    name: 'Claude 3.5 Sonnet',
    inputPerM: 3.00,
    outputPerM: 15.00,
  },
  groq: {
    name: 'Groq (Llama 3.3 70B)',
    inputPerM: 0.59,
    outputPerM: 0.79,
  },
  openai: {
    name: 'GPT-4o mini',
    inputPerM: 0.15,
    outputPerM: 0.60,
  },
};

/**
 * Calculates exact digest generation cost based on LLM provider rates.
 */
export function calculateDigestCost(providerKey = 'gemini', inputTokens = 4850, outputTokens = 420) {
  const key = (providerKey || 'gemini').toLowerCase();
  const rates = PROVIDER_RATES[key] || PROVIDER_RATES.gemini;

  const inputCost = (inputTokens / 1000000) * rates.inputPerM;
  const outputCost = (outputTokens / 1000000) * rates.outputPerM;
  const total = inputCost + outputCost;

  // Format cost cleanly: $0.00045 for Gemini/Groq, $0.0208 for Claude
  let formattedCost;
  if (total < 0.001) {
    formattedCost = `$${total.toFixed(5)}`;
  } else if (total < 0.01) {
    formattedCost = `$${total.toFixed(4)}`;
  } else {
    formattedCost = `$${total.toFixed(4)}`;
  }

  return {
    total,
    formattedCost,
    providerName: rates.name,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
  };
}
