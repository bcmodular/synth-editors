// Everything the app reads from the desk on connect (docs/x32-spec.md, "What the app reads from the desk"). After this,
// /xremote notifications keep the cache current. Pans aren't read yet: nothing uses them.

import { config, fx, FX_SEND_SLOTS, FX_SLOTS, insert, link, output, send, strip, STRIP_COUNT, type Param, type StripKind } from "./addresses";
import { LOCAL_OUTPUTS } from "./enums";

const INPUTS: StripKind[] = ["ch", "auxin", "fxrtn"];
// Only channels have an insert point (aux inputs don't, on the real desk).
const WITH_INSERTS: StripKind[] = ["ch"];
const ALL: StripKind[] = [...INPUTS, "bus"];

const numbers = (count: number) => Array.from({ length: count }, (_, i) => i + 1);
const strips = (kind: StripKind) => numbers(STRIP_COUNT[kind]).map((n) => strip(kind, n));

function stripConfig(kind: StripKind): Param[] {
  return strips(kind).flatMap((s) => {
    const c = config(s);
    const own = [c.name, c.icon, c.color];
    return s.n % 2 === 1 ? [...own, link(s)] : own;
  });
}

function sends(kind: StripKind): Param[] {
  return strips(kind).flatMap((s) =>
    numbers(STRIP_COUNT.bus).flatMap((bus) => {
      const m = send(s, bus);
      return bus % 2 === 1 ? [m.on, m.level, m.type] : [m.on, m.level]; // tap points only on odd buses
    }));
}

const inserts = (kind: StripKind): Param[] => strips(kind).flatMap((s) => Object.values(insert(s)));

const fxSlots = (): Param[] => [
  ...numbers(FX_SLOTS).map((n) => fx(n).type),
  ...numbers(FX_SEND_SLOTS).flatMap((n) => [fx(n).source("l"), fx(n).source("r")]),
];

const outputs = (): Param[] => [
  ...numbers(LOCAL_OUTPUTS.main).map((n) => output("main", n)),
  ...numbers(LOCAL_OUTPUTS.aux).map((n) => output("aux", n)),
];

export function deskReadList(): Param[] {
  return [
    ...ALL.flatMap(stripConfig),
    ...fxSlots(),
    ...outputs(),
    ...WITH_INSERTS.flatMap(inserts),
    ...INPUTS.flatMap(sends),
  ];
}
