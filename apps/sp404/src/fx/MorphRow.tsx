// A module's morph row (EXPERIMENTAL): EXP turns morph on, a stored preset pressed then becomes the target, and the
// track blends the bus's values towards it. Turning morph off keeps the blend. KEEP TUNING (only for effects with
// tuning parameters) is Exclude tuning: preset recall and morph leave ROOT, CHORD and the like alone.

import { effectById } from "../core/fx";
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
  const b = fx.state.buses[bus];
  const on = fx.play.morphs[bus] !== undefined;
  const tuning = effectById(b.fxId)?.params.some((p) => p.tuning) ?? false;
  const keep = fx.state.exclude[bus];
  return (
    <div className={`morph ${on ? "on" : ""}`}>
      {tuning && (
        <button className={`btn keep ${keep ? "on" : ""}`} aria-pressed={keep}
          title="Exclude tuning: preset recall and morph leave the tuning parameters alone"
          onClick={() => fx.toggleExclude(bus)}>
          KEEP TUNING
        </button>
      )}
      <span className="lbl">MORPH</span>
      <MorphTrack bus={bus} fx={fx} />
      <button className={`exp ${on ? "on" : ""}`} aria-pressed={on} aria-label={`Bus ${bus} morph on`} disabled={!b.fxId}
        title="Morph (experimental): then press a stored preset and drag the track"
        onClick={() => fx.play.toggleMorph(bus)}>
        EXP
      </button>
    </div>
  );
}
