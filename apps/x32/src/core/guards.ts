// The loop guards (docs/x32-spec.md, "Loop guards"), checked on the desk as a plan would leave it. A plan is refused if
// it makes a loop that wasn't there before, so a loop made by hand doesn't block every other change.
//
// 1. A device's return is never sent to its own feed: the bus with the same name, or a shared bus while that device
//    is its live target.
// 2. An FX return is never sent to the bus that feeds its own FX slot.
// 3. A send effect (a slot fed by a bus something is sent to) is never retyped or used as an insert.

import type { DeskValue } from "./cache";
import { sameName } from "./names";
import { insertSlot } from "./enums";
import { busName, deriveRig, stripLabel, type Lookup, type Rig, type Source } from "./rig";
import { liveTarget, type SharedBus } from "./shared";

export interface Proposed {
  param: { address: string };
  value: DeskValue;
}

// The desk as it would be after the writes.
export function overlay(get: Lookup, writes: Proposed[]): Lookup {
  const after = new Map(writes.map((w) => [w.param.address, w.value]));
  return (a) => (after.has(a) ? after.get(a) : get(a));
}

const sendsTo = (s: Source, buses: number[]) => s.sends.some((x) => buses.includes(x.bus));
const returnOf = (rig: Rig, device: string) => rig.sources.find((s) => s.kind !== "fxrtn" && sameName(s.name, device));

function ownFeedLoops(rig: Rig): string[] {
  return rig.destinations.flatMap((d) => {
    const back = d.deviceReturn;
    return back && sendsTo(back, d.numbers) ? [`${back.name} (${stripLabel(back)}) would be sent to its own feed, ${d.name}`] : [];
  });
}

function sharedLoops(rig: Rig, get: Lookup, shared: SharedBus[]): string[] {
  return shared.flatMap((sb) => {
    const live = liveTarget(get, sb);
    const back = live ? returnOf(rig, live) : undefined;
    return back && sendsTo(back, sb.buses) ? [`${back.name} would be sent to the ${sb.name} bus while it goes to the ${live}`] : [];
  });
}

// FX returns come back on FX rtn 2n-1 and 2n for slot n.
const slotOfReturn = (n: number) => Math.ceil(n / 2);

function fxLoops(rig: Rig): string[] {
  return rig.sources.filter((s) => s.kind === "fxrtn").flatMap((s) => {
    const slot = rig.fx.find((f) => f.slot === slotOfReturn(s.numbers[0]!));
    return slot && sendsTo(s, slot.sourceBuses) ? [`${s.name} would be sent back into FX ${slot.slot}, which it returns`] : [];
  });
}

const FX_TYPE = /^\/fx\/(\d)\/type$/;
const INSERT_SEL = /^\/ch\/\d\d\/insert\/sel$/;

// The FX slots the writes retype or insert, by slot number.
function slotsTouched(writes: Proposed[]): number[] {
  return writes.flatMap((w) => {
    const typed = FX_TYPE.exec(w.param.address);
    if (typed) return [Number(typed[1])];
    const sel = INSERT_SEL.test(w.param.address) && typeof w.value === "number" ? insertSlot(w.value) : null;
    return sel ? [sel] : [];
  });
}

// Guard 3: send effects the writes would retype or insert, as reasons.
export function sendEffectsTouched(get: Lookup, writes: Proposed[]): string[] {
  const rig = deriveRig(get);
  const sends = new Set(rig.fx.filter((f) => f.role === "send").map((f) => f.slot));
  return [...new Set(slotsTouched(writes))].filter((slot) => sends.has(slot)).map((slot) => {
    const fed = rig.fx.find((f) => f.slot === slot)!.sourceBuses.map((b) => busName(rig, b));
    return `FX ${slot} is a send effect (fed by ${[...new Set(fed)].join("/")}), so its type and use stay as they are; to free it, stop its bus feed in X32-Edit`;
  });
}

export function loops(get: Lookup, shared: SharedBus[]): string[] {
  const rig = deriveRig(get);
  return [...ownFeedLoops(rig), ...sharedLoops(rig, get, shared), ...fxLoops(rig)];
}

// Loops the writes would make that the desk doesn't have now.
export function newLoops(get: Lookup, writes: Proposed[], shared: SharedBus[]): string[] {
  const before = new Set(loops(get, shared));
  return loops(overlay(get, writes), shared).filter((l) => !before.has(l));
}
