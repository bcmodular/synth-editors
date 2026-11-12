// The keyboard controller on KEYS IN (docs/tb3-phase4-design.md): notes and pitch bend go to the TB-3 on its channel,
// learned CCs drive their targets, other CCs pass through to the TB-3, and while learning the next CC is assigned.
import { ccValue, findAssignment, NO_TAKEOVER } from "@synth-editors/cc-learn";
import type { CcAssignment, Takeover } from "@synth-editors/cc-learn";
import type { CcTarget } from "./ccTargets";

export interface TargetValue {
  current: number | null;
  max: number;
}

export interface KeysDeps {
  tb3Channel: () => number; // 1–16
  send: (msg: number[]) => void; // to the TB-3
  assignments: () => readonly CcAssignment[];
  listening: () => CcTarget | null; // a target waiting for its CC
  learned: (channel: number, cc: number) => void;
  read: (t: CcTarget) => TargetValue;
  write: (t: CcTarget, value: number) => void;
}

const PASSED = new Set([0x80, 0x90, 0xb0, 0xe0]); // notes, CCs, pitch bend

export function launchkeyHandler(d: KeysDeps): (data: ArrayLike<number>) => void {
  const takeovers = new Map<CcTarget, Takeover>();
  const pass = (status: number, data: ArrayLike<number>) =>
    d.send([status | (d.tb3Channel() - 1), data[1] ?? 0, data[2] ?? 0]);

  const drive = (a: CcAssignment, value: number) => {
    const r = ccValue({ mode: a.mode, value, ...d.read(a.target) }, takeovers.get(a.target) ?? NO_TAKEOVER);
    takeovers.set(a.target, r.takeover);
    if (r.value !== null) d.write(a.target, r.value);
  };

  const cc = (channel: number, data: ArrayLike<number>) => {
    const num = data[1] ?? 0;
    if (d.listening() !== null) return d.learned(channel, num);
    const a = findAssignment(d.assignments(), { channel, cc: num });
    if (a) drive(a, data[2] ?? 0);
    else pass(0xb0, data);
  };

  return (data) => {
    const status = (data[0] ?? 0) & 0xf0;
    if (!PASSED.has(status)) return;
    if (status === 0xb0) cc(((data[0] ?? 0) & 0x0f) + 1, data);
    else pass(status, data);
  };
}
