// A multi-stage envelope (core/envelope.ts) as a graph with a handle at the end of each stage: drag sideways for the
// stage's time, up / down for its level (Shift = fine), double-click to zero the time. The hold before the release
// stage is drawn dashed. Hovering or dragging a handle shows its values; the corner button resets the envelope.

import { useState } from "react";
import { envelopeNodes, type EnvelopeSpec } from "../core/envelope";
import { dragXY } from "./dragXY";

const PAD = 8;
const TIME_MAX = 127;
const SUSTAIN = 50; // the hold's width, in time units
const HANDLE_NODES = [1, 2, 3, 5]; // nodes that end stages 1–4 (node 4 ends the hold)

export interface EnvelopeGraphProps {
  spec: EnvelopeSpec;
  width: number;
  height: number;
  onTime: (stage: number, raw: number) => void; // stage 0–3
  onLevel: (stage: number, raw: number) => void;
  onReset?: () => void; // shows a reset button in the corner
}

export function EnvelopeGraph({ spec, width, height, onTime, onLevel, onReset }: EnvelopeGraphProps) {
  const [active, setActive] = useState<number | null>(null);
  const unit = (width - 2 * PAD) / (4 * TIME_MAX + SUSTAIN);
  const bipolar = spec.center !== undefined;
  const span = bipolar ? (height - 2 * PAD) / 2 : height - 2 * PAD;
  const base = bipolar ? height / 2 : height - PAD;
  const x = (t: number) => PAD + t * unit;
  const y = (v: number) => base - v * span;
  const nodes = envelopeNodes(spec, SUSTAIN).map((n) => ({ x: x(n.t), y: y(n.v) }));
  const line = nodes.map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`);
  const levelPx = bipolar ? 2 * span : span; // drag distance for the whole level range

  const startDrag = (stage: number) => (e: React.PointerEvent<SVGCircleElement>) => {
    setActive(stage);
    const hasLevel = stage < spec.levels.length;
    dragXY(e, {
      x: { value: spec.times[stage] ?? 0, max: TIME_MAX, px: TIME_MAX * unit, onChange: (v) => onTime(stage, v) },
      y: hasLevel
        ? { value: spec.levels[stage]!, max: spec.levelMax, px: levelPx, onChange: (v) => onLevel(stage, v) }
        : undefined,
    });
  };

  return (
    <svg className="envg" width={width} height={height} onPointerLeave={() => setActive(null)}>
      <rect className="well" width={width} height={height} />
      <line className="axis" x1={0} x2={width} y1={base} y2={base} />
      <polygon className="area" points={[`${nodes[0]!.x},${base}`, ...line, `${nodes.at(-1)!.x},${base}`].join(" ")} />
      <polyline className="shape" points={line.slice(0, 4).join(" ")} />
      <polyline className="hold" points={line.slice(3, 5).join(" ")} />
      <polyline className="shape" points={line.slice(4).join(" ")} />
      {HANDLE_NODES.map((node, stage) => (
        <g key={stage} className={`handle ${active === stage ? "on" : ""}`}>
          <circle className="dot" cx={nodes[node]!.x} cy={nodes[node]!.y} r={4} />
          <circle className="hit" cx={nodes[node]!.x} cy={nodes[node]!.y} r={10}
            onPointerEnter={() => setActive(stage)} onPointerDown={startDrag(stage)}
            onDoubleClick={() => onTime(stage, 0)} />
        </g>
      ))}
      {onReset && (
        <g className="reset" onClick={onReset}>
          <title>Reset to a simple envelope</title>
          <rect x={4} y={4} width={18} height={16} rx={2} />
          <text x={13} y={16} textAnchor="middle">↺</text>
        </g>
      )}
      {active !== null && (
        <text className="readout" x={width - 6} y={14} textAnchor="end">
          T{active + 1} {spec.times[active]}
          {active < spec.levels.length ? `  L${active + 1} ${levelText(spec, spec.levels[active]!)}` : ""}
        </text>
      )}
    </svg>
  );
}

function levelText(spec: EnvelopeSpec, raw: number): string {
  if (spec.center === undefined) return String(raw);
  const v = raw - spec.center;
  return v > 0 ? `+${v}` : String(v);
}

