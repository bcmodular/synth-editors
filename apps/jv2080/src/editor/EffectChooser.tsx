// The EFX chooser: a grid over the editor, one row per group in the group's colour (core/efxGroups.ts), after the
// SP-404 app's. Escape or a press outside closes it.

import { useRef } from "react";
import { createPortal } from "react-dom";
import { EFX_CELLS, EFX_GROUPS } from "../core/efxGroups";
import { useDismiss } from "../ui/useDismiss";

export function EffectChooser({ current, onPick, onClose }: { current: number; onPick: (type: number) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose);
  const host = document.querySelector<HTMLElement>(".editor") ?? document.body;
  return createPortal(
    <div className="chooser" ref={panel} role="dialog" aria-label="EFX type">
      <div className="ch-title">EFX TYPE</div>
      {EFX_GROUPS.map((g) => (
        <div key={g.name} className="ch-row" style={{ ["--grp" as string]: g.colour }}>
          <div className="ch-group">{g.name.toUpperCase()}</div>
          {Array.from({ length: EFX_CELLS }, (_, i) => {
            const cell = g.types[i];
            if (!cell) return <span key={i} className="ch-empty" />;
            return (
              <button key={cell.type} className={`ch-fx ${cell.type === current ? "on" : ""}`} onClick={() => onPick(cell.type)}>
                {cell.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>,
    host,
  );
}
