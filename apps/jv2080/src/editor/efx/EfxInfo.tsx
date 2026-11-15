// The (i) on the EFX section: a panel over the editor describing the current EFX type (core/efxHelp.ts), with its
// signal flow and each parameter's current value. Hovering a parameter lights it up in the flow, and the other way
// round. Escape or a press outside closes it.

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { efxHelp, type EfxHelp } from "../../core/efxHelp";
import { useDismiss } from "../../ui/useDismiss";
import { FlowDiagram } from "./FlowDiagram";
import { useEfx } from "./useEfx";

function InfoPanel({ help, onClose }: { help: EfxHelp; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose);
  const { type, typeRaw, params, get } = useEfx();
  const [hot, setHot] = useState<ReadonlySet<string>>(new Set());
  const hover = (names: readonly string[]) => setHot(new Set(names));
  const host = document.querySelector<HTMLElement>(".editor") ?? document.body;
  return createPortal(
    <div className="info-panel efx-info" ref={panel} role="dialog" aria-label={`About ${type?.name}`}>
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
            <dt>{x.p.name}<em>{x.text}</em></dt>
            <dd>{help.params[x.p.name]}</dd>
          </div>
        ))}
      </dl>
      {help.notes && <ul className="info-notes">{help.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </div>,
    host,
  );
}

// Shown only for types that have help so far.
export function EfxInfoButton() {
  const { typeRaw } = useEfx();
  const [open, setOpen] = useState(false);
  const help = efxHelp(typeRaw);
  if (!help) return null;
  return (
    <>
      <button className="btn info-btn" aria-label="About this effect" onClick={() => setOpen(true)}>i</button>
      {open && <InfoPanel help={help} onClose={() => setOpen(false)} />}
    </>
  );
}
