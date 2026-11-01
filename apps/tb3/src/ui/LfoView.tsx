// Summed LFO output (display only). See core/lfoShape.ts for the maths.
import { lfoShape } from "../core/lfoShape";
import type { LfoShapeInput } from "../core/lfoShape";

export function LfoView(p: { input: LfoShapeInput | null; width?: number; height?: number }) {
  const W = p.width ?? 300;
  const H = p.height ?? 130;
  const mid = H / 2;
  const amp = H / 2 - 8;
  const ys = p.input ? lfoShape(p.input, 240) : [];
  const points = ys.map((y, i) => `${((i / 240) * W).toFixed(1)},${(mid - y * amp).toFixed(1)}`).join(" ");
  return (
    <svg className="lfo" width={W} height={H}>
      <rect className="well" width={W} height={H} />
      <line className="axis" x1={0} x2={W} y1={mid} y2={mid} />
      {p.input && <polyline className="trace" points={points} />}
    </svg>
  );
}
