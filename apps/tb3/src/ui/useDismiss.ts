// Copied from apps/jv2080/src/ui/useDismiss.ts (itself from apps/sp404/src/ui/useDismiss.ts).
// Close a panel on Escape or on a press outside it. `keep` (a selector) names panels opened from this one, such as a
// chooser: presses in them don't close it, and while one is open Escape is left to it.
import { useEffect, type RefObject } from "react";

const keepOpen = (keep: string | undefined, target: Element) => !!keep && !!target.closest?.(keep);
const childOpen = (keep: string | undefined) => !!keep && !!document.querySelector(keep);

export function useDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void, keep?: string) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !childOpen(keep)) onClose();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      const outside = ref.current && !ref.current.contains(target);
      if (outside && !keepOpen(keep, target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [ref, onClose, keep]);
}
