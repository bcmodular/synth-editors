// Building blocks for the effect drawings: an SVG as wide as its box, and a draggable handle.

import { useState, type PointerEvent, type ReactNode } from "react";
import { useSize } from "./useSize";

// A drawing filling its box's width; `children` gets the width to draw at.
export function Drawing({ height, className, children }: { height: number; className?: string; children: (width: number) => ReactNode }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const { width } = useSize(box);
  return (
    <div className={`fxdraw ${className ?? ""}`} ref={setBox}>
      {width > 0 && <svg width={width} height={height}>{children(width)}</svg>}
    </div>
  );
}

export function Handle({ x, y, onPointerDown }: { x: number; y: number; onPointerDown: (e: PointerEvent<SVGCircleElement>) => void }) {
  return (
    <g className="handle">
      <circle className="dot" cx={x} cy={y} r={4} />
      <circle className="hit" cx={x} cy={y} r={10} onPointerDown={onPointerDown} />
    </g>
  );
}
