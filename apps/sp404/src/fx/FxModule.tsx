// One FX bus module (358 × 520): bus number (in DEL mode, click to clear the bus), the effect's name on an LCD (click
// to choose), ON/OFF; the effect's view and controls; the preset column and the morph row.

import { useRef, useState } from "react";
import { effectById, effectsForBus } from "../core/fx";
import type { Bus, FxDef, FxId } from "../core/fxTypes";
import { useDismiss } from "../ui/useDismiss";
import { FX_LAYOUT } from "./fxLayout";
import { FxControls } from "./FxControls";
import { FxView } from "./FxView";
import { MorphRow } from "./MorphRow";
import { PresetColumn } from "./PresetColumn";
import type { Fx } from "./useFx";
import { VIEWS } from "./views";

export const BUS_ACCENT: Record<Bus, string> = { 1: "#ff8a2a", 2: "#3ddc5a", 3: "#4aa3ff", 4: "#4aa3ff", 5: "#d8a2ff" };
export const BUS_LABEL: Record<Bus, string> = { 1: "BUS 1", 2: "BUS 2", 3: "BUS 3", 4: "BUS 4 · MASTER", 5: "INPUT FX" };
const BUS_NUMBER: Record<Bus, string> = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "IN" };

export interface FxModuleProps {
  bus: Bus;
  fx: Fx;
}

// The effects this bus can load, by category, in the designs' order.
function byCategory(bus: Bus): [string, FxDef[]][] {
  const groups = new Map<string, FxDef[]>();
  for (const fx of effectsForBus(bus)) {
    const cat = FX_LAYOUT[fx.id - 1]?.category ?? "";
    groups.set(cat, [...(groups.get(cat) ?? []), fx]);
  }
  return [...groups];
}

function Chooser({ bus, current, onPick, onClose }: { bus: Bus; current: FxId; onPick: (id: FxId) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose);
  return (
    <div className="chooser" ref={panel} role="dialog" aria-label={`Effects for ${BUS_LABEL[bus]}`}>
      {byCategory(bus).map(([cat, list]) => (
        <div key={cat} className="cat">
          <div className="lbl">{cat}</div>
          <div className="choices">
            {list.map((fx) => (
              <button key={fx.id} className={fx.id === current ? "on" : ""} onClick={() => onPick(fx.id)}>{fx.name}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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
  return (
    <div className={`bus ${lib.play.locks.has(bus) ? "locked" : ""}`} style={{ ["--acc" as string]: BUS_ACCENT[bus] }}
      data-bus={bus}>
      <div className="hd">
        <BusNumber bus={bus} fx={lib} />
        <button className="name" aria-label={`${BUS_LABEL[bus]} effect`} onClick={() => setChoosing(true)}>
          {fx ? fx.name.toUpperCase() : "CHOOSE AN EFFECT"}
        </button>
        <button className={`ring ${state.on ? "" : "off"}`} disabled={!fx} aria-pressed={state.on}
          aria-label={`${BUS_LABEL[bus]} on`} onClick={() => lib.toggle(bus)}>
          {state.on ? "ON" : "OFF"}
        </button>
      </div>
      <div className="lbl">{BUS_LABEL[bus]}</div>
      <div className="body">
        <div className="mcol">
          <FxView fx={fx} values={state.values} onValue={onValue} />
          {fx && <FxControls fx={fx} values={state.values} hasView={VIEWS[fx.id] !== undefined} onValue={onValue} />}
        </div>
        <PresetColumn bus={bus} fx={lib} />
      </div>
      <MorphRow bus={bus} fx={lib} />
      {choosing && (
        <Chooser bus={bus} current={state.fxId} onClose={() => setChoosing(false)}
          onPick={(id) => {
            lib.chooseEffect(bus, id);
            setChoosing(false);
          }} />
      )}
    </div>
  );
}
