// The rig file turned into desk values: every address it wants set, and to what (targets.ts). The card outputs are
// worked out in cardRouting.ts.

import { config, fader, fx, link, strip, STRIP_COUNT, stripOn, tapOf, type Strip, type StripKind } from "./addresses";
import { cardTargets } from "./cardRouting";
import { TAPS } from "./enums";
import { formatDb } from "./faderLaw";
import { IN_BLOCKS, IN_USER_BLOCK, output, OUTPUT_SOURCE, routingIn, userIn, USER_IN_SLOTS } from "./routing";
import type { RigBus, RigFile, RigSource } from "./rigFile";
import { at, label, outputLabel, type Area, type Target } from "./targets";

function socketName(value: number): string {
  if (value === 0) return "nothing";
  if (value > 160) return `aux in ${value - 160}`;
  if (value > 128) return `card in ${value - 128}`;
  return `XLR ${value}`;
}

// Every channel reads its own user-in slot (ch N ← slot N), so any socket can go to any channel. Channels the rig
// file doesn't give a socket get none.
function routingTargets(rig: RigFile): Target[] {
  const slots = new Map<number, number>();
  for (const s of [...rig.sources, ...rig.spare]) s.sockets.forEach((v, i) => slots.set(s.strips[i]!.n, v));
  const blocks = IN_BLOCKS.map((b) => at("routing", 1)(routingIn(b), IN_USER_BLOCK[b], `ch ${b} from user routing`));
  const perChannel = Array.from({ length: USER_IN_SLOTS }, (_, i) => {
    const v = slots.get(i + 1) ?? 0;
    return at("routing", 1)(userIn(i + 1), v, `ch ${i + 1} input ← ${socketName(v)}`);
  });
  return [...perChannel, ...blocks];
}

// Links: a source with two strips is linked; a single strip is unlinked unless another source links its pair.
function linkTargets(groups: { strips: Strip[] }[], area: Area): Target[] {
  const links = new Map<string, Target>();
  for (const g of groups) {
    const on = g.strips.length === 2 ? 1 : 0;
    const p = link(g.strips[0]!);
    if (on || !links.has(p.address)) links.set(p.address, at(area, 2)(p, on, `${label(g.strips[0]!)} ${on ? "linked" : "not linked"}`));
  }
  return [...links.values()];
}

function looks(area: Area, s: Strip, item: { name: string; colour: number | null; icon?: number | null }): Target[] {
  const c = config(s);
  const out = [at(area, 6)(c.name, item.name, item.name ? `${label(s)} named "${item.name}"` : `${label(s)} unnamed`)];
  if (item.colour !== null) out.push(at(area, 6)(c.color, item.colour, `${label(s)} colour`));
  if (item.icon !== undefined && item.icon !== null) out.push(at(area, 6)(c.icon, item.icon, `${label(s)} icon`));
  return out;
}

// Unused strips are unnamed (and coloured, if the file gives one). Aux strips are also muted: their sockets feed channels.
function unusedTargets(rig: RigFile, kind: "inputs" | "buses"): Target[] {
  const area: Area = kind === "buses" ? "buses" : "channels";
  const strips = rig.unused.filter((s) => (s.kind === "bus") === (kind === "buses"));
  return strips.flatMap((s) => [
    ...(s.kind === "auxin" ? [at(area, 6)(stripOn(s), 0, `${label(s)} muted (its socket feeds a channel)`)] : []),
    ...looks(area, s, { name: "", colour: rig.unusedColour }),
  ]);
}

function channelTargets(rig: RigFile): Target[] {
  const sourceLooks = rig.sources.flatMap((src: RigSource) => src.strips.flatMap((s) => looks("channels", s, src)));
  return [...linkTargets(rig.sources, "channels"), ...sourceLooks, ...unusedTargets(rig, "inputs")];
}

const INPUTS: StripKind[] = ["ch", "auxin", "fxrtn"];

// The tap point lives on every input strip, at the odd bus of the pair.
function tapTargets(b: RigBus): Target[] {
  if (!b.tap) return [];
  const value = TAPS.indexOf(b.tap);
  return INPUTS.flatMap((kind) =>
    Array.from({ length: STRIP_COUNT[kind] }, (_, i) => {
      const from = strip(kind, i + 1);
      return at("buses", 3)(tapOf(from, b.buses[0]!), value, `${label(from)} → bus ${b.buses[0]} taken ${b.tap}-fader`);
    }));
}

// Bus masters come last, once the bus feeds what it should: FX inputs and bus outputs are taken after the master.
function levelTargets(b: RigBus): Target[] {
  if (b.level === null) return [];
  return b.buses.map((n) => at("buses", 6)(fader(strip("bus", n)), b.level!, `bus ${n} master at ${formatDb(b.level!)}`));
}

function busTargets(rig: RigFile): Target[] {
  const strips = rig.buses.map((b) => ({ strips: b.buses.map((n) => strip("bus", n)) }));
  const named = rig.buses.flatMap((b) => b.buses.flatMap((n) => looks("buses", strip("bus", n), b)));
  const unnamed = unusedTargets(rig, "buses");
  return [...linkTargets(strips, "buses"), ...rig.buses.flatMap(tapTargets), ...named, ...unnamed, ...rig.buses.flatMap(levelTargets)];
}

// A shared bus goes to its first target; the other targets' outputs are off until the chat switches the bus.
function idleTargets(b: RigBus): Target[] {
  return b.targets.slice(1).flatMap((t) => t.outputs.map((o) =>
    at("outputs", 3)(output(o), OUTPUT_SOURCE.off, `${outputLabel(o.kind, o.n)} off (${b.name} → ${t.name} when switched)`)));
}

function outputTargets(rig: RigFile): Target[] {
  const live = rig.buses.flatMap((b) => b.outputs.map((o, i) => {
    const bus = b.buses[i]!;
    return at("outputs", 3)(output(o), OUTPUT_SOURCE.bus + bus, `${outputLabel(o.kind, o.n)} ← bus ${bus}`);
  }));
  return [...live, ...rig.buses.flatMap(idleTargets)];
}

function fxTargets(rig: RigFile): Target[] {
  return rig.fx.flatMap((f) => {
    const [l, r = l] = f.sourceBuses as [number, number?];
    return [
      at("fx", 4)(fx(f.slot).source("l"), l, `FX ${f.slot} left fed by bus ${l}`),
      at("fx", 4)(fx(f.slot).source("r"), r!, `FX ${f.slot} right fed by bus ${r}`),
    ];
  });
}

export function desiredTargets(rig: RigFile): Target[] {
  return [
    ...routingTargets(rig), ...channelTargets(rig), ...busTargets(rig), ...outputTargets(rig), ...fxTargets(rig),
    ...cardTargets(rig),
  ];
}
