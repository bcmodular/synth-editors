// The (i) on the EFX section: a panel over the editor describing the current EFX type (core/efxHelp), with its
// signal flow and each parameter's current value. Hovering a parameter lights it up in the flow, and the other way
// round. A working copy of the EFX section (`side`) sits on its left, so the effect can be edited, or its type
// changed, while reading about it. Escape or a press outside closes it.

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EFX_GENERAL_NOTE, efxHelp, paramHelp, type EfxHelp } from "../../core/efxHelp";
import type { EfxParamDef } from "../../core/efx";
import { useDismiss } from "../../ui/useDismiss";
import { FlowDiagram } from "./FlowDiagram";
import { useEfx } from "./useEfx";

// A parameter's range as the panel shows it; a long list as its first and last entries.
const rangeOf = (p: EfxParamDef) => (p.labels && p.labels.length > 6 ? `${p.labels[0]}…${p.labels[p.labels.length - 1]}` : p.range);

interface PanelProps {
  help: EfxHelp;
  side: ReactNode;
  onClose: () => void;
}

function InfoPanel({ help, side, onClose }: PanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose, ".chooser");
  const { type, typeRaw, params, get } = useEfx();
  const [hot, setHot] = useState<ReadonlySet<string>>(new Set());
  const hover = (names: readonly string[]) => setHot(new Set(names));
  const host = document.querySelector<HTMLElement>(".editor") ?? document.body;
  return createPortal(
    <div className="info-overlay" ref={panel}>
    <div className="info-side">{side}</div>
    <div className="info-panel efx-info" role="dialog" aria-label={`About ${type?.name}`}>
      <div className="info-head">
        <span className="info-num">{typeRaw + 1}</span>
        <span className="info-title">{type?.name}</span>
        <button className="btn info-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <p className="info-summary">{help.summary}</p>
      <FlowDiagram flow={help.flow} get={get} hot={hot} onHover={hover} />
      <dl className="info-params">
        {params.map((x) => (
          <div key={x.p.slot} className={hot.has(x.p.name) ? "hot" : ""} onPointerEnter={() => hover([x.p.name])}
            onPointerLeave={() => hover([])}>
            <dt>{x.p.name}<small>{rangeOf(x.p)}</small><em>{x.text}</em></dt>
            <dd>{paramHelp(typeRaw, x.p.name)}</dd>
          </div>
        ))}
      </dl>
      <ul className="info-notes">{[...(help.notes ?? []), EFX_GENERAL_NOTE].map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
    </div>,
    host,
  );
}

export function EfxInfoButton({ side }: { side: ReactNode }) {
  const { typeRaw } = useEfx();
  const [open, setOpen] = useState(false);
  const help = efxHelp(typeRaw);
  if (!help) return null;
  return (
    <>
      <button className="btn info-btn" aria-label="About this effect" onClick={() => setOpen(true)}>i</button>
      {open && <InfoPanel help={help} side={side} onClose={() => setOpen(false)} />}
    </>
  );
}
