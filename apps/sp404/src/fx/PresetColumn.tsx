// A module's side column (docs/sp404-design.md › FX modules): the 8 presets of the bus's effect, then DEF, SYNC, GRAB
// and LOCK. A press on a preset recalls it, or stores into an empty slot; in DEL mode it deletes; held with GRAB mode
// on (or Shift) it previews until let go; with morph on it picks the morph target. This GRAB is the bus's own: the
// effect is on while it's held.

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Bus } from "../core/fxTypes";
import { currentPreset, hasDefaults, slotsOn } from "./fxLibrary";
import type { Fx } from "./useFx";

const BUS_NAME: Record<Bus, string> = { 1: "BUS 1", 2: "BUS 2", 3: "BUS 3", 4: "BUS 4", 5: "INPUT FX" };

interface SlotProps {
  bus: Bus;
  slot: number;
  stored: boolean;
  className: string;
  fx: Fx;
}

const pressKey = (e: KeyboardEvent) => (e.key === " " || e.key === "Enter") && !e.repeat;

function PresetSlot({ bus, slot, stored, className, fx }: SlotProps) {
  const { play } = fx;
  const press = (held: boolean) => play.pressPreset({ bus, slot }, held);
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no focus, so no focus ring after Shift
    e.currentTarget.setPointerCapture(e.pointerId);
    press(play.grab || e.shiftKey);
  };
  return (
    <button className={`${stored ? "stored" : ""} ${className}`} aria-label={`${BUS_NAME[bus]} preset ${slot + 1}`}
      onPointerDown={onPointerDown} onPointerUp={play.release} onLostPointerCapture={play.release}
      onKeyDown={(e) => pressKey(e) && press(false)}>
      {slot + 1}
    </button>
  );
}

// Each slot's look: stored, the one the bus's values match ("on"), and the morph target.
function slotClass(fx: Fx, bus: Bus, slot: number) {
  const current = currentPreset(fx.state, bus) === slot ? "on" : "";
  const target = fx.play.morphs[bus]?.slot === slot ? "target" : "";
  return `${current} ${target}`;
}

// The effect on while held (momentary); letting go puts ON/OFF back as it was.
function FxGrab({ bus, fx, disabled }: { bus: Bus; fx: Fx; disabled: boolean }) {
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
  const held = was !== null;
  return (
    <button className={`btn fxgrab ${held ? "on" : ""}`} disabled={disabled} aria-label={`${BUS_NAME[bus]} grab`}
      title="GRAB: the effect is on while held" onPointerDown={onPointerDown} onPointerUp={up}
      onLostPointerCapture={up}>
      GRAB
    </button>
  );
}

export function PresetColumn({ bus, fx }: { bus: Bus; fx: Fx }) {
  const { play, state } = fx;
  const noFx = !state.buses[bus].fxId;
  const locked = play.locks.has(bus);
  return (
    <div className={`pcol mode-${play.mode} ${noFx ? "nofx" : ""}`}>
      <span className="lbl">PRESETS</span>
      <div className="presets">
        {slotsOn(state, bus).map((v, i) => (
          <PresetSlot key={i} bus={bus} slot={i} stored={v !== null} className={slotClass(fx, bus, i)} fx={fx} />
        ))}
      </div>
      <button className={`btn def ${hasDefaults(state, bus) ? "stored" : ""}`} disabled={noFx}
        title="Recall this effect's defaults" onClick={() => play.pressDefaults(bus)}>
        DEF
      </button>
      <button className="btn sync" disabled={!fx.outputName} aria-label={`${BUS_NAME[bus]} sync`}
        title="SYNC: send this bus to the SP-404 again" onClick={() => fx.sync(bus)}>
        SYNC
      </button>
      <FxGrab bus={bus} fx={fx} disabled={noFx} />
      <button className={`btn lock ${locked ? "on" : ""}`} aria-pressed={locked} aria-label={`${BUS_NAME[bus]} lock`}
        title="LOCK: presets, DEF, morph and ON/OFF still play; store, delete, clear and scene recall leave the bus alone"
        onClick={() => play.toggleLock(bus)}>
        LOCK
      </button>
    </div>
  );
}
