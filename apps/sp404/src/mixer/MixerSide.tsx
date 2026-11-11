// The mixer's left column: DESK / SCOPE, the project, and SHOW BANKS (banks with no samples are greyed out).
// Mix scenes and recall safe join it later.

import { PROJECT_NAME } from "../core/serialNames";
import { NameEdit } from "../ui/NameEdit";
import { BANK_LETTERS, bankColourOf } from "./banks";
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
}

function ViewSwitch({ view, onView }: { view: MixerView; onView: (view: MixerView) => void }) {
  return (
    <div className="seg" role="group" aria-label="Mixer view">
      {(["desk", "scope"] as const).map((v) => (
        <button key={v} className={`btn ${view === v ? "on" : ""}`} aria-pressed={view === v} onClick={() => onView(v)}>
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function MixerSide({ project, shown, loadedBanks, onToggleBank, view, onView }: MixerSideProps) {
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
    </div>
  );
}
