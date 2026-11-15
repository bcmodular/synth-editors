// The help for one effect, shown by the (i) on its module: what it does, a line for each of its six parameters and
// tips. The words are ours; the facts come from the SP-404MK2 Reference Manual (v5.50, "MFX List", pp. 143–157) and
// the tips draw on NearTao's unofficial SP-404 mk2 Guide (0.36).

export interface FxHelp {
  summary: string; // what the effect does, in one or two sentences
  params: Readonly<Record<string, string>>; // keyed by the parameter's `key` in core/effects.ts: what it does
  notes: readonly string[]; // tips: what it's good for, sweet spots, things to watch for
}
