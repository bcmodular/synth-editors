// Every OSC address the app uses, built from typed parts so no other module writes address strings by hand.
// Addresses come from Maillot's "Unofficial X32/M32 OSC Remote Protocol" and are checked on the real desk on day one
// (docs/x32-spec.md, day-one questions); a correction should only need a change here.

export type StripKind = "ch" | "auxin" | "fxrtn" | "bus";

export interface Strip {
  kind: StripKind;
  n: number; // 1-based, as the desk shows it
}

// How many of each the X32 Rack has.
export const STRIP_COUNT: Record<StripKind, number> = { ch: 32, auxin: 8, fxrtn: 8, bus: 16 };
export const FX_SLOTS = 8;
// Only FX 1-4 can be fed from a bus; FX 5-8 work as inserts only (no /fx/N/source on the desk).
export const FX_SEND_SLOTS = 4;

// A value on the desk: its address and the OSC type it's written with.
export interface Param {
  address: string;
  type: "i" | "f" | "s";
}

const p = (address: string, type: Param["type"]): Param => ({ address, type });
const pad2 = (n: number) => String(n).padStart(2, "0");
// 1 to max, whole numbers only.
const inRange = (n: number, max: number) => Number.isInteger(n) && Math.min(Math.max(n, 1), max) === n;

export const strip = (kind: StripKind, n: number): Strip => {
  if (!inRange(n, STRIP_COUNT[kind])) throw new Error(`No ${kind} ${n} on the X32 Rack`);
  return { kind, n };
};

export const stripPath = (s: Strip): string => `/${s.kind}/${pad2(s.n)}`;

export const config = (s: Strip) => ({
  name: p(`${stripPath(s)}/config/name`, "s"),
  icon: p(`${stripPath(s)}/config/icon`, "i"),
  color: p(`${stripPath(s)}/config/color`, "i"),
  // Input source; channels only (aux ins and FX returns have fixed sources).
  source: p(`${stripPath(s)}/config/source`, "i"),
});

// A send from an input strip (channel, aux in or FX return) to a mix bus.
export function send(from: Strip, bus: number) {
  if (from.kind === "bus") throw new Error("Buses send to matrices, not to other buses");
  strip("bus", bus);
  const base = `${stripPath(from)}/mix/${pad2(bus)}`;
  return {
    on: p(`${base}/on`, "i"),
    level: p(`${base}/level`, "f"),
    pan: p(`${base}/pan`, "f"),
    type: p(`${base}/type`, "i"), // tap point; the desk has it on odd buses only (one per bus pair). See tapOf.
  };
}

// The odd bus of a pair, where the pair's tap point lives.
export const pairStart = (bus: number): number => (bus % 2 === 1 ? bus : bus - 1);

// The tap point for a send: on the desk it belongs to the bus pair, at the odd bus.
export const tapOf = (from: Strip, bus: number): Param => send(from, pairStart(bus)).type;

export const insert = (s: Strip) => ({
  on: p(`${stripPath(s)}/insert/on`, "i"),
  pos: p(`${stripPath(s)}/insert/pos`, "i"),
  sel: p(`${stripPath(s)}/insert/sel`, "i"),
});

export function fx(slot: number) {
  if (!inRange(slot, FX_SLOTS)) throw new Error(`No FX slot ${slot}`);
  return {
    type: p(`/fx/${slot}/type`, "i"),
    source: (side: "l" | "r") => p(`/fx/${slot}/source/${side}`, "i"),
    par: (n: number) => p(`/fx/${slot}/par/${pad2(n)}`, "f"),
  };
}

// Stereo links are per odd/even pair: `/config/chlink/1-2`.
const LINK_GROUP: Record<StripKind, string> = { ch: "chlink", auxin: "auxlink", fxrtn: "fxlink", bus: "buslink" };

export function link(s: Strip): Param {
  const odd = s.n % 2 === 1 ? s.n : s.n - 1;
  return p(`/config/${LINK_GROUP[s.kind]}/${odd}-${odd + 1}`, "i");
}

export const output = (kind: "main" | "aux", n: number): Param => p(`/outputs/${kind}/${pad2(n)}/src`, "i");

// Messages that aren't values: the desk's identity, renewing notifications, and batch reads.
export const INFO = "/info";
export const STATUS = "/status";
export const XREMOTE = "/xremote";
export const NODE = "/node";
