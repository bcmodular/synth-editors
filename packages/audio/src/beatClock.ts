// The tempo of a MIDI clock (docs/sp404-design.md › Scopes): 24 clocks per quarter note; Start (FA) begins
// afresh, Continue (FB) resumes, Stop (FC) stops. Times are performance.now() milliseconds, as MIDI messages carry
// them. There's no beat or bar position: joining a running clock, there's no telling where a bar starts.

export const CLOCKS_PER_BEAT = 24;
const LOST_MS = 500; // no clock for this long: no tempo
const TEMPO_CLOCKS = CLOCKS_PER_BEAT * 4; // the tempo is read over the last four beats
const STEADY_BPM = 0.06; // a shown tempo stays until the reading moves by just over half its last digit

export interface BeatClock {
  running: boolean;
  lastAt: number | undefined;
  recent: number[]; // the last four beats' clock times, for the tempo
}

export const newBeatClock = (): BeatClock => ({ running: false, lastAt: undefined, recent: [] });

const onClock = (c: BeatClock, at: number): BeatClock =>
  ({ ...c, lastAt: at, recent: [...c.recent, at].slice(-(TEMPO_CLOCKS + 1)) });

// The clock after one MIDI message (other messages leave it as it was).
export function clockStep(c: BeatClock, status: number, at: number): BeatClock {
  if (status === 0xf8) return onClock(c, at);
  if (status === 0xfa) return { ...c, running: true, recent: [] };
  if (status === 0xfb) return { ...c, running: true };
  if (status === 0xfc) return { ...c, running: false };
  return c;
}

const arriving = (c: BeatClock, now: number) => c.lastAt !== undefined && now - c.lastAt <= LOST_MS;

// Milliseconds per clock: the slope of a least-squares line through the clock times, so one late or early
// message barely moves it.
function msPerClock(times: number[]): number {
  const n = times.length;
  const meanI = (n - 1) / 2;
  const meanT = times.reduce((a, t) => a + t, 0) / n;
  let num = 0;
  let den = 0;
  times.forEach((t, i) => {
    num += (i - meanI) * (t - meanT);
    den += (i - meanI) ** 2;
  });
  return num / den;
}

// Beats per minute from the last four beats' clocks, or undefined when the clock has stopped or isn't arriving.
export function clockBpm(c: BeatClock, now: number): number | undefined {
  if (!arriving(c, now) || c.recent.length < CLOCKS_PER_BEAT / 2) return undefined;
  const ms = msPerClock(c.recent);
  return ms > 0 ? 60_000 / (ms * CLOCKS_PER_BEAT) : undefined;
}

// The tempo to show, to a tenth: the one shown already while the reading stays within STEADY_BPM of it (so a
// reading on the edge between two tenths doesn't flicker), else the reading rounded.
export function steadyBpm(shown: number | undefined, bpm: number | undefined): number | undefined {
  if (bpm === undefined) return undefined;
  if (shown !== undefined && Math.abs(bpm - shown) < STEADY_BPM) return shown;
  return Math.round(bpm * 10) / 10;
}
