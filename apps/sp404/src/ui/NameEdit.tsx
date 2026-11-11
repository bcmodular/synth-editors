// A name that turns into a text field when clicked: Enter or clicking away keeps the new name, Escape drops it.
// Only printable ASCII is kept, as the SP-404 stores it.

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { cleanName, type NameField } from "../core/serialNames";

export interface NameEditProps {
  value: string;
  field: NameField; // how long a name the SP-404 keeps
  label: string; // what it names, for the accessible labels ("A1 sample name")
  className?: string;
  onRename: (name: string) => void;
}

export function NameEdit({ value, field, label, className = "", onRename }: NameEditProps) {
  const [draft, setDraft] = useState<string>();
  if (draft === undefined) {
    return (
      <button className={`nameedit ${className}`} title={`${value} (click to rename)`} aria-label={`Rename ${label}`}
        onClick={() => setDraft(value)}>
        {value}
      </button>
    );
  }
  const keep = () => {
    const name = cleanName(draft, field);
    setDraft(undefined);
    if (name && name !== value) onRename(name);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") keep();
    if (e.key === "Escape") setDraft(undefined);
  };
  return (
    <input className={`nameedit editing ${className}`} aria-label={label} value={draft} maxLength={field.length} autoFocus
      spellCheck={false} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} onBlur={keep}
      onFocus={(e) => e.target.select()} />
  );
}
