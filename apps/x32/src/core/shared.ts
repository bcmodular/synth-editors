// Shared buses (docs/x32-spec.md, "One-off setup"): one bus that feeds one of several devices at a time, like the
// Sampler (SP-404, Koala or P-6). The rig file lists the targets; the desk's output patches say which one is live.

import type { Lookup } from "./rig";
import { OUTPUT_SOURCE, output, type Logical } from "./routing";
import type { RigBus, RigFile } from "./rigFile";

export interface SharedBus {
  name: string; // as in the rig file ("Sampler")
  buses: number[];
  targets: { name: string; outputs: Logical[] }[];
}

export const sharedBuses = (rig: RigFile): SharedBus[] =>
  rig.buses.filter((b: RigBus) => b.targets.length > 0).map((b) => ({ name: b.name, buses: b.buses, targets: b.targets }));

// The value an output's patch takes to carry a bus.
export const busSource = (bus: number): number => OUTPUT_SOURCE.bus + bus;

const carries = (get: Lookup, outputs: Logical[], buses: number[]) =>
  outputs.every((o, i) => get(output(o).address) === busSource(buses[i]!));

// The target whose outputs carry the bus now, or null if none does (switched off, or patched by hand elsewhere).
export function liveTarget(get: Lookup, shared: SharedBus): string | null {
  return shared.targets.find((t) => carries(get, t.outputs, shared.buses))?.name ?? null;
}

// The output patches a shared bus may change: its targets' outputs, and nothing else.
export const sharedOutputAddresses = (shared: SharedBus[]): string[] =>
  shared.flatMap((s) => s.targets.flatMap((t) => t.outputs.map((o) => output(o).address)));
