// Zooms the whole editor so the fixed-size layout always fits the window. Uses Electron's page
// zoom (see electron/preload.cjs); in a plain browser it does nothing and the page scrolls.
import { useEffect } from "react";

const MIN_ZOOM = 0.4;

export function useFitZoom(el: HTMLElement | null) {
  useEffect(() => {
    const shell = window.tb3Shell;
    if (!shell || !el) return;
    document.documentElement.classList.add("fit");
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // CSS px are unaffected by zoom, so the layout's natural size is constant; the window's
        // device size is the CSS viewport times the current zoom.
        const z = shell.getZoom();
        const winW = window.innerWidth * z;
        const winH = window.innerHeight * z;
        const next = Math.max(MIN_ZOOM, Math.min(winW / el.offsetWidth, winH / el.offsetHeight));
        if (Math.abs(next - z) > 0.002) shell.setZoom(next);
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
