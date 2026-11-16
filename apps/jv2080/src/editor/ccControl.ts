// The controller on CTRL IN: learned CCs drive their targets (packages/cc-learn decides how a knob moves a value),
// and while learning the next CC is assigned. Nothing else from the controller goes anywhere.
import { ccValue, findAssignment, NO_TAKEOVER, type CcAssignment, type Takeover } from "@synth-editors/cc-learn";
import type { CcTarget, TargetValue } from "./ccTargets";

export interface ControlDeps {
  assignments: () => readonly CcAssignment[];
  listening: () => CcTarget | null; // a target waiting for its CC
  learned: (channel: number, cc: number) => void;
  read: (t: CcTarget) => TargetValue;
  write: (t: CcTarget, value: number) => void;
}

export function controllerHandler(d: ControlDeps): (data: ArrayLike<number>) => void {
  const takeovers = new Map<CcTarget, Takeover>();
  const drive = (a: CcAssignment, value: number) => {
    const target = d.read(a.target);
    const r = ccValue({ mode: a.mode, value, ...target }, takeovers.get(a.target) ?? NO_TAKEOVER);
    takeovers.set(a.target, r.takeover);
    if (r.value !== null && target.current !== null) d.write(a.target, r.value);
  };
  return (data) => {
    const status = data[0] ?? 0;
    if ((status & 0xf0) !== 0xb0) return;
    const channel = (status & 0x0f) + 1;
    const cc = data[1] ?? 0;
    if (d.listening() !== null) return d.learned(channel, cc);
    const a = findAssignment(d.assignments(), { channel, cc });
    if (a) drive(a, data[2] ?? 0);
  };
}
