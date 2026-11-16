// KEYS in the mixer area (docs/sp404-design.md › Controllers › Keyboard): what the keyboard is attached to, a piano to
// play or set the tuning with, the effect's chord or scale pads, and the six parameters the Launchkey's encoders turn.
// The Launchkey's keys and pads do the same as these.

import { useState, type PointerEvent } from "react";
import { displayValue, effectById, paramMode, stepIndex, stepLabels } from "../core/fx";
import { BUSES, type Bus } from "../core/fxTypes";
import { BUS_ACCENT, BUS_LABEL } from "../fx/FxModule";
import type { BusFx } from "../core/midi";
import type { Fx } from "../fx/useFx";
import {
  degreeOf, degreeStep, isWhite, PARAM, RESONATOR_CHORDS, scalePad, scalePadLabel, scaleStep, VOCODER_CHORDS,
  type KeysFx, type KeysTarget,
} from "./keyboard";
import { busScale, targetFx } from "./keyRouter";
import type { Keyboard } from "./useKeyboard";

const sameTarget = (a: KeysTarget | undefined, b: KeysTarget | undefined) =>
  a?.kind === b?.kind && (a?.kind !== "bus" || a.bus === (b as { bus: Bus }).bus);

const WHAT: Record<KeysFx | "chromatic" | "soundGen" | "none", string> = {
  resonator: "Keys set ROOT; pads set CHORD.",
  hyperReso: "White keys set NOTE (middle C is degree 1); pads set SCALE.",
  vocoder: "Keys play the vocoder (MIDI channel 11); pads set CHORD and SCALE.",
  chromatic: "Keys play the selected pad chromatically, C2–C4 (MIDI channel 16).",
  soundGen: "Keys play over the full range (MIDI channel 16).",
  none: "Keys and pads do nothing for this effect; the Launchkey's encoders turn its six parameters.",
};

