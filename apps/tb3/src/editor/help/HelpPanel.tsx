// A help panel over the editor (after the JV-2080's editor/help/HelpPanel.tsx): a working copy of the section it
// explains on the left, and on the right a summary, a row for each parameter (or group, like an envelope) with its
// current value, range and what it does, and tips. Pointing at a row lights up its controls in the copy, and the
// other way round. Escape or a press outside closes it; presses in a popover opened from the copy don't.
import { useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "../../ui/useDismiss";
import type { VoiceSection } from "../../core/help";
import { HotContext, useHot } from "./hot";
import { VoiceDiagram } from "./VoiceDiagram";

export interface HelpRowView {
  label: string;
  ids: readonly string[];
  text: string;
  value?: string;
  range?: string;
}

export interface HelpContent {
  title: string;
  summary: string;
  rows: readonly HelpRowView[];
  notes: readonly string[];
  voice?: VoiceSection; // the section's place in the voice's flow, highlighted there
}

interface PanelProps {
  useContent: () => HelpContent; // a hook, so the panel follows the patch live
  side: ReactNode;
  sideWidth: number;
  tint: string;
  onClose: () => void;
}

function Rows({ rows, hot, hover }: { rows: readonly HelpRowView[]; hot: ReadonlySet<string>; hover: (ids: readonly string[]) => void }) {
  return (
    <dl className="info-params">
      {rows.map((r) => (
        <div key={r.label} className={r.ids.some((id) => hot.has(id)) ? "hot" : ""} onPointerEnter={() => hover(r.ids)}
          onPointerLeave={() => hover([])}>
          <dt>
            {r.label}
            <small>{r.range}</small>
            <em>{r.value}</em>
          </dt>
          <dd>{r.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function HelpPanel({ useContent, side, sideWidth, tint, onClose }: PanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose, ".popover");
  const content = useContent();
  const [hot, setHot] = useState<ReadonlySet<string>>(new Set());
  const hover = (ids: readonly string[]) => setHot(new Set(ids));
  const host = document.querySelector<HTMLElement>(".editor") ?? document.body;
  return createPortal(
    <div className="info-overlay" ref={panel} style={{ ["--tint" as string]: tint }}>
      <HotContext.Provider value={{ active: true, hot, hover }}>
        <div className="info-side" style={{ width: sideWidth }}>
          {side}
        </div>
      </HotContext.Provider>
      <div className="info-panel" role="dialog" aria-label={`About ${content.title}`}>
        <div className="info-head">
          <p className="info-summary">{content.summary}</p>
          <button className="btn info-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <VoiceDiagram here={content.voice} hot={hot} hover={hover} />
        <Rows rows={content.rows} hot={hot} hover={hover} />
        {content.notes.length > 0 && (
          <ul className="info-notes">
            {content.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    host,
  );
}

// The (i) that opens a help panel, in the colour of the section it sits in. Not shown in a help panel's own copy.
export function HelpButton({ label, ...panel }: Omit<PanelProps, "onClose" | "tint"> & { label: string }) {
  const [tint, setTint] = useState<string | null>(null);
  const inHelp = useHot().active;
  if (inHelp) return null;
  const open = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setTint(getComputedStyle(e.currentTarget).getPropertyValue("--tint").trim() || "#a8b8ff");
  };
  return (
    <>
      <button className="btn info-btn" aria-label={`About ${label}`} title={`About ${label}`} onClick={open}>
        i
      </button>
      {tint !== null && <HelpPanel {...panel} tint={tint} onClose={() => setTint(null)} />}
    </>
  );
}
