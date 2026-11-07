// Zooms the editor so the fixed-size layout always fits the window, with CSS `zoom` on its root.
// (Electron's page zoom did the same, but changing it during a live window resize could leave
// Chromium's viewport out of step with the window: offset layout, mouse moves going missing.)
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
        if (Math.abs(next - getZoom()) < 0.002 && el.style.zoom) return;
        setZoom(next);
        el.style.zoom = String(next);
      });
    };
    const ro = new ResizeObserver(fit); // content height changes, e.g. EFX type with more slots
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
