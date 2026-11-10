// Isolator's KILL buttons (an app feature, drawn in blue): a press sends the band to −INF and remembers its level;
// a second press puts the level back.

import { useState } from "react";

const BANDS = ["LOW", "MID", "HIGH"] as const;

export interface KillRowProps {
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
}

export function KillRow({ values, onValue }: KillRowProps) {
  const [kept, setKept] = useState<(number | undefined)[]>([undefined, undefined, undefined]);
  const toggle = (band: number) => {
    const level = kept[band];
    onValue(band, level ?? 0);
    setKept(kept.map((k, i) => (i !== band ? k : level === undefined ? (values[band] ?? 0) : undefined)));
  };
  return (
    <div className="r2">
      <span className="lbl">APP</span>
      <div className="seg kill">
        {BANDS.map((name, band) => (
          <button key={name} className={`app ${kept[band] !== undefined ? "on" : ""}`} aria-pressed={kept[band] !== undefined}
            onClick={() => toggle(band)}>
            KILL {name}
          </button>
        ))}
      </div>
    </div>
  );
}
