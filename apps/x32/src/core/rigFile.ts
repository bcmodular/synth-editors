// The rig file (apps/x32/rig/studio.json): the desired setup of the desk, written for people ("ch 5-6", "XLR 9-10",
// "aux out 1-2"), parsed here into desk terms. Anything malformed is reported with where it is, so a typo in the file
// can't turn into a wrong write.

import { strip, type Strip, type StripKind } from "./addresses";
import { COLOURS, iconNumber } from "./enums";
import { levelFromDb, quantizeLevel } from "./faderLaw";
import { USER_SOURCE, type Logical } from "./routing";

export class RigFileError extends Error {
  constructor(where: string, problem: string) {
    super(`Rig file, ${where}: ${problem}`);
    this.name = "RigFileError";
  }
}

// A value from the file and where it came from, for error messages.
export interface Field {
  value: unknown;
  where: string;
}

export interface RigSource {
  strips: Strip[]; // one, or a stereo pair
  name: string;
  colour: number | null;
  icon: number | null;
  sockets: number[]; // user-in source values, one per strip; empty for FX returns
  phantom: string | null; // a note: never written
  notes: string | null;
}

// A device a shared bus can be switched to (the Sampler bus: SP-404, Koala or P-6).
export interface RigTarget {
  name: string; // the device's return channel, as named on the desk
  outputs: Logical[]; // one per bus, in order
  notes: string | null;
}

export interface RigBus {
  buses: number[];
  name: string;
  colour: number | null;
  tap: "pre" | "post" | null;
  level: number | null; // the bus master, as a fader level (0.75 is 0 dB)
  outputs: Logical[]; // one per bus, in order: where the bus goes now (a shared bus: its first target)
  targets: RigTarget[]; // a shared bus's devices, the default first; empty for a fixed bus
  notes: string | null;
}

// Every output a bus may use: its own, and those of the targets it can be switched to.
export const busOutputs = (b: RigBus): Logical[] => [...b.outputs, ...b.targets.slice(1).flatMap((t) => t.outputs)];

export interface RigFx {
  slot: number;
  sourceBuses: number[]; // the bus pair (or one bus) that feeds it
}

export type CardSource = { kind: "ch" | "auxin" | "fxrtn"; n: number } | { kind: "main"; side: "L" | "R" };

export interface RigCardOut {
  card: number;
  source: CardSource;
  tap: "pre" | "post";
}

export interface RigFile {
  sources: RigSource[];
  spare: { strips: Strip[]; sockets: number[] }[]; // spare channels that still get a socket
  unused: Strip[]; // strips to leave unnamed (aux inputs also muted)
  unusedColour: number | null;
  buses: RigBus[];
  fx: RigFx[];
  cardOut: RigCardOut[];
  manual: string[];
}

type Json = Record<string, unknown>;

const STRIP_KIND: Record<string, StripKind> = { ch: "ch", aux: "auxin", auxin: "auxin", fxrtn: "fxrtn", bus: "bus" };
const MAX_NAME = 12;
const TAP_CHOICES = new Set(["pre", "post"]);

const textOf = (f: Field) => String(f.value ?? "").trim();
const fail = (f: Field, problem: string): never => {
  throw new RigFileError(f.where, problem);
};
const sub = (f: Field, value: unknown): Field => ({ value, where: f.where });

