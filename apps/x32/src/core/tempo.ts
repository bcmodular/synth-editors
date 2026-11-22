// The tempo bridge (docs/x32-spec.md, "Tempo bridge"): the tempo of incoming MIDI clock, whether it has settled, and the
// plan that sets every synced delay's Time to match. Pure, so it runs under vitest; useTempoBridge feeds it Web MIDI.

import { fx } from "./addresses";
import { effectAt, findParam, fromDesk, fxParam, SYNCED_BEATS, toDesk, typeCode, typeName } from "./effects";
import { change, guarded, type Plan, type PlanContext } from "./planner";

export const CLOCK = 0xf8;
export const START = 0xfa;
export const STOP = 0xfc;
const TICKS_PER_BEAT = 24;
const AVERAGE_BEATS = 2;
export const SETTLE_BPM = 0.5; // the tempo has settled when it moved less than this over the last beat
const TIME_TOLERANCE = 0.002; // Time is 1-3000 ms in 0-1: about 6 ms

// Tempo from clock ticks: averaged over the last two beats, settled once it held still for a beat. Stop keeps the
// last tempo; Start begins again.
export class TempoMeter {
  private times: number[] = [];
  private recent: number[] = []; // the tempo after each tick of the last beat
  running = false;
  last: number | null = null; // the last tempo measured, kept after Stop

  // One MIDI message (status byte first) at a time in ms.
  take(data: ArrayLike<number>, at: number): void {
    const status = data[0];
    if (status === START) this.restart();
    else if (status === STOP) this.running = false;
    else if (status === CLOCK) this.tick(at);
  }

  private restart(): void {
    this.times = [];
    this.recent = [];
    this.running = true;
  }

  private tick(at: number): void {
    this.running = true;
    this.times.push(at);
    if (this.times.length > AVERAGE_BEATS * TICKS_PER_BEAT + 1) this.times.shift();
    const bpm = this.measured();
    if (bpm === null) return;
    this.last = bpm;
    this.recent.push(bpm);
    if (this.recent.length > TICKS_PER_BEAT) this.recent.shift();
  }

  private measured(): number | null {
    if (this.times.length <= TICKS_PER_BEAT) return null;
    const span = this.times.at(-1)! - this.times[0]!;
    return span > 0 ? (60_000 * (this.times.length - 1)) / TICKS_PER_BEAT / span : null;
  }

  // Held still (within SETTLE_BPM) for a whole beat.
  get settled(): boolean {
    if (this.recent.length < TICKS_PER_BEAT) return false;
    return Math.max(...this.recent) - Math.min(...this.recent) <= SETTLE_BPM;
  }
}

// The tempo as shown and written: one decimal place.
export const roundBpm = (bpm: number): number => Math.round(bpm * 10) / 10;

export interface SyncedDelay {
  slot: number;
  name: string; // "Stereo Delay (DLY)"
  beats: number; // the note Time is set to
  time: string; // Time now, as the desk has it ("250 ms")
  factors: string; // the Factors, which set the note values ("Factor L 3/2, Factor R 3/2")
}

const FX_SLOTS_WITH_DELAYS = [1, 2, 3, 4]; // FX 5-8 can't hold delays

// Every slot holding a delay the bridge syncs, with its Time and Factors now.
export function syncedDelays(ctx: PlanContext): SyncedDelay[] {
  return FX_SLOTS_WITH_DELAYS.flatMap((slot) => {
    const value = Number(ctx.get(fx(slot).type.address) ?? -1);
    const beats = SYNCED_BEATS[typeCode({ slot, value })];
    const def = effectAt({ slot, value });
    if (!beats || !def) return [];
    const read = (name: string) => {
      const d = findParam(def, name)!;
      return `${d.name} ${fromDesk(d, Number(ctx.get(fxParam({ slot }, d).address) ?? 0))}`;
    };
    const factors = def.params.filter((d) => d.name.startsWith("Factor")).map((d) => read(d.name)).join(", ");
    return [{ slot, name: typeName({ slot, value }), beats, time: read("Time").replace(/^Time /, ""), factors }];
  });
}

// Time in ms for a note at a tempo, within the delay's range.
export const timeMs = (bpm: number, beats: number): number => Math.min(3000, Math.max(1, (60_000 / bpm) * beats));

// The plan the tempo button applies: every synced delay's Time to the tempo. Not confirmed (the press is the
// confirmation) and not undone (the next press sets it again).
export function tempoPlan(ctx: PlanContext, bpm: number): Plan {
  const delays = syncedDelays(ctx);
  const changes = delays.flatMap((d) => {
    const def = effectAt({ slot: d.slot, value: Number(ctx.get(fx(d.slot).type.address)) })!;
    const time = findParam(def, "Time")!;
    const ms = Math.round(timeMs(bpm, d.beats));
    return change(ctx.get, { param: fxParam(d, time), value: toDesk({ def: time, value: ms }), what: `FX ${d.slot} Time ${ms} ms`, step: 1, tolerance: TIME_TOLERANCE });
  });
  const list = delays.map((d) => `FX ${d.slot} ${Math.round(timeMs(bpm, d.beats))} ms`).join(", ");
  return guarded(ctx, { summary: `Set the delays to ${roundBpm(bpm)} BPM${list ? `: ${list}` : ""}`, changes, confirm: null });
}
