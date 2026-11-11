// Beats from MIDI clock, for the beat grid on a waveform (docs/sp404-design.md › Scopes): 24 clocks per quarter
// note, Start (FA) begins at the first beat of a bar, Continue (FB) resumes, Stop (FC) stops. Bars are taken as
// four beats. Times are performance.now() milliseconds, as MIDI messages carry them.

export const CLOCKS_PER_BEAT = 24;
export const BEATS_PER_BAR = 4;
const KEEP_MS = 30_000; // beats older than this are dropped
const LOST_MS = 500; // no clock for this long: no tempo
const TEMPO_CLOCKS = CLOCKS_PER_BEAT * 4; // the tempo is read over the last four beats
const STEADY_BPM = 0.3; // a shown tempo stays until the reading moves by this much

export interface Beat {
  at: number; // ms
  beat: number; // counted from Start (or from the first clock seen), so beat % 4 === 0 is a bar line
}

export interface BeatClock {
  clocks: number; // clocks since Start
  running: boolean;
  fromStart: boolean; // the bar lines line up with a Start the clock saw
  lastAt: number | undefined;
  recent: number[]; // the last four beats' clock times, for the tempo
  beats: Beat[];
}

export const newBeatClock = (): BeatClock => ({
  clocks: 0, running: false, fromStart: false, lastAt: undefined, recent: [], beats: [],
});

function onClock(c: BeatClock, at: number): BeatClock {
  const beats = c.clocks % CLOCKS_PER_BEAT === 0 ? [...c.beats, { at, beat: c.clocks / CLOCKS_PER_BEAT }] : c.beats;
  return {
    ...c,
    clocks: c.clocks + 1,
    lastAt: at,
    recent: [...c.recent, at].slice(-(TEMPO_CLOCKS + 1)),
    beats: beats[0] && beats[0].at < at - KEEP_MS ? beats.filter((b) => b.at >= at - KEEP_MS) : beats,
  };
}

// The clock after one MIDI message (other messages leave it as it was).
export function clockStep(c: BeatClock, status: number, at: number): BeatClock {
  if (status === 0xf8) return onClock(c, at);
  if (status === 0xfa) return { ...c, clocks: 0, running: true, fromStart: true, recent: [] };
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

// The tempo to show: the one shown already while the reading stays within STEADY_BPM of it, else the reading to
// a tenth.
export function steadyBpm(shown: number | undefined, bpm: number | undefined): number | undefined {
  if (bpm === undefined) return undefined;
  if (shown !== undefined && Math.abs(bpm - shown) < STEADY_BPM) return shown;
  return Math.round(bpm * 10) / 10;
}

export const isBar = (b: Beat) => b.beat % BEATS_PER_BAR === 0;
