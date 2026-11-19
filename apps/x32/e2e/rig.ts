// The fake desk's state: every address the app uses, at a neutral default, with the studio rig from the routing plan
// (the Claude Doc "Studio routing plan: X32 Rack and X-Touch") set up on top: names, stereo links, FX feeds and a few
// sends. Defaults and enum values (FX sources) are guesses until day one.

import { config, fx, FX_SLOTS, insert, link, send, strip, STRIP_COUNT, type Param, type StripKind } from "../src/core/addresses.ts";
import type { OscArg } from "../src/core/osc.ts";

type Values = Map<string, OscArg>;

const put = (values: Values, param: Param, value: number | string) =>
  values.set(param.address, param.type === "s" ? { type: "s", value: String(value) } : { type: param.type, value: Number(value) });

const INPUTS: StripKind[] = ["ch", "auxin", "fxrtn"];
const ALL: StripKind[] = [...INPUTS, "bus"];

function blankDesk(): Values {
  const values: Values = new Map();
  for (const kind of ALL) {
    for (let n = 1; n <= STRIP_COUNT[kind]; n++) blankStrip(values, kind, n);
  }
  for (let slot = 1; slot <= FX_SLOTS; slot++) {
    const f = fx(slot);
    put(values, f.type, 0);
    put(values, f.source("l"), 0);
    put(values, f.source("r"), 0);
  }
  return values;
}

function blankStrip(values: Values, kind: StripKind, n: number): void {
  const s = strip(kind, n);
  const c = config(s);
  put(values, c.name, "");
  put(values, c.icon, 1);
  put(values, c.color, 0);
  put(values, link(s), 0);
  if (kind === "bus") return;
  if (kind === "ch") {
    put(values, c.source, n);
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
  ["ch", 11, 1, 0.6], // TB-3 to the King Rat
];

export function defaultDesk(): Values {
  const values = blankDesk();
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
