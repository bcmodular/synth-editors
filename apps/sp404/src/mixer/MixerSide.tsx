// The mixer's left column: the project, and SHOW BANKS (banks with no samples are greyed out). Mix scenes and
// recall safe join it later in this phase.

import { BANK_LETTERS } from "./banks";

export interface MixerSideProps {
  projectLabel: string;
  shown: ReadonlySet<number>;
  loadedBanks: ReadonlySet<number>;
  onToggleBank: (bank: number) => void;
}

export function MixerSide({ projectLabel, shown, loadedBanks, onToggleBank }: MixerSideProps) {
  return (
    <div className="mx-left">
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
