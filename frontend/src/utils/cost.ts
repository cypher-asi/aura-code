const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet": { input: 3, output: 15 },
  "claude-opus": { input: 15, output: 75 },
  "claude-haiku": { input: 0.25, output: 1.25 },
};

/**
 * Estimate cost in USD from token counts.
 * Prices are per million tokens; defaults to Sonnet pricing.
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model?: string,
): number {
  const key = model
    ? Object.keys(PRICING).find((k) => model.toLowerCase().includes(k.split("-")[1]))
    : undefined;
  const { input, output } = PRICING[key ?? "claude-sonnet"];
  return (inputTokens * input + outputTokens * output) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
