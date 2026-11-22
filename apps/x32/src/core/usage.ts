// What the chat has cost, from the token counts. Prices per million tokens; only for models listed, since the key has
// $5 of credit and the panel shows the running total (docs/x32-spec.md, "Cost with $5").

import type { Usage } from "./agent";

const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};
const CACHE_READ = 0.1; // of the input price
const CACHE_WRITE = 1.25;

export const ZERO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite,
});

// Dollars, or null for a model without a price here.
export function costOf(u: Usage, model: string): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const input = u.input + u.cacheRead * CACHE_READ + u.cacheWrite * CACHE_WRITE;
  return (input * p.input + u.output * p.output) / 1_000_000;
}

export function usageText(u: Usage, model: string): string {
  const tokens = u.input + u.output + u.cacheRead + u.cacheWrite;
  const cost = costOf(u, model);
  return `${tokens.toLocaleString("en")} tokens${cost === null ? "" : `, about $${cost.toFixed(4)}`}`;
}
