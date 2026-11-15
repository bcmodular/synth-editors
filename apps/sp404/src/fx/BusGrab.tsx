// A module's GRAB, beside its ON/OFF: the effect is on while held (momentary), and letting go puts ON/OFF back as it
// was. Not to be confused with AUDITION in the top bar, which previews presets and scenes.

import { useState, type PointerEvent } from "react";
import type { Bus } from "../core/fxTypes";
import type { Fx } from "./useFx";

export function BusGrab({ bus, label, fx, disabled }: { bus: Bus; label: string; fx: Fx; disabled: boolean }) {
  const [was, setWas] = useState<boolean | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setWas(fx.buses[bus].on);
    fx.hold(bus, true);
  };
  const up = () => {
    if (was === null) return;
    fx.hold(bus, was);
    setWas(null);
  };
  return (
    <button className={`fxgrab ${was !== null ? "on" : ""}`} disabled={disabled} aria-label={`${label} grab`}
      title="GRAB: the effect is on while held" onPointerDown={onPointerDown} onPointerUp={up}
      onLostPointerCapture={up}>
      GRAB
    </button>
  );
}
