// Cross-mod matrix: rows = sources, columns = destinations, cells rendered by the caller.
// The patch view beside it draws one curve per non-zero cell (thickness = amount, colour = sign).
import type { ReactNode } from "react";

export interface XmodMatrixProps {
  sources: readonly string[];
  dests: readonly string[];
  amounts: number[][] | null; // signed amounts (raw − centre), [source][dest]
  range: number; // largest |amount|
  renderCell: (row: number, col: number) => ReactNode;
}

export function XmodMatrix(p: XmodMatrixProps) {
  return (
    <div className="xmod">
      <div className="xgrid" style={{ gridTemplateColumns: `52px repeat(${p.dests.length}, 96px)` }}>
        <span />
        {p.dests.map((d) => (
          <span key={d} className="lbl xd">
            → {d}
          </span>
        ))}
        {p.sources.map((s, r) => (
          <Row key={s} label={s}>
            {p.dests.map((_, c) => (
              <div key={c}>{p.renderCell(r, c)}</div>
            ))}
          </Row>
        ))}
      </div>
      <PatchView {...p} />
    </div>
  );
}

function Row(p: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="lbl">{p.label}</span>
      {p.children}
    </>
  );
}

function PatchView(p: XmodMatrixProps) {
  const W = 130;
  const rowY = (r: number) => 34 + r * 28;
  const destY = (c: number) => 34 + ((p.sources.length - 1) * 28 * (c + 0.5)) / p.dests.length;
  return (
    <svg className="patch" width={W} height={rowY(p.sources.length - 1) + 14}>
      {p.sources.map((s, r) => (
        <circle key={s} className="jack" cx={6} cy={rowY(r)} r={3.5} />
      ))}
      {p.dests.map((d, c) => (
        <g key={d}>
          <circle className="jack" cx={W - 30} cy={destY(c)} r={3.5} />
          <text className="glabel" x={W - 22} y={destY(c) + 4}>
            {d}
          </text>
        </g>
      ))}
      {p.amounts?.flatMap((row, r) =>
        row.map((v, c) =>
          v === 0 ? null : (
            <path
              key={`${r}-${c}`}
              className={v > 0 ? "cord pos" : "cord neg"}
              strokeWidth={1.5 + (Math.abs(v) / p.range) * 6}
              d={`M6 ${rowY(r)} C ${W / 2} ${rowY(r)}, ${W / 2 - 10} ${destY(c)}, ${W - 30} ${destY(c)}`}
            />
          ),
        ),
      )}
    </svg>
  );
}
