// The internal waves sorted into instrument categories for the wave library. The manual's list (pp.182–183) has no
// categories, but it keeps instruments together, so each category is a set of ranges of panel numbers (1-based).

import { waveCount, waveName, WAVE_GROUPS, type WaveGroup } from "./waves";

type Ranges = readonly (readonly [first: number, last: number])[];

interface CategoryDef {
  name: string;
  "INT-A"?: Ranges;
  "INT-B"?: Ranges;
}

const CATEGORIES: readonly CategoryDef[] = [
  { name: "Piano", "INT-A": [[1, 14]] },
  { name: "E.Piano & Clav", "INT-A": [[15, 35], [38, 40]] },
  { name: "Organ", "INT-A": [[41, 51]] },
  { name: "Guitar", "INT-A": [[52, 104]] },
  { name: "Plucked & ethnic", "INT-A": [[105, 122]] },
  { name: "Bass", "INT-A": [[123, 155]] },
  { name: "Woodwind", "INT-A": [[156, 183]] },
  { name: "Brass", "INT-A": [[184, 201]] },
  { name: "Strings", "INT-A": [[202, 218]] },
  { name: "Synth", "INT-A": [[219, 235]], "INT-B": [[18, 19], [22, 25]] },
  { name: "Voice", "INT-A": [[236, 255]] },
  { name: "Bell & Mallet", "INT-A": [[36, 37]], "INT-B": [[1, 17], [20, 21], [58, 59]] },
  { name: "Basic waves", "INT-B": [[26, 46], [183, 190], [193, 193]] },
  { name: "Drums", "INT-B": [[67, 102], [131, 143], [145, 161]] },
  { name: "Percussion", "INT-B": [[103, 123], [129, 130], [144, 144], [162, 170]] },
  { name: "Hits & scratches", "INT-B": [[60, 66], [125, 128]] },
  { name: "Noise & FX", "INT-B": [[47, 57], [124, 124], [178, 182], [191, 192]] },
  { name: "Loops", "INT-B": [[171, 177]] },
];

export const WAVE_CATEGORIES: readonly string[] = CATEGORIES.map((c) => c.name);

export interface WaveEntry {
  group: WaveGroup;
  number: number; // raw Wave Number, 0-based
  name: string;
  category: string;
  reversed: boolean; // the "REV" waves: drums and hits played backwards
}

const inRanges = (ranges: Ranges | undefined, n: number) => (ranges ?? []).some(([a, b]) => n >= a && n <= b);

// Every category whose ranges hold a wave (one, if the ranges don't overlap).
export function categoriesOf(group: WaveGroup, number: number): string[] {
  return CATEGORIES.filter((c) => inRanges(c[group], number + 1)).map((c) => c.name);
}

export function waveCategory(group: WaveGroup, number: number): string | undefined {
  return categoriesOf(group, number)[0];
}

// Every internal wave, INT-A then INT-B, with its category.
export const ALL_WAVES: readonly WaveEntry[] = WAVE_GROUPS.flatMap((group) =>
  Array.from({ length: waveCount(group) }, (_, number) => {
    const name = waveName(group, number) ?? "";
    return { group, number, name, category: waveCategory(group, number) ?? "?", reversed: name.startsWith("REV ") };
  }),
);

// The waves in a category (or all of them) whose name contains every word of the query, ignoring case and spaces
// inside words ("ac piano" finds "Ac Piano1 A"; "rhodes" finds "SA Rhodes 2B").
export function findWaves(query: string, category?: string): WaveEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const squash = (s: string) => s.toLowerCase().replace(/[\s.]/g, "");
  return ALL_WAVES.filter((w) =>
    (!category || w.category === category) && words.every((word) => squash(w.name).includes(squash(word))));
}
