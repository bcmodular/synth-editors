// Effects and inserts (docs/x32-spec.md, phase 5): put an effect on a channel as an insert, take it off, change an
// effect's parameters or a free slot's type. Same rules as the send plans: worked out from the desk, checked by the
// guards (guard 3 keeps send effects as they are), inserts and type changes confirmed first.

import { FX_SEND_SLOTS, fx, insert, strip } from "./addresses";
import {
  BadValue, canInsert, effectAt, EFFECTS, findParam, fxParam, SYNCED, toDesk, typeCode, typeName, typeValue, type EffectDef,
} from "./effects";
import { change, findSource, guarded, Refused, type Plan, type PlanChange, type PlanContext } from "./planner";
import { deriveRig, type FxSlot, type Rig, type Source } from "./rig";

export interface InsertRequest {
  source: string;
  effect: string; // "DLY", "Stereo Delay"
  params?: Record<string, number | string>; // over the effect's insert defaults
}

export interface FxParamRequest {
  target: string; // "FX 2", "2", a destination fed into a slot ("Reverb"), or a source with an insert ("TD-3-MO")
  param: string;
  value: number | string;
}

export interface FxTypeRequest {
  target: string;
  effect: string;
}

// Steps: a slot's feed off, then its type, then its parameters (the desk resets them on a type change), then inserts.
const FEED = 1;
const TYPE = 2;
const PARAMS = 3;
const INSERT = 4;
const PARAM_TOLERANCE = 0.02; // the desk rounds parameters to its own steps

const POST = 1; // /insert/pos: 0 pre, 1 post
// /insert/sel for a slot's left side (the right side is one more).
const selOf = (slot: number) => 2 * slot - 1;

const typeOf = (ctx: PlanContext, slot: number) => Number(ctx.get(fx(slot).type.address) ?? 0);
const insertedSlot = (rig: Rig, s: Source) => rig.fx.find((f) => f.insertedOn.includes(s.name))?.slot ?? null;

// The slot a request names, by number, destination or inserted source.
function findSlot(rig: Rig, target: string): number {
  const n = /^(?:fx\s*)?([1-8])$/i.exec(target.trim());
  if (n) return Number(n[1]);
  const lower = target.trim().toLowerCase();
  const fed = rig.destinations.find((d) => d.name.toLowerCase() === lower)?.fxSlot;
  if (fed) return fed;
  const source = rig.sources.find((s) => s.name.toLowerCase() === lower);
  const inserted = source ? insertedSlot(rig, source) : null;
  if (inserted) return inserted;
  throw new Refused(`No effect at "${target}". Name an FX slot (FX 1-8), a bus that feeds one (${rig.destinations.filter((d) => d.fxSlot).map((d) => d.name).join(", ")}) or a channel with an insert`);
}

function effectNamed(slot: number, name: string): { value: number; def: EffectDef } {
  const value = typeValue({ slot }, name);
  if (value === null) throw new Refused(`FX ${slot} can't hold "${name}". FX 1-4 take any effect; FX 5-8 only EQs, dynamics and a few others`);
  const def = EFFECTS[typeCode({ slot, value })];
  if (!def) throw new Refused(`The app doesn't know ${typeName({ slot, value })}'s parameters yet; it knows ${Object.keys(EFFECTS).join(", ")}`);
  return { value, def };
}

// Free slots that can hold the effect, best first: not fed from a bus, then fed from a bus nothing is sent to (the
// highest first, so the reverb and delay buses are the last taken).
function freeSlotFor(rig: Rig, name: string): FxSlot {
  const free = rig.fx.filter((f) => f.role === "free" && f.slot <= FX_SEND_SLOTS && typeValue(f, name) !== null);
  const best = [...free].sort((a, b) => a.sourceBuses.length - b.sourceBuses.length || b.slot - a.slot)[0];
  if (!best) throw new Refused(`No free FX slot can hold ${name}: FX 1-4 are all in use as send effects or inserts`);
  return best;
}

function paramChanges(ctx: PlanContext, slot: number, def: EffectDef, values: Record<string, number | string>): PlanChange[] {
  return Object.entries(values).flatMap(([name, v]) => {
    const d = findParam(def, name);
    if (!d) throw new Refused(`${name} isn't a parameter here; it has ${def.params.map((x) => x.name).join(", ")}`);
    try {
      return change(ctx.get, { param: fxParam({ slot }, d), value: toDesk({ def: d, value: v }), what: `FX ${slot} ${d.name} ${v}${d.unit ? ` ${d.unit}` : ""}`, step: PARAMS, tolerance: PARAM_TOLERANCE });
    } catch (e) {
      throw e instanceof BadValue ? new Refused(e.message) : e;
    }
  });
}

const unfeed = (ctx: PlanContext, slot: FxSlot): PlanChange[] =>
  (["l", "r"] as const).flatMap((side) => change(ctx.get, { param: fx(slot.slot).source(side), value: 0, what: `FX ${slot.slot} ${side.toUpperCase()} not fed from a bus`, step: FEED }));

