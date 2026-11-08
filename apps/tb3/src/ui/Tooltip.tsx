// Hover tooltips for every `title` attribute, after TIP_DELAY_MS instead of the OS's slow native
// delay. While an element is hovered its title moves to data-tip so the native tooltip stays
// away. The layer renders into <body>, outside the zoomed editor, so it uses client px directly.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const TIP_DELAY_MS = 1000;
const GAP = 14; // below and right of the pointer

export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cur: HTMLElement | null = null;
    let pos = { x: 0, y: 0 };

    const release = () => {
      if (cur) {
        // React may have set a new title meanwhile: only put ours back if there's none.
        if (cur.dataset.tip !== undefined && !cur.hasAttribute("title")) cur.setAttribute("title", cur.dataset.tip);
        delete cur.dataset.tip;
      }
      cur = null;
    };
    const hide = () => {
      clearTimeout(timer);
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[title], [data-tip]") ?? null;
      if (el === cur) return;
      hide();
      release();
      const text = el?.getAttribute("title");
      if (!el || !text) return;
      el.dataset.tip = text;
      el.removeAttribute("title");
      cur = el;
      timer = setTimeout(() => {
        const t = el.getAttribute("title") ?? el.dataset.tip;
        if (cur === el && t) setTip({ text: t, x: pos.x, y: pos.y });
      }, TIP_DELAY_MS);
    };
    const move = (e: PointerEvent) => {
      pos = { x: e.clientX, y: e.clientY };
    };
    const away = () => {
      hide();
      release();
    };
    window.addEventListener("pointerover", over, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", hide, true);
    window.addEventListener("keydown", hide, true);
    window.addEventListener("wheel", hide, true);
    window.addEventListener("blur", away);
    document.documentElement.addEventListener("pointerleave", away);
    return () => {
      away();
      window.removeEventListener("pointerover", over, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("keydown", hide, true);
      window.removeEventListener("wheel", hide, true);
      window.removeEventListener("blur", away);
      document.documentElement.removeEventListener("pointerleave", away);
    };
  }, []);

  if (!tip) return null;
  // Flip to the other side of the pointer near the window's right or bottom edge.
  const right = tip.x > innerWidth - 320;
  const bottom = tip.y > innerHeight - 80;
  return createPortal(
    <div
      className="tooltip"
      style={{
        left: right ? undefined : tip.x + GAP,
        right: right ? innerWidth - tip.x + 4 : undefined,
        top: bottom ? undefined : tip.y + GAP,
        bottom: bottom ? innerHeight - tip.y + 4 : undefined,
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
