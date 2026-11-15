// A help panel over the editor: a working copy of the section it explains on the left (`side`), and on the right a
// summary, the section's signal flow, a row for each parameter (or group of parameters, like an envelope) with its
// current value and a line on what it does, and notes. Pointing at a row, a part of the flow or a control in the copy
// lights up the others for the same parameters (help/hot.ts). Escape or a press outside closes it; presses in a
// chooser opened from the copy don't.

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Flow, FlowGet } from "../../core/efxHelp";
import { useDismiss } from "../../ui/useDismiss";
import { FlowDiagram } from "./FlowDiagram";
import { HotContext } from "./hot";

export interface HelpRow {
  label: string;
  ids: readonly string[]; // the parameters it stands for (lit together)
  text: string;
  value?: string;
  range?: string;
}

export interface HelpContent {
  title: string; // for screen readers; the copy beside the panel shows the section's own title
  summary: string;
  rows: readonly HelpRow[];
  notes: readonly string[];
  flow?: Flow;
  get: FlowGet;
}

interface PanelProps {
  useContent: () => HelpContent; // a hook, so the panel follows the patch live
  side: ReactNode;
  sideStyle?: CSSProperties;
  onClose: () => void;
}

function Rows({ rows, hot, hover }: { rows: readonly HelpRow[]; hot: ReadonlySet<string>; hover: (ids: readonly string[]) => void }) {
  return (
    <dl className="info-params">
      {rows.map((r) => (
        <div key={r.label} className={r.ids.some((id) => hot.has(id)) ? "hot" : ""} onPointerEnter={() => hover(r.ids)}
          onPointerLeave={() => hover([])}>
          <dt>{r.label}<small>{r.range}</small><em>{r.value}</em></dt>
          <dd>{r.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function HelpPanel({ useContent, side, sideStyle, onClose }: PanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose, ".chooser, .wavelib");
  const content = useContent();
  const [hot, setHot] = useState<ReadonlySet<string>>(new Set());
  const hover = (names: readonly string[]) => setHot(new Set(names));
  const host = document.querySelector<HTMLElement>(".editor") ?? document.body;
  return createPortal(
    <div className="info-overlay" ref={panel}>
      <HotContext.Provider value={{ active: true, hot, hover }}>
        <div className="info-side" style={sideStyle}>{side}</div>
      </HotContext.Provider>
      <div className="info-panel" role="dialog" aria-label={`About ${content.title}`}>
        <div className="info-head">
          <p className="info-summary">{content.summary}</p>
          <button className="btn info-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {content.flow && <FlowDiagram flow={content.flow} get={content.get} hot={hot} onHover={hover} />}
        <Rows rows={content.rows} hot={hot} hover={hover} />
        <ul className="info-notes">{content.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
    </div>,
    host,
  );
}

// The (i) that opens a help panel.
export function HelpButton({ label, ...panel }: Omit<PanelProps, "onClose"> & { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn info-btn" aria-label={`About ${label}`} title={`About ${label}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}>i</button>
      {open && <HelpPanel {...panel} onClose={() => setOpen(false)} />}
    </>
  );
}
