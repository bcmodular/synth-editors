// The rig, worked out from the desk alone (docs/x32-spec.md, "The rig, derived"): sources, destinations, device
// returns, FX slots and their roles, spare channels, and anything odd. No file: rename something in X32-Edit and the
// next derive picks it up.

import { config, fx, FX_SEND_SLOTS, FX_SLOTS, insert, link, send, strip, STRIP_COUNT, tapOf, type Param, type StripKind } from "./addresses";
import type { DeskValue } from "./cache";
import { output } from "./routing";
import { colourName, fxSourceBus, insertSlot, LOCAL_OUTPUTS, outputBus, tapName, type Tap } from "./enums";

export type Lookup = (address: string) => DeskValue | undefined;

// One strip, or a stereo-linked pair shown as one.
export interface RigStrip {
  kind: StripKind;
  numbers: number[];
  name: string; // "" when unnamed
  icon: number;
  colour: string;
}

export interface RigSend {
  bus: number;
  level: number; // 0–1, fader law
  tap: Tap;
}

export interface Source extends RigStrip {
  sends: RigSend[]; // switched on and above −∞, from the pair's first side
}

export interface Destination extends RigStrip {
  outputs: string[]; // "XLR out 1-2"
  fxSlot: number | null; // the FX slot this bus feeds
  deviceReturn: Source | null; // the channel with the same name, where the device comes back
}

export type FxRole = "send" | "insert" | "free";

export interface FxSlot {
  slot: number;
  type: number;
  sourceBuses: number[];
  role: FxRole;
  insertedOn: string[]; // source names
}

export interface Rig {
  sources: Source[];
  destinations: Destination[];
  fx: FxSlot[];
  spare: number[]; // unnamed input channels
  oddities: string[];
}

const KIND_LABEL: Record<StripKind, string> = { ch: "ch", auxin: "aux", fxrtn: "FX rtn", bus: "bus" };
const INPUTS: StripKind[] = ["ch", "auxin", "fxrtn"];
const WITH_INSERTS: StripKind[] = ["ch"]; // aux inputs have no insert point

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const range = (numbers: number[]) => numbers.join("-");
export const stripLabel = (s: Pick<RigStrip, "kind" | "numbers">) => `${KIND_LABEL[s.kind]} ${range(s.numbers)}`;
const quoted = (s: RigStrip) => `${stripLabel(s)} "${s.name}"`;

function reader(get: Lookup) {
  return {
    num: (p: Param, fallback = 0) => {
      const v = get(p.address);
      return typeof v === "number" ? v : fallback;
    },
    text: (p: Param) => {
      const v = get(p.address);
      return typeof v === "string" ? v.trim() : "";
    },
  };
}

type Reader = ReturnType<typeof reader>;

function oneStrip(r: Reader, kind: StripKind, numbers: number[]): RigStrip {
  const c = config(strip(kind, numbers[0]!));
  return { kind, numbers, name: r.text(c.name), icon: r.num(c.icon, 1), colour: colourName(r.num(c.color)) };
}

// Every strip of a kind, linked pairs merged. A pair named differently on each side is reported.
function stripsOf(r: Reader, kind: StripKind, oddities: string[]): RigStrip[] {
  const out: RigStrip[] = [];
  for (let n = 1; n <= STRIP_COUNT[kind]; n++) {
    const linked = n % 2 === 1 && r.num(link(strip(kind, n))) === 1;
    if (!linked) {
      out.push(oneStrip(r, kind, [n]));
      continue;
    }
    const pair = oneStrip(r, kind, [n, n + 1]);
    const other = r.text(config(strip(kind, n + 1)).name);
    if (!sameName(pair.name, other)) oddities.push(`${stripLabel(pair)} are linked but named "${pair.name}" and "${other}"`);
    out.push(pair);
    n++;
  }
  return out;
}

function sendsFrom(r: Reader, s: RigStrip): RigSend[] {
  const from = strip(s.kind, s.numbers[0]!);
  const out: RigSend[] = [];
  for (let bus = 1; bus <= STRIP_COUNT.bus; bus++) {
    // Every send is switched on at −∞ from the factory, so a send counts only when it's on and raised.
    const m = send(from, bus);
    const level = r.num(m.level);
    if (r.num(m.on) === 1 && level > 0) out.push({ bus, level, tap: tapName(r.num(tapOf(from, bus))) });
  }
  return out;
}

function outputsTo(r: Reader, buses: number[]): string[] {
  const kinds = [["main", "XLR out"], ["aux", "Aux out"]] as const;
  return kinds.flatMap(([kind, label]) => {
    const found: number[] = [];
    for (let n = 1; n <= LOCAL_OUTPUTS[kind]; n++) {
      if (buses.includes(outputBus(r.num(output({ kind, n }))) ?? 0)) found.push(n);
    }
    return found.length ? [`${label} ${range(found)}`] : [];
  });
}

