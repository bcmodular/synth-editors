// Building blocks for the effect drawings: an SVG as wide as its box, and a draggable handle.

import { useState, type PointerEvent, type ReactNode } from "react";
import { useSize } from "./useSize";

// A drawing filling its box's width, and its height too when none is given (the box is then sized by the layout);
// `children` gets the size to draw at.
export function Drawing({ height, className, children }: {
  height?: number;
  className?: string;
  children: (width: number, height: number) => ReactNode;
}) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const size = useSize(box);
  const h = height ?? size.height;
  return (
    <div className={`fxdraw ${height === undefined ? "fill" : ""} ${className ?? ""}`} ref={setBox}>
      {size.width > 0 && h > 0 && <svg width={size.width} height={h}>{children(size.width, h)}</svg>}
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
