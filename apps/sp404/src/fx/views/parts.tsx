// Parts several effects' drawings share: the frequency band under delays and reverbs.

import { freqX, hzText, type Hz, type Px } from "./draw";
import { parseHz, type ViewContext } from "./viewContext";

export interface BandProps {
  c: ViewContext;
  y: Px;
  lo?: Hz; // undefined = open (FLAT)
  hi?: Hz;
  loIndex: number; // the parameter each edge drags
  hiIndex: number;
  label: string;
}

// A band between two frequencies with draggable edges.
export function Band({ c, y, lo, hi, loIndex, hiIndex, label }: BandProps) {
  const w = c.size.width;
  const x1 = lo ? freqX(lo, w) : 0;
  const x2 = hi ? freqX(hi, w) : w;
  return (
    <g>
      <rect className="dimf" x={0} y={y} width={w} height={14} />
      <rect className="ar" x={x1} y={y} width={Math.max(0, x2 - x1)} height={14} style={{ fillOpacity: 0.4 }} />
      <text className="gl" x={4} y={y + 10}>{label}</text>
      <rect className="dragx" x={x1 - 5} y={y} width={10} height={14} fill="#fff" fillOpacity={0.85}
        onPointerDown={c.drag({ x: { index: loIndex, scale: 0.35 } })} role="slider" aria-label={c.label(loIndex)} />
      <rect className="dragx" x={x2 - 5} y={y} width={10} height={14} fill="#fff" fillOpacity={0.85}
        onPointerDown={c.drag({ x: { index: hiIndex, scale: 0.35 } })} role="slider" aria-label={c.label(hiIndex)} />
      <text className="hl" x={x1 + 7} y={y + 10}>{lo ? hzText(lo) : "FLAT"}</text>
      <text className="hl" x={x2 - 7} y={y + 10} textAnchor="end">{hi ? hzText(hi) : "FLAT"}</text>
    </g>
  );
}

// The band between two frequency parameters (damping or cut), labelled `label`.
export function DampBand({ c, y, lo, hi, label = "DAMP" }: { c: ViewContext; y: Px; lo: number; hi: number; label?: string }) {
  return <Band c={c} y={y} lo={parseHz(c.text(lo))} hi={parseHz(c.text(hi))} loIndex={lo} hiIndex={hi} label={label} />;
}

export interface PadProps {
  box: { x: Px; y: Px; w: Px; h: Px };
  on: boolean;
  label: string;
  fontSize?: number;
  onPick: () => void;
}

// A button drawn in a view (pattern pads, note values, mode buttons): lit when chosen.
export function Pad({ box, on, label, fontSize = 13, onPick }: PadProps) {
  return (
    <g className={on ? "on" : ""} role="button" aria-label={label} aria-pressed={on} onClick={onPick}>
      <rect className="pad" x={box.x} y={box.y} width={box.w} height={box.h} rx={3} />
      <text className="padt" x={box.x + box.w / 2} y={box.y + box.h / 2 + fontSize * 0.35} textAnchor="middle" style={{ fontSize }}>
        {label}
      </text>
    </g>
  );
}
