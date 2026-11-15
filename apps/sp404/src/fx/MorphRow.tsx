// A module's morph row (experimental): MORPH turns morph on, a stored preset pressed then becomes the target (lit in
// the morph colour), and the track blends the bus's values towards it. Turning morph off keeps the blend.

import type { Bus } from "../core/fxTypes";
import { useValueDrag } from "../ui/useValueDrag";
import type { Fx } from "./useFx";

const STEPS = 100;

function MorphTrack({ bus, fx }: { bus: Bus; fx: Fx }) {
  const m = fx.play.morphs[bus];
  const ready = m?.slot !== undefined;
  const value = Math.round((m?.amount ?? 0) * STEPS);
  const drag = useValueDrag<HTMLDivElement>({
    value, max: STEPS, defaultValue: 0, axis: "x", disabled: !ready,
    onChange: (v) => fx.play.setMorphAmount(bus, v / STEPS),
  });
  return (
    <div className={`tr ${ready ? "" : "dis"}`} ref={drag.ref} role="slider" aria-label={`Bus ${bus} morph`}
      aria-valuemin={0} aria-valuemax={STEPS} aria-valuenow={value} aria-disabled={!ready}
      title={m ? (ready ? "Drag to blend towards the target preset" : "Press a stored preset to blend towards") : undefined}
      onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick}>
      <div className="fill" style={{ width: `${value}%` }} />
    </div>
  );
}

export function MorphRow({ bus, fx }: { bus: Bus; fx: Fx }) {
  const on = fx.play.morphs[bus] !== undefined;
  return (
    <div className={`morph ${on ? "on" : ""}`}>
      <button className={`mtoggle ${on ? "on" : ""}`} aria-pressed={on} aria-label={`Bus ${bus} morph on`}
        disabled={!fx.state.buses[bus].fxId} title="Morph (experimental): then press a stored preset and drag the track"
        onClick={() => fx.play.toggleMorph(bus)}>
        MORPH
      </button>
      <MorphTrack bus={bus} fx={fx} />
    </div>
  );
}
