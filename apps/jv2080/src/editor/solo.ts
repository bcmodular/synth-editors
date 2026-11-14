// Solo on a synth without one: while any tone is soloed, the JV hears only the soloed tones that are switched on.
// The patch keeps its real tone switches; only what's sent to the JV changes.

export function soloedSwitches(on: readonly boolean[], solo: ReadonlySet<number>): boolean[] {
  return on.map((isOn, tone) => isOn && (solo.size === 0 || solo.has(tone)));
}

// Solo toggles one tone in or out of the set.
export function toggleSolo(solo: ReadonlySet<number>, tone: number): Set<number> {
  const next = new Set(solo);
  if (!next.delete(tone)) next.add(tone);
  return next;
}