function fxFedBy(r: Reader, bus: number): number | null {
  for (let slot = 1; slot <= FX_SEND_SLOTS; slot++) {
    if (fxSourceBus(r.num(fx(slot).source("l"))) === bus) return slot;
  }
  return null;
}

function destinationsOf(r: Reader, buses: RigStrip[], sources: Source[]): Destination[] {
  return buses.filter((b) => b.name).map((b) => ({
    ...b,
    outputs: outputsTo(r, b.numbers),
    fxSlot: fxFedBy(r, b.numbers[0]!),
    deviceReturn: sources.find((s) => s.kind !== "fxrtn" && sameName(s.name, b.name)) ?? null,
  }));
}

// Sources with an insert switched on into each slot.
function insertsBySlot(r: Reader, sources: Source[]): Map<number, string[]> {
  const bySlot = new Map<number, string[]>();
  for (const s of sources.filter((x) => WITH_INSERTS.includes(x.kind))) {
    const i = insert(strip(s.kind, s.numbers[0]!));
    const slot = r.num(i.on) === 1 ? insertSlot(r.num(i.sel)) : null;
    if (slot) bySlot.set(slot, [...(bySlot.get(slot) ?? []), s.name]);
  }
  return bySlot;
}

function fxSlots(r: Reader, sources: Source[]): FxSlot[] {
  const inserted = insertsBySlot(r, sources);
  const sentTo = new Set(sources.flatMap((s) => s.sends.map((x) => x.bus)));
  return Array.from({ length: FX_SLOTS }, (_, i) => {
    const slot = i + 1;
    const f = fx(slot);
    const sourceBuses = [f.source("l"), f.source("r")].map((p) => fxSourceBus(r.num(p))).filter((b) => b !== null);
    const insertedOn = inserted.get(slot) ?? [];
    const fed = sourceBuses.some((b) => sentTo.has(b));
    const role: FxRole = insertedOn.length ? "insert" : fed ? "send" : "free";
    return { slot, type: r.num(f.type), sourceBuses, role, insertedOn };
  });
}

function duplicateNames(strips: RigStrip[], what: string): string[] {
  const seen = new Map<string, RigStrip>();
  const out: string[] = [];
  for (const s of strips) {
    const key = s.name.toLowerCase();
    const first = seen.get(key);
    if (first) out.push(`${what} name "${s.name}" is used by ${stripLabel(first)} and ${stripLabel(s)}`);
    else seen.set(key, s);
  }
  return out;
}

// A bus that feeds an output but has no same-named channel is shared (the Sampler bus), so only a bus that goes
// nowhere is odd.
function busesWithoutRole(destinations: Destination[]): string[] {
  return destinations
    .filter((d) => !d.deviceReturn && d.fxSlot === null && !d.outputs.length)
    .map((d) => `${quoted(d)} has no channel with the same name, feeds no effect and goes to no output`);
}

// A device's return already sent to its own feed: guard 1 broken on the desk.
function returnsIntoOwnFeed(destinations: Destination[]): string[] {
  return destinations.flatMap(({ deviceReturn: back, ...d }) => {
    const loops = back?.sends.some((x) => d.numbers.includes(x.bus));
    return back && loops ? [`${quoted(back)} is sent to its own feed, ${stripLabel(d)}: a feedback loop`] : [];
  });
}

export function deriveRig(get: Lookup): Rig {
  const r = reader(get);
  const oddities: string[] = [];
  const inputs = INPUTS.flatMap((kind) => stripsOf(r, kind, oddities));
  const sources: Source[] = inputs.filter((s) => s.name).map((s) => ({ ...s, sends: sendsFrom(r, s) }));
  const destinations = destinationsOf(r, stripsOf(r, "bus", oddities), sources);
  const spare = inputs.filter((s) => s.kind === "ch" && !s.name).flatMap((s) => s.numbers);
  oddities.push(
    ...duplicateNames(sources, "Source"),
    ...duplicateNames(destinations, "Bus"),
    ...busesWithoutRole(destinations),
    ...returnsIntoOwnFeed(destinations),
  );
  return { sources, destinations, fx: fxSlots(r, sources), spare, oddities };
}

// A name for a bus number, for showing sends ("P-6", or "bus 2" when unnamed).
export function busName(rig: Rig, bus: number): string {
  return rig.destinations.find((d) => d.numbers.includes(bus))?.name ?? `bus ${bus}`;
}
