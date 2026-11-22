// Intent → plan (docs/x32-spec.md, "Intent tools"): what to write for "send S-1 to the P-6", worked out from the desk
// as it is now. Names are as the desk shows them. Nothing is written here; every plan is checked against the loop
// guards, and says whether a person has to confirm it first.

import { strip, send, type Param } from "./addresses";
import type { Write } from "./applier";
import type { DeskValue } from "./cache";
import { formatDb, levelFromDb, quantizeLevel } from "./faderLaw";
import { newLoops, sendEffectsTouched } from "./guards";
import { sameName } from "./names";
import { deriveRig, type Lookup, type Rig, type Source } from "./rig";
import { OUTPUT_SOURCE, output } from "./routing";
import { sameValue } from "./setupPlan";
import { outputLabel } from "./targets";
import type { PresetLoad } from "./library";
import type { LibPreset } from "./presets";
import type { RigFx } from "./rigFile";
import { busSource, liveTarget, type SharedBus } from "./shared";

export interface PlanChange extends Write {
  from: DeskValue | undefined;
}

export interface Plan {
  summary: string;
  changes: PlanChange[];
  confirm: string | null; // why a person must confirm it first; null: applied straight away
  load?: PresetLoad; // a library preset loaded before the changes; such a plan can't be undone from here
}

export class Refused extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "Refused";
  }
}

export interface PlanContext {
  get: Lookup;
  shared: SharedBus[];
  feeds?: RigFx[]; // the rig file's FX feeds, put back when an insert that took a fed slot is removed
  presets?: LibPreset[]; // the preset catalogue, matched to the desk's FX library
}

export type SendMode = "add" | "replace";

interface Destination {
  label: string; // "P-6", or "the Sampler (→ P-6)"
  buses: number[];
  shared: SharedBus | null;
  target: string | null; // the shared bus's target this destination names
}

// What the user asked for, by the desk's names.
export interface SendRequest {
  source: string;
  destination: string;
  mode?: SendMode; // default "add"
  levelDb?: number; // default 0 dB
}

export interface EffectsRequest {
  destination: string;
  on: boolean;
}

// Steps: sends off first, then a shared bus switched, then sends on, so no step makes a loop on the way.
const OFF = 1;
const SWITCH = 2;
const ON = 3;

const names = (items: { name: string }[]) => items.map((i) => i.name).join(", ");

export function findSource(rig: Rig, req: Pick<SendRequest, "source">): Source {
  const found = rig.sources.find((s) => sameName(s.name, req.source));
  if (!found) throw new Refused(`No source named "${req.source}". Sources: ${names(rig.sources)}`);
  return found;
}

const sharedFor = (ctx: PlanContext, d: Rig["destinations"][number]) => ctx.shared.find((s) => s.buses[0] === d.numbers[0]) ?? null;

function sharedTarget(ctx: PlanContext, req: Pick<SendRequest, "destination">): Destination | null {
  for (const sb of ctx.shared) {
    const t = sb.targets.find((x) => sameName(x.name, req.destination));
    if (t) return { label: `the ${sb.name} (→ ${t.name})`, buses: sb.buses, shared: sb, target: t.name };
  }
  return null;
}

export function findDestination(ctx: PlanContext, rig: Rig, req: Pick<SendRequest, "destination">): Destination {
  const d = rig.destinations.find((x) => sameName(x.name, req.destination));
  if (d) return { label: d.name, buses: d.numbers, shared: sharedFor(ctx, d), target: null };
  const t = sharedTarget(ctx, req);
  if (t) return t;
  const targets = ctx.shared.flatMap((s) => s.targets);
  throw new Refused(`No destination named "${req.destination}". Destinations: ${names([...rig.destinations, ...targets])}`);
}

// A change if the desk doesn't already have the value.
export function change(get: Lookup, w: Write): PlanChange[] {
  const from = get(w.param.address);
  return sameValue(from, w.value) ? [] : [{ ...w, from }];
}

const strips = (s: Source) => s.numbers.map((n) => strip(s.kind, n));
const each = (s: Source, d: Destination) => strips(s).flatMap((from) => d.buses.map((bus) => ({ m: send(from, bus), bus })));

function sendOn(get: Lookup, s: Source, d: Destination, level: number): PlanChange[] {
  return each(s, d).flatMap(({ m, bus }) => [
    ...change(get, { param: m.on, value: 1, what: `${s.name} → bus ${bus} on`, step: ON }),
    ...change(get, { param: m.level, value: level, what: `${s.name} → bus ${bus} at ${formatDb(level)}`, step: ON }),
  ]);
}

function sendOff(get: Lookup, s: Source, d: Destination): PlanChange[] {
  return each(s, d).flatMap(({ m, bus }) => change(get, { param: m.on, value: 0, what: `${s.name} → bus ${bus} off`, step: OFF }));
}

