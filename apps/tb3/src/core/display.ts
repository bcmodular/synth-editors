// Shared value formatters and lookup tables (ported from the TouchOSC Lua scripts).

const sign = (n: number): string => (n >= 0 ? "+" : "") + n;

// Offset formatters: raw → signed number around a centre, explicit "+".
export const fmtSigned = (raw: number): string => sign(raw - 64); // s7, raw 64 = 0
export const fmtBipolar = (raw: number, center: number): string => sign(raw - center);
export const fmtSemitoneRange = (raw: number): string => `±${raw + 1} st`; // 0 = ±1 … 23 = ±24

const pick = (table: readonly string[], raw: number): string => table[raw] ?? String(raw);

export const dispDb = (centre: number) => (raw: number): string => `${sign(raw - centre)} dB`;
export const dispDb20 = dispDb(20); // 0–40
export const dispDb15 = dispDb(15); // 0–30
export const dispDb40 = dispDb(40); // 0–80 (COMP GAIN)
export const dispThreshold = (raw: number): string => `${raw - 40} dB`; // always ≤ 0
export const dispBipolar50 = (raw: number): string => sign(raw - 50);
export const dispMs = (raw: number): string => `${raw} ms`;
export const dispPct = (raw: number): string => `${raw}%`;
export const dispPitchSt = (raw: number): string => `${sign(raw - 24)} st`; // centre 24 = 0 st
export const dispRevTime = (raw: number): string => `${(raw / 10).toFixed(1)} s`;
export const dispPhase = (raw: number): string => `${Math.floor(raw * 3.6 + 0.5)}°`;
// Linear approximation of a logarithmic mapping (~8000 ms … 20 ms).
export const dispRate = (raw: number): string => `${Math.floor((1 - raw / 100) * 7980 + 20)} ms`;
export const dispKnee = (raw: number): string => (raw === 0 ? "Hard" : `Soft ${raw}`);
export const dispCsAttack = (raw: number): string => `${Math.floor((raw / 124) * 800)} ms`; // approx
export const dispCsRelease = (raw: number): string => `${Math.floor((raw / 124) * 8000)} ms`; // approx

// Beat divisions: values 0–20 (tremolo/chorus/flanger/phaser); delay uses 0–13.
export const BPM_DIVS = [
  "OFF", "2", "3/2", "4/3", "1",
  "3/4", "2/3", "1/2", "3/8", "1/3",
  "1/4", "3/16", "1/6", "1/8", "3/32",
  "1/12", "1/16", "3/64", "1/24", "1/32",
  "3/128",
] as const;
export const dispBpmDiv = (raw: number): string => pick(BPM_DIVS, raw);

export const CS_RATIOS = [
  "1:1.0", "1:1.1", "1:1.2", "1:1.4", "1:1.6", "1:1.8",
  "1:2.0", "1:2.5", "1:3.2", "1:4.0", "1:5.6", "1:8.0", "1:16", "1:INF",
] as const;
export const dispRatio = (raw: number): string => pick(CS_RATIOS, raw);

// HPF 0–17 (Flat → 800 Hz), shared by chorus, phaser, reverb, EQ.
export const HPF_FREQS = [
  "Flat", "20 Hz", "25 Hz", "31 Hz", "40 Hz", "50 Hz", "63 Hz", "80 Hz", "100 Hz",
  "125 Hz", "160 Hz", "200 Hz", "250 Hz", "315 Hz", "400 Hz", "500 Hz", "630 Hz", "800 Hz",
] as const;
export const dispHPF = (raw: number): string => pick(HPF_FREQS, raw);

// Flanger HPF 0–10: condensed table, frequencies approximate (verify on hardware).
export const FL_HPF_FREQS = [
  "Flat", "20 Hz", "40 Hz", "80 Hz", "125 Hz", "200 Hz", "315 Hz", "500 Hz", "630 Hz", "710 Hz", "800 Hz",
] as const;
export const dispFLHPF = (raw: number): string => pick(FL_HPF_FREQS, raw);

// LPF 0–14 (630 Hz → Flat).
export const LPF_FREQS = [
  "630 Hz", "800 Hz", "1 kHz", "1.25 kHz", "1.6 kHz", "2 kHz", "2.5 kHz",
  "3.15 kHz", "4 kHz", "5 kHz", "6.3 kHz", "8 kHz", "10 kHz", "12.5 kHz", "Flat",
] as const;
export const dispLPF = (raw: number): string => pick(LPF_FREQS, raw);

