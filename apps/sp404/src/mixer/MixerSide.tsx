// The mixer's left column: DESK / SCOPE, the project, and SHOW BANKS (banks with no samples are greyed out).
// Mix scenes and recall safe join it later.

import { BANK_LETTERS } from "./banks";
import type { MixerView } from "./useMixerView";

export interface MixerSideProps {
  projectLabel: string;
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

export function MixerSide({ projectLabel, shown, loadedBanks, onToggleBank, view, onView }: MixerSideProps) {
  return (
    <div className="mx-left">
      <ViewSwitch view={view} onView={onView} />
      <div className="lbl">PROJECT</div>
      <div className="project">{projectLabel}</div>
      <div className="lbl">SHOW BANKS</div>
      <div className="showbanks">
        {[...BANK_LETTERS].map((letter, bank) => {
          const loaded = loadedBanks.has(bank);
          return (
            <button key={letter} className={`btn ${shown.has(bank) ? "on" : ""} ${loaded ? "" : "na"}`} disabled={!loaded}
              aria-pressed={shown.has(bank)} onClick={() => onToggleBank(bank)}>
              {letter}
            </button>
          );
        })}
      </div>
      <div className="hint">Banks with no samples are greyed out. Two banks fit without scrolling.</div>
    </div>
  );
}
