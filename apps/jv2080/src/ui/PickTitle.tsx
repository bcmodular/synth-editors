// A section title that opens a chooser: the current choice's name and a grid icon, as on the tones (their wave) and
// the EFX (its type).

import type { ReactNode } from "react";

// Four little squares: "pick from a grid".
export function LibraryIcon() {
  return (
    <svg className="lib-icon" width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      {[0, 8].flatMap((x) => [0, 8].map((y) => <rect key={`${x}${y}`} x={x} y={y} width={6} height={6} rx={1} />))}
    </svg>
  );
}

export function PickTitle({ hint, onClick, children }: { hint: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="pick-title" title={hint} onClick={onClick}>
      <span>{children}</span>
      <LibraryIcon />
    </button>
  );
}
