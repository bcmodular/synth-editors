// Pad mixer model: app-side mute, mix scenes and recall safe. The serial codec turns the changes into frames.

export type Routing = 0 | 1 | 2; // DRY, BUS 1, BUS 2

// The values the SP-404 holds for a pad, as sent over serial.
export interface PadMix {
  level: number; // 0–127
  pan: number; // 14–114 (L50–R50), centre 64
  routing: Routing;
  muteGroup: number; // 0 = none, 1–10 = A–J
  attack: number;
  hold: number;
  release: number;
}
export type MixField = keyof PadMix;
export const MIX_FIELDS: readonly MixField[] = ["level", "pan", "routing", "muteGroup", "attack", "hold", "release"];

// A pad as the app sees it. The SP-404 has no pad mute over serial, so a muted pad is sent level 0 and
// `mix.level` keeps the level to go back to.
export interface MixerPad {
  pad: number; // 0-based: bank × 16 + pad
  name: string;
  mix: PadMix;
  muted: boolean;
}

export const deviceMix = (p: MixerPad): PadMix => (p.muted ? { ...p.mix, level: 0 } : p.mix);

export const toggleMute = (p: MixerPad): MixerPad => ({ ...p, muted: !p.muted });

export interface MixChange {
  pad: number;
  field: MixField;
  value: number;
}

// What to send to take the device from `before` to `after` for one pad.
export function padChanges(before: MixerPad, after: MixerPad): MixChange[] {
  const from = deviceMix(before);
  const to = deviceMix(after);
  return MIX_FIELDS.filter((f) => from[f] !== to[f]).map((field) => ({ pad: after.pad, field, value: to[field] }));
}

// ---- mix scenes

export const MIX_SCENE_COUNT = 16;

// The pads loaded when the scene was stored, keyed by pad number.
export type MixScene = Record<number, { mix: PadMix; muted: boolean }>;

export function storeMixScene(pads: readonly MixerPad[]): MixScene {
  return Object.fromEntries(pads.map((p) => [p.pad, { mix: { ...p.mix }, muted: p.muted }]));
}

// Value types a scene recall can be told to leave alone.
export type SafeType = "level" | "pan" | "routing" | "mute" | "muteGroup" | "ahr";
const SAFE_FIELDS: Record<Exclude<SafeType, "mute">, readonly MixField[]> = {
  level: ["level"],
  pan: ["pan"],
  routing: ["routing"],
  muteGroup: ["muteGroup"],
  ahr: ["attack", "hold", "release"],
};

function recallPad(pad: MixerPad, stored: MixScene[number], safe: ReadonlySet<SafeType>): MixerPad {
  const mix = { ...stored.mix };
  for (const [type, fields] of Object.entries(SAFE_FIELDS)) {
    if (safe.has(type as SafeType)) for (const f of fields) mix[f] = pad.mix[f] as never;
  }
  return { ...pad, mix, muted: safe.has("mute") ? pad.muted : stored.muted };
}

// Pads in the scene that are loaded now take the scene's values (apart from the safe types). Loaded pads
// that aren't in the scene are left alone, and scene pads that aren't loaded any more are skipped.
export function recallMixScene(
  pads: readonly MixerPad[], scene: MixScene, safe: ReadonlySet<SafeType> = new Set(),
): { pads: MixerPad[]; changes: MixChange[] } {
  const out = pads.map((p) => {
    const stored = scene[p.pad];
    return stored ? recallPad(p, stored, safe) : p;
  });
  return { pads: out, changes: out.flatMap((p, i) => padChanges(pads[i] ?? p, p)) };
}
