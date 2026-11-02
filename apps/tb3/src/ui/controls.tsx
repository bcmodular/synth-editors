// Buttons, segmented control, type stepper and the section frame.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function Section(p: { title: ReactNode; extra?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`sec ${p.className ?? ""}`}>
      <header>
        <h2>{p.title}</h2>
        {p.extra && <div className="extra">{p.extra}</div>}
      </header>
      {p.children}
    </section>
  );
}

// Anchor + panel that closes on a press outside both.
export function Popover(p: { open: boolean; onClose: () => void; panel: ReactNode; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const onClose = useRef(p.onClose);
  onClose.current = p.onClose;
  useEffect(() => {
    if (!p.open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose.current();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [p.open]);
  return (
    <div className="anchor" ref={box}>
      {p.children}
      {p.open && <div className="popover">{p.panel}</div>}
    </div>
  );
}

export function LedButton(p: { label: ReactNode; on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button className={`btn ${p.on ? "on" : ""}`} disabled={p.disabled} onClick={p.onToggle}>
      <span className="l" />
      {p.label}
    </button>
  );
}

export interface SegOption {
  label: string;
  value: number;
}

export function Segmented(p: { options: SegOption[]; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="seg">
      {p.options.map((o) => (
        <button
          key={o.label}
          className={`btn ${o.value === p.value ? "sel" : ""}`}
          disabled={p.disabled}
          onClick={() => p.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface StepperGroup {
  name: string;
  items: number[]; // indexes into `items`
}

// Name display with ‹ ›; scroll or arrow keys step, clicking the name opens the grouped list.
// Without `width` the name stretches to fill the row.
export function Stepper(p: {
  items: readonly string[];
  groups?: StepperGroup[];
  index: number;
  onChange: (i: number) => void;
  width?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLButtonElement>(null);
  const opts = useRef(p);
  opts.current = p;
  const n = p.items.length;
  const step = (d: number) => p.onChange((p.index + d + n) % n);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    const el = name.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      const { disabled, index, items, onChange } = opts.current;
      if (disabled) return;
      e.preventDefault();
      // Mouse notches step once; trackpad deltas accumulate (~24 px per type).
      acc += Math.abs(e.deltaY) >= 40 ? Math.sign(e.deltaY) * 24 : e.deltaY;
      const steps = Math.trunc(acc / 24);
      if (!steps) return;
      acc -= steps * 24;
      const len = items.length;
      const next = (((index + steps) % len) + len) % len;
      opts.current = { ...opts.current, index: next };
      onChange(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const groups = p.groups ?? [{ name: "", items: p.items.map((_, i) => i) }];
  return (
    <div className="stepper" ref={box}>
      <button className="btn" disabled={p.disabled} onClick={() => step(-1)} aria-label="previous">
        ‹
      </button>
      <button
        ref={name}
        className="stepname"
        style={p.width ? { width: p.width } : undefined}
        disabled={p.disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") step(1);
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step(-1);
          else return;
          e.preventDefault();
        }}
      >
        {p.disabled ? "–" : (p.items[p.index] ?? `#${p.index}`).toUpperCase()}
      </button>
      <button className="btn" disabled={p.disabled} onClick={() => step(1)} aria-label="next">
        ›
      </button>
      {open && !p.disabled && (
        <div className="popover">
          {groups.map((g) => (
            <div key={g.name} className="pgroup">
              {g.name && <div className="gt">{g.name}</div>}
              {g.items.map((i) => (
                <button
                  key={i}
                  className={`btn ${i === p.index ? "sel" : ""}`}
                  onClick={() => {
                    p.onChange(i);
                    setOpen(false);
                  }}
                >
                  {p.items[i]}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
