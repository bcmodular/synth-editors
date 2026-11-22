// Plans from the Sends panel and the chat go through here (docs/x32-spec.md, "Plans, apply, read-back, undo"): a plan
// that needs confirming is held until the user presses Apply; the rest are applied straight away. Applied plans go on
// the undo stack. Writes go through the applier, under the chat's allowed list, and are read back.

import { applyChanges, refuseOutside, type ApplyResult, type DeskIO, type Mismatch } from "./applier";
import { loadPreset } from "./library";
import { undoPlan, type Plan, type PlanContext } from "./planner";
import type { Requester } from "./scenes";
import { sharedOutputAddresses, type SharedBus } from "./shared";

// The chat may write sends (on and level), channel inserts, effect types, parameters and bus feeds (guard 3 keeps send
// effects as they are), and the output patches of a shared bus's targets, and nothing else.
export const CHAT_SENDS: RegExp = /^\/(ch|auxin|fxrtn)\/\d\d\/mix\/(0[1-9]|1[0-6])\/(on|level)$/;
export const CHAT_EFFECTS: RegExp[] = [
  /^\/ch\/\d\d\/insert\/(on|pos|sel)$/,
  /^\/fx\/[1-8]\/(type|par\/\d\d)$/,
  /^\/fx\/[1-4]\/source\/[lr]$/,
];

export function chatAllowed(shared: SharedBus[]): RegExp[] {
  const outputs = sharedOutputAddresses(shared).map((a) => new RegExp(`^${a.replace(/\//g, "\\/")}$`));
  return [CHAT_SENDS, ...CHAT_EFFECTS, ...outputs];
}

export type Outcome =
  | { kind: "applied"; plan: Plan; result: ApplyResult }
  | { kind: "nothing"; plan: Plan } // already as asked
  | { kind: "waiting"; plan: Plan } // held for the user to confirm
  | { kind: "mismatch"; plan: Plan; mismatch: Mismatch }
  | { kind: "offline"; plan: Plan };

export interface OperatorDesk extends DeskIO, Requester {
  connected(): boolean;
}

export class Operator {
  private held: { plan: Plan; undoable: boolean } | null = null;
  private readonly undoStack: Plan[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly desk: OperatorDesk,
    private readonly allowed: RegExp[],
  ) {}

  get pending(): Plan | null {
    return this.held?.plan ?? null;
  }

  get lastApplied(): Plan | null {
    return this.undoStack.at(-1) ?? null;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Apply a plan now, or hold it for confirmation. A new plan replaces one still waiting.
  async propose(plan: Plan): Promise<Outcome> {
    if (!plan.changes.length && !plan.load) return this.settle({ kind: "nothing", plan });
    return this.holdOrApply(plan, true);
  }

  async confirm(): Promise<Outcome | null> {
    const held = this.held;
    if (!held) return null;
    this.held = null;
    return this.apply(held.plan, held.undoable);
  }

  // Apply at once, without asking and without going on the undo stack (the tempo button: the press is the
  // confirmation, and the next press sets it again).
  async applyNow(plan: Plan): Promise<Outcome> {
    if (!plan.changes.length) return this.settle({ kind: "nothing", plan });
    return this.apply(plan, false);
  }

  cancel(): void {
    this.held = null;
    this.changed();
  }

  // Undo the last applied plan. If its values were changed since, the undo is held for confirmation.
  async undo(ctx: PlanContext): Promise<Outcome | null> {
    const last = this.undoStack.at(-1);
    if (!last) return null;
    const plan = undoPlan(ctx, last);
    this.undoStack.pop();
    return this.holdOrApply(plan, false);
  }

  private holdOrApply(plan: Plan, undoable: boolean): Promise<Outcome> | Outcome {
    if (!plan.confirm) return this.apply(plan, undoable);
    this.held = { plan, undoable };
    return this.settle({ kind: "waiting", plan });
  }

  private async apply(plan: Plan, undoable: boolean): Promise<Outcome> {
    if (!this.desk.connected()) return this.settle({ kind: "offline", plan });
    const outcome = await this.write(plan);
    // A preset load replaces every parameter of the slot, which the app doesn't keep, so it can't be undone here.
    const keep = undoable && !plan.load && outcome.kind === "applied" && outcome.result.written > 0;
    if (keep) this.undoStack.push(plan);
    return this.settle(outcome);
  }

  // The preset load first, if any, then the changes; the first thing that doesn't read back stops it.
  private async write(plan: Plan): Promise<Outcome> {
    refuseOutside(plan.changes, this.allowed); // before a preset load: nothing happens if anything is refused
    const loaded = plan.load ? await loadPreset(this.desk, plan.load) : null;
    if (loaded) return { kind: "mismatch", plan, mismatch: loaded };
    const result = await applyChanges(this.desk, plan.changes, this.allowed);
    const mismatch = result.mismatches[0];
    if (mismatch) return { kind: "mismatch", plan, mismatch };
    return { kind: "applied", plan, result: { ...result, written: result.written + (plan.load ? 1 : 0) } };
  }

  private settle(outcome: Outcome): Outcome {
    this.changed();
    return outcome;
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }
}
