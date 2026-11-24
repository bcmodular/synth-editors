// The patch's controllers (manual p. 73, 104–106), from the mixer's header: a tab for each of the three controllers
// (its source and hold/peak, then where each tone sends it: four destinations with a depth each), and one for the
// EFX control (two sources that move the EFX type's realtime parameter).

import { useState } from "react";
import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { CONTROLLERS, ctrlDepthId, ctrlDestId, DESTINATIONS, SLOTS } from "../core/paramsControl";
import { Segmented } from "../ui/controls";
import { PopoverButton } from "../ui/Popover";
import { TONE_COLOURS } from "./colours";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamKnob, ParamSelect } from "./ParamControls";

const TONES = [0, 1, 2, 3];
const EFX_TAB = 4;
const TABS = [...CONTROLLERS.map((c) => ({ label: `CTRL ${c}`, value: c })), { label: "EFX", value: EFX_TAB }];

// One destination of a controller in a tone: what it moves, and how far (dim while it moves nothing).
function Slot({ c, d, tone }: { c: number; d: number; tone: number }) {
  const { patch } = useEditor();
  const dest = getParam(patch, param(ctrlDestId(c, d)), tone);
  return (
    <div className="ct-slot" title={`Moves ${DESTINATIONS[dest]?.[1] ?? "?"}`}>
      <ParamSelect def={ctrlDestId(c, d)} tone={tone} label={String(d)} />
      <div className={dest === 0 ? "off" : ""}>
        <ParamKnob def={ctrlDepthId(c, d)} tone={tone} label="DEPTH" />
      </div>
    </div>
  );
}

function ControllerTab({ c }: { c: number }) {
  return (
    <>
      <div className="ct-head">
        {c === 1 ? (
          <div className="prow"><span className="lbl">Source</span><span className="ct-fixed">MODULATION lever</span></div>
        ) : (
          <ParamSelect def={`ctrlSource${c}`} label="Source" />
        )}
        <ParamChoice def={`ctrl${c}Hold`} label="Hold/Peak" />
      </div>
      <div className="ct-grid">
        {TONES.map((t) => (
          <div key={t} className="ct-col" style={{ ["--led" as string]: TONE_COLOURS[t] }}>
            <span className="ct-tone">TONE {t + 1}</span>
            {SLOTS.map((d) => <Slot key={d} c={c} d={d} tone={t} />)}
          </div>
        ))}
      </div>
      <p className="pop-note">
        Each tone sends the controller to up to four destinations: PCH pitch, CUT cutoff, RES resonance, LEV level,
        PAN, MIX / CHO / REV the sends, PL FL AL pL an LFO's pitch, filter, amp or pan depth, L1R / L2R an LFO's rate.
        Hold keeps the value while a pedal is held; peak keeps the highest.
      </p>
    </>
  );
}

function EfxTab() {
  return (
    <>
      {[1, 2].map((n) => (
        <div key={n} className="ct-efx">
          <ParamSelect def={`efxCtrlSource${n}`} label={`Source ${n}`} />
          <ParamKnob def={`efxCtrlDepth${n}`} label="DEPTH" />
        </div>
      ))}
      <ParamChoice def="efxCtrlHold" label="Hold/Peak" />
      <p className="pop-note">
        Two controllers move the EFX type's realtime parameter (marked # in the manual's effect pages, p. 34–53), each
        by its depth.
      </p>
    </>
  );
}

function ControllersPanel() {
  const [tab, setTab] = useState(1);
  return (
    <>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === EFX_TAB ? <EfxTab /> : <ControllerTab c={tab} />}
    </>
  );
}

export function ControllersButton() {
  return (
    <PopoverButton label="CONTROL" title="Controllers" className="ranges-btn">
      <ControllersPanel />
    </PopoverButton>
  );
}
