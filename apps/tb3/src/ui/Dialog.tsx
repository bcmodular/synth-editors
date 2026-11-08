// In-app dialogs (Electron has no window.prompt) and a context menu. Both render inside the
// zoomed editor, so pointer coordinates are divided by the fit zoom.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getZoom } from "./zoom";

export interface DialogSpec {
  title: string;
  message?: string;
  input?: string; // initial text: shows a text field
  choice?: { label: string; options: { value: string; label: string }[]; value: string }; // shows a menu
  buttons: string[]; // first is the default (Enter); Esc cancels
}

export type DialogResult = { button: string; value: string; choice: string } | null;
type Ask = (d: DialogSpec) => Promise<DialogResult>;

const DialogContext = createContext<Ask | null>(null);

export function useDialog(): Ask {
  const ask = useContext(DialogContext);
  if (!ask) throw new Error("useDialog outside DialogHost");
  return ask;
}

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

// Ask for a name; null when cancelled or left empty.
export async function askName(ask: Ask, title: string, initial = ""): Promise<string | null> {
  const r = await ask({ title, input: initial, buttons: ["OK"] });
  return r?.value ? r.value : null;
}

export async function confirmed(ask: Ask, title: string, message: string, button = "REPLACE"): Promise<boolean> {
  return (await ask({ title, message, buttons: [button] }))?.button === button;
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

// Opens at a contextmenu event's position.
export const menuAt = (e: { clientX: number; clientY: number }, items: MenuItem[]): MenuState => ({
  x: e.clientX / getZoom(),
  y: e.clientY / getZoom(),
  items,
});

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
