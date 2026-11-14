// The EFX type's own view: its drawings (specs.ts) side by side, joined by an arrow for two effects in series or
// stacked for two in parallel, then a knob or buttons for every parameter no drawing takes. The drawings fill the
// height the knob rows leave.

import type { ReactNode } from "react";
import { Segmented } from "../../ui/controls";
import { Drawing } from "../../ui/Drawing";
import { Knob } from "../../ui/Knob";
import type { Size } from "./drawKit";
import { LfoPanel, RotaryPanel } from "./modPanels";
import { EFX_SPECS, panelParams, type PanelSpec } from "./specs";
import { DelayPanel, GatePanel, PitchPanel, ReverbPanel } from "./timePanels";
import { CompressorPanel, DrivePanel, EnhancerPanel, EqPanel, LimiterPanel, SpectrumPanel } from "./tonePanels";
import { useEfx, type EfxParam, type GetParam } from "./useEfx";

function panelContent(spec: PanelSpec, get: GetParam, size: Size): ReactNode {
  switch (spec.kind) {
    case "eq": return <EqPanel spec={spec} get={get} size={size} />;
    case "spectrum": return <SpectrumPanel spec={spec} get={get} size={size} />;
    case "drive": return <DrivePanel spec={spec} get={get} size={size} />;
    case "enhancer": return <EnhancerPanel spec={spec} get={get} size={size} />;
    case "compressor": return <CompressorPanel spec={spec} get={get} size={size} />;
    case "limiter": return <LimiterPanel spec={spec} get={get} size={size} />;
    case "lfo": return <LfoPanel spec={spec} get={get} size={size} />;
    case "rotary": return <RotaryPanel spec={spec} get={get} size={size} />;
    case "delay": return <DelayPanel spec={spec} get={get} size={size} />;
    case "pitch": return <PitchPanel spec={spec} get={get} size={size} />;
    case "reverb": return <ReverbPanel spec={spec} get={get} size={size} />;
    case "gate": return <GatePanel spec={spec} get={get} size={size} />;
  }
}

// A drawing as big as the space the view leaves it.
function Panel({ spec, get }: { spec: PanelSpec; get: GetParam }) {
  return <Drawing className="efx-panel">{(width, height) => panelContent(spec, get, { width, height })}</Drawing>;
}

// Shorter names for the knob rows, where long ones get cut off ("Chorus Pre Delay" → "Chorus Pre-Dly").
const SHORTER: readonly (readonly [RegExp, string])[] = [
  [/Pre Delay/, "Pre-Dly"], [/Level Balance/, "A/B Bal"], [/Balance/, "Bal"], [/Deviation/, "Dev"],
  [/Acceleration/, "Accel"], [/Separation/, "Sep"], [/Feedback/, "Fbk"], [/HF Damp/, "HF Damp"],
];
export const shortName = (name: string) => SHORTER.reduce((n, [re, to]) => n.replace(re, to), name);

// A parameter no drawing takes: buttons for a short list, a drop-down for a long one, otherwise a knob.
function RestControl({ x }: { x: EfxParam }) {
  const labels = x.p.labels;
  if (labels && labels.length <= 5) {
    return (
      <div className="efx-choice">
        <span className="lbl">{shortName(x.p.name)}</span>
        <Segmented options={labels.map((label, value) => ({ label, value }))} value={x.raw} onChange={x.set} />
      </div>
    );
  }
  if (labels) {
    return (
      <div className="efx-choice">
        <span className="lbl">{shortName(x.p.name)}</span>
        <select className="pick" value={x.raw} onChange={(e) => x.set(Number(e.target.value))}>
          {labels.map((label, i) => <option key={label} value={i}>{label}</option>)}
        </select>
      </div>
    );
  }
  return <Knob label={shortName(x.p.name)} value={x.raw} max={x.p.max} reset={x.def.center ?? 0} text={x.text} onChange={x.set} />;
}

export function EfxView() {
  const { typeRaw, params, get } = useEfx();
  const spec = EFX_SPECS[typeRaw];
  if (!spec) return null;
  const drawn = new Set(spec.panels.flatMap(panelParams));
  const rest = params.filter((x) => !drawn.has(x.p.name));
  return (
    <div className="efx-view">
      <div className={`efx-panels ${spec.join ?? ""}`}>
        {spec.panels.map((panel, i) => (
          <div key={`${typeRaw}-${i}`} className="efx-panel-wrap">
            {i > 0 && spec.join === "series" && <span className="efx-arrow">→</span>}
            <Panel spec={panel} get={get} />
          </div>
        ))}
      </div>
      <div className="efx-rest">
        {rest.map((x) => <RestControl key={`${typeRaw}-${x.p.slot}`} x={x} />)}
      </div>
    </div>
  );
}
