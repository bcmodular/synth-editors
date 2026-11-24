// The live trace (docs/x32-spec.md, "Trace signal", traceSignal): while the source plays, the desk's meters along the
// path are watched for a few seconds, and the first stage with no level (below about -60 dBFS) is where it stops. The
// settings check (pathCheck.ts) then says why, where it can.

import { strip } from "./addresses";
import { dbfs, METER_AT, type MeterAt, type Peaks } from "./meters";
import { checkPath, type PathRequest } from "./pathCheck";
import { findDestination, findSource, type PlanContext } from "./planner";
import { deriveRig, type Rig, type Source } from "./rig";
import { LOCAL_OUTPUTS } from "./enums";
import { output, type Logical } from "./routing";
import { busSource } from "./shared";
import { label, outputLabel } from "./targets";

export const SILENT = 0.001; // -60 dBFS
const MAIN_NAMES = /^(the )?(main|main mix|mains|lr|main lr|master)$/i;

export interface Stage {
  name: string;
  at: MeterAt;
}

const sourceStage = (s: Source): Stage => {
  const first = strip(s.kind, s.numbers[0]!);
  return { name: `${s.name} (${label(first)})`, at: METER_AT[s.kind as "ch" | "auxin" | "fxrtn"](first.n) };
};

const outputStage = (o: Logical): Stage =>
  ({ name: outputLabel(o.kind, o.n), at: o.kind === "aux" ? METER_AT.auxOut(o.n) : METER_AT.output(o.n) });

// The first local output patched to a bus (a shared bus's live target's, too).
function patchedOutput(ctx: PlanContext, bus: number): Logical | null {
  const kinds = [["main", LOCAL_OUTPUTS.main], ["aux", LOCAL_OUTPUTS.aux]] as const;
  for (const [kind, count] of kinds) {
    for (let n = 1; n <= count; n++) if (ctx.get(output({ kind, n }).address) === busSource(bus)) return { kind, n };
  }
  return null;
}

// Where a bus's signal goes next: its effect's return, or the output it's patched to.
function afterBus(ctx: PlanContext, rig: Rig, bus: number): Stage[] {
  const fxSlot = rig.destinations.find((x) => x.numbers.includes(bus))?.fxSlot;
  if (fxSlot) return [{ name: `the FX ${fxSlot} return`, at: METER_AT.fxrtn(2 * fxSlot - 1) }];
  const out = patchedOutput(ctx, bus);
  return out ? [outputStage(out)] : [];
}

// The meters to watch, in order along the path.
export function traceStages(ctx: PlanContext, req: PathRequest): Stage[] {
  const rig = deriveRig(ctx.get);
  const source = findSource(rig, req);
  if (MAIN_NAMES.test(req.destination.trim())) return [sourceStage(source), { name: "the main mix", at: METER_AT.mainL() }];
  const d = findDestination(ctx, rig, req);
  return [sourceStage(source), { name: `bus ${d.buses[0]} (${d.label})`, at: METER_AT.bus(d.buses[0]!) }, ...afterBus(ctx, rig, d.buses[0]!)];
}

// The banks to subscribe to for these stages.
export const banksOf = (stages: Stage[]): number[] => [...new Set(stages.map((s) => s.at.bank))];

const level = (v: number) => `${Math.round(dbfs(v))} dBFS`;
const NO_INPUT = "Check the cable, the socket it's on (the rig file), and the source's own volume; the app never changes gain.";

export function traceText(ctx: PlanContext, req: PathRequest, stages: Stage[], peaks: Peaks): string {
  const silent = stages.findIndex((s) => peaks.at(s.at) < SILENT);
  if (silent < 0) return `The signal reaches ${stages.at(-1)!.name} at ${level(peaks.at(stages.at(-1)!.at))}. If it still isn't heard, check the device it goes to.`;
  if (silent === 0) return `No level at ${stages[0]!.name} while it played: the signal isn't reaching the desk. ${NO_INPUT}`;
  const before = stages[silent - 1]!;
  const blocks = checkPath(ctx, req).blocks;
  const why = blocks.length ? ` The settings say why: ${blocks.join("; ")}.` : " Nothing in the settings explains it.";
  return `${before.name} has level (${level(peaks.at(before.at))}), but ${stages[silent]!.name} is silent.${why}`;
}
