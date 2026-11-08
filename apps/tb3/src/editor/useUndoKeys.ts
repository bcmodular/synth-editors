// ⌘Z undoes, ⇧⌘Z redoes, except in a text field: the search box and dialogs keep their own text
// undo. Handling the key here (and preventing its default) also keeps the app menu's Edit > Undo
// from acting on it.
import { useEffect, useRef } from "react";

const isTextField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const isUndoKey = (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "z";

export function useUndoKeys(h: { undo: () => void; redo: () => void }) {
  const latest = useRef(h);
  latest.current = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isUndoKey(e) || isTextField(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) latest.current.redo();
      else latest.current.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
