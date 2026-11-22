// Plans from the Sends panel and the chat go through here (docs/x32-spec.md, "Plans, apply, read-back, undo"): a plan
// that needs confirming is held until the user presses Apply; the rest are applied straight away. Applied plans go on
// the undo stack. Writes go through the applier, under the chat's allowed list, and are read back.

import { applyChanges, type ApplyResult, type DeskIO, type Mismatch } from "./applier";
import { undoPlan, type Plan, type PlanContext } from "./planner";
import { sharedOutputAddresses, type SharedBus } from "./shared";

// The chat may write sends (on and level) and the output patches of a shared bus's targets, and nothing else. Inserts,
// FX and spare-channel routing join this list in phase 5.
export const CHAT_SENDS: RegExp = /^\/(ch|auxin|fxrtn)\/\d\d\/mix\/(0[1-9]|1[0-6])\/(on|level)$/;

export function chatAllowed(shared: SharedBus[]): RegExp[] {
  const outputs = sharedOutputAddresses(shared).map((a) => new RegExp(`^${a.replace(/\//g, "\\/")}$`));
  return [CHAT_SENDS, ...outputs];
}

export type Outcome =
  | { kind: "applied"; plan: Plan; result: ApplyResult }
  | { kind: "nothing"; plan: Plan } // already as asked
  | { kind: "waiting"; plan: Plan } // held for the user to confirm
  | { kind: "mismatch"; plan: Plan; mismatch: Mismatch }
  | { kind: "offline"; plan: Plan };

export interface OperatorDesk extends DeskIO {
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
    if (!plan.changes.length) return this.settle({ kind: "nothing", plan });
    return this.holdOrApply(plan, true);
  }

  async confirm(): Promise<Outcome | null> {
    const held = this.held;
    if (!held) return null;
    this.held = null;
    return this.apply(held.plan, held.undoable);
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
    const result = await applyChanges(this.desk, plan.changes, this.allowed);
    const mismatch = result.mismatches[0];
    if (undoable && result.written) this.undoStack.push(plan);
    return this.settle(mismatch ? { kind: "mismatch", plan, mismatch } : { kind: "applied", plan, result });
  }

  private settle(outcome: Outcome): Outcome {
    this.changed();
    return outcome;
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }
}
