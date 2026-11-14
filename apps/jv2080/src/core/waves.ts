// Wave selection: Tone offsets 1 (Wave Group Type), 2 (Wave Group ID) and 3–4 (Wave Number, nibbled).
// Type 0 = INT; ID 1 = INT-A, 2 = INT-B (found on the JV, not in the manual). Type 2 = EXP boards (none fitted).

import { INT_A_WAVES, INT_B_WAVES } from "./waveNames";

export type WaveGroup = "INT-A" | "INT-B";

export const WAVE_GROUPS: readonly WaveGroup[] = ["INT-A", "INT-B"];

const GROUP_BYTES: Record<WaveGroup, readonly [type: number, id: number]> = {
  "INT-A": [0, 1],
  "INT-B": [0, 2],
};

const NAMES: Record<WaveGroup, readonly string[]> = { "INT-A": INT_A_WAVES, "INT-B": INT_B_WAVES };

// The raw Wave Group Type and ID bytes for a group.
export const waveGroupBytes = (group: WaveGroup) => GROUP_BYTES[group];

// The group a tone's type and ID bytes select, or undefined for anything else (eg. an expansion board).
export function waveGroupOf(type: number, id: number): WaveGroup | undefined {
  return WAVE_GROUPS.find((g) => GROUP_BYTES[g][0] === type && GROUP_BYTES[g][1] === id);
}

export const waveCount = (group: WaveGroup) => NAMES[group].length;

export function waveName(group: WaveGroup, number: number): string | undefined {
  return NAMES[group][number];
}

// Panel style, eg. "INT-A 001 Ac Piano1 A". Waves from other groups show their raw bytes.
export function waveLabel(type: number, id: number, number: number): string {
  const group = waveGroupOf(type, id);
  const no = String(number + 1).padStart(3, "0");
  if (!group) return `group ${type}/${id} ${no}`;
  return `${group} ${no} ${waveName(group, number) ?? "?"}`;
}
