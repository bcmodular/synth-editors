// The patch's name in the top strip; click to edit it (12 characters, as the JV allows), Enter to set it, Escape to
// leave it as it was.

import { useState, type KeyboardEvent } from "react";
import { NAME_LENGTH, patchName, type Patch } from "../core/patch";

export function PatchName({ patch, onRename }: { patch: Patch | null; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!patch) return <span className="name">—</span>;
  const current = patchName(patch);
  if (draft === null) {
    return <button className="name name-btn" title="Rename the patch" onClick={() => setDraft(current)}>{current || "(no name)"}</button>;
  }
  const done = (keep: boolean) => {
    if (keep && draft !== current) onRename(draft);
    setDraft(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") done(true);
    if (e.key === "Escape") done(false);
  };
  return (
    <input className="name name-edit" autoFocus value={draft} maxLength={NAME_LENGTH} spellCheck={false}
      onChange={(e) => setDraft(e.target.value.replace(/[^\x20-\x7d]/g, ""))} onKeyDown={onKey} onBlur={() => done(true)} />
  );
}
