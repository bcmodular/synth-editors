// VCO preview: the summed oscillator mix over two cycles, for drawing. Qualitative only — cross
// mod and ring mod depths are left out, and the tuning units are unknown, so a tuning offset of
// 24 is drawn as one octave.

export interface VcoShapeInput {
  saw: number; // source levels, raw 0..127 (0 when the source is switched off)
  sqr: number;
  sin: number;
  white: number;
  pink: number;
  ring: number;
  sawTune: number; // tuning offsets from centre (raw − centre)
  sqrTune: number;
  sinTune: number; // RING+SIN tuning
}

const CYCLES = 2;
const OCTAVE = 24;

const ratio = (tune: number) => 2 ** (tune / OCTAVE);
const saw = (x: number) => 2 * (x - Math.floor(x)) - 1;
const sqr = (x: number) => (x - Math.floor(x) < 0.5 ? 1 : -1);

// Repeatable white noise: hash of the sample index, in −1..1.
function noise(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return 2 * (s - Math.floor(s)) - 1;
}

// `n + 1` samples across the window, scaled so the largest excursion is ±1 (never amplified
// beyond a single full-level wave, so small mixes look small).
export function vcoShape(p: VcoShapeInput, n = 240): number[] {
  let pink = 0;
  const ys = Array.from({ length: n + 1 }, (_, i) => {
    const x = (i / n) * CYCLES;
    const a = saw(x * ratio(p.sawTune));
    const b = sqr(x * ratio(p.sqrTune));
    const xs = x * ratio(p.sinTune);
    pink = 0.85 * pink + 0.15 * noise(i + 1000) * 2.5; // low-passed noise
    return (
      (p.saw / 127) * a +
      (p.sqr / 127) * b +
      (p.sin / 127) * Math.sin(2 * Math.PI * xs) +
      (p.white / 127) * noise(i) +
      (p.pink / 127) * pink +
      (p.ring / 127) * saw(xs) * sqr(x * ratio(p.sqrTune))
    );
  });
  const peak = Math.max(1, ...ys.map(Math.abs));
  return ys.map((y) => y / peak);
}