// EQ parametric frequency 0–27 (20 Hz → 10 kHz). The Lua table has 28 entries.
export const EQ_FREQS = [
  "20 Hz", "25 Hz", "31 Hz", "40 Hz", "50 Hz", "63 Hz", "80 Hz", "100 Hz", "125 Hz",
  "160 Hz", "200 Hz", "250 Hz", "315 Hz", "400 Hz", "500 Hz", "630 Hz", "800 Hz",
  "1 kHz", "1.25 kHz", "1.6 kHz", "2 kHz", "2.5 kHz", "3.15 kHz", "4 kHz",
  "5 kHz", "6.3 kHz", "8 kHz", "10 kHz",
] as const;
export const dispEQFreq = (raw: number): string => pick(EQ_FREQS, raw);

export const EQ_Q = ["0.5", "1.0", "2.0", "4.0", "8.0", "16"] as const;
export const dispEQQ = (raw: number): string => `Q ${EQ_Q[raw] ?? raw}`;

export const TR_TYPES = ["TRI", "UP SAW", "DN SAW", "SIN", "SQR", "RND"] as const;
export const dispTrType = (raw: number): string => pick(TR_TYPES, raw);

export const DIST_TYPES = [
  "Mid Boost", "Clean Boost", "Treble Bst", "Blues OD", "Crunch",
  "Natural OD", "OD-1", "T-Scream", "Turbo OD", "Warm OD", "Distortion",
  "Mild DS", "Mid DS", "RAT", "GUV DS", "DST+", "Modern DS", "Solid DS",
  "Stack", "Loud", "Metal Zone", "Lead", "'60s FUZZ", "Oct FUZZ", "MUFF FUZZ",
] as const;

// Global tuning (CC 104, not part of the patch). CC 64 = +0.0, CC 0 = −7.0, CC 127 = +7.0.
// Steps are mostly 0.1 st, so this is a lookup rather than a formula.
export const GLOBAL_TUNING_CC = 104;

// Builds the Control Change message; `channel` is 0-based (MIDI channel 2 → 1).
export function globalTuningCc(channel: number, value: number): number[] {
  const v = Math.max(0, Math.min(127, Math.round(value)));
  return [0xb0 | (channel & 0x0f), GLOBAL_TUNING_CC, v];
}

export const GLOBAL_TUNING_DISPLAY: readonly string[] = [
  "-7.0st", "-6.9st", "-6.8st", "-6.7st", "-6.6st", "-6.4st", "-6.3st", "-6.2st",
  "-6.1st", "-6.0st", "-5.9st", "-5.8st", "-5.7st", "-5.6st", "-5.5st", "-5.3st",
  "-5.2st", "-5.1st", "-5.0st", "-4.9st", "-4.8st", "-4.7st", "-4.6st", "-4.5st",
  "-4.4st", "-4.2st", "-4.1st", "-4.0st", "-3.9st", "-3.8st", "-3.7st", "-3.6st",
  "-3.5st", "-3.4st", "-3.3st", "-3.1st", "-3.0st", "-2.9st", "-2.8st", "-2.7st",
  "-2.6st", "-2.5st", "-2.4st", "-2.3st", "-2.1st", "-2.0st", "-1.9st", "-1.8st",
  "-1.7st", "-1.6st", "-1.5st", "-1.4st", "-1.3st", "-1.2st", "-1.0st", "-0.9st",
  "-0.8st", "-0.7st", "-0.6st", "-0.5st", "-0.4st", "-0.3st", "-0.2st", "-0.1st",
  "+0.0st", "+0.2st", "+0.3st", "+0.4st", "+0.5st", "+0.6st", "+0.7st", "+0.8st",
  "+0.9st", "+1.0st", "+1.2st", "+1.3st", "+1.4st", "+1.5st", "+1.6st", "+1.7st",
  "+1.8st", "+1.9st", "+2.0st", "+2.1st", "+2.3st", "+2.4st", "+2.5st", "+2.6st",
  "+2.7st", "+2.8st", "+2.9st", "+3.0st", "+3.1st", "+3.3st", "+3.4st", "+3.5st",
  "+3.6st", "+3.7st", "+3.8st", "+3.9st", "+4.0st", "+4.1st", "+4.2st", "+4.4st",
  "+4.5st", "+4.6st", "+4.7st", "+4.8st", "+4.9st", "+5.0st", "+5.1st", "+5.2st",
  "+5.3st", "+5.5st", "+5.6st", "+5.7st", "+5.8st", "+5.9st", "+6.0st", "+6.1st",
  "+6.2st", "+6.3st", "+6.4st", "+6.6st", "+6.7st", "+6.8st", "+6.9st", "+7.0st",
];
