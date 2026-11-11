// Cross-mod matrix for two destinations, stacked: each destination gets a group, one fader per source, with a patch
// view beside the faders. The patch view labels each row's source and the group's destination; each non-zero cell
// draws a cord from its source to the destination (thickness = amount, colour = sign).
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
const VIEW_W = 130;
const SRC_X = 46; // source jacks, after the source labels
const DEST_X = VIEW_W - 38; // the destination jack, before its label

export function XmodMatrix(p: XmodMatrixProps) {
  return (
    <div className="xstack">
      {p.dests.map((d, c) => (
        <div key={d} className="xgroup">
          <span className="lbl xd">→ {d}</span>
          <div className="xgrid" style={{ gridTemplateColumns: `auto ${VIEW_W}px` }}>
            {p.sources.map((s, r) => (
              <div key={s} style={{ gridColumn: 1, gridRow: r + 1 }}>
                {p.renderCell(r, c)}
              </div>
            ))}
            <div style={{ gridColumn: 2, gridRow: `1 / span ${p.sources.length}` }}>
              <PatchView {...p} col={c} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Cord(p: { amount: number; range: number; y0: number; y1: number }) {
  const xm = (SRC_X + DEST_X) / 2;
  return (
    <path
      className={p.amount > 0 ? "cord pos" : "cord neg"}
      strokeWidth={1.5 + (Math.abs(p.amount) / p.range) * 5}
      d={`M${SRC_X} ${p.y0} C ${xm} ${p.y0}, ${xm} ${p.y1}, ${DEST_X} ${p.y1}`}
    />
  );
}

function PatchView(p: XmodMatrixProps & { col: number }) {
  const H = p.sources.length * (ROW + GAP) - GAP;
  const rowY = (r: number) => ROW / 2 + r * (ROW + GAP);
  const destY = H / 2;
  return (
    <svg className="patch" width={VIEW_W} height={H}>
      {p.sources.map((s, r) => (
        <g key={s}>
          <text className="glabel" x={4} y={rowY(r) + 4}>
            {s}
          </text>
          <circle className="jack" cx={SRC_X} cy={rowY(r)} r={2.5} />
        </g>
      ))}
      <circle className="jack" cx={DEST_X} cy={destY} r={3.5} />
      <text className="glabel dest" x={DEST_X + 8} y={destY + 4}>
        {p.dests[p.col]}
      </text>
      {p.amounts?.map((row, r) => {
        const v = row[p.col]!;
        return v === 0 ? null : <Cord key={r} amount={v} range={p.range} y0={rowY(r)} y1={destY} />;
      })}
    </svg>
  );
}
