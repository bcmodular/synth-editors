// The X32's fader law: faders and send levels are floats 0.0–1.0, made of four straight segments in dB
// (Maillot, "Unofficial X32/M32 OSC Remote Protocol"). 0.75 is 0 dB, 1.0 is +10 dB and 0.0 is −∞.

export const MIN_DB = -90;
export const MAX_DB = 10;
// The desk stores levels in 1024 steps, so a written level reads back on the nearest step.
export const LEVEL_STEPS = 1024;

interface Segment {
  from: number; // lowest level in the segment
  slope: number; // dB per unit of level
  offset: number; // dB at level 0 on this segment's line
}

// Highest first, so the first segment whose `from` is ≤ the level is the one it's on.
const SEGMENTS: Segment[] = [
  { from: 0.5, slope: 40, offset: -30 },
  { from: 0.25, slope: 80, offset: -50 },
  { from: 0.0625, slope: 160, offset: -70 },
  { from: 0, slope: 480, offset: -90 },
];

const dbAt = (s: Segment, level: number) => level * s.slope + s.offset;

export function dbFromLevel(level: number): number {
  if (level <= 0) return -Infinity;
  const l = Math.min(level, 1);
  const segment = SEGMENTS.find((s) => l >= s.from) ?? SEGMENTS[SEGMENTS.length - 1]!;
  return dbAt(segment, l);
}

export function levelFromDb(db: number): number {
  if (db <= MIN_DB) return 0;
  const d = Math.min(db, MAX_DB);
  const segment = SEGMENTS.find((s) => d >= dbAt(s, s.from)) ?? SEGMENTS[SEGMENTS.length - 1]!;
  return (d - segment.offset) / segment.slope;
}

// The step the desk will store a level on.
export const quantizeLevel = (level: number): number =>
  Math.round(Math.min(Math.max(level, 0), 1) * (LEVEL_STEPS - 1)) / (LEVEL_STEPS - 1);

// Two levels the desk would store on the same step (for skip-if-equal and read-back).
export const sameLevel = (a: number, b: number): boolean => quantizeLevel(a) === quantizeLevel(b);

// "0 dB", "-10.5 dB", "+3 dB", "-∞", for plans and the Rig panel.
export function formatDb(level: number): string {
  const db = dbFromLevel(level);
  if (db === -Infinity) return "-∞";
  const rounded = Math.round(db * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded === 0 ? 0 : rounded} dB`;
}
