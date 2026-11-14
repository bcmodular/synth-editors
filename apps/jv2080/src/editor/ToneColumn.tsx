// One tone's column: its wave as the title (opening the wave library), pitch, filter, amp envelope and LFOs (level,
// pan and sends are in the mixer). Envelopes are graphs; the other values are knobs.

import { useState } from "react";
import { SIMPLE_ENVELOPES, type EnvelopeKind, type EnvelopeSpec } from "../core/envelope";
import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import type { WaveEntry } from "../core/waveCategories";
import { waveGroupBytes, waveGroupOf, waveName } from "../core/waves";
import { Section } from "../ui/controls";
import { EnvelopeGraph } from "../ui/EnvelopeGraph";
import { useSize } from "../ui/useSize";
import { TONE_COLOURS, tintVars } from "./colours";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamFader, ParamKnob, ParamSelect } from "./ParamControls";
import { WaveLibrary } from "./WaveLibrary";

const ROW_ENV_HEIGHT = 112; // beside the three knobs
const AMP_ENV_HEIGHT = 80;

interface ToneProps {
  tone: number; // 0–3
}

// The tone's wave as its section title: the name, and an icon that opens the wave library.
function WaveTitle({ tone }: ToneProps) {
  const { patch, setValue } = useEditor();
  const [open, setOpen] = useState(false);
  const raw = (id: string) => getParam(patch, param(id), tone);
  const group = waveGroupOf(raw("waveGroupType"), raw("waveGroupId"));
  const number = raw("waveNumber");
  const name = group ? waveName(group, number) : `group ${raw("waveGroupType")}/${raw("waveGroupId")} ${number + 1}`;
  const pick = (w: WaveEntry) => {
    const [type, id] = waveGroupBytes(w.group);
    setValue(param("waveGroupType"), type, tone);
    setValue(param("waveGroupId"), id, tone);
    setValue(param("waveNumber"), w.number, tone);
  };
  return (
    <>
      <button className="wave-title" title="Choose a wave" onClick={() => setOpen(true)}>
        <span>{name}</span>
        <LibraryIcon />
      </button>
      {open && (
        <WaveLibrary title={`TONE ${tone + 1} WAVE`} colour={TONE_COLOURS[tone]!} current={{ group, number }}
          onPick={pick} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// Four little squares: "pick from a grid".
function LibraryIcon() {
  return (
    <svg className="lib-icon" width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      {[0, 8].flatMap((x) => [0, 8].map((y) => <rect key={`${x}${y}`} x={x} y={y} width={6} height={6} rx={1} />))}
    </svg>
  );
}

// Sets an envelope's times and levels to its simple shape.
function resetEnvelope(kind: EnvelopeKind, set: (id: string, value: number) => void) {
  const { times, levels } = SIMPLE_ENVELOPES[kind];
  times.forEach((v, i) => set(`${kind}EnvTime${i + 1}`, v));
  levels.forEach((v, i) => set(`${kind}EnvLevel${i + 1}`, v));
}

// An envelope as a graph filling the width it's given (ui/EnvelopeGraph.tsx).
function Envelope({ tone, kind, height }: ToneProps & { kind: EnvelopeKind; height: number }) {
  const { patch, setValue } = useEditor();
  const prefix = `${kind}Env`;
  const bipolar = kind === "pitch";
  const levels = SIMPLE_ENVELOPES[kind].levels.length;
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const { width } = useSize(box);
  const raw = (id: string) => getParam(patch, param(id), tone);
  const spec: EnvelopeSpec = {
    times: [1, 2, 3, 4].map((i) => raw(`${prefix}Time${i}`)),
    levels: Array.from({ length: levels }, (_, i) => raw(`${prefix}Level${i + 1}`)),
    levelMax: bipolar ? 126 : 127,
    center: bipolar ? 63 : undefined,
  };
  return (
    <div className="envbox" ref={setBox}>
      {width > 0 && (
        <EnvelopeGraph spec={spec} width={width} height={height}
          onTime={(stage, v) => setValue(param(`${prefix}Time${stage + 1}`), v, tone)}
          onLevel={(stage, v) => setValue(param(`${prefix}Level${stage + 1}`), v, tone)}
          onReset={() => resetEnvelope(kind, (id, v) => setValue(param(id), v, tone))} />
      )}
    </div>
  );
}

function Lfo({ tone, n }: ToneProps & { n: 1 | 2 }) {
  return (
    <>
      <div className="row tight lfo-head">
        <ParamSelect def={`lfo${n}Wave`} tone={tone} label={`LFO${n}`} />
        <ParamFader def={`lfo${n}Rate`} tone={tone} label="Rate" />
      </div>
      <ParamFader def={`pitchLfo${n}`} tone={tone} label="→ Pitch" />
      <ParamFader def={`filterLfo${n}`} tone={tone} label="→ Filter" />
      <ParamFader def={`ampLfo${n}`} tone={tone} label="→ Amp" />
    </>
  );
}

export function ToneColumn({ tone }: ToneProps) {
  return (
    <Section title={<WaveTitle tone={tone} />} className="tone" style={tintVars(TONE_COLOURS[tone]!)}>
      <h3>PITCH</h3>
      <div className="envrow">
        <div className="knobstack">
          <ParamKnob def="coarseTune" tone={tone} label="COARSE" />
          <ParamKnob def="fineTune" tone={tone} label="FINE" />
          <ParamKnob def="pitchEnvDepth" tone={tone} label="ENV DEPTH" />
        </div>
        <Envelope tone={tone} kind="pitch" height={ROW_ENV_HEIGHT} />
      </div>
      <h3>FILTER</h3>
      <ParamChoice def="filterType" tone={tone} label="Type" />
      <div className="envrow">
        <div className="knobstack">
          <ParamKnob def="cutoff" tone={tone} label="CUTOFF" />
          <ParamKnob def="resonance" tone={tone} label="RESO" />
          <ParamKnob def="filterEnvDepth" tone={tone} label="ENV DEPTH" />
        </div>
        <Envelope tone={tone} kind="filter" height={ROW_ENV_HEIGHT} />
      </div>
      <h3>AMP</h3>
      <Envelope tone={tone} kind="amp" height={AMP_ENV_HEIGHT} />
      <h3>LFO</h3>
      <Lfo tone={tone} n={1} />
      <Lfo tone={tone} n={2} />
    </Section>
  );
}
