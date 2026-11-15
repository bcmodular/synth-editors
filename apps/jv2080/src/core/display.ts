// How the JV-2080's panel shows parameter values.

export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : String(n));

// A bipolar value shown relative to its centre, eg. Coarse Tune raw 36 → "-12".
export const fmtOffset = (center: number) => (raw: number) => fmtSigned(raw - center);

// Raw 0–127, 64 = centre: "L64" … "C" … "63R".
export const PAN_CENTRE = 64;
export function fmtPan(raw: number): string {
  if (raw === PAN_CENTRE) return "C";
  return raw < PAN_CENTRE ? `L${PAN_CENTRE - raw}` : `${raw - PAN_CENTRE}R`;
}

// Bend Range Down: raw n bends down n semitones.
export const fmtBendDown = (raw: number) => fmtSigned(-raw);

// Wave Number: raw 0–254 shown as 001–255.
export const fmtWaveNumber = (raw: number) => String(raw + 1).padStart(3, "0");

// Reverb HF Damp frequencies (BYPASS follows them).
export const HF_DAMP: readonly string[] = ["200", "250", "315", "400", "500", "630", "800", "1000", "1250", "1600",
  "2000", "2500", "3150", "4000", "5000", "6300", "8000"].map((f) => `${f} Hz`);

// A MIDI note as the JV shows it: 0 = C-1, 60 = C4, 127 = G9.
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const fmtNote = (raw: number) => `${NOTE_NAMES[raw % 12]}${Math.floor(raw / 12) - 1}`;

// Signed whole numbers as table labels: [-100, 0, 50] → ["-100", "0", "+50"].
export const signedLabels = (values: readonly number[]) => values.map(fmtSigned);

// Keyfollow (Pitch, Cutoff), in % of an octave per octave (manual p.190 *15).
export const KEYFOLLOW = signedLabels([-100, -70, -50, -30, -10, 0, 10, 20, 30, 40, 50, 70, 100, 120, 150, 200]);

// Velocity times, time keyfollow, bias and pan keyfollow (*17).
export const TIME_SENS = signedLabels([-100, -70, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 70, 100]);

// Random Pitch Depth in cents (*14): 0–10, then tens to 100, then hundreds to 1200.
export const RANDOM_PITCH = [
  ...Array.from({ length: 11 }, (_, i) => i),
  ...Array.from({ length: 9 }, (_, i) => 20 + i * 10),
  ...Array.from({ length: 11 }, (_, i) => 200 + i * 100),
].map(String);

// Velocity sensitivity: raw 0–125 shown as −100…+150 in steps of 2 (*16).
export const fmtVelSens = (raw: number) => fmtSigned(raw * 2 - 100);

// A pan LFO depth: raw 0–126, 63 = none, shown L63…63R.
export const fmtPanDepth = (raw: number) => (raw === 63 ? "0" : raw < 63 ? `L${63 - raw}` : `${raw - 63}R`);
