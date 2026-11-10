// The FX modules' controls, as in the designs: knobs (plain or stepped), button rows, grids, drop-downs, the
// note-value matrix and large latching buttons. Each works on a raw value (0–127); discrete ones set the raw
// value where a step starts.

import { useValueDrag } from "../ui/useValueDrag";

export interface StepOption {
  label: string;
  raw: number; // the raw value where the step starts
}

export interface StepControlProps {
  label: string;
  options: readonly StepOption[];
  index: number; // the selected step
  onPick: (raw: number) => void;
}

// A knob, 0–127. `stepped` draws the ring that marks a stepped knob.
export function Knob(p: { label: string; value: number; text: string; stepped?: boolean; reset?: number;
  onChange: (raw: number) => void }) {
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value, max: 127, onChange: p.onChange, defaultValue: p.reset ?? 64, axis: "y", length: 160,
  });
  const angle = -135 + (p.value / 127) * 270;
  return (
    <div className={`kn ${p.stepped ? "st" : ""}`} ref={drag.ref} role="slider" aria-label={p.label}
      aria-valuemin={0} aria-valuemax={127} aria-valuenow={p.value} aria-valuetext={p.text}
      onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick}>
      <i style={{ ["--a" as string]: `${angle}deg` }} />
      <span className="lbl">{p.label}</span>
      <em>{p.text}</em>
    </div>
  );
}

export function SegRow({ label, options, index, onPick }: StepControlProps) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o, i) => (
        <button key={o.raw} className={i === index ? "on" : ""} aria-pressed={i === index} onClick={() => onPick(o.raw)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Grid({ columns, ...p }: StepControlProps & { columns: number }) {
  return (
    <div className="gsel" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }} role="group" aria-label={p.label}>
      {p.options.map((o, i) => (
        <button key={o.raw} className={i === p.index ? "on" : ""} aria-pressed={i === p.index} onClick={() => p.onPick(o.raw)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Drop({ label, options, index, onPick }: StepControlProps) {
  return (
    <select className="dd" aria-label={label} value={options[index]?.raw ?? ""}
      onChange={(e) => onPick(Number(e.target.value))}>
      {options.map((o) => <option key={o.raw} value={o.raw}>{o.label}</option>)}
    </select>
  );
}

// Note values in three rows (triplet, straight, dotted), one column per base value. Values the parameter doesn't
// have leave a gap.
const NOTE_BASES = {
  nv: ["1/32", "1/16", "1/8", "1/4", "1/2", "1/1"],
  nv8: ["2/1", "1/1", "1/2", "1/4", "1/8", "1/16", "1/32", "1/64"],
} as const;
const NOTE_ROWS = ["T", "", "D"] as const;

export function NoteMatrix({ wide, ...p }: StepControlProps & { wide: boolean }) {
  const bases = wide ? NOTE_BASES.nv8 : NOTE_BASES.nv;
  const at = new Map(p.options.map((o, i) => [o.label, i]));
  return (
    <div className="nv" style={{ gridTemplateColumns: `repeat(${bases.length}, 1fr)` }} role="group" aria-label={p.label}>
      {NOTE_ROWS.flatMap((suffix) => bases.map((base) => {
        const name = `${base}${suffix}`;
        const i = at.get(name);
        if (i === undefined) return <span key={name} className="x" />;
        return (
          <button key={name} className={`${i === p.index ? "on" : ""} ${suffix ? "sf" : ""}`} aria-pressed={i === p.index}
            onClick={() => p.onPick(p.options[i]!.raw)}>
            {name}
          </button>
        );
      }))}
    </div>
  );
}

// A large latching button for a two-step performance switch (LOOP, SCATTER, BACK…).
export function BigButton({ label, options, index, onPick }: StepControlProps) {
  const on = index === 1;
  const state = /OFF$/.test(options[0]?.label ?? "") ? (on ? "ON" : "OFF") : options[index]?.label;
  return (
    <button className={`big ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onPick(options[on ? 0 : 1]?.raw ?? 0)}>
      {label} · {state}
    </button>
  );
}
