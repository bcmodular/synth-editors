// What a drawing reads from its props, in the designs' terms: raw values, display text, the selected step, and
// handle drags.

import { displayText, isSyncOn, paramMode, stepIndex, stepLabels, syncParam } from "../../core/fx";
import type { Size } from "./draw";
import type { ViewProps } from "./types";
import { useHandleDrag, type HandleDrag } from "./useHandleDrag";

export interface ViewContext {
  size: Size;
  raw: (i: number) => number;
  text: (i: number) => string; // what the SP-404 shows, without the unit
  step: (i: number) => number; // the step index of a discrete parameter
  label: (i: number) => string; // the parameter's name
  labels: (i: number) => string[]; // a discrete parameter's step names
  starts: (i: number) => readonly number[]; // where its steps start
  synced: boolean;
  drag: (d: HandleDrag) => ReturnType<ReturnType<typeof useHandleDrag>>;
  set: (i: number, raw: number) => void;
}

// "1.25k" → 1250, "630" → 630; FLAT or other words → undefined.
export function parseHz(text: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)(k?)/.exec(text);
  return m ? Number(m[1]) * (m[2] ? 1000 : 1) : undefined;
}

export function useViewContext({ fx, values, onValue, width, height }: ViewProps): ViewContext {
  const sync = syncParam(fx);
  const synced = sync ? isSyncOn(values[fx.params.indexOf(sync)] ?? 0) : false;
  const drag = useHandleDrag({ values, onValue });
  const raw = (i: number) => values[i] ?? 0;
  const mode = (i: number) => paramMode(fx.params[i]!, synced);
  return {
    size: { width, height },
    raw,
    text: (i) => displayText(mode(i), raw(i)),
    step: (i) => stepIndex(mode(i).starts ?? [0], raw(i)),
    label: (i) => fx.params[i]?.label ?? "",
    labels: (i) => stepLabels(fx.params[i]!, synced),
    starts: (i) => mode(i).starts ?? [],
    synced,
    drag,
    set: onValue,
  };
}
