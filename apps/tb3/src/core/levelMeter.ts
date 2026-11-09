// A peak level meter in dBFS (docs/tb3-live-waveform-design.md): instant rise, a steady fall so it can
// be read, a peak-hold tick, and a clip light that stays on until cleared.

export const METER_FLOOR_DB = -48;
export const FALL_DB_PER_S = 24;
export const HOLD_S = 1.5;
const CLIP_LEVEL = 0.999; // a sample this close to full scale counts as clipping

export interface Meter {
  db: number; // the bar
  holdDb: number; // the peak-hold tick
  holdUntil: number; // seconds
  at: number; // seconds, when last updated
  clipped: boolean;
  maxDb: number; // highest peak since cleared
}

export const toDb = (level: number) => (level > 0 ? 20 * Math.log10(level) : -Infinity);

export const silentMeter = (now = 0): Meter => ({
  db: -Infinity,
  holdDb: -Infinity,
  holdUntil: now,
  at: now,
  clipped: false,
  maxDb: -Infinity,
});

function peakOf(samples: ArrayLike<number>) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]!));
  return peak;
}

// The meter after the samples that arrived by `now` (seconds).
export function meterStep(m: Meter, samples: ArrayLike<number>, now: number): Meter {
  const peak = peakOf(samples);
  const db = toDb(peak);
  const fallen = m.db - FALL_DB_PER_S * Math.max(0, now - m.at);
  const holdNew = db >= m.holdDb || now >= m.holdUntil;
  return {
    db: Math.max(db, fallen),
    holdDb: holdNew ? db : m.holdDb,
    holdUntil: holdNew ? now + HOLD_S : m.holdUntil,
    at: now,
    clipped: m.clipped || peak >= CLIP_LEVEL,
    maxDb: Math.max(m.maxDb, db),
  };
}

export const clearClip = (m: Meter): Meter => ({ ...m, clipped: false, maxDb: -Infinity });

// How far up the bar a level reaches, 0 (floor or silence) to 1 (0 dBFS).
export const meterFraction = (db: number) => Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));

const SILENT_DB = -90; // below this it's digital silence, not a level worth reading

// "−6.2 dB", or "–" for silence.
export const formatDb = (db: number) => (db < SILENT_DB ? "–" : `${db.toFixed(1).replace("-", "−")} dB`);
