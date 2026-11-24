// The clock forwarder for the Launchkey's arpeggiator (docs/h12-spec.md › Clock forwarder): which messages from the
// Nome II go on to the Launchkey, and the tempo they carry. Independent of Web MIDI, so it runs under vitest.

export const CLOCK = 0xf8;
export const START = 0xfa;
export const CONTINUE = 0xfb;
export const STOP = 0xfc;

const TICKS_PER_BEAT = 24;
const FORWARDED = new Set([CLOCK, START, CONTINUE, STOP]);

// Clock, Start, Continue and Stop go on (Start restarts the arpeggio, keeping it in phase); nothing else does.
export const forwards = (data: ArrayLike<number>): boolean => data.length === 1 && FORWARDED.has(data[0]!);

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
