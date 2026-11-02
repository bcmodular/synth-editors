// Display-only waveform: samples in −1..1 across the width (see core/lfoShape.ts, core/vcoShape.ts).
export function WaveView(p: { ys: number[] | null; width?: number; height?: number }) {
  const W = p.width ?? 300;
  const H = p.height ?? 130;
  const mid = H / 2;
  const amp = H / 2 - 8;
  const last = Math.max(1, (p.ys?.length ?? 1) - 1);
  const points = p.ys?.map((y, i) => `${((i / last) * W).toFixed(1)},${(mid - y * amp).toFixed(1)}`).join(" ");
  return (
    <svg className="wave" width={W} height={H}>
      <rect className="well" width={W} height={H} />
      <line className="axis" x1={0} x2={W} y1={mid} y2={mid} />
      {points && <polyline className="trace" points={points} />}
    </svg>
  );
}