// "5", "5-6", "1-16" → [5], [5, 6], [1 … 16].
export function parseRange(f: Field): number[] {
  const m = /^(\d+)(?:-(\d+))?$/.exec(textOf(f));
  const from = Number(m?.[1]);
  const to = Number(m?.[2] ?? m?.[1]);
  if (!m || to < from) fail(f, `"${textOf(f)}" isn't a number or a range like 5-6`);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function stripOrFail(f: Field, kind: StripKind, n: number): Strip {
  try {
    return strip(kind, n);
  } catch (e) {
    return fail(f, (e as Error).message);
  }
}

// "ch 5-6", "aux 1-2", "fxrtn 3-4", "bus 7-8" → strips.
export function parseStrips(f: Field): Strip[] {
  const m = /^(\w+)\s+(.+)$/.exec(textOf(f));
  const kind = m ? STRIP_KIND[m[1]!.toLowerCase()] : undefined;
  if (!m || !kind) return fail(f, `"${textOf(f)}" isn't a strip like "ch 5-6" or "aux 3"`);
  return parseRange(sub(f, m[2])).map((n) => stripOrFail(f, kind, n));
}

const SOCKETS: [RegExp, number][] = [
  [/^xlr\s+(.+)$/i, USER_SOURCE.local],
  [/^aux in\s+(.+)$/i, USER_SOURCE.aux],
  [/^card\s+(.+)$/i, USER_SOURCE.card],
];

// "XLR 9-10", "aux in 5", "card 1" → user-in source values.
export function parseSockets(f: Field): number[] {
  for (const [pattern, base] of SOCKETS) {
    const m = pattern.exec(textOf(f));
    if (m) return parseRange(sub(f, m[1])).map((n) => base + n);
  }
  return fail(f, `"${textOf(f)}" isn't a socket like "XLR 9-10", "aux in 5" or "card 1"`);
}

const OUTPUTS: [RegExp, Logical["kind"]][] = [
  [/^xlr out\s+(.+)$/i, "main"],
  [/^aux out\s+(.+)$/i, "aux"],
];

// "XLR out 1-2", "aux out 6" → logical outputs.
export function parseOutputs(f: Field): Logical[] {
  for (const [pattern, kind] of OUTPUTS) {
    const m = pattern.exec(textOf(f));
    if (m) return parseRange(sub(f, m[1])).map((n) => ({ kind, n }));
  }
  return fail(f, `"${textOf(f)}" isn't an output like "XLR out 1-2" or "aux out 6"`);
}

const noteOf = (v: unknown): string | null => (typeof v === "string" ? v : null);

function colourOf(f: Field): number | null {
  if (f.value === undefined) return null;
  const i = COLOURS.indexOf(textOf(f).toUpperCase());
  return i < 0 ? fail(f, `colour "${textOf(f)}" isn't one of ${COLOURS.join(", ")}`) : i;
}

function iconOf(f: Field): number | null {
  if (f.value === undefined) return null;
  return iconNumber(textOf(f)) ?? fail(f, `icon "${textOf(f)}" isn't in the desk's icon list (enums.ts ICONS)`);
}

function nameOf(f: Field): string {
  const name = textOf(f);
  const ok = name.length > 0 && name.length <= MAX_NAME;
  return ok ? name : fail(f, `name "${name}" must be 1-${MAX_NAME} characters`);
}

function tapOf(f: Field): "pre" | "post" | null {
  if (f.value === undefined) return null;
  return TAP_CHOICES.has(textOf(f)) ? (textOf(f) as "pre" | "post") : fail(f, 'tap must be "pre" or "post"');
}

// "0 dB", "-6 dB", "+3 dB" → the fader level the desk will store.
function levelOf(f: Field): number | null {
  if (f.value === undefined) return null;
  const m = /^([+-]?\d+(?:\.\d+)?)\s*dB$/i.exec(textOf(f));
  return m ? quantizeLevel(levelFromDb(Number(m[1]))) : fail(f, `level "${textOf(f)}" isn't like "0 dB" or "-6 dB"`);
}

// Optional per-strip values (sockets, outputs) must come one per strip.
function onePer<T>(f: Field, items: T[], count: number): T[] {
  if (items.length && items.length !== count) fail(f, "doesn't match the number of strips or buses");
  return items;
}

function parseSource(j: Json, i: number): RigSource {
  const at = (value: unknown): Field => ({ value, where: `sources[${i}] (${String(j.name ?? j.strip)})` });
  const strips = parseStrips(at(j.strip));
  const sockets = onePer(at(j.socket), j.socket === undefined ? [] : parseSockets(at(j.socket)), strips.length);
  if (sockets.length && strips[0]!.kind !== "ch") fail(at(j.socket), "only channels take a socket");
  return {
    strips, name: nameOf(at(j.name)), colour: colourOf(at(j.colour)), icon: iconOf(at(j.icon)), sockets,
    phantom: noteOf(j.phantom), notes: noteOf(j.notes),
  };
}

function outputsOf(f: Field, count: number): Logical[] {
  return f.value === undefined ? [] : onePer(f, parseOutputs(f), count);
}

function parseTarget(f: Field, t: Json, count: number): RigTarget {
  const at = (value: unknown): Field => ({ value, where: `${f.where}, target "${String(t.name)}"` });
  if (t.output === undefined) fail(at(t.output), "every target needs an output");
  return { name: nameOf(at(t.name)), outputs: outputsOf(at(t.output), count), notes: noteOf(t.notes) };
}

function parseTargets(f: Field, count: number): RigTarget[] {
  if (f.value === undefined) return [];
  if (!Array.isArray(f.value) || !f.value.length) return fail(f, "targets must be a list of devices");
  return (f.value as Json[]).map((t) => parseTarget(f, t, count));
}

function parseBus(j: Json, i: number): RigBus {
  const at = (value: unknown): Field => ({ value, where: `buses[${i}] (${String(j.name ?? j.bus)})` });
  const buses = parseRange(at(j.bus));
  const targets = parseTargets(at(j.targets), buses.length);
  if (targets.length && j.output !== undefined) fail(at(j.output), "a bus with targets takes its output from the first one");
  return {
    buses, name: nameOf(at(j.name)), colour: colourOf(at(j.colour)), tap: tapOf(at(j.tap)), level: levelOf(at(j.level)),
    outputs: targets[0]?.outputs ?? outputsOf(at(j.output), buses.length), targets, notes: noteOf(j.notes),
  };
}

function parseFx(j: Json, i: number): RigFx {
  const f: Field = { value: j.source, where: `fx[${i}]` };
  const slot = Number(j.slot);
  if (![1, 2, 3, 4].includes(slot)) fail(f, "only FX 1-4 can be fed from a bus");
  const m = /^bus\s+(.+)$/i.exec(textOf(f));
  if (!m) return fail(f, `source "${textOf(f)}" isn't a bus like "bus 3-4"`);
  return { slot, sourceBuses: parseRange(sub(f, m[1])) };
}

function cardSources(f: Field): CardSource[] {
  if (textOf(f).toLowerCase() === "main") return [{ kind: "main", side: "L" }, { kind: "main", side: "R" }];
  return parseStrips(f).map((s) => (s.kind === "bus" ? fail(f, "buses can't go to the card directly") : { kind: s.kind, n: s.n }));
}

function parseCardOut(j: Json, i: number): RigCardOut[] {
  const at = (value: unknown): Field => ({ value, where: `card.outputs[${i}]` });
  const cards = parseRange(at(j.card));
  const sources = onePer(at(j.source), cardSources(at(j.source)), cards.length);
  const tap = j.tap === "pre" ? "pre" : "post";
  return cards.map((card, k) => ({ card, source: sources[k]!, tap }));
}

function parseSpare(spare: unknown): RigFile["spare"] {
  return Object.entries((spare ?? {}) as Record<string, unknown>)
    .filter(([key, socket]) => key.startsWith("ch") && typeof socket === "string")
    .map(([key, socket]) => {
      const where = `spare "${key}"`;
      const strips = parseStrips({ value: key, where });
      return { strips, sockets: onePer({ value: socket, where }, parseSockets({ value: socket, where }), strips.length) };
    });
}

const list = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

export function parseRigFile(json: unknown): RigFile {
  const j = (json ?? {}) as Json;
  const unused = (j.unused ?? {}) as Json;
  const card = (j.card ?? {}) as Json;
  return {
    sources: list(j.sources).map(parseSource),
    spare: parseSpare(j.spare),
    unused: list(unused.strips).flatMap((s, i) => parseStrips({ value: s, where: `unused.strips[${i}]` })),
    unusedColour: colourOf({ value: unused.colour, where: "unused.colour" }),
    buses: list(j.buses).map(parseBus),
    fx: list(j.fx).map(parseFx),
    cardOut: list(card.outputs).flatMap(parseCardOut),
    manual: list(j.manual).map(String),
  };
}
