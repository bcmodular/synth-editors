// A small panel opened from a button, next to it: for the less-used controls of a part (a tone's "more" settings,
// the structure of a tone pair, the key and velocity ranges). It takes the colour of where its button sits, stays
// inside the window, and closes on Escape or a press outside. It lives inside the editor, so it zooms with it
// (editor/useFitZoom.ts): screen positions are divided by the zoom to place it in the editor's own px.

import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "./useDismiss";
import { getZoom } from "./zoom";

interface Anchor {
  left: number;
  top: number;
  tint: string;
}

const GAP = 6;
const EDGE = 12;

function Panel({ anchor, title, onClose, children }: { anchor: Anchor; title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose, ".wavelib, .chooser");
  const [shift, setShift] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const r = panel.current?.getBoundingClientRect();
    if (!r) return;
    const zoom = getZoom();
    setShift({ x: Math.min(0, innerWidth - EDGE - r.right) / zoom, y: Math.min(0, innerHeight - EDGE - r.bottom) / zoom });
  }, []);
  const style = { left: anchor.left + shift.x, top: anchor.top + shift.y, ["--tint" as string]: anchor.tint, ["--led" as string]: anchor.tint } as CSSProperties;
  return createPortal(
    <div className="popover" ref={panel} style={style} role="dialog" aria-label={title}>
      <div className="pop-title">{title}</div>
      {children}
    </div>,
    document.querySelector(".editor") ?? document.body,
  );
}

// The button that opens a popover: `children` is its content, `label` the button's text.
export function PopoverButton({ label, title, className, children }: {
  label: ReactNode; title: string; className?: string; children: ReactNode;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const tint = getComputedStyle(e.currentTarget).getPropertyValue("--tint").trim() || "#a8b8ff";
    const zoom = getZoom();
    setAnchor({ left: r.right / zoom + GAP, top: r.top / zoom, tint });
  };
  return (
    <>
      <button className={`btn pop-btn ${className ?? ""}`} title={title} aria-label={title} onClick={open}>{label}</button>
      {anchor && <Panel anchor={anchor} title={title} onClose={() => setAnchor(null)}>{children}</Panel>}
    </>
  );
}
