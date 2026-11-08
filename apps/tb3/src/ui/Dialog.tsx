// In-app dialogs (Electron has no window.prompt) and a context menu. Both render inside the
// zoomed editor. The helpers that open them (useDialog, askName, confirmed, menuAt) are in
// dialogs.ts, so this file exports only components and Fast Refresh works on it.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DialogContext } from "./dialogs";
import type { Ask, DialogResult, DialogSpec, MenuState } from "./dialogs";

export function DialogHost(p: { children: ReactNode }) {
  const [open, setOpen] = useState<{ spec: DialogSpec; resolve: (r: DialogResult) => void } | null>(null);
  const ask = useCallback<Ask>((spec) => new Promise((resolve) => setOpen({ spec, resolve })), []);
  return (
    <DialogContext.Provider value={ask}>
      {p.children}
      {open && (
        <DialogBox
          spec={open.spec}
          onDone={(r) => {
            setOpen(null);
            open.resolve(r);
          }}
        />
      )}
    </DialogContext.Provider>
  );
}

function DialogBox(p: { spec: DialogSpec; onDone: (r: DialogResult) => void }) {
  const [value, setValue] = useState(p.spec.input ?? "");
  const [choice, setChoice] = useState(p.spec.choice?.value ?? "");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        p.onDone(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [p]);
  const done = (button: string) => p.onDone({ button, value: value.trim(), choice });
  return (
    <div className="dialog-back" onPointerDown={(e) => e.target === e.currentTarget && p.onDone(null)}>
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          done(p.spec.buttons[0]!);
        }}
      >
        <h3>{p.spec.title}</h3>
        {p.spec.message && <p>{p.spec.message}</p>}
        {p.spec.input !== undefined && (
          <input ref={input} value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
        )}
        {p.spec.choice && (
          <label className="choice">
            <span className="lbl">{p.spec.choice.label}</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              {p.spec.choice.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="row">
          {p.spec.buttons.map((b, i) => (
            <button
              key={b}
              type={i === 0 ? "submit" : "button"}
              className={`btn ${i === 0 ? "sel" : ""}`}
              onClick={i === 0 ? undefined : () => done(b)}
            >
              {b}
            </button>
          ))}
          <button type="button" className="btn" onClick={() => p.onDone(null)}>
            CANCEL
          </button>
        </div>
      </form>
    </div>
  );
}

export function ContextMenu(p: { menu: MenuState | null; onClose: () => void }) {
  useEffect(() => {
    if (!p.menu) return;
    const close = () => p.onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [p]);
  if (!p.menu) return null;
  return (
    <div className="ctxmenu" style={{ left: p.menu.x, top: p.menu.y }} onPointerDown={(e) => e.stopPropagation()}>
      {p.menu.items.map((it) => (
        <button
          key={it.label}
          className="ctxitem"
          disabled={it.disabled}
          onClick={() => {
            p.onClose();
            it.onClick();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
