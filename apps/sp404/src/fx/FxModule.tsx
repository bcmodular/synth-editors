// One FX bus module (358 × 520): bus number, the effect's name on an LCD (click to choose), ON/OFF; the effect's
// view and controls; the preset column (Phase 4) and morph (Phase 4).

import { useRef, useState } from "react";
import { effectById, effectsForBus } from "../core/fx";
import type { Bus, FxDef, FxId } from "../core/fxTypes";
import type { BusFx } from "../core/midi";
import { useDismiss } from "../ui/useDismiss";
import { FX_LAYOUT } from "./fxLayout";
import { FxControls } from "./FxControls";
import { FxView } from "./FxView";
import { VIEWS } from "./views";

export const BUS_ACCENT: Record<Bus, string> = { 1: "#ff8a2a", 2: "#3ddc5a", 3: "#4aa3ff", 4: "#4aa3ff", 5: "#d8a2ff" };
export const BUS_LABEL: Record<Bus, string> = { 1: "BUS 1", 2: "BUS 2", 3: "BUS 3", 4: "BUS 4 · MASTER", 5: "INPUT FX" };
const BUS_NUMBER: Record<Bus, string> = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "IN" };

export interface FxModuleProps {
  bus: Bus;
  state: BusFx;
  onChoose: (bus: Bus, fxId: FxId) => void;
  onValue: (bus: Bus, index: number, raw: number) => void;
  onToggle: (bus: Bus) => void;
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

function PresetColumn() {
  return (
    <div className="pcol" title="Presets, defaults, GRAB and LOCK arrive with the library (Phase 4)">
      <span className="lbl">PRESETS</span>
      <div className="presets">{Array.from({ length: 8 }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
      <span className="btn dis">DEF</span>
      <span className="btn dis">GRAB</span>
      <span className="btn dis">LOCK</span>
    </div>
  );
}

export function FxModule({ bus, state, onChoose, onValue, onToggle }: FxModuleProps) {
  const [choosing, setChoosing] = useState(false);
  const fx = effectById(state.fxId);
  return (
    <div className="bus" style={{ ["--acc" as string]: BUS_ACCENT[bus] }} data-bus={bus}>
      <div className="hd">
        <div className="num">{BUS_NUMBER[bus]}</div>
        <button className="name" aria-label={`${BUS_LABEL[bus]} effect`} onClick={() => setChoosing(true)}>
          {fx ? fx.name.toUpperCase() : "CHOOSE AN EFFECT"}
        </button>
        <button className={`ring ${state.on ? "" : "off"}`} disabled={!fx} aria-pressed={state.on}
          aria-label={`${BUS_LABEL[bus]} on`} onClick={() => onToggle(bus)}>
          {state.on ? "ON" : "OFF"}
        </button>
      </div>
      <div className="lbl">{BUS_LABEL[bus]}</div>
      <div className="body">
        <div className="mcol">
          <FxView fx={fx} values={state.values} onValue={(i, raw) => onValue(bus, i, raw)} />
          {fx && <FxControls fx={fx} values={state.values} hasView={VIEWS[fx.id] !== undefined}
            onValue={(i, raw) => onValue(bus, i, raw)} />}
        </div>
        <PresetColumn />
      </div>
      <div className="morph dis"><span className="lbl">MORPH</span><div className="tr" /><span className="exp">EXP</span></div>
      {choosing && (
        <Chooser bus={bus} current={state.fxId} onClose={() => setChoosing(false)}
          onPick={(id) => {
            onChoose(bus, id);
            setChoosing(false);
          }} />
      )}
    </div>
  );
}
