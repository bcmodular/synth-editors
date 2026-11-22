// The difference between the rig file and the desk: every target whose desk value differs, grouped by area, plus the
// steps only a person can do (phantom power, gain). Pure: the desk's values come in through a lookup.

import type { DeskValue } from "./cache";
import { formatDb, sameLevel } from "./faderLaw";
import type { RigFile } from "./rigFile";
import { AREAS, type Area, type Target } from "./targets";

export interface Change extends Target {
  from: DeskValue | undefined; // undefined: the desk didn't answer
}

export interface SetupPlan {
  changes: Change[];
  byArea: Record<Area, Change[]>;
  unchanged: number;
  manual: string[];
}

export type Lookup = (address: string) => DeskValue | undefined;

// Levels are floats the desk stores in steps (and sends back as 32-bit floats), so they match on the step.
const isLevel = (v: DeskValue | undefined): v is number => typeof v === "number" && !Number.isInteger(v);
export const sameValue = (got: DeskValue | undefined, want: DeskValue): boolean =>
  isLevel(want) && typeof got === "number" ? sameLevel(got, want) : got === want;
const differs = (from: DeskValue | undefined, to: DeskValue) => !sameValue(from, to);

function phantomSteps(rig: RigFile): string[] {
  return rig.sources
    .filter((s) => s.phantom)
    .map((s) => `${s.name}: phantom power, ${s.phantom} (switch it in X32-Edit; the app never does)`);
}

export function manualSteps(rig: RigFile): string[] {
  return [...phantomSteps(rig), ...rig.manual];
}

export function planSetup(targets: Target[], get: Lookup, manual: string[] = []): SetupPlan {
  const changes = targets
    .map((t) => ({ ...t, from: get(t.param.address) }))
    .filter((c) => differs(c.from, c.value));
  const byArea = Object.fromEntries(AREAS.map((a) => [a, changes.filter((c) => c.area === a)])) as Record<Area, Change[]>;
  return { changes, byArea, unchanged: targets.length - changes.length, manual };
}

// The changes in the order they're written: routing first, names last.
export const applyOrder = (changes: Change[]): Change[] => [...changes].sort((a, b) => a.step - b.step);

const showsAsDb = (v: DeskValue, type?: string): v is number => isLevel(v) || (type === "f" && typeof v === "number");

// How a value reads in the plan. Pass the param's type so a fader at 0 reads as -∞, not 0.
export function show(v: DeskValue | undefined, type?: string): string {
  if (v === undefined) return "(no answer)";
  if (showsAsDb(v, type)) return formatDb(v);
  return typeof v === "string" ? `"${v}"` : String(v);
}
