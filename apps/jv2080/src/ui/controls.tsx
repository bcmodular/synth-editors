// Copied from apps/tb3/src/ui/controls.tsx: the section frame (here with an optional style), LED button and
// segmented control.
import type { CSSProperties, ReactNode } from "react";

export function Section(p: { title: ReactNode; extra?: ReactNode; className?: string; style?: CSSProperties;
  children: ReactNode }) {
  return (
    <section className={`sec ${p.className ?? ""}`} style={p.style}>
      <header>
        <h2>{p.title}</h2>
        {p.extra && <div className="extra">{p.extra}</div>}
      </header>
      {p.children}
    </section>
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

