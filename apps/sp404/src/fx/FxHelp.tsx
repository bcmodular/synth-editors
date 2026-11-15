// The (i) on an FX module and the help panel it opens: a working copy of the module's drawing and controls on the
// left, and on the right the effect's name (click to choose another), the buses that can load it, what it does, a row
// per parameter (its value now, its range and what it does) and tips, all in the bus's colour. Escape or a press
// outside closes it.

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { fxHelp, helpRows, loadsOn } from "../core/fxHelp";
import type { Bus, FxDef, FxId } from "../core/fxTypes";
import { useDismiss } from "../ui/useDismiss";
import { EffectChooser } from "./EffectChooser";
import { HotContext, hotProps, type Hot } from "./hot";

interface HelpProps {
  bus: Bus;
  label: string; // the bus's name
  values: readonly number[];
  colour: string;
  side: ReactNode;
  onChoose: (id: FxId) => void;
}

function Params({ fx, values, hot }: { fx: FxDef; values: readonly number[]; hot: Hot }) {
  return (
    <dl className="fx-help-params">
      {helpRows(fx, values).map((r) => (
        <div key={r.key} {...hotProps(hot, [r.key], "")}>
          <dt>{r.label}<small>{r.range}</small><em>{r.value}</em></dt>
          <dd>{r.text}</dd>
        </div>
      ))}
    </dl>
  );
}

type PanelProps = HelpProps & { fx: FxDef; onClose: () => void };

function FxHelpPanel({ fx, bus, label, values, colour, side, onChoose, onClose }: PanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [lit, setLit] = useState<ReadonlySet<string>>(new Set());
  const hot: Hot = { active: true, hot: lit, hover: (keys) => setLit(new Set(keys)) };
  useDismiss(panel, onClose, !choosing);
  const help = fxHelp(fx.id);
  const host = document.querySelector<HTMLElement>(".ld") ?? document.body;
  return createPortal(
    <div className="fx-help" ref={panel} style={{ ["--acc" as string]: colour }}>
      <HotContext.Provider value={hot}>
        <div className="bus fx-help-side" style={{ ["--acc" as string]: colour }}>{side}</div>
      </HotContext.Provider>
      <div className="fx-help-panel" role="dialog" aria-label={`About ${fx.name}`}>
        <div className="fx-help-head">
          <button className="fx-help-name" aria-label={`Choose the effect for ${label}`} title="Choose another effect"
            onClick={() => setChoosing(true)}>
            {fx.name}<span aria-hidden>▾</span>
          </button>
          <span className="fx-help-loads">{loadsOn(fx)}</span>
          <button className="pill" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {help && <p className="fx-help-summary">{help.summary}</p>}
        <Params fx={fx} values={values} hot={hot} />
        {help && help.notes.length > 0 && (
          <ul className="fx-help-notes">{help.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        )}
        <p className="fx-help-credit">
          From Roland's SP-404MK2 Reference Manual, with tips drawing on NearTao's unofficial SP-404 mk2 Guide.
        </p>
      </div>
      {choosing && (
        <EffectChooser bus={bus} label={label} colour={colour} current={fx.id} onClose={() => setChoosing(false)}
          onPick={(id) => {
            onChoose(id);
            setChoosing(false);
          }} />
      )}
    </div>,
    host,
  );
}

// The (i) that opens the panel; `side` is the working copy shown beside it.
export function FxHelpButton({ fx, ...panel }: HelpProps & { fx: FxDef | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="info" disabled={!fx} aria-label={fx ? `About ${fx.name}` : "About this effect"}
        title={fx ? `About ${fx.name}` : undefined} onClick={() => setOpen(true)}>i</button>
      {open && fx && <FxHelpPanel fx={fx} {...panel} onClose={() => setOpen(false)} />}
    </>
  );
}
