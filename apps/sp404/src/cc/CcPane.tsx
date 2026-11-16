// CC learn on screen: the LEARN pill in the top bar, the bar that says what learning waits for, and Settings › CC
// LEARN, the assignments with their modes.

import type { CcAssignment, CcMode } from "@synth-editors/cc-learn";
import { CC_MODES } from "@synth-editors/cc-learn";
import { targetLabel, type CcFx } from "./ccTargets";
import type { CcLearn } from "./useCcLearn";

const MODE_TIPS: Record<CcMode, string> = {
  relative: "For encoders sending steps around 64 (set the controller's encoders to relative)",
  pickup: "Ignores the knob until it reaches the value, then follows",
  jump: "Follows the knob at once",
};

function status(l: CcLearn, fx: CcFx): string {
  if (l.learning === "pick") return "Click a parameter (or a morph track), then move a knob or fader. Esc cancels.";
  if (l.learning) return `Move a knob or fader for ${targetLabel(l.learning.target, fx)}… Esc cancels.`;
  return "";
}

export function LearnPill({ learn }: { learn: CcLearn }) {
  const on = learn.learning !== null;
  return (
    <button className={`pill ${on ? "on" : ""}`} aria-pressed={on} onClick={learn.togglePick}
      title="CC learn: click a parameter, then move a knob or fader on any other controller">
      LEARN
    </button>
  );
}

// While learning: what it waits for, and CANCEL.
export function LearnBar({ learn, fx }: { learn: CcLearn; fx: CcFx }) {
  if (learn.learning === null) return null;
  return (
    <div className="learnbar" role="status">
      <span>{status(learn, fx)}</span>
      <button className="btn" onClick={learn.cancel}>CANCEL</button>
    </div>
  );
}

function Row({ a, learn, fx }: { a: CcAssignment; learn: CcLearn; fx: CcFx }) {
  const listening = typeof learn.learning === "object" && learn.learning?.target === a.target;
  return (
    <tr>
      <td>CC {a.cc}</td>
      <td>{a.channel === null ? "any" : `ch ${a.channel}`}</td>
      <td className="cctarget">{targetLabel(a.target, fx)}</td>
      <td>
        <select value={a.mode} title={MODE_TIPS[a.mode]} aria-label={`${targetLabel(a.target, fx)} mode`}
          onChange={(e) => learn.setMode(a.target, e.target.value as CcMode)}>
          {CC_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td>
        <button className={`btn ${listening ? "on" : ""}`} title="Move a knob or fader to give this a new CC"
          onClick={() => (listening ? learn.cancel() : learn.listenFor(a.target))}>
          LEARN
        </button>
        <button className="btn" aria-label={`Forget ${targetLabel(a.target, fx)}`} onClick={() => learn.forget(a.target)}>
          ×
        </button>
      </td>
    </tr>
  );
}

export function CcFields({ learn, fx }: { learn: CcLearn; fx: CcFx }) {
  return (
    <>
      <div className="lbl">CC LEARN · knobs and faders on other controllers</div>
      {learn.assignments.length === 0 ? (
        <div className="note">None yet: press LEARN in the top bar, click a parameter, then move a knob.</div>
      ) : (
        <table className="cclist">
          <tbody>{learn.assignments.map((a) => <Row key={a.target} a={a} learn={learn} fx={fx} />)}</tbody>
        </table>
      )}
      {learn.assignments.length > 0 && <button className="btn" onClick={learn.clear}>FORGET ALL</button>}
    </>
  );
}