function insertOn(ctx: PlanContext, s: Source, slot: number): PlanChange[] {
  return s.numbers.flatMap((n, i) => {
    const ins = insert(strip("ch", n));
    return [
      ...change(ctx.get, { param: ins.sel, value: selOf(slot) + i, what: `ch ${n} insert ← FX ${slot}${i ? "R" : "L"}`, step: INSERT }),
      ...change(ctx.get, { param: ins.pos, value: POST, what: `ch ${n} insert post-EQ`, step: INSERT }),
      ...change(ctx.get, { param: ins.on, value: 1, what: `ch ${n} insert on`, step: INSERT }),
    ];
  });
}

function channelSource(rig: Rig, name: string): Source {
  const s = findSource(rig, { source: name });
  if (s.kind !== "ch") throw new Refused(`${s.name} isn't on a channel, and only channels have an insert point`);
  return s;
}

export function insertFx(ctx: PlanContext, req: InsertRequest): Plan {
  const rig = deriveRig(ctx.get);
  const source = channelSource(rig, req.source);
  const already = insertedSlot(rig, source);
  if (already) throw new Refused(`${source.name} already has FX ${already} as an insert; take it off first`);
  const slot = freeSlotFor(rig, req.effect);
  const { value, def } = effectNamed(slot.slot, req.effect);
  if (!canInsert(def)) throw new Refused(`${typeName({ slot: slot.slot, value })} has no dry/wet mix, so it can't go in as an insert; send to its bus instead`);
  const changes = [
    ...unfeed(ctx, slot),
    ...change(ctx.get, { param: fx(slot.slot).type, value, what: `FX ${slot.slot} → ${typeName({ slot: slot.slot, value })}`, step: TYPE }),
    ...paramChanges(ctx, slot.slot, def, { ...def.insertDefaults, ...req.params }),
    ...insertOn(ctx, source, slot.slot),
  ];
  const fed = slot.sourceBuses.length ? `; FX ${slot.slot} stops being fed by bus ${slot.sourceBuses.join("-")}` : "";
  const summary = `Put ${typeName({ slot: slot.slot, value })} on ${source.name} as an insert, in FX ${slot.slot}${fed}`;
  return guarded(ctx, { summary, changes, confirm: "It changes an insert and an effect type" });
}

export function removeInsert(ctx: PlanContext, req: { source: string }): Plan {
  const rig = deriveRig(ctx.get);
  const source = channelSource(rig, req.source);
  const slot = insertedSlot(rig, source);
  if (!slot) throw new Refused(`${source.name} has no insert`);
  const off = source.numbers.flatMap((n) => {
    const ins = insert(strip("ch", n));
    return [
      ...change(ctx.get, { param: ins.on, value: 0, what: `ch ${n} insert off`, step: FEED }),
      ...change(ctx.get, { param: ins.sel, value: 0, what: `ch ${n} insert empty`, step: FEED }),
    ];
  });
  const feed = ctx.feeds?.find((f) => f.slot === slot);
  const refeed = feed
    ? (["l", "r"] as const).flatMap((side, i) => change(ctx.get, { param: fx(slot).source(side), value: feed.sourceBuses[i] ?? feed.sourceBuses[0]!, what: `FX ${slot} ${side.toUpperCase()} fed by bus ${feed.sourceBuses[i] ?? feed.sourceBuses[0]}`, step: TYPE }))
    : [];
  const summary = `Take FX ${slot} off ${source.name}${refeed.length ? `, and feed it from bus ${feed!.sourceBuses.join("-")} again` : ""}`;
  return guarded(ctx, { summary, changes: [...off, ...refeed], confirm: "It changes an insert" });
}

export function setFxParam(ctx: PlanContext, req: FxParamRequest): Plan {
  const slot = findSlot(deriveRig(ctx.get), req.target);
  const value = typeOf(ctx, slot);
  const def = effectAt({ slot, value });
  if (!def) throw new Refused(`The app doesn't know ${typeName({ slot, value })}'s parameters yet; it knows ${Object.keys(EFFECTS).join(", ")}`);
  const d = findParam(def, req.param);
  if (SYNCED.has(typeCode({ slot, value })) && d?.name === "Time") {
    throw new Refused(`FX ${slot}'s delay time follows the tempo (the tempo button sets it); change Factor L/R for the note value instead`);
  }
  const changes = paramChanges(ctx, slot, def, { [req.param]: req.value });
  return guarded(ctx, { summary: `Set FX ${slot} (${typeName({ slot, value })}) ${d!.name} to ${req.value}${d!.unit ? ` ${d!.unit}` : ""}`, changes, confirm: null });
}

export function setFxType(ctx: PlanContext, req: FxTypeRequest): Plan {
  const slot = findSlot(deriveRig(ctx.get), req.target);
  const value = typeValue({ slot }, req.effect);
  if (value === null) throw new Refused(`FX ${slot} can't hold "${req.effect}"`);
  const changes = change(ctx.get, { param: fx(slot).type, value, what: `FX ${slot} → ${typeName({ slot, value })}`, step: TYPE });
  return guarded(ctx, { summary: `Change FX ${slot} to ${typeName({ slot, value })}`, changes, confirm: "It changes an effect type" });
}
