// ⌘Z undoes, ⇧⌘Z redoes (on Windows Ctrl+Z, and Ctrl+Y or Ctrl+Shift+Z), except in a text field:
// the search box and dialogs keep their own text undo. Handling the key here (and preventing its
// default) also keeps the app menu's Edit > Undo from acting on it.
import { useEffect, useRef } from "react";

const isTextField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const isUndoKey = (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "z";
const isRedoY = (e: KeyboardEvent) => e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "y";

// Which history key this is, if any.
function historyKey(e: KeyboardEvent): "undo" | "redo" | null {
  if (isRedoY(e)) return "redo";
  if (!isUndoKey(e)) return null;
  return e.shiftKey ? "redo" : "undo";
}

export function useUndoKeys(h: { undo: () => void; redo: () => void }) {
  const latest = useRef(h);
  latest.current = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = historyKey(e);
      if (!key || isTextField(e.target)) return;
      e.preventDefault();
      latest.current[key]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
