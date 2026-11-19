// The fake desk's state: every address the app uses, at a neutral default, with the studio rig from the routing plan
// (the Claude Doc "Studio routing plan: X32 Rack and X-Touch") set up on top: names, stereo links, FX feeds and a few
// sends. Defaults and enum values (FX sources) are guesses until day one.

import { config, fx, FX_SLOTS, insert, link, output, send, strip, STRIP_COUNT, type Param, type StripKind } from "../src/core/addresses.ts";
import { LOCAL_OUTPUTS, outputSource } from "../src/core/enums.ts";
import type { OscArg } from "../src/core/osc.ts";

type Values = Map<string, OscArg>;

const put = (values: Values, param: Param, value: number | string) =>
  values.set(param.address, param.type === "s" ? { type: "s", value: String(value) } : { type: param.type, value: Number(value) });

const INPUTS: StripKind[] = ["ch", "auxin", "fxrtn"];
const ALL: StripKind[] = [...INPUTS, "bus"];

export interface DeskOptions {
  auxInserts?: boolean; // do aux inputs have an insert point? (day-one question; default: no)
}

const numbers = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

function blankDesk(options: DeskOptions): Values {
  const values: Values = new Map();
  for (const kind of ALL) numbers(STRIP_COUNT[kind]).forEach((n) => blankStrip(values, kind, n, options));
  for (const kind of ["main", "aux"] as const) numbers(LOCAL_OUTPUTS[kind]).forEach((n) => put(values, output(kind, n), 0));
  for (const slot of numbers(FX_SLOTS)) [fx(slot).type, fx(slot).source("l"), fx(slot).source("r")].forEach((p) => put(values, p, 0));
  return values;
}

const insertKinds = (options: DeskOptions): StripKind[] => (options.auxInserts ? ["ch", "auxin"] : ["ch"]);

function blankStrip(values: Values, kind: StripKind, n: number, options: DeskOptions): void {
  const s = strip(kind, n);
  const c = config(s);
  put(values, c.name, "");
  put(values, c.icon, 1);
  put(values, c.color, 0);
  put(values, link(s), 0);
  if (kind === "bus") return;
  if (kind === "ch") put(values, c.source, n);
  if (insertKinds(options).includes(kind)) {
    for (const p of Object.values(insert(s))) put(values, p, 0);
  }
  for (let bus = 1; bus <= STRIP_COUNT.bus; bus++) {
    const m = send(s, bus);
    put(values, m.on, 0);
    put(values, m.level, 0);
    put(values, m.pan, 0.5);
    put(values, m.type, 0);
  }
}

// [kind, first number, name, stereo?]
const NAMES: [StripKind, number, string, boolean][] = [
  ["ch", 1, "Volca Kick", false],
  ["ch", 2, "Volca Bass", false],
  ["ch", 3, "JV-2080", true],
  ["ch", 5, "Koala", true],
  ["ch", 7, "SP-404 Mk2", true],
  ["ch", 9, "TR-8S", true],
  ["ch", 11, "TB-3", true],
  ["ch", 13, "Mic", false],
  ["ch", 14, "Guitar", false],
  ["auxin", 1, "P-6", true],
  ["auxin", 3, "S-1", true],
  ["auxin", 5, "TD-3-MO", false],
  ["auxin", 6, "King Rat", false],
  ["fxrtn", 1, "Reverb Rtn", true],
  ["fxrtn", 3, "Delay Rtn", true],
  ["fxrtn", 5, "FX 3 Rtn", true],
  ["bus", 1, "King Rat", false],
  ["bus", 3, "Reverb", true],
  ["bus", 5, "Delay", true],
  ["bus", 7, "SP-404 Mk2", true],
  ["bus", 9, "Koala", true],
  ["bus", 11, "P-6", true],
  ["bus", 13, "FX 3", true],
];

// [kind, number, bus, level]: sends switched on.
const SENDS: [StripKind, number, number, number][] = [
  ["ch", 9, 11, 0.75], // TR-8S into the P-6
  ["ch", 10, 12, 0.75],
  ["ch", 1, 3, 0.5], // Volca Kick to the reverb
  ["ch", 3, 5, 0.5], // JV-2080 to the delay
  ["ch", 11, 1, 0.6], // TB-3 to the King Rat
];

// [kind, output, bus]: the routing plan's output patches.
const OUTPUTS: ["main" | "aux", number, number][] = [
  ["main", 1, 7], ["main", 2, 8], // SP-404 line in
  ["main", 3, 9], ["main", 4, 10], // Scarlett, for Koala
  ["aux", 1, 11], ["aux", 2, 12], // P-6 MIX IN
  ["aux", 6, 1], // King Rat
];

// Tap points from the routing plan: the sampler feeds (buses 7-12) pre-fader, everything else post. Enum: 3 = pre,
// 4 = post (a guess until day one).
const PRE_BUSES = [7, 8, 9, 10, 11, 12];

function setTaps(values: Values): void {
  for (const kind of INPUTS) {
    for (let n = 1; n <= STRIP_COUNT[kind]; n++) {
      for (let bus = 1; bus <= STRIP_COUNT.bus; bus++) put(values, send(strip(kind, n), bus).type, PRE_BUSES.includes(bus) ? 3 : 4);
    }
  }
}

export function defaultDesk(options: DeskOptions = {}): Values {
  const values = blankDesk(options);
  setTaps(values);
  for (const [kind, n, bus] of OUTPUTS) put(values, output(kind, n), outputSource(bus));
  for (const [kind, n, name, stereo] of NAMES) {
    const sides = stereo ? [n, n + 1] : [n];
    for (const side of sides) put(values, config(strip(kind, side)).name, name);
    if (stereo) put(values, link(strip(kind, n)), 1);
  }
  for (const [kind, n, bus, level] of SENDS) {
    const m = send(strip(kind, n), bus);
    put(values, m.on, 1);
    put(values, m.level, level);
  }
  // FX 1-3 fed by buses 3-4, 5-6 and 13-14 (source enum: n = mix bus n, a guess until day one).
  for (const [slot, bus] of [[1, 3], [2, 5], [3, 13]] as const) {
    put(values, fx(slot).source("l"), bus);
    put(values, fx(slot).source("r"), bus + 1);
  }
  return values;
}
