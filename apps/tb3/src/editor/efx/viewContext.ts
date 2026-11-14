// What an EFX drawing reads and sets, by byte offset in its EFX block (after the SP-404's views/viewContext.ts):
// raw values, display text, drag axes for handles, and resets to the slot defaults. Every set goes through the
// editor's setEfxByte, so it is sent to the TB-3 exactly as a fader's would be.
import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { EfxNum, EfxSlot, EfxType } from "../../core/efx";
import { getEfxRaw } from "../../core/patch";
import type { Size } from "../../ui/draw";
import { startHandleDrag } from "../../ui/useHandleDrag";
import type { DragAxis } from "../../ui/useHandleDrag";
import { useEditor } from "../EditorContext";
import type { Editor } from "../EditorContext";

export interface EfxViewProps {
  efx: EfxNum;
  type: EfxType;
  size: Size;
}

// An axis of a drag: an offset, or an offset with the px it takes to cross its range (negative = backwards) and the
// lowest value it goes down to.
export type AxisSpec = number | { offset: number; px?: number; min?: number };

export interface EfxView {
  size: Size;
  raw: (offset: number) => number;
  text: (offset: number) => string; // as the fader shows it
  name: (offset: number) => string;
  set: (offset: number, raw: number) => void;
  drag: (axes: { x?: AxisSpec; y?: AxisSpec }) => (e: ReactPointerEvent<Element>) => void;
  reset: (...offsets: number[]) => () => void;
}

const slotAt = (type: EfxType, offset: number): EfxSlot | undefined =>
  type.slots.find((s) => s?.offset === offset) ?? undefined;
const defaultOf = (s: EfxSlot | undefined) => (s ? Math.round(s.default * s.max) : 0);

function axisFor(latest: { current: Editor }, efx: EfxNum, type: EfxType, spec: AxisSpec): DragAxis {
  const { offset, px, min } = typeof spec === "number" ? { offset: spec, px: undefined, min: undefined } : spec;
  const patch = () => latest.current.patch;
  return {
    get: () => {
      const p = patch();
      return p ? getEfxRaw(p, efx, offset) : 0;
    },
    min,
    max: slotAt(type, offset)?.max ?? 127,
    set: (v) => latest.current.setEfxByte(efx, offset, v),
    px,
  };
}

export function useEfxView({ efx, type, size }: EfxViewProps): EfxView {
  const ed = useEditor();
  const latest = useRef(ed);
  latest.current = ed;
  const raw = (offset: number) => (ed.patch ? getEfxRaw(ed.patch, efx, offset) : 0);
  const set = (offset: number, v: number) => latest.current.setEfxByte(efx, offset, v);
  const axis = (spec: AxisSpec | undefined) => (spec === undefined ? undefined : axisFor(latest, efx, type, spec));
  return {
    size,
    raw,
    text: (offset) => (slotAt(type, offset)?.display ?? String)(raw(offset)),
    name: (offset) => slotAt(type, offset)?.name ?? "",
    set,
    drag: (axes) => (e) => startHandleDrag({ x: axis(axes.x), y: axis(axes.y) }, e),
    reset:
      (...offsets) =>
      () => {
        for (const o of offsets) set(o, defaultOf(slotAt(type, o)));
      },
  };
}
