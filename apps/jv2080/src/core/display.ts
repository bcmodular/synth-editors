// How the JV-2080's panel shows parameter values.

export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : String(n));

// A bipolar value shown relative to its centre, eg. Coarse Tune raw 36 → "-12".
export const fmtOffset = (center: number) => (raw: number) => fmtSigned(raw - center);

// Raw 0–127, 64 = centre: "L64" … "0" … "63R".
export const fmtPan = (raw: number) => (raw === 64 ? "0" : raw < 64 ? `L${64 - raw}` : `${raw - 64}R`);

// Bend Range Down: raw n bends down n semitones.
export const fmtBendDown = (raw: number) => fmtSigned(-raw);

// Wave Number: raw 0–254 shown as 001–255.
export const fmtWaveNumber = (raw: number) => String(raw + 1).padStart(3, "0");

// Reverb HF Damp frequencies (BYPASS follows them).
export const HF_DAMP: readonly string[] = ["200", "250", "315", "400", "500", "630", "800", "1000", "1250", "1600",
  "2000", "2500", "3150", "4000", "5000", "6300", "8000"].map((f) => `${f} Hz`);
