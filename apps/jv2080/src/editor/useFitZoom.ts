// Zooms the editor so its fixed-size layout (1920 px wide, as designed) always fits the window, with CSS `zoom` on
// its root; after apps/tb3/src/editor/useFitZoom.ts. The window's height in the layout's own px goes to `--fit-h`,
// for panels that size to the window (the help panel).
import { useEffect } from "react";
import { getZoom, setZoom } from "../ui/zoom";

const MIN_ZOOM = 0.4;

export function useFitZoom(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return;
    document.documentElement.classList.add("fit");
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // offsetWidth/Height are in the layout's own px, unaffected by its zoom.
        const next = Math.max(MIN_ZOOM, Math.min(innerWidth / el.offsetWidth, innerHeight / el.offsetHeight));
        el.style.setProperty("--fit-h", `${innerHeight / next}px`);
        if (Math.abs(next - getZoom()) < 0.002 && el.style.zoom) return;
        setZoom(next);
        el.style.zoom = String(next);
      });
    };
    const ro = new ResizeObserver(fit); // the layout's height can change (eg. a long read-failure message)
    ro.observe(el);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [el]);
}
