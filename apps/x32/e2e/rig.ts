// The fake desk's state: every address the app uses, with an early version of the example studio rig set up on top:
// names, stereo links, FX feeds and a few sends (the current rig is studio.ts, set up from rig/studio.json). Defaults follow
// the real X32 Rack (fw 4.15, read 22 Nov 2026): sends on at −∞, tap points on odd buses only, no source for FX 5-8,
// no insert point on aux inputs.

import { config, fader, fx, FX_SEND_SLOTS, FX_SLOTS, insert, link, send, strip, STRIP_COUNT, stripOn, type Param, type Strip, type StripKind } from "../src/core/addresses.ts";
import {
  FX_LIBRARY_SIZE, IN_BLOCKS, libFx, output, OUTPUT_COUNT, OUTPUT_SOURCE, outputPos, routingCard, routingIn, scene, SCENE_SLOTS, userIn, userOut,
  USER_IN_SLOTS, USER_OUT_SLOTS,
} from "../src/core/routing.ts";
import type { OscArg } from "../src/core/osc.ts";

export type Values = Map<string, OscArg>;

export const put = (values: Values, param: Param, value: number | string) =>
  values.set(param.address, param.type === "s" ? { type: "s", value: String(value) } : { type: param.type, value: Number(value) });

const INPUTS: StripKind[] = ["ch", "auxin", "fxrtn"];
const ALL: StripKind[] = [...INPUTS, "bus"];

export const numbers = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

export function blankDesk(): Values {
  const values: Values = new Map();
  for (const kind of ALL) numbers(STRIP_COUNT[kind]).forEach((n) => blankStrip(values, kind, n));
  for (const slot of numbers(FX_SLOTS)) put(values, fx(slot).type, 0);
  for (const slot of numbers(FX_SLOTS)) numbers(15).forEach((k) => put(values, fx(slot).par(k), 0.5)); // READ_PARAMS
  for (const slot of numbers(FX_SEND_SLOTS)) [fx(slot).source("l"), fx(slot).source("r")].forEach((p) => put(values, p, 0));
  blankRouting(values);
  for (let n = 1; n <= FX_LIBRARY_SIZE; n++) put(values, libFx(n).name, ""); // an empty FX library
  return values;
}

// Routing, outputs and scenes, as the factory leaves them where it matters (fw 4.15).
function blankRouting(values: Values): void {
  IN_BLOCKS.forEach((b, i) => put(values, routingIn(b), [0, 1, 4, 5][i]!));
  IN_BLOCKS.forEach((b, i) => put(values, routingCard(b), [0, 1, 4, 5][i]!));
  numbers(USER_IN_SLOTS).forEach((n) => put(values, userIn(n), 0));
  numbers(USER_OUT_SLOTS).forEach((n) => put(values, userOut(n), 0));
  for (const kind of ["main", "aux", "p16"] as const) {
    numbers(OUTPUT_COUNT[kind]).forEach((n) => {
      put(values, output({ kind, n }), 0);
      put(values, outputPos({ kind, n }), kind === "p16" ? 2 : 8);
    });
  }
  for (let n = 0; n < SCENE_SLOTS; n++) {
    put(values, scene(n).name, "");
    put(values, scene(n).hasdata, 0);
  }
}

function blankStrip(values: Values, kind: StripKind, n: number): void {
  const s = strip(kind, n);
  const c = config(s);
  put(values, c.name, "");
  put(values, c.icon, 1);
  put(values, c.color, 0);
  put(values, link(s), 0);
  if (kind === "bus") {
    put(values, fader(s), 0); // bus masters at −∞, as found on the real desk
    return;
  }
  put(values, stripOn(s), 1);
  if (kind === "ch") {
    put(values, c.source, n);
    for (const p of Object.values(insert(s))) put(values, p, 0);
  }
  numbers(STRIP_COUNT.bus).forEach((bus) => blankSend(values, s, bus));
}

// From the factory every send is on at −∞; the tap point lives on the odd bus of each pair.
function blankSend(values: Values, s: Strip, bus: number): void {
  const m = send(s, bus);
  put(values, m.on, 1);
  put(values, m.level, 0);
  put(values, m.pan, 0.5);
  if (bus % 2 === 1) put(values, m.type, 4);
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

// [kind, output, bus]: the early rig's output patches.
const OUTPUTS: ["main" | "aux", number, number][] = [
  ["main", 1, 7], ["main", 2, 8], // SP-404 line in
  ["main", 3, 9], ["main", 4, 10], // Scarlett, for Koala
  ["aux", 1, 11], ["aux", 2, 12], // P-6 MIX IN
  ["aux", 6, 1], // King Rat
];

// Tap points from the early rig: the sampler feeds (buses 7-12) pre-fader, everything else post. Enum: 3 = pre,
// 4 = post (a guess until day one).
const PRE_BUSES = [7, 8, 9, 10, 11, 12];

function setTaps(values: Values): void {
  for (const kind of INPUTS) {
    for (let n = 1; n <= STRIP_COUNT[kind]; n++) {
      for (let bus = 1; bus <= STRIP_COUNT.bus; bus += 2) put(values, send(strip(kind, n), bus).type, PRE_BUSES.includes(bus) ? 3 : 4);
    }
  }
}

export function defaultDesk(): Values {
  const values = blankDesk();
  setTaps(values);
  for (const [kind, n, bus] of OUTPUTS) put(values, output({ kind, n }), OUTPUT_SOURCE.bus + bus);
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
