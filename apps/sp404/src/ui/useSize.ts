// An element's size in the layout's own px (offsetWidth/Height, unaffected by the fit zoom), kept up to date.
import { useEffect, useState } from "react";

export function useSize(el: HTMLElement | null): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!el) return;
    const measure = () => setSize((s) =>
      s.width === el.offsetWidth && s.height === el.offsetHeight ? s : { width: el.offsetWidth, height: el.offsetHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [el]);
  return size;
}
