// Cross-mod matrix for two destinations, mirrored: the first destination's column of cells on the
// left, the second's on the right, and a patch view between them. The patch view labels each row's
// source beside its cells and the two destinations in the middle; each non-zero cell draws a cord
// from its source inwards to its destination (thickness = amount, colour = sign), so cords from the
// two columns never cross.
import type { ReactNode } from "react";

export interface XmodMatrixProps {
  sources: readonly string[];
  dests: readonly [string, string];
  amounts: number[][] | null; // signed amounts (raw − centre), [source][dest]
  range: number; // largest |amount|
  renderCell: (row: number, col: number) => ReactNode;
}

const ROW = 24;
const GAP = 4;
const VIEW_W = 280;

export function XmodMatrix(p: XmodMatrixProps) {
  return (
    <div className="xgrid" style={{ gridTemplateColumns: `auto ${VIEW_W}px auto` }}>
      <span className="lbl xd">→ {p.dests[0]}</span>
      <span />
      <span className="lbl xd">→ {p.dests[1]}</span>
      {p.sources.map((s, r) => (
        <div key={`l${s}`} style={{ gridColumn: 1, gridRow: r + 2 }}>
          {p.renderCell(r, 0)}
        </div>
      ))}
      <div style={{ gridColumn: 2, gridRow: `2 / span ${p.sources.length}` }}>
        <PatchView {...p} />
      </div>
      {p.sources.map((s, r) => (
        <div key={`r${s}`} style={{ gridColumn: 3, gridRow: r + 2 }}>
          {p.renderCell(r, 1)}
        </div>
      ))}
    </div>
  );
}

function PatchView(p: XmodMatrixProps) {
  const H = p.sources.length * (ROW + GAP) - GAP;
  const mid = VIEW_W / 2;
  const rowY = (r: number) => ROW / 2 + r * (ROW + GAP);
  const destY = H / 2;
  const src = [40, VIEW_W - 40]; // source jacks beside each column of cells
  const dest = [mid - 38, mid + 38]; // destination jacks either side of the centre labels
  return (
    <svg className="patch" width={VIEW_W} height={H}>
      {p.sources.map((s, r) => (
        <g key={s}>
          <text className="glabel" x={2} y={rowY(r) + 4}>
            {s}
          </text>
          <text className="glabel" x={VIEW_W - 2} y={rowY(r) + 4} textAnchor="end">
            {s}
          </text>
          {src.map((x) => (
            <circle key={x} className="jack" cx={x} cy={rowY(r)} r={2.5} />
          ))}
        </g>
      ))}
      <text className="glabel dest" x={mid - 6} y={destY + 4} textAnchor="end">
        {p.dests[0]}
      </text>
      <text className="glabel dest" x={mid + 6} y={destY + 4}>
        {p.dests[1]}
      </text>
      {dest.map((x) => (
        <circle key={x} className="jack" cx={x} cy={destY} r={3.5} />
      ))}
      {p.amounts?.flatMap((row, r) =>
        row.map((v, c) => {
          if (v === 0) return null;
          const x0 = src[c]!;
          const x1 = dest[c]!;
          const xm = (x0 + x1) / 2;
          return (
            <path
              key={`${r}-${c}`}
              className={v > 0 ? "cord pos" : "cord neg"}
              strokeWidth={1.5 + (Math.abs(v) / p.range) * 5}
              d={`M${x0} ${rowY(r)} C ${xm} ${rowY(r)}, ${xm} ${destY}, ${x1} ${destY}`}
            />
          );
        }),
      )}
    </svg>
  );
}
