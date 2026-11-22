// Matching names from the desk: case-insensitive, whitespace trimmed.

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const SIDE = /\s+(l|r|left|right)$/i;

// The name of a linked pair, or null when its sides don't match. "USB L" and "USB R" (the factory names of aux 7-8)
// are one pair, "USB".
export function pairName(a: string, b: string): string | null {
  if (sameName(a, b)) return a;
  const base = a.replace(SIDE, "");
  return SIDE.test(a) && SIDE.test(b) && sameName(base, b.replace(SIDE, "")) ? base : null;
}
