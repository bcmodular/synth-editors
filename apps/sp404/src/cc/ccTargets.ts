// What a learned CC can drive in the SP-404 editor (docs/sp404-design.md › Controllers › CC learn): a bus's parameter
// slot (whatever effect is on the bus, as the BCR's encoders do) or a bus's morph amount. And how a CC message moves
// it, through packages/cc-learn (relative / pickup / jump).

import { ccValue, findAssignment, NO_TAKEOVER, type CcAssignment, type Takeover } from "@synth-editors/cc-learn";
import { effectById } from "../core/fx";
import { BUSES, type Bus } from "../core/fxTypes";
import type { Fx } from "../fx/useFx";

// "param:<bus>:<slot>" (slot 0–5) | "morph:<bus>"
export type CcTarget = string;

export type Target = { kind: "param"; bus: Bus; slot: number } | { kind: "morph"; bus: Bus };

export const paramTarget = (bus: Bus, slot: number): CcTarget => `param:${bus}:${slot}`;
export const morphTarget = (bus: Bus): CcTarget => `morph:${bus}`;

const busAt = (n: number): Bus | undefined => BUSES.find((b) => b === n);

export function targetOf(t: CcTarget): Target | undefined {
  const m = /^(param|morph):(\d)(?::(\d))?$/.exec(t);
  const bus = m ? busAt(Number(m[2])) : undefined;
  if (!m || !bus) return undefined;
  if (m[1] === "morph") return { kind: "morph", bus };
  const slot = Number(m[3]);
  return slot >= 0 && slot < 6 ? { kind: "param", bus, slot } : undefined;
}

const BUS_NAME: Record<Bus, string> = { 1: "BUS 1", 2: "BUS 2", 3: "BUS 3", 4: "BUS 4", 5: "INPUT FX" };

export type CcFx = Pick<Fx, "state" | "play" | "setValue">;

// "BUS 1 · 2 RESO": the bus, the slot, and the parameter there now.
export function targetLabel(t: CcTarget, fx: CcFx): string {
  const x = targetOf(t);
  if (!x) return t;
  if (x.kind === "morph") return `${BUS_NAME[x.bus]} · MORPH`;
  const p = effectById(fx.state.buses[x.bus].fxId)?.params[x.slot];
  return `${BUS_NAME[x.bus]} · ${x.slot + 1}${p ? ` ${p.label}` : ""}`;
}

const MORPH_MAX = 127;

// The target's value now (0–127), or null when it has none (no effect there, morph without a target).
function currentOf(x: Target, fx: CcFx): number | null {
  if (x.kind === "morph") {
    const m = fx.play.morphs[x.bus];
    return m?.slot === undefined ? null : Math.round(m.amount * MORPH_MAX);
  }
  const b = fx.state.buses[x.bus];
  return b.fxId && x.slot < b.values.length ? (b.values[x.slot] ?? 0) : null;
}

function setTarget(x: Target, fx: CcFx, value: number) {
  if (x.kind === "morph") fx.play.setMorphAmount(x.bus, value / MORPH_MAX);
  else fx.setValue(x.bus, x.slot, value);
}

// A CC message → the assignment's target, remembering each assignment's takeover for pickup.
export class CcApplier {
  private readonly takeovers = new Map<CcTarget, Takeover>();

  apply(list: readonly CcAssignment[], from: { channel: number; cc: number; value: number }, fx: CcFx): boolean {
    const a = findAssignment(list, from);
    const x = a && targetOf(a.target);
    if (!a || !x) return false;
    const current = currentOf(x, fx);
    if (current === null) return true; // nothing to drive there now
    const r = ccValue({ mode: a.mode, value: from.value, current, max: MORPH_MAX }, this.takeovers.get(a.target) ?? NO_TAKEOVER);
    this.takeovers.set(a.target, r.takeover);
    if (r.value !== null && r.value !== current) setTarget(x, fx, r.value);
    return true;
  }
}
