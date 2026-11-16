// The mixer's left column: DESK / SCOPE / KEYS, the project, SHOW BANKS (banks with no samples are greyed out), and
// the project's mix scenes with RECALL SAFE.

import { PROJECT_NAME } from "../core/serialNames";
import { NameEdit } from "../ui/NameEdit";
import { BANK_LETTERS, bankColourOf } from "./banks";
import { SAFE_LABELS, SAFE_TYPES } from "./mixScenes";
import type { MixSceneControls } from "./useMixScenes";
import type { MixerView } from "./useMixerView";

// The project as shown: a status line while there's no project to name, else its number and a name to edit.
export type ProjectView = { status: string } | { number: string; name: string; onRename: (name: string) => void };

function Project({ project }: { project: ProjectView }) {
  if ("status" in project) return <div className="project">{project.status}</div>;
  return (
    <div className="project">
      <span className="num">{project.number}</span>
      <NameEdit value={project.name} field={PROJECT_NAME} label="project name" onRename={project.onRename} />
    </div>
  );
}

export interface MixerSideProps {
  project: ProjectView;
  shown: ReadonlySet<number>;
  loadedBanks: ReadonlySet<number>;
  onToggleBank: (bank: number) => void;
  view: MixerView;
  onView: (view: MixerView) => void;
  scenes: MixSceneControls;
}

const SCENE_TIP = "A mix scene is the loaded pads' values and MUTE buttons. Empty: press to store. Stored: press to "
  + "recall (RECALL SAFE types stay). DEL on: press to delete";

function MixScenePanel({ scenes }: { scenes: MixSceneControls }) {
  return (
    <>
      <div className="lbl">MIX SCENES</div>
      <div className="mixscenes" role="group" aria-label="Mix scenes" title={SCENE_TIP}>
        {scenes.stored.map((stored, i) => (
          <button key={i} className={`${stored ? "stored" : ""} ${scenes.current === i ? "on" : ""}`}
            aria-label={`Mix scene ${i + 1}`} disabled={!scenes.ready} onClick={() => scenes.press(i)}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="lbl">RECALL SAFE</div>
      <div className="recallsafe" role="group" aria-label="Recall safe">
        {SAFE_TYPES.map((t) => (
          <button key={t} className={`btn ${scenes.safe.has(t) ? "on" : ""}`} aria-pressed={scenes.safe.has(t)}
            title={`Scene recall leaves ${SAFE_LABELS[t].toLowerCase()} alone`} onClick={() => scenes.toggleSafe(t)}>
            {SAFE_LABELS[t]}
          </button>
        ))}
      </div>
    </>
  );
}

function ViewSwitch({ view, onView }: { view: MixerView; onView: (view: MixerView) => void }) {
  return (
    <div className="seg" role="group" aria-label="Mixer view">
      {(["desk", "scope", "keys"] as const).map((v) => (
        <button key={v} className={`btn ${view === v ? "on" : ""}`} aria-pressed={view === v} onClick={() => onView(v)}>
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function MixerSide({ project, shown, loadedBanks, onToggleBank, view, onView, scenes }: MixerSideProps) {
  return (
    <div className="mx-left">
      <ViewSwitch view={view} onView={onView} />
      <div className="lbl">PROJECT</div>
      <Project project={project} />
      <div className="lbl">SHOW BANKS</div>
      <div className="showbanks">
        {[...BANK_LETTERS].map((letter, bank) => {
          const loaded = loadedBanks.has(bank);
          return (
            <button key={letter} className={`btn ${shown.has(bank) ? "on" : ""} ${loaded ? "" : "na"}`} disabled={!loaded}
              aria-pressed={shown.has(bank)} onClick={() => onToggleBank(bank)}
              style={{ ["--bc" as string]: bankColourOf(bank) }}>
              {letter}
            </button>
          );
        })}
      </div>
      <MixScenePanel scenes={scenes} />
    </div>
  );
}
