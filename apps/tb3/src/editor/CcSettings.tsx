// The CC popover (docs/tb3-phase4-design.md): the learned CC assignments with their modes, LEARN, and the Launchkey
// defaults.
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

export function CcSettings(p: { learn: CcLearn; hasKeys: boolean; onClose: () => void }) {
  const l = p.learn;
  return (
    <div className="popover settings ccsettings">
      <div className="row">
        <button
          className={`btn ${l.learning === "pick" ? "sel blink" : ""}`}
          title="Click a parameter, then move a knob or fader"
          onClick={l.togglePick}
        >
          LEARN
        </button>
        <span className="status">{p.hasKeys ? learnStatus(l) : "Choose KEYS IN in MIDI settings"}</span>
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
        <button className="btn" onClick={p.onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
