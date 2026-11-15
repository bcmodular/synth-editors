// A small picture of an LFO wave, in place of its name over its knob: saw, square, triangle, sine, or sample and
// hold (random steps). Drawn in the section's colour.
export type Wave = "saw" | "sqr" | "tri" | "sin" | "sh";

const W = 28;
const H = 14;

const PATHS: Readonly<Record<Wave, string>> = {
  saw: "M1,13 L14,1 L14,13 L27,1 L27,13",
  sqr: "M1,13 L1,1 L8,1 L8,13 L15,13 L15,1 L22,1 L22,13 L27,13",
  tri: "M1,13 L7.5,1 L14,13 L20.5,1 L27,13",
  sin: "M1,7 C4,-2 7,-2 7.5,7 S11,16 14,7 S17,-2 20.5,7 S24,16 27,7",
  sh: "M1,9 L6,9 L6,3 L11,3 L11,12 L16,12 L16,5 L21,5 L21,10 L27,10",
};

export const WAVE_NAMES: Readonly<Record<Wave, string>> = {
  saw: "Saw", sqr: "Square", tri: "Triangle", sin: "Sine", sh: "Sample and hold",
};

export function WaveIcon({ wave }: { wave: Wave }) {
  return (
    <svg className="waveicon" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={WAVE_NAMES[wave]}>
      <title>{WAVE_NAMES[wave]}</title>
      <path d={PATHS[wave]} />
    </svg>
  );
}
