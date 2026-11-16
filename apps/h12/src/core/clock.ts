// MIDI clock for the Launchkey test (docs/h12-spec.md › Clock forwarder): does the Launchkey 49 Mk4's arpeggiator
// follow clock sent to its USB MIDI port? Two sources: clock generated here at a set tempo, and the Nome II's clock
// forwarded as it arrives. Independent of Web MIDI, so it runs under vitest.

export const CLOCK = 0xf8;
export const START = 0xfa;
export const CONTINUE = 0xfb;
export const STOP = 0xfc;

const TICKS_PER_BEAT = 24;
export const MIN_BPM = 30;
export const MAX_BPM = 300;

export const clampBpm = (bpm: number): number => Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

export const tickMs = (bpm: number): number => 60_000 / (clampBpm(bpm) * TICKS_PER_BEAT);

// Send(bytes, at): at is a performance.now() time, as Web MIDI's MIDIOutput.send takes.
export type Send = (data: number[], at?: number) => void;

export interface ClockClock {
  now(): number;
  every(ms: number, fn: () => void): () => void; // returns a stop function
}

const LOOKAHEAD_MS = 100;
const WAKE_MS = 20;

// Generated clock: wakes every WAKE_MS and schedules every tick due in the next LOOKAHEAD_MS with a timestamp, so
// the timer's own jitter doesn't reach the clock. Tick times count from an origin rather than adding up, so they
// don't drift. A tempo change takes effect from the next unscheduled tick.
export class ClockGenerator {
  private origin = 0; // the time of tick 0 at the current tempo
  private since = 0; // ticks scheduled since the origin
  private stopTimer: (() => void) | undefined;
  ticks = 0;

  constructor(private readonly send: Send, private readonly time: ClockClock, private bpm = 120) {}

  setBpm(bpm: number): void {
    this.origin = this.next;
    this.since = 0;
    this.bpm = clampBpm(bpm);
  }

  private get next(): number {
    return this.origin + this.since * tickMs(this.bpm);
  }

  get running(): boolean {
    return this.stopTimer !== undefined;
  }

  start(transport: boolean): void {
    if (this.running) return;
    this.origin = this.time.now();
    this.since = 0;
    if (transport) this.send([START], this.next);
    this.schedule();
    this.stopTimer = this.time.every(WAKE_MS, () => this.schedule());
  }

  stop(transport: boolean): void {
    if (!this.running) return;
    this.stopTimer?.();
    this.stopTimer = undefined;
    if (transport) this.send([STOP], Math.max(this.next, this.time.now()));
  }

  private schedule(): void {
    const until = this.time.now() + LOOKAHEAD_MS;
    while (this.next <= until) {
      this.send([CLOCK], this.next);
      this.ticks++;
      this.since++;
    }
  }
}

const TRANSPORT = new Set([START, CONTINUE, STOP]);

// Forwarded clock: which messages from the Nome II go on to the Launchkey. Clock always; Start/Continue/Stop only
// when asked (the arpeggiator may need them to reset its phase).
export function forwards(data: ArrayLike<number>, transport: boolean): boolean {
  if (data.length !== 1) return false;
  const status = data[0]!;
  return status === CLOCK || (transport && TRANSPORT.has(status));
}

// The tempo of incoming clock, from the times of the last beat's ticks. Undefined until a beat has arrived.
export class TempoMeter {
  private times: number[] = [];

  tick(at: number): void {
    this.times.push(at);
    if (this.times.length > TICKS_PER_BEAT + 1) this.times.shift();
  }

  reset(): void {
    this.times = [];
  }

  get bpm(): number | undefined {
    if (this.times.length <= TICKS_PER_BEAT) return undefined;
    const beatMs = this.times[this.times.length - 1]! - this.times[0]!;
    return beatMs > 0 ? 60_000 / beatMs : undefined;
  }
}
