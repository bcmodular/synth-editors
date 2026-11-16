// The settings window's CC tab (docs/tb3-phase4-design.md): the learned CC assignments with their modes, LEARN, and
// the Launchkey defaults; and the bar that says what learning waits for while the window is out of the way.
import type { CcAssignment, CcMode } from "@synth-editors/cc-learn";
import { modesFor, targetLabel } from "./ccTargets";
import type { CcLearn } from "./useCcLearn";

const MODE_TIPS: Record<CcMode, string> = {
  relative: "For encoders sending steps around 64 (set the controller's encoders to relative)",
  pickup: "Ignores the knob until it reaches the value, then follows",
  jump: "Follows the knob at once",
};

function learnStatus(l: CcLearn): string {
  if (l.learning === "pick") return "Click a parameter, then move a knob or fader. Esc cancels.";
  if (l.learning) return `Move a knob or fader for ${targetLabel(l.learning.target)}… Esc cancels.`;
  return "";
}

function Row(p: { a: CcAssignment; learn: CcLearn }) {
  const { a, learn } = p;
  const listening = learn.learning !== null && learn.learning !== "pick" && learn.learning.target === a.target;
  return (
    <tr>
      <td className="ccnum">CC {a.cc}</td>
      <td className="ccch">{a.channel === null ? "any" : `ch ${a.channel}`}</td>
      <td className="cctarget">{targetLabel(a.target)}</td>
      <td>
        <select
          value={a.mode}
          title={MODE_TIPS[a.mode]}
          disabled={modesFor(a.target).length < 2}
          onChange={(e) => learn.setMode(a.target, e.target.value as CcMode)}
        >
          {modesFor(a.target).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          className={`btn mini ${listening ? "sel blink" : ""}`}
          title="Move a knob or fader to give this a new CC"
          onClick={() => (listening ? learn.cancel() : learn.listenFor(a.target))}
        >
          LEARN
        </button>
        <button className="btn mini" title="Forget this assignment" onClick={() => learn.forget(a.target)}>
          ×
        </button>
      </td>
    </tr>
  );
}

// `onPick`: LEARN, which steps the window aside so a parameter can be clicked.
export function CcPane(p: { learn: CcLearn; hasKeys: boolean; onPick: () => void }) {
  const l = p.learn;
  return (
    <div className="ccsettings">
      <div className="row">
        <button className="btn" title="Click a parameter, then move a knob or fader" onClick={p.onPick}>
          LEARN
        </button>
        <span className="status">
          {p.hasKeys ? learnStatus(l) || "LEARN, then click a parameter and move a knob." : "Choose KEYS IN under CONTROLLERS."}
        </span>
      </div>
      <table className="cclist">
        <tbody>
          {l.assignments.map((a) => (
            <Row key={a.target} a={a} learn={l} />
          ))}
        </tbody>
      </table>
      <div className="row">
        <button className="btn" title="Back to the Launchkey assignments" onClick={l.resetDefaults}>
          DEFAULTS
        </button>
      </div>
    </div>
  );
}

// While learning with the settings window closed: what it waits for, and CANCEL.
export function LearnBar(p: { learn: CcLearn }) {
  if (p.learn.learning === null) return null;
  return (
    <div className="learnbar" role="status">
      <span>{learnStatus(p.learn)}</span>
      <button className="btn mini" onClick={p.learn.cancel}>
        CANCEL
      </button>
    </div>
  );
}
