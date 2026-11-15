// One FX bus module (358 × 520): bus number (in DEL mode, click to clear the bus), the effect's name on an LCD (click
// to choose), (i) for its help, GRAB and ON/OFF; the effect's view and controls; the preset column and the morph row.

import { useState } from "react";
import { effectById } from "../core/fx";
import type { Bus, FxDef } from "../core/fxTypes";
import { BusGrab } from "./BusGrab";
import { EffectChooser } from "./EffectChooser";
import { FxControls, type KeepTuning } from "./FxControls";
import { FxHelpButton } from "./FxHelp";
import { FxView } from "./FxView";
import { MorphRow } from "./MorphRow";
import { PresetColumn } from "./PresetColumn";
import type { Fx } from "./useFx";
import { VIEWS } from "./views";

// Each bus its own colour; none is the app's orange (var(--cap)). Bus 1 and 2 match --b1 and --b2 in styles.css.
export const BUS_ACCENT: Record<Bus, string> = { 1: "#ff5f9e", 2: "#3ddc5a", 3: "#4aa3ff", 4: "#f2d03b", 5: "#b48cff" };
export const BUS_LABEL: Record<Bus, string> = { 1: "BUS 1", 2: "BUS 2", 3: "BUS 3", 4: "BUS 4 · MASTER", 5: "INPUT FX" };
const BUS_NUMBER: Record<Bus, string> = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "IN" };

export interface FxModuleProps {
  bus: Bus;
  fx: Fx;
}

// Exclude tuning, offered only for effects with tuning parameters.
function keepTuning(lib: Fx, bus: Bus, fx: FxDef): KeepTuning | undefined {
  if (!fx.params.some((p) => p.tuning)) return undefined;
  return { on: lib.state.exclude[bus], toggle: () => lib.toggleExclude(bus) };
}

// The bus number: in DEL mode it clears the bus (unloads its effect).
function BusNumber({ bus, fx }: { bus: Bus; fx: Fx }) {
  const clearing = fx.play.mode === "delete";
  return (
    <button className={`num ${clearing ? "clear" : ""}`} disabled={!clearing} onClick={() => fx.play.pressBus(bus)}
      aria-label={clearing ? `Clear ${BUS_LABEL[bus]}` : BUS_LABEL[bus]} title={clearing ? "Clear this bus" : undefined}>
      {BUS_NUMBER[bus]}
    </button>
  );
}

export function FxModule({ bus, fx: lib }: FxModuleProps) {
  const [choosing, setChoosing] = useState(false);
  const state = lib.buses[bus];
  const fx = effectById(state.fxId);
  const onValue = (i: number, raw: number) => lib.setValue(bus, i, raw);
  const face = (
    <div className="mcol">
      <FxView fx={fx} values={state.values} onValue={onValue} />
      {fx && (
        <FxControls fx={fx} values={state.values} hasView={VIEWS[fx.id] !== undefined} onValue={onValue}
          keepTuning={keepTuning(lib, bus, fx)} />
      )}
    </div>
  );
  return (
    <div className={`bus ${lib.play.locks.has(bus) ? "locked" : ""}`} style={{ ["--acc" as string]: BUS_ACCENT[bus] }}
      data-bus={bus}>
      <div className="hd">
        <BusNumber bus={bus} fx={lib} />
        <button className="name" aria-label={`${BUS_LABEL[bus]} effect`} onClick={() => setChoosing(true)}>
          {fx ? fx.name.toUpperCase() : "CHOOSE AN EFFECT"}
        </button>
        <FxHelpButton fx={fx} bus={bus} label={BUS_LABEL[bus]} values={state.values} colour={BUS_ACCENT[bus]}
          side={face} onChoose={(id) => lib.chooseEffect(bus, id)} />
        <BusGrab bus={bus} label={BUS_LABEL[bus]} fx={lib} disabled={!fx} />
        <button className={`ring ${state.on ? "" : "off"}`} disabled={!fx} aria-pressed={state.on}
          aria-label={`${BUS_LABEL[bus]} on`} onClick={() => lib.toggle(bus)}>
          <span className="sizer" aria-hidden>OFF</span>
          <span>{state.on ? "ON" : "OFF"}</span>
        </button>
      </div>
      <div className="body">
        {face}
        <PresetColumn bus={bus} fx={lib} />
      </div>
      <MorphRow bus={bus} fx={lib} />
      {choosing && (
        <EffectChooser bus={bus} label={BUS_LABEL[bus]} colour={BUS_ACCENT[bus]} current={state.fxId}
          onClose={() => setChoosing(false)}
          onPick={(id) => {
            lib.chooseEffect(bus, id);
            setChoosing(false);
          }} />
      )}
    </div>
  );
}
