// EQ frequency response with draggable band handles (see core/eqResponse.ts for the maths).
// Like the envelope editor, drags are relative (Shift = fine): horizontal moves step through a
// handle's frequency table, vertical moves change its gain. Scrolling over a handle steps its
// `wheel` value (Q for the mid bands); double-click resets it.
import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { EQ_MAX_HZ, EQ_MIN_HZ } from "../core/eqResponse";

const RANGE_DB = 24; // ± shown
const FINE = 0.15;
const WHEEL_PX_PER_STEP = 8;
const GRID_HZ: [number, string][] = [
  [100, "100"],
  [1000, "1k"],
  [10000, "10k"],
];

export interface EqHandle {
  key: string;
  label: string;
  below?: boolean; // label under the handle (the cut handles, which sit near others)
  hz: number; // drawn position
  db: number;
  freq?: { table: readonly number[]; index: number; onChange: (index: number) => void }; // x drag
  gain?: { raw: number; max: number; onChange: (raw: number) => void }; // y drag, 1 dB per step
  wheel?: { value: number; max: number; onChange: (v: number) => void };
  onReset?: () => void;
}

export function EqView(p: { ys: number[] | null; handles?: EqHandle[]; width?: number; height?: number }) {
  const W = p.width ?? 240;
  const H = p.height ?? 190;
  const mid = H / 2;
  const dbPerPx = RANGE_DB / (mid - 6);
  const yOf = (dbv: number) => mid - Math.max(-RANGE_DB, Math.min(RANGE_DB, dbv)) / dbPerPx;
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
      {pts &&
        p.handles?.map((h) => (
          <Handle
            key={h.key}
            h={h}
            x={Math.max(6, Math.min(W - 6, xOf(h.hz)))}
            y={Math.max(6, Math.min(H - 6, yOf(h.db)))}
            xOf={xOf}
            dbPerPx={dbPerPx}
          />
        ))}
    </svg>
  );
}

function Handle(p: { h: EqHandle; x: number; y: number; xOf: (hz: number) => number; dbPerPx: number }) {
  const ref = useRef<SVGRectElement>(null);
  const props = useRef(p);
  props.current = p;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      const w = props.current.h.wheel;
      if (!w) return;
      e.preventDefault();
      acc += Math.abs(e.deltaY) >= 40 ? Math.sign(e.deltaY) * WHEEL_PX_PER_STEP : e.deltaY;
      const steps = Math.trunc(acc / WHEEL_PX_PER_STEP);
      if (!steps) return;
      acc -= steps * WHEEL_PX_PER_STEP;
      const next = Math.max(0, Math.min(w.max, w.value - steps));
      if (next === w.value) return;
      props.current = { ...props.current, h: { ...props.current.h, wheel: { ...w, value: next } } };
      w.onChange(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const { h, xOf, dbPerPx } = props.current;
    const tableX = h.freq?.table.map(xOf);
    let fx = h.freq ? tableX![h.freq.index]! : 0; // target x along the table
    let fGain = h.gain?.raw ?? 0;
    let lastX = e.clientX;
    let lastY = e.clientY;
    const move = (ev: PointerEvent) => {
      const k = ev.shiftKey ? FINE : 1;
      const cur = props.current.h;
      if (cur.freq && tableX) {
        fx += (ev.clientX - lastX) * k;
        let best = 0;
        tableX.forEach((x, i) => {
          if (Math.abs(x - fx) < Math.abs(tableX[best]! - fx)) best = i;
        });
        if (best !== cur.freq.index) cur.freq.onChange(best);
      }
      if (cur.gain) {
        fGain = Math.max(0, Math.min(cur.gain.max, fGain - (ev.clientY - lastY) * dbPerPx * k));
        const raw = Math.round(fGain);
        if (raw !== cur.gain.raw) cur.gain.onChange(raw);
      }
      lastX = ev.clientX;
      lastY = ev.clientY;
    };
    const up = () => {
      el.removeEventListener("pointermove", move as EventListener);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move as EventListener);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const { h, x, y } = p;
  const cursor = h.freq && h.gain ? "move" : h.freq ? "ew-resize" : "ns-resize";
  return (
    <g>
      <text className="glabel hlabel" x={x} y={h.below ? y + 17 : y - 10} textAnchor="middle">
        {h.label}
      </text>
      <rect
        ref={ref}
        className="handle"
        style={{ cursor }}
        x={x - 6}
        y={y - 6}
        width={12}
        height={12}
        onPointerDown={onPointerDown}
        onDoubleClick={() => h.onReset?.()}
      />
    </g>
  );
}