function Attach({ fx, kb }: { fx: Fx; kb: Keyboard }) {
  const choices: { t: KeysTarget | undefined; label: string; bus?: Bus }[] = [
    ...BUSES.map((bus) => ({ t: { kind: "bus", bus } as KeysTarget, label: BUS_LABEL[bus].replace(" · MASTER", ""), bus })),
    { t: { kind: "chromatic" }, label: "CHROMATIC" },
    { t: { kind: "soundGen" }, label: "SOUND GEN" },
    { t: undefined, label: "OFF" },
  ];
  return (
    <div className="seg keys-attach" role="group" aria-label="Keyboard on">
      {choices.map(({ t, label, bus }) => {
        const on = sameTarget(kb.target, t);
        return (
          <button key={label} className={`btn ${on ? "on" : ""}`} aria-pressed={on} onClick={() => kb.attach(t)}
            disabled={bus !== undefined && !fx.buses[bus].fxId}
            style={bus ? { ["--acc" as string]: BUS_ACCENT[bus] } : undefined}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

const LOW = 36; // C2
const OCTAVES = 3;

// The note the tuning is set to now, to light its key.
function tunedNote(fx: Fx, kind: KeysFx | undefined, bus: Bus | undefined): number | undefined {
  if (bus === undefined) return undefined;
  const v = fx.buses[bus].values[PARAM.root] ?? 0;
  if (kind === "resonator") return v;
  if (kind !== "hyperReso") return undefined;
  const p = effectById(fx.buses[bus].fxId)?.params[PARAM.note];
  const step = stepIndex(paramMode(p!).starts ?? [0], v);
  for (let n = 0; n < 128; n++) if (isWhite(n) && degreeStep(degreeOf(n)!) === step) return n;
  return undefined;
}

function Piano({ kb, lit, dimBlack }: { kb: Keyboard; lit: ReadonlySet<number>; dimBlack: boolean }) {
  const [base, setBase] = useState(LOW);
  const notes = Array.from({ length: OCTAVES * 12 + 1 }, (_, i) => base + i);
  const press = (n: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    kb.router.key(n, 100);
  };
  return (
    <div className="keys-piano-row">
      <button className="btn" aria-label="Octave down" disabled={base <= 0} onClick={() => setBase(base - 12)}>◀</button>
      <div className="keys-piano" role="group" aria-label="Piano">
        {notes.map((n) => (
          <button key={n} className={`${isWhite(n) ? "w" : "b"} ${lit.has(n) ? "on" : ""} ${!isWhite(n) && dimBlack ? "na" : ""}`}
            aria-label={`Key ${n}`} onPointerDown={press(n)} onPointerUp={() => kb.router.key(n, 0)}
            onLostPointerCapture={() => kb.router.key(n, 0)}>
            {n % 12 === 0 ? `C${n / 12 - 1}` : ""}
          </button>
        ))}
      </div>
      <button className="btn" aria-label="Octave up" disabled={base >= 84} onClick={() => setBase(base + 12)}>▶</button>
    </div>
  );
}

interface PadsProps {
  title: string;
  labels: string[];
  current: number | undefined;
  onPad: (pad: number) => void;
}

const Pads = ({ title, labels, current, onPad }: PadsProps) => (
  <div className="keys-pads" role="group" aria-label={title}>
    <span className="lbl">{title}</span>
    <div className="grid">
      {labels.map((label, i) => (
        <button key={i} className={`${current === i ? "on" : ""} ${label ? "" : "na"}`} disabled={!label}
          onClick={() => onPad(i)}>
          {label}
        </button>
      ))}
    </div>
  </div>
);

// The chord parameter's steps as pads, the bus's chord lit.
function chordPads(b: BusFx, chord: { index: number; count: number }, kb: Keyboard) {
  const p = effectById(b.fxId)!.params[chord.index]!;
  const labels = stepLabels(p).slice(0, chord.count);
  const current = stepIndex(paramMode(p).starts ?? [], b.values[chord.index] ?? 0);
  return <Pads title="CHORD" labels={labels} current={current} onPad={(i) => kb.router.pad(i)} />;
}

function scalePads(fx: Fx, bus: Bus, onPad: (pad: number) => void) {
  const s = busScale(fx, bus);
  const labels = Array.from({ length: 16 }, (_, i) => scalePadLabel(scalePad(i)));
  const lit = labels.findIndex((_, i) => {
    const p = scalePad(i);
    return typeof p === "number" ? p === s.root : p === (s.minor ? "minor" : "major");
  });
  return <Pads title={`SCALE · ${labels[lit]}${s.minor ? " MIN" : " MAJ"}`} labels={labels} current={lit}
    onPad={onPad} key={scaleStep(s)} />;
}

function EffectPads({ fx, kb, kind, bus }: { fx: Fx; kb: Keyboard; kind: KeysFx | undefined; bus: Bus | undefined }) {
  if (bus === undefined) return null;
  if (kind === "resonator") return chordPads(fx.buses[bus], { index: PARAM.resoChord, count: RESONATOR_CHORDS }, kb);
  if (kind === "hyperReso") return scalePads(fx, bus, (i) => kb.router.pad(i));
  if (kind !== "vocoder") return null;
  return (
    <>
      {chordPads(fx.buses[bus], { index: PARAM.vocoderChord, count: VOCODER_CHORDS }, kb)}
      {scalePads(fx, bus, (i) => kb.router.scale(i))}
    </>
  );
}

function Encoders({ fx, bus }: { fx: Fx; bus: Bus | undefined }) {
  const b = bus === undefined ? undefined : fx.buses[bus];
  const def = b && effectById(b.fxId);
  if (!b || !def) return null;
  return (
    <div className="keys-encoders" aria-label="Launchkey encoders">
      <span className="lbl">ENCODERS 1–6</span>
      {def.params.map((p, i) => (
        <span key={p.key} className="readout"><span className="lbl">{p.label}</span><em>{displayValue(p, b.values[i] ?? 0)}</em></span>
      ))}
    </div>
  );
}

// What the keys and pads do now, for the line under the target.
function whatTheyDo(fx: Fx, target: KeysTarget | undefined, kind: KeysFx | undefined): string {
  if (!target) return "Choose what the keyboard plays.";
  if (target.kind !== "bus") return WHAT[target.kind];
  if (kind) return WHAT[kind];
  const name = effectById(fx.buses[target.bus].fxId)?.name;
  return name ? `${name}: ${WHAT.none}` : WHAT.none;
}

// The keys to light: the notes sounding and the tuning's note.
function litKeys(fx: Fx, kb: Keyboard, kind: KeysFx | undefined, bus: Bus | undefined): Set<number> {
  const tuned = tunedNote(fx, kind, bus);
  return new Set(tuned === undefined ? kb.notes : [...kb.notes, tuned]);
}

const LaunchkeyPill = ({ name }: { name?: string }) => (
  <span className={`pill ${name ? "on" : ""}`} title={name ?? "No Launchkey connected"}>
    {name ? "LAUNCHKEY ●" : "LAUNCHKEY ○"}
  </span>
);

export function KeysView({ fx, kb }: { fx: Fx; kb: Keyboard }) {
  const bus = kb.target?.kind === "bus" ? kb.target.bus : undefined;
  const kind = targetFx(fx, kb.target);
  const accent = bus ? { ["--acc" as string]: BUS_ACCENT[bus] } : undefined;
  return (
    <div className="keys" aria-label="Keyboard" style={accent}>
      <div className="keys-head">
        <span className="lbl">KEYBOARD ON</span>
        <Attach fx={fx} kb={kb} />
        <LaunchkeyPill name={kb.launchkey} />
      </div>
      <p className="keys-what">{whatTheyDo(fx, kb.target, kind)}</p>
      <Piano kb={kb} lit={litKeys(fx, kb, kind, bus)} dimBlack={kind === "hyperReso"} />
      <div className="keys-lower">
        <EffectPads fx={fx} kb={kb} kind={kind} bus={bus} />
        <Encoders fx={fx} bus={bus} />
      </div>
    </div>
  );
}
