// Loading an FX preset from the desk's library (docs/x32-spec.md, phase 5): into a slot by number or by the bus that
// feeds it ("Big Concert on the reverb"), or onto a channel as an insert ("Memory Man on the TD-3"). Guard 3 is kept in
// spirit: a send effect only takes a preset of a kind it already is, so the Reverb stays a reverb.

import { FX_SEND_SLOTS, fx } from "./addresses";
import { typeCode, typeName } from "./effects";
import { channelSource, findSlot, insertedSlot, insertOn, unfeed } from "./fxPlanner";
import { sameName } from "./names";
import { guarded, Refused, type Plan, type PlanChange, type PlanContext } from "./planner";
import { canLoadInto, families, sameFamily, type LibPreset } from "./presets";
import { deriveRig, type FxSlot, type Rig } from "./rig";

export interface PresetRequest {
  preset: string; // its name in the library
  target: string; // FX slot, a bus that feeds one, or a channel source (as an insert)
}

const CONFIRM = "It replaces the slot's effect and every setting, and can't be undone from here (load another preset, or a scene)";

function findPreset(ctx: PlanContext, name: string): LibPreset & { index: number } {
  const all = ctx.presets ?? [];
  const exact = all.find((p) => sameName(p.name, name));
  const loose = all.filter((p) => p.name.toLowerCase().includes(name.trim().toLowerCase()));
  const found = exact ?? (loose.length === 1 ? loose[0] : undefined);
  if (!found) throw new Refused(`No preset named "${name}"${loose.length > 1 ? ` (several match: ${loose.map((p) => p.name).join(", ")})` : ""}; find_presets lists them`);
  if (found.index === null) throw new Refused(`"${found.name}" isn't in the desk's FX library`);
  return found as LibPreset & { index: number };
}

const slotRow = (rig: Rig, slot: number): FxSlot => rig.fx.find((f) => f.slot === slot)!;
const currentCode = (row: FxSlot) => ({ code: typeCode({ slot: row.slot, value: row.type }) });

// A send effect stays the kind it is; a slot that can't hold the preset is refused.
function checkSlot(preset: LibPreset, row: FxSlot): void {
  if (!canLoadInto(preset, row.slot)) throw new Refused(`"${preset.name}" (${preset.type}) only loads into FX 1-${FX_SEND_SLOTS}`);
  if (row.role === "send" && !sameFamily(preset, currentCode(row))) {
    throw new Refused(`FX ${row.slot} is a send effect (${typeName({ slot: row.slot, value: row.type })}), so it only takes another ${families(currentCode(row)).join(" or ")} preset; "${preset.name}" is a ${preset.type}`);
  }
}

// The slot's bus feed, written again after the load, so the load can't change where the effect is fed from.
function keepFeed(ctx: PlanContext, row: FxSlot): PlanChange[] {
  if (row.slot > FX_SEND_SLOTS || !row.sourceBuses.length) return [];
  return (["l", "r"] as const).map((side) => {
    const param = fx(row.slot).source(side);
    const value = Number(ctx.get(param.address));
    return { param, value, from: value, what: `FX ${row.slot} ${side.toUpperCase()} still fed by bus ${value}`, step: 1 };
  });
}

// Free slots that can hold it, best first: FX 5-8 for a preset that fits there (they're insert-only), then a slot not
// fed from a bus, then the highest.
function freeSlotFor(rig: Rig, preset: LibPreset): FxSlot {
  const rank = (f: FxSlot) => [f.slot > FX_SEND_SLOTS ? 0 : 1, f.sourceBuses.length, -f.slot];
  const free = rig.fx.filter((f) => f.role === "free" && canLoadInto(preset, f.slot));
  const best = free.sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!;
  })[0];
  if (!best) throw new Refused(`No free FX slot can hold "${preset.name}"`);
  return best;
}

function asInsert(ctx: PlanContext, rig: Rig, preset: LibPreset & { index: number }, sourceName: string): Plan {
  const source = channelSource(rig, sourceName);
  const already = insertedSlot(rig, source);
  if (already) return intoSlot(ctx, rig, preset, already);
  const reverbOnly = families(preset).every((f) => f === "reverb");
  if (reverbOnly && preset.source !== "Insert") throw new Refused(`"${preset.name}" is a send reverb with no dry signal; load it into the Reverb's slot instead`);
  const row = freeSlotFor(rig, preset);
  const fed = row.sourceBuses.length ? `; FX ${row.slot} stops being fed by bus ${row.sourceBuses.join("-")}` : "";
  return guarded(ctx, {
    summary: `Put "${preset.name}" (${preset.type}) on ${source.name} as an insert, in FX ${row.slot}${fed}`,
    changes: [...unfeed(ctx, row), ...insertOn(ctx, source, row.slot)],
    confirm: CONFIRM,
    load: { name: preset.name, index: preset.index, slot: row.slot, code: preset.code },
  });
}

function intoSlot(ctx: PlanContext, rig: Rig, preset: LibPreset & { index: number }, slot: number): Plan {
  const row = slotRow(rig, slot);
  checkSlot(preset, row);
  const what = row.role === "insert" ? ` (the insert on ${row.insertedOn.join(", ")})` : "";
  return guarded(ctx, {
    summary: `Load "${preset.name}" (${preset.type}) into FX ${slot}${what}, replacing ${typeName({ slot, value: row.type })}`,
    changes: keepFeed(ctx, row),
    confirm: CONFIRM,
    load: { name: preset.name, index: preset.index, slot, code: preset.code },
  });
}

export function loadPresetPlan(ctx: PlanContext, req: PresetRequest): Plan {
  const preset = findPreset(ctx, req.preset);
  const rig = deriveRig(ctx.get);
  const isSource = rig.sources.some((s) => s.kind === "ch" && sameName(s.name, req.target));
  return isSource ? asInsert(ctx, rig, preset, req.target) : intoSlot(ctx, rig, preset, findSlot(rig, req.target));
}
