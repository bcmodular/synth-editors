// Drawings for the pitch and harmony effects, from the designs: the Resonator's pitch ladder, XY pads (Chromatic
// PS, Auto Pitch, Harmony) and the circle of notes for a scale (Hyper-Reso, Vocoder). Tuning parameters are also
// played from the keyboard overlay (Phase 5).

import { bipolar, clamp, Handle, signed, Svg, type Px } from "./draw";
import type { ViewProps } from "./types";
import { useViewContext, type ViewContext } from "./viewContext";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const rootName = (note: number) => `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;

// ---- Resonator

const CHORD_TONES: Record<string, number[]> = {
  Root: [0], Oct: [0, 12], UpDn: [-12, 0, 12], P5: [0, 7], m3: [0, 3], m5: [0, 3, 7], m7: [0, 3, 7, 10],
  m7oct: [0, 3, 7, 10, 12], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17], M3: [0, 4], M5: [0, 4, 7],
  M7: [0, 4, 7, 11], M7oct: [0, 4, 7, 11, 12], M9: [0, 4, 7, 11, 14], M11: [0, 4, 7, 11, 14, 17],
};

function ChordBar({ c, semis, y, root }: { c: ViewContext; semis: number; y: Px; root: number }) {
  const len = (c.size.width - 48) * (0.25 + 0.75 * (c.raw(2) / 127));
  const opacity = 0.35 + 0.65 * (c.raw(1) / 127);
  return (
    <g>
      <line x1={40} y1={y} x2={40 + len} y2={y} stroke="var(--acc)" strokeWidth={4} strokeLinecap="round" opacity={opacity} />
      {[1, 2, 3].map((k) => (
        <line key={k} x1={40 + len + k * 5} y1={y} x2={40 + len + k * 5 + 2} y2={y} stroke="var(--acc)" strokeWidth={4} opacity={opacity * (1 - k / 4)} />
      ))}
      <text className="gt" x={4} y={y + 3}>{rootName(clamp(root + semis, 0, 127))}</text>
    </g>
  );
}

// 2 · The chord tones on a pitch ladder: bar length = FEEDBACK, brightness = BRIGHT; drag up and down for ROOT.
export function ResonatorView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const root = c.raw(0);
  const chord = c.labels(3)[c.step(3)] ?? "Root";
  const [top, bottom] = [30, h - 8];
  const y = (s: number) => bottom - ((s + 13) / 31) * (bottom - top);
  return (
    <Svg size={c.size}>
      {Array.from({ length: 30 }, (_, i) => i - 12).map((s) => (
        <g key={s}>
          <line className={s % 12 === 0 ? "ax" : "gr"} x1={36} y1={y(s)} x2={w} y2={y(s)} />
          {s % 12 === 0 && <text className="gl" x={w - 3} y={y(s) - 2} textAnchor="end">{s > 0 ? "+" : ""}{s / 12} oct</text>}
        </g>
      ))}
      {(CHORD_TONES[chord] ?? [0]).map((s) => <ChordBar key={s} c={c} semis={s} y={y(s)} root={root} />)}
      <text className="big1" x={6} y={18}>{rootName(root)} · {chord}</text>
      <text className="gl" x={w - 6} y={16} textAnchor="end">root from the keyboard</text>
      <rect className="drag" x={0} y={top} width={w} height={bottom - top} fill="transparent" onPointerDown={c.drag({ y: { index: 0, scale: 0.25 } })} />
    </Svg>
  );
}

// ---- XY pads

interface Grid {
  top: Px;
  height: Px;
  xLabel: string;
  yLabel: string;
}

function XyGrid({ c, g }: { c: ViewContext; g: Grid }) {
  const w = c.size.width;
  return (
    <g>
      <rect className="dimf" x={0} y={g.top} width={w} height={g.height} fillOpacity={0.35} />
      {[1, 2, 3].map((i) => (
        <g key={i}>
          <line className={i === 2 ? "ax" : "gr"} x1={(w * i) / 4} y1={g.top} x2={(w * i) / 4} y2={g.top + g.height} />
          <line className={i === 2 ? "ax" : "gr"} x1={0} y1={g.top + (g.height * i) / 4} x2={w} y2={g.top + (g.height * i) / 4} />
        </g>
      ))}
      <text className="gl" x={w - 3} y={g.top + g.height - 3} textAnchor="end">{g.xLabel}</text>
      <text className="gl" x={3} y={g.top + 9}>{g.yLabel}</text>
    </g>
  );
}

// FORMANT sideways, PITCH up and down, on one handle (Auto Pitch, Harmony).
function PitchPad({ c, caption }: { c: ViewContext; caption: string }) {
  const g: Grid = { top: 20, height: c.size.height - 22, xLabel: "FORMANT →", yLabel: "PITCH ↑" };
  return (
    <Svg size={c.size}>
      <text className="gt" x={6} y={13}>{caption}</text>
      <XyGrid c={c} g={g} />
      <Handle size={c.size} x={(c.raw(1) / 127) * c.size.width} y={g.top + (1 - c.raw(0) / 127) * g.height}
        label={`${signed(bipolar(c.raw(1)))} / ${signed(bipolar(c.raw(0)))}`}
        onPointerDown={c.drag({ x: { index: 1 }, y: { index: 0, scale: 0.7 } })} />
    </Svg>
  );
}

// 43 · FORMANT × PITCH XY pad; KEY is a drop-down, AUTO PITCH a large button.
export function AutoPitchView(props: ViewProps) {
  const c = useViewContext(props);
  return <PitchPad c={c} caption={`KEY ${c.text(4)}`} />;
}

// 45 · As Auto Pitch, with the HARMONY interval as a button grid.
export function HarmonyView(props: ViewProps) {
  const c = useViewContext(props);
  return <PitchPad c={c} caption={`KEY ${c.text(4)} · ${c.text(5)}`} />;
}

// 30 · One dot per voice: pitch (−24 … +12 semitones) up and down, pan sideways.
export function ChromaticPsView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const [top, span] = [6, h - 12];
  const y = (s: number) => top + ((12 - s) / 36) * span;
  const voice = (pitch: number, pan: number, n: number) => (
    <Handle key={n} size={c.size} x={(c.raw(pan) / 127) * w} y={y(Number(c.text(pitch)) || 0)} label={`${n} · ${c.text(pitch)}`}
      onPointerDown={c.drag({ x: { index: pan }, y: { index: pitch } })} />
  );
  return (
    <Svg size={c.size}>
      <rect className="dimf" x={0} y={top} width={w} height={span} fillOpacity={0.35} />
      {Array.from({ length: 37 }, (_, i) => i - 24).map((s) => (
        <g key={s}>
          <line className={s % 12 === 0 ? "ax" : "gr"} x1={0} y1={y(s)} x2={w} y2={y(s)} />
          {s % 12 === 0 && <text className="gl" x={3} y={y(s) - 2}>{signed(s)}</text>}
        </g>
      ))}
      <line className="ax" x1={w / 2} y1={top} x2={w / 2} y2={top + span} />
      <text className="gl" x={w - 3} y={top + span - 3} textAnchor="end">PAN →</text>
      {voice(0, 3, 1)}
      {voice(1, 4, 2)}
    </Svg>
  );
}

// ---- the circle of notes (Hyper-Reso, Vocoder)

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// The scale step SCALE is on: 0–11 major keys C…B, 12–23 minor.
export function scaleNotes(step: number): { key: number; minor: boolean; notes: Set<number> } {
  const key = step % 12;
  const minor = step >= 12;
  return { key, minor, notes: new Set((minor ? MINOR : MAJOR).map((i) => (key + i) % 12)) };
}

// The pitch class NOTE picks: a scale degree (−17…+18, no 0), folded into one octave.
export function degreeNote(degree: number, key: number, minor: boolean): number {
  const d = degree > 0 ? degree - 1 : degree;
  const step = ((d % 7) + 7) % 7;
  return (key + (minor ? MINOR : MAJOR)[step]!) % 12;
}

interface CircleProps {
  c: ViewContext;
  scale: number; // the SCALE parameter
  degree?: number; // the NOTE parameter's degree, marked with a dot
  top: Px;
}

interface Geometry {
  cx: Px;
  cy: Px;
  r: Px;
}

const around = ({ cx, cy }: Geometry, n: number, rr: Px) => {
  const a = -Math.PI / 2 + (n / 12) * 2 * Math.PI;
  return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
};

interface NoteButtonProps {
  name: string;
  at: { x: Px; y: Px };
  lit: boolean;
  isKey: boolean;
  onPick: () => void;
}

function NoteButton({ name, at, lit, isKey, onPick }: NoteButtonProps) {
  return (
    <g className={lit ? "on" : ""} role="button" aria-label={`Key ${name}`} aria-pressed={isKey} onClick={onPick}>
      <circle className={`pad ${isKey ? "key" : ""}`} cx={at.x} cy={at.y} r={isKey ? 13 : 11} style={lit ? undefined : { fillOpacity: 0.6 }} />
      <text className="padt" x={at.x} y={at.y + 4} textAnchor="middle">{name}</text>
    </g>
  );
}

function MajMin({ g, minor, onPick }: { g: Geometry; minor: boolean; onPick: (minor: boolean) => void }) {
  return (
    <>
      {["MAJ", "MIN"].map((label, j) => (
        <g key={label} className={Number(minor) === j ? "on" : ""} role="button" aria-label={label} aria-pressed={Number(minor) === j}
          onClick={() => onPick(j === 1)}>
          <rect className="pad" x={g.cx - 35 + j * 36} y={g.cy - 9} width={34} height={18} rx={2} />
          <text className="padt" x={g.cx - 18 + j * 36} y={g.cy + 4} textAnchor="middle">{label}</text>
        </g>
      ))}
    </>
  );
}

function NoteCircle({ c, scale, degree, top }: CircleProps) {
  const height = c.size.height - top - 2;
  const s = scaleNotes(c.step(scale));
  const starts = c.starts(scale);
  const g: Geometry = { cx: c.size.width / 2, cy: top + height / 2, r: Math.min(height / 2 - 12, c.size.width / 2 - 14) };
  const pick = (key: number, minor: boolean) => c.set(scale, starts[key + (minor ? 12 : 0)] ?? 0);
  const mark = degree === undefined ? undefined : around(g, degreeNote(degree, s.key, s.minor), g.r - 22);
  return (
    <g>
      <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke="#202227" strokeWidth={18} />
      {NOTE_NAMES.map((name, n) => (
        <NoteButton key={name} name={name} at={around(g, n, g.r)} lit={s.notes.has(n)} isKey={n === s.key} onPick={() => pick(n, s.minor)} />
      ))}
      {mark && <circle cx={mark.x} cy={mark.y} r={4} fill="#fff" />}
      <MajMin g={g} minor={s.minor} onPick={(minor) => pick(s.key, minor)} />
    </g>
  );
}

// 31 · SCALE on the circle of notes (click a note for the key, MAJ/MIN in the middle); the dot is NOTE.
export function HyperResoView(props: ViewProps) {
  const c = useViewContext(props);
  return (
    <Svg size={c.size}>
      <text className="big1" x={6} y={16}>{c.text(3)} · NOTE {c.text(0)}</text>
      <NoteCircle c={c} scale={3} degree={Number(c.text(0))} top={22} />
    </Svg>
  );
}

// 44 · As Hyper-Reso, with CHORD as a button grid below.
export function VocoderView(props: ViewProps) {
  const c = useViewContext(props);
  return (
    <Svg size={c.size}>
      <text className="big1" x={6} y={16}>{c.text(3)} · {c.text(4)} · NOTE {c.text(0)}</text>
      <NoteCircle c={c} scale={3} degree={Number(c.text(0))} top={22} />
    </Svg>
  );
}
