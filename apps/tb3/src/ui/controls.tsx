// Buttons, segmented control, type stepper and the section frame.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

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
  useCloseOnOutside(p.open, box, p.onClose);
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

// Whether a popover would run off the bottom of the window below its anchor, with more room above.
function opensUp(anchor: DOMRect, height: number) {
  const below = innerHeight - anchor.bottom;
  return height > below && anchor.top > below;
}

// Whether an open popover should open upwards. Measured before paint, so it never shows in the
// wrong place first.
function useOpensUp(open: boolean, anchor: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>) {
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = panel.current;
    setUp(open && a !== null && el !== null && opensUp(a.getBoundingClientRect(), el.getBoundingClientRect().height));
  }, [open, anchor, panel]);
  return up;
}

// While `open`, a press outside `box` calls `close`.
function useCloseOnOutside(open: boolean, box: RefObject<HTMLElement | null>, close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) latest.current();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, box]);
}

const wrap = (i: number, len: number) => ((i % len) + len) % len;
const WHEEL_PX_PER_ITEM = 24;

// Scrolling over `el` steps through the items: mouse notches step once, trackpad deltas
// accumulate (~24 px per item).
function useWheelStep(el: RefObject<HTMLElement | null>, opts: RefObject<StepperProps>) {
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      const { disabled, index, items, onChange } = opts.current;
      if (disabled) return;
      e.preventDefault();
      acc += Math.abs(e.deltaY) >= 40 ? Math.sign(e.deltaY) * WHEEL_PX_PER_ITEM : e.deltaY;
      const steps = Math.trunc(acc / WHEEL_PX_PER_ITEM);
      if (!steps) return;
      acc -= steps * WHEEL_PX_PER_ITEM;
      const next = wrap(index + steps, items.length);
      opts.current = { ...opts.current, index: next }; // several wheel events can beat a re-render
      onChange(next);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [el, opts]);
}

const ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export interface StepperGroup {
  name: string;
  items: number[]; // indexes into `items`
}

interface StepperProps {
  items: readonly string[];
  groups?: StepperGroup[];
  index: number;
  onChange: (i: number) => void;
  width?: number;
  disabled?: boolean;
}

// The grouped list of every item.
function StepperList(p: StepperProps & { onPick: (i: number) => void }) {
  const groups = p.groups ?? [{ name: "", items: p.items.map((_, i) => i) }];
  return (
    <>
      {groups.map((g) => (
        <div key={g.name} className="pgroup">
          {g.name && <div className="gt">{g.name}</div>}
          {g.items.map((i) => (
            <button key={i} className={`btn ${i === p.index ? "sel" : ""}`} onClick={() => p.onPick(i)}>
              {p.items[i]}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}

// Name display with ‹ ›; scroll or arrow keys step, clicking the name opens the grouped list (above
// the name when there's no room below). Without `width` the name stretches to fill the row.
export function Stepper(p: StepperProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opts = useRef(p);
  opts.current = p;
  const up = useOpensUp(open, box, panel);
  useCloseOnOutside(open, box, () => setOpen(false));
  useWheelStep(name, opts);
  const step = (d: number) => p.onChange(wrap(p.index + d, p.items.length));
  const pick = (i: number) => {
    p.onChange(i);
    setOpen(false);
  };

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
          if (!(e.key in ARROW_STEPS)) return;
          step(ARROW_STEPS[e.key]!);
          e.preventDefault();
        }}
      >
        {p.disabled ? "–" : (p.items[p.index] ?? `#${p.index}`).toUpperCase()}
      </button>
      <button className="btn" disabled={p.disabled} onClick={() => step(1)} aria-label="next">
        ›
      </button>
      {open && !p.disabled && (
        <div ref={panel} className={`popover ${up ? "up" : ""}`}>
          <StepperList {...p} onPick={pick} />
        </div>
      )}
    </div>
  );
}
