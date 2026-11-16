// CC learn's picking: a press on a parameter's cell or a morph track in an FX module chooses what to learn.

import { useEffect } from "react";
import type { Bus } from "../core/fxTypes";
import { morphTarget, paramTarget, type CcTarget } from "./ccTargets";

export type Learning = null | "pick" | { target: CcTarget };

const busUnder = (el: Element): Bus | undefined =>
  Number(el.closest<HTMLElement>(".bus[data-bus]")?.dataset.bus) as Bus || undefined;

// The target under a click while picking: a parameter's cell (data-slot) or a morph track, in an FX module.
export function pickedTarget(el: Element): CcTarget | undefined {
  const bus = busUnder(el);
  if (!bus) return undefined;
  const slot = el.closest<HTMLElement>("[data-slot]")?.dataset.slot;
  if (slot !== undefined) return paramTarget(bus, Number(slot));
  return el.closest(".morph") ? morphTarget(bus) : undefined;
}

// While picking, a press on a parameter's cell or a morph track chooses it (and does nothing else).
export function usePick(learning: Learning, onPick: (t: CcTarget) => void) {
  useEffect(() => {
    if (learning !== "pick") return;
    const onDown = (e: PointerEvent) => {
      const t = pickedTarget(e.target as Element);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      onPick(t);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [learning, onPick]);
}

