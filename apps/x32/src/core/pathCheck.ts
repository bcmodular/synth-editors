// Trace a signal by the desk's settings (docs/x32-spec.md, "Trace signal", checkPath): follow a source to a destination
// (a bus, a shared bus's target, or the main mix) and list everything that would stop it, without needing audio.
// It writes nothing; the chat can then offer the fix where it has a tool for it.

import { dca, DCA_COUNT, fader, groups, MAIN, mainAssign, MUTE_GROUPS, muteGroup, send, strip, stripOn, tapOf, type Strip } from "./addresses";
import { tapName } from "./enums";
import { findDestination, findSource, type PlanContext } from "./planner";
import { deriveRig, stripLabel, type Destination as RigDestination, type Lookup, type Rig, type Source } from "./rig";
import { IN_BLOCKS, IN_USER_BLOCK, routingIn, userIn } from "./routing";
import { liveTarget } from "./shared";
import { label } from "./targets";

export interface PathRequest {
  source: string;
  destination: string; // a bus, a shared bus's target, or "main"
}

export interface PathReport {
  route: string; // "S-1 (ch 9-10) → Sampler (bus 11-12) → XLR out 1-2"
  blocks: string[]; // everything that stops the signal, in path order
  notes: string[]; // what to check outside the desk (from the rig file)
}

const MAIN_NAMES = /^(the )?(main|main mix|mains|lr|main lr|master)$/i;
const bitsOf = (mask: number, count: number) => Array.from({ length: count }, (_, i) => i + 1).filter((n) => mask & (1 << (n - 1)));
const num = (get: Lookup, address: string) => Number(get(address) ?? 0);

// A channel fed through user routing with no socket in its slot hears nothing.
function inputBlocks(get: Lookup, s: Strip): string[] {
  if (s.kind !== "ch") return [];
  const block = IN_BLOCKS[Math.floor((s.n - 1) / 8)]!;
  const viaUser = num(get, routingIn(block).address) === IN_USER_BLOCK[block];
  return viaUser && num(get, userIn(s.n).address) === 0 ? [`${label(s)} has no input: no socket is routed to it`] : [];
}

function muteBlocks(get: Lookup, s: Strip): string[] {
  const muted = num(get, stripOn(s).address) === 0 ? [`${label(s)} is muted`] : [];
  const inGroups = bitsOf(num(get, groups(s).mute.address), MUTE_GROUPS);
  const engaged = inGroups.filter((n) => num(get, muteGroup(n).address) === 1).map((n) => `${label(s)} is in mute group ${n}, which is on`);
  return [...muted, ...engaged];
}

// What only matters after the fader: the fader itself and the DCAs the strip is in.
function faderBlocks(get: Lookup, s: Strip): string[] {
  const down = num(get, fader(s).address) === 0 ? [`${label(s)}'s fader is at -∞`] : [];
  const dcas = bitsOf(num(get, groups(s).dca.address), DCA_COUNT).flatMap((n) => {
    if (num(get, dca(n).on.address) === 0) return [`${label(s)} is in DCA ${n}, which is muted`];
    return num(get, dca(n).fader.address) === 0 ? [`${label(s)} is in DCA ${n}, whose fader is at -∞`] : [];
  });
  return [...down, ...dcas];
}

const strips = (s: Source) => s.numbers.map((n) => strip(s.kind, n));
const unique = (items: string[]) => [...new Set(items)];

function sendBlocks(get: Lookup, s: Strip, buses: number[]): { blocks: string[]; postFader: boolean } {
  const blocks = buses.flatMap((bus) => {
    const m = send(s, bus);
    if (num(get, m.on.address) === 0) return [`${label(s)}'s send to bus ${bus} is off`];
    return num(get, m.level.address) === 0 ? [`${label(s)}'s send to bus ${bus} is at -∞`] : [];
  });
  const postFader = buses.some((bus) => tapName(num(get, tapOf(s, bus).address)) === "post");
  return { blocks, postFader };
}

function busBlocks(get: Lookup, buses: number[]): string[] {
  return buses.flatMap((n) => {
    const b = strip("bus", n);
    if (num(get, stripOn(b).address) === 0) return [`bus ${n} is muted`];
    return num(get, fader(b).address) === 0 ? [`bus ${n}'s master is at -∞`] : [];
  });
}

