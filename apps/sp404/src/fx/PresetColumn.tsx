// A module's side column (docs/sp404-design.md › FX modules): the 8 presets of the bus's effect, then DEF, GRAB and
// LOCK. A press on a preset recalls it, or stores into an empty slot; in STORE mode it stores, in DEL mode it
// deletes; held with GRAB on (or Shift) it previews until let go; with morph on it picks the morph target.

import type { KeyboardEvent, PointerEvent } from "react";
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
    e.currentTarget.setPointerCapture(e.pointerId);
    press(play.grabs.has(bus) || e.shiftKey);
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

export function PresetColumn({ bus, fx }: { bus: Bus; fx: Fx }) {
  const { play, state } = fx;
  const noFx = !state.buses[bus].fxId;
  const locked = play.locks.has(bus);
  const grab = play.grabs.has(bus);
  return (
    <div className={`pcol mode-${play.mode} ${noFx ? "nofx" : ""}`}>
      <span className="lbl">PRESETS</span>
      <div className="presets">
        {slotsOn(state, bus).map((v, i) => (
          <PresetSlot key={i} bus={bus} slot={i} stored={v !== null} className={slotClass(fx, bus, i)} fx={fx} />
        ))}
      </div>
      <button className={`btn def ${hasDefaults(state, bus) ? "stored" : ""}`} disabled={noFx}
        title="Recall this effect's defaults (in STORE mode: store them)" onClick={() => play.pressDefaults(bus)}>
        DEF
      </button>
      <button className={`btn ${grab ? "on" : ""}`} aria-pressed={grab} aria-label={`${BUS_NAME[bus]} grab`}
        title="GRAB: hold a stored preset to hear it; letting go puts back what was there (or hold Shift)"
        onClick={() => play.toggleGrab(bus)}>
        GRAB
      </button>
      <button className={`btn lock ${locked ? "on" : ""}`} aria-pressed={locked} aria-label={`${BUS_NAME[bus]} lock`}
        title="LOCK: presets, DEF, morph and ON/OFF still play; store, delete, clear and scene recall leave the bus alone"
        onClick={() => play.toggleLock(bus)}>
        LOCK
      </button>
    </div>
  );
}