// A shared bus to its named target: that target's outputs carry the bus, the others' are off.
function switchTarget(get: Lookup, d: Destination): PlanChange[] {
  const sb = d.shared!;
  return sb.targets.flatMap((t) => t.outputs.flatMap((o, i) => {
    const on = t.name === d.target;
    const where = outputLabel(o.kind, o.n);
    const value = on ? busSource(sb.buses[i]!) : OUTPUT_SOURCE.off;
    return change(get, { param: output(o), value, what: on ? `${where} ← ${sb.name} (${t.name})` : `${where} off`, step: SWITCH });
  }));
}

const sendsTo = (s: Source, d: Destination) => s.sends.some((x) => d.buses.includes(x.bus));
const needsSwitch = (ctx: PlanContext, d: Destination) => !!d.shared && !!d.target && liveTarget(ctx.get, d.shared) !== d.target;

export function guarded(ctx: PlanContext, plan: Plan): Plan {
  const loops = newLoops(ctx.get, plan.changes, ctx.shared);
  if (loops.length) throw new Refused(`Refused: ${loops[0]}, a feedback loop`);
  const sendFx = sendEffectsTouched(ctx.get, plan.changes);
  if (sendFx.length) throw new Refused(`Refused: ${sendFx[0]}`);
  return plan;
}

function resolve(ctx: PlanContext, req: SendRequest) {
  const rig = deriveRig(ctx.get);
  return { rig, source: findSource(rig, req), dest: findDestination(ctx, rig, req) };
}

interface SendParts {
  source: Source;
  dest: Destination;
  level: number;
  others: Source[]; // switched off
  switching: boolean; // the shared bus switches to dest.target
}

function sendSummary(p: SendParts): string {
  const parts = [`Send ${p.source.name} to ${p.dest.label} at ${formatDb(p.level)}`];
  if (p.switching) parts.push(`switch the ${p.dest.shared!.name} to the ${p.dest.target}`);
  if (p.others.length) parts.push(`stop sending ${names(p.others)} to it`);
  return parts.join("; ");
}

export function sendTo(ctx: PlanContext, req: SendRequest): Plan {
  const { rig, source, dest } = resolve(ctx, req);
  const level = quantizeLevel(levelFromDb(req.levelDb ?? 0));
  const switching = needsSwitch(ctx, dest);
  const others = req.mode === "replace" ? rig.sources.filter((s) => s !== source && sendsTo(s, dest)) : [];
  const changes = [
    ...others.flatMap((s) => sendOff(ctx.get, s, dest)),
    ...(switching ? switchTarget(ctx.get, dest) : []),
    ...sendOn(ctx.get, source, dest, level),
  ];
  const summary = sendSummary({ source, dest, level, others, switching });
  const confirm = others.length || switching ? "It switches sends or outputs off" : null;
  return guarded(ctx, { summary, changes, confirm });
}

export function removeSend(ctx: PlanContext, req: SendRequest): Plan {
  const { source, dest } = resolve(ctx, req);
  return guarded(ctx, { summary: `Stop sending ${source.name} to ${dest.label}`, changes: sendOff(ctx.get, source, dest), confirm: "It switches a send off" });
}

// The FX returns and every other device's return (the King Rat), for sampling with effects.
function effectSources(rig: Rig, dest: Destination): Source[] {
  const fxReturns = rig.sources.filter((s) => s.kind === "fxrtn");
  const others = rig.destinations.filter((d) => d.numbers[0] !== dest.buses[0]);
  return [...fxReturns, ...others.flatMap((d) => (d.deviceReturn ? [d.deviceReturn] : []))];
}

export function includeEffects(ctx: PlanContext, req: EffectsRequest): Plan {
  const rig = deriveRig(ctx.get);
  const dest = findDestination(ctx, rig, req);
  const sources = effectSources(rig, dest);
  const level = quantizeLevel(levelFromDb(0));
  const changes = sources.flatMap((s) => (req.on ? sendOn(ctx.get, s, dest, level) : sendOff(ctx.get, s, dest)));
  const summary = `${req.on ? "Also send" : "Stop sending"} ${names(sources)} to ${dest.label}`;
  return guarded(ctx, { summary, changes, confirm: req.on ? null : "It switches sends off" });
}

// The reverse of an applied plan, last change first. If anything it wrote has changed since (moved on the X-Touch),
// confirm first.
export function undoPlan(ctx: PlanContext, applied: Plan): Plan {
  const changes = [...applied.changes]
    .reverse()
    .filter((c) => c.from !== undefined)
    .map((c) => ({ param: c.param, value: c.from!, from: ctx.get(c.param.address), what: `undo ${c.what}`, step: ON + OFF - (c.step ?? ON) }));
  const moved = applied.changes.filter((c) => !sameValue(ctx.get(c.param.address), c.value));
  const confirm = moved.length ? `${moved.length} of its values changed since (${moved[0]!.what}); undo overwrites them` : null;
  return guarded(ctx, { summary: `Undo: ${applied.summary}`, changes, confirm });
}