const sourceBlocks = (get: Lookup, s: Source) => unique(strips(s).flatMap((x) => [...inputBlocks(get, x), ...muteBlocks(get, x)]));

type Dest = ReturnType<typeof findDestination>;

// Where the bus goes: a shared bus's live target, an output, or an effect.
function whereBlocks(ctx: PlanContext, d: Dest, onDesk: RigDestination | undefined): string[] {
  if (d.shared) {
    const live = liveTarget(ctx.get, d.shared);
    if (!live) return [`the ${d.shared.name} isn't patched to any of its outputs`];
    return d.target && live !== d.target ? [`the ${d.shared.name} goes to the ${live}, not the ${d.target} (send to the ${d.target} to switch it)`] : [];
  }
  const nowhere = onDesk && !onDesk.outputs.length && onDesk.fxSlot === null;
  return nowhere ? [`${d.label} goes to no output and feeds no effect`] : [];
}

function routeText(s: Source, d: Dest, onDesk: RigDestination | undefined): string {
  const where = [...(onDesk?.outputs ?? []), ...(onDesk?.fxSlot ? [`FX ${onDesk.fxSlot}`] : [])].join(", ");
  return `${s.name} (${stripLabel(s)}) → ${d.label} (bus ${d.buses.join("-")})${where ? ` → ${where}` : ""}`;
}

function targetNotes(ctx: PlanContext, d: Dest): string[] {
  const live = d.shared ? (d.target ?? liveTarget(ctx.get, d.shared)) : null;
  const t = d.shared?.targets.find((x) => x.name === live) as { notes?: string | null } | undefined;
  return t?.notes ? [t.notes] : [];
}

function toBus(ctx: PlanContext, rig: Rig, s: Source, req: PathRequest): PathReport {
  const d = findDestination(ctx, rig, req);
  const onDesk = rig.destinations.find((x) => x.numbers[0] === d.buses[0]);
  const sends = strips(s).map((x) => sendBlocks(ctx.get, x, d.buses));
  const postFader = sends.some((x) => x.postFader);
  const blocks = [
    ...sourceBlocks(ctx.get, s),
    ...(postFader ? unique(strips(s).flatMap((x) => faderBlocks(ctx.get, x))) : []),
    ...sends.flatMap((x) => x.blocks),
    ...busBlocks(ctx.get, d.buses),
    ...whereBlocks(ctx, d, onDesk),
  ];
  return { route: routeText(s, d, onDesk), blocks, notes: targetNotes(ctx, d) };
}

function toMain(ctx: PlanContext, s: Source): PathReport {
  const notAssigned = strips(s).filter((x) => num(ctx.get, mainAssign(x).address) === 0).map((x) => `${label(x)} isn't assigned to the main mix`);
  const main = [
    ...(num(ctx.get, MAIN.on.address) === 0 ? ["the main mix is muted"] : []),
    ...(num(ctx.get, MAIN.fader.address) === 0 ? ["the main fader is at -∞"] : []),
  ];
  const blocks = [...sourceBlocks(ctx.get, s), ...unique(strips(s).flatMap((x) => faderBlocks(ctx.get, x))), ...notAssigned, ...main];
  return { route: `${s.name} (${stripLabel(s)}) → the main mix`, blocks, notes: [] };
}

export function checkPath(ctx: PlanContext, req: PathRequest): PathReport {
  const rig = deriveRig(ctx.get);
  const source = findSource(rig, req);
  return MAIN_NAMES.test(req.destination.trim()) ? toMain(ctx, source) : toBus(ctx, rig, source, req);
}

export function pathText(r: PathReport): string {
  const head = `Checked ${r.route}.`;
  const found = r.blocks.length
    ? ` What stops it:\n${r.blocks.map((b) => `- ${b}`).join("\n")}`
    : " Nothing in the desk's settings stops it. If it's still silent, check the cable, the source's own volume, and the device it goes to.";
  const notes = r.notes.length ? `\nNotes for the device: ${r.notes.join(" ")}` : "";
  return head + found + notes;
}

// The check as a tool result: the report, or why it couldn't be made (an unknown name).
export function checkOutcome(ctx: PlanContext, req: PathRequest): { text: string; kind: string } {
  try {
    return { text: pathText(checkPath(ctx, req)), kind: "state" };
  } catch (e) {
    return { text: (e as Error).message, kind: "refused" };
  }
}
