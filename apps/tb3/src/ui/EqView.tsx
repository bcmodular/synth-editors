// EQ frequency response (display only). See core/eqResponse.ts for the maths and its assumptions.
import { EQ_MAX_HZ, EQ_MIN_HZ } from "../core/eqResponse";

const RANGE_DB = 24; // ± shown
const GRID_HZ: [number, string][] = [
  [100, "100"],
  [1000, "1k"],
  [10000, "10k"],
];

export function EqView(p: { ys: number[] | null; width?: number; height?: number }) {
  const W = p.width ?? 240;
  const H = p.height ?? 190;
  const mid = H / 2;
  const yOf = (dbv: number) => mid - (Math.max(-RANGE_DB, Math.min(RANGE_DB, dbv)) / RANGE_DB) * (mid - 6);
  const xOf = (hz: number) => (Math.log(hz / EQ_MIN_HZ) / Math.log(EQ_MAX_HZ / EQ_MIN_HZ)) * W;
  const last = Math.max(1, (p.ys?.length ?? 1) - 1);
  const pts = p.ys?.map((y, i) => `${((i / last) * W).toFixed(1)},${yOf(y).toFixed(1)}`);
  return (
    <svg className="eqview" width={W} height={H}>
      <rect className="well" width={W} height={H} />
      {[-12, 12].map((d) => (
        <line key={d} className="grid" x1={0} x2={W} y1={yOf(d)} y2={yOf(d)} />
      ))}
      {GRID_HZ.map(([hz, label]) => (
        <g key={hz}>
          <line className="grid" x1={xOf(hz)} x2={xOf(hz)} y1={0} y2={H} />
          <text className="glabel" x={xOf(hz) + 3} y={H - 5}>
            {label}
          </text>
        </g>
      ))}
      <line className="axis" x1={0} x2={W} y1={mid} y2={mid} />
      <text className="glabel" x={3} y={yOf(12) - 3}>
        +12
      </text>
      <text className="glabel" x={3} y={yOf(-12) - 3}>
        −12
      </text>
      {pts && (
        <>
          <polygon className="eqfill" points={`0,${mid} ${pts.join(" ")} ${W},${mid}`} />
          <polyline className="trace" points={pts.join(" ")} />
        </>
      )}
    </svg>
  );
}
