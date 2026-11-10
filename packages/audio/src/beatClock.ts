// Beats from MIDI clock, for the beat grid on a waveform (docs/sp404-design.md › Scopes): 24 clocks per quarter
// note, Start (FA) begins at the first beat of a bar, Continue (FB) resumes, Stop (FC) stops. Bars are taken as
// four beats. Times are performance.now() milliseconds, as MIDI messages carry them.

export const CLOCKS_PER_BEAT = 24;
export const BEATS_PER_BAR = 4;
const KEEP_MS = 30_000; // beats older than this are dropped
const LOST_MS = 500; // no clock for this long: no tempo

export interface Beat {
  at: number; // ms
  beat: number; // counted from Start (or from the first clock seen), so beat % 4 === 0 is a bar line
}

export interface BeatClock {
  clocks: number; // clocks since Start
  running: boolean;
  fromStart: boolean; // the bar lines line up with a Start the clock saw
  lastAt: number | undefined;
  recent: number[]; // the last beat's worth of clock times, for the tempo
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
    recent: [...c.recent, at].slice(-(CLOCKS_PER_BEAT + 1)),
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

// Beats per minute from the last beat's clocks, or undefined when the clock has stopped or isn't arriving.
export function clockBpm(c: BeatClock, now: number): number | undefined {
  if (!arriving(c, now) || c.recent.length < CLOCKS_PER_BEAT / 2) return undefined;
  const span = c.recent[c.recent.length - 1]! - c.recent[0]!;
  return span > 0 ? (60_000 * (c.recent.length - 1)) / (span * CLOCKS_PER_BEAT) : undefined;
}

export const isBar = (b: Beat) => b.beat % BEATS_PER_BAR === 0;
