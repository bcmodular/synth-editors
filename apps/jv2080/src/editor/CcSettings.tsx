// CC learn's controls (after apps/tb3/src/editor/CcSettings.tsx): the CC ▾ button in the top strip with its pop-up
// (the controller's port, LEARN, and the learned CCs with their modes), and the bar that says what learning waits for.
import type { CcAssignment, CcMode } from "@synth-editors/cc-learn";
import type { PortInfo } from "@synth-editors/midi";
import { useRef, useState } from "react";
import type { JvLink } from "../link/useJvLink";
import { useDismiss } from "../ui/useDismiss";
import { MODES, targetLabel } from "./ccTargets";
import type { CcLearn } from "./useCcLearn";

const MODE_TIPS: Record<CcMode, string> = {
  relative: "For encoders sending steps around 64 (set the controller's encoders to relative)",
  pickup: "Ignores the knob until it reaches the value, then follows",
  jump: "Follows the knob at once",
};

function learnStatus(l: CcLearn): string {
  if (l.learning === "pick") return "Click a control, then move a knob or fader. Esc cancels.";
  if (l.learning) return `Move a knob or fader for ${targetLabel(l.learning.target)}… Esc cancels.`;
  return "";
}

function Row({ a, learn }: { a: CcAssignment; learn: CcLearn }) {
  const listening = learn.learning !== null && learn.learning !== "pick" && learn.learning.target === a.target;
  return (
    <tr>
      <td className="ccnum">CC {a.cc}</td>
      <td className="ccch">{a.channel === null ? "any" : `ch ${a.channel}`}</td>
      <td className="cctarget" title={targetLabel(a.target)}>{targetLabel(a.target)}</td>
      <td>
        <select className="pick" value={a.mode} title={MODE_TIPS[a.mode]}
          onChange={(e) => learn.setMode(a.target, e.target.value as CcMode)}>
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td className="ccbtns">
        <button className={`btn mini ${listening ? "sel" : ""}`} title="Move a knob or fader to give this a new CC"
          onClick={() => (listening ? learn.cancel() : learn.listenFor(a.target))}>LEARN</button>
        <button className="btn mini" title="Forget this CC" onClick={() => learn.forget(a.target)}>×</button>
      </td>
    </tr>
  );
}

function PortSelect(p: { ports: PortInfo[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="pick" value={p.value} onChange={(e) => p.onChange(e.target.value)}>
      <option value="">(none)</option>
      {p.ports.map((port) => <option key={port.id} value={port.name}>{port.name}</option>)}
    </select>
  );
}

function CcPanel({ link, learn, onClose }: { link: JvLink; learn: CcLearn; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const pick = () => {
    learn.togglePick();
    onClose(); // out of the way, so a control can be clicked
  };
  return (
    <div ref={ref} className="cc-pop">
      <label className="prow">
        <span className="lbl">Controller in</span>
        <PortSelect ports={link.inputs} value={link.ctrlName} onChange={link.setCtrlName} />
      </label>
      <div className="row tight">
        <button className="btn" disabled={!link.ctrlName} onClick={pick}>LEARN</button>
        <span className="note">{link.ctrlName ? "LEARN, then click a control and move a knob." : "Choose the controller's port first."}</span>
      </div>
      {learn.assignments.length > 0 ? (
        <table className="cclist"><tbody>{learn.assignments.map((a) => <Row key={a.target} a={a} learn={learn} />)}</tbody></table>
      ) : (
        <p className="note">No CCs learned yet.</p>
      )}
    </div>
  );
}

export function CcSettings({ link, learn }: { link: JvLink; learn: CcLearn }) {
  const [open, setOpen] = useState(false);
  const count = learn.assignments.length;
  return (
    <div className="cc-set">
      <button className={`btn ${open ? "sel" : ""}`} title="Learn CCs from a controller" onClick={() => setOpen((o) => !o)}>
        CC{count ? ` ${count}` : ""} ▾
      </button>
      {open && <CcPanel link={link} learn={learn} onClose={() => setOpen(false)} />}
    </div>
  );
}

// While learning: what it waits for, and CANCEL.
export function LearnBar({ learn }: { learn: CcLearn }) {
  if (learn.learning === null) return null;
  return (
    <div className="learnbar" role="status">
      <span>{learnStatus(learn)}</span>
      <button className="btn mini" onClick={learn.cancel}>CANCEL</button>
    </div>
  );
}
