// Close a panel on Escape or on a press outside it (while `enabled`: off while a panel opened from it is up).
import { useEffect, type RefObject } from "react";

export function useDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [ref, onClose, enabled]);
}
