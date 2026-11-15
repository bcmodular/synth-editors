// The effect chooser: an 8 × 8 grid over the FX row, one row per effect group in the group's colour (fxGroups.ts),
// matching the Launchpad's pads. Every effect has a fixed cell; those the bus can't load are dimmed. Escape or a press
// outside closes it.

import { useRef } from "react";
import { createPortal } from "react-dom";
import { canLoad } from "../core/fx";
import type { Bus, FxId } from "../core/fxTypes";
import { useDismiss } from "../ui/useDismiss";
import { FX_GROUPS } from "./fxGroups";

const CELLS = 8;

// Names wrap at spaces; a single long word (TimeCtrlDly) is set narrower instead of breaking.
const LONG_WORD = 11;
const narrow = (name: string) => name.split(" ").some((w) => w.length >= LONG_WORD);

export interface EffectChooserProps {
  bus: Bus;
  label: string; // the bus's name
  colour: string; // the bus's colour
  current: FxId;
  onPick: (id: FxId) => void;
  onClose: () => void;
}

export function EffectChooser({ bus, label, colour, current, onPick, onClose }: EffectChooserProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose);
  const host = document.querySelector<HTMLElement>(".ld") ?? document.body; // inside the zoomed layout
  return createPortal(
    <div className="chooser" ref={panel} role="dialog" aria-label={`Effects for ${label}`}
      style={{ ["--acc" as string]: colour }}>
      <div className="ch-title">EFFECT FOR <b>{label}</b></div>
      {FX_GROUPS.map((g) => (
        <div key={g.name} className="ch-row" style={{ ["--grp" as string]: g.colour }}>
          <div className="ch-group">{g.name.toUpperCase()}</div>
          {Array.from({ length: CELLS }, (_, i) => {
            const fx = g.effects[i];
            if (!fx) return <span key={i} className="ch-empty" />;
            const cls = ["ch-fx", fx.id === current && "on", narrow(fx.name) && "narrow"].filter(Boolean).join(" ");
            return (
              <button key={fx.id} className={cls} disabled={!canLoad(fx, bus)} onClick={() => onPick(fx.id)}>
                {fx.name}
              </button>
            );
          })}
        </div>
      ))}
    </div>,
    host,
  );
}
