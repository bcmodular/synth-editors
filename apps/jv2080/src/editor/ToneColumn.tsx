// One tone's column: its wave as the title (opening the wave library), pitch, filter, amp envelope and LFOs (level,
// pan and sends are in the mixer). Envelopes are graphs; the other values are knobs.

import { useState, type ReactNode } from "react";
import { SIMPLE_ENVELOPES, type EnvelopeKind, type EnvelopeSpec } from "../core/envelope";
import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { AMP_HELP, FILTER_HELP, LFO_HELP, PITCH_HELP, type SectionHelp } from "../core/sectionHelp";
import type { WaveEntry } from "../core/waveCategories";
import { waveGroupBytes, waveGroupOf, waveName } from "../core/waves";
import { Section } from "../ui/controls";
import { EnvelopeGraph } from "../ui/EnvelopeGraph";
import { PickTitle } from "../ui/PickTitle";
import { HelpButton } from "./help/HelpPanel";
import { Lit } from "./help/Lit";
import { sectionContentHook } from "./help/sectionContent";
import { useSize } from "../ui/useSize";
import { TONE_COLOURS, tintVars } from "./colours";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamKnob } from "./ParamControls";
import { WaveLibrary } from "./WaveLibrary";
import { StructureButton } from "./Structure";
import { PartMore, PartMoreInline, WaveMore } from "./ToneMore";
import { PopoverButton } from "../ui/Popover";
import { WaveIcon } from "../ui/WaveIcon";

const ROW_ENV_HEIGHT = 112; // beside two rows of knobs
const AMP_ENV_HEIGHT = 64;

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
      <PickTitle hint="Choose a wave" onClick={() => setOpen(true)}>{name}</PickTitle>
      {open && (
        <WaveLibrary title={`TONE ${tone + 1} WAVE`} colour={TONE_COLOURS[tone]!} current={{ group, number }}
          onPick={pick} onClose={() => setOpen(false)} />
      )}
    </>
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
  const ids = [...spec.times.map((_, i) => `${prefix}Time${i + 1}`), ...spec.levels.map((_, i) => `${prefix}Level${i + 1}`)];
  return (
    <Lit ids={ids} fit="grow">
    <div className="envbox" ref={setBox}>
      {width > 0 && (
        <EnvelopeGraph spec={spec} width={width} height={height}
          onTime={(stage, v) => setValue(param(`${prefix}Time${stage + 1}`), v, tone)}
          onLevel={(stage, v) => setValue(param(`${prefix}Level${stage + 1}`), v, tone)}
          onReset={() => resetEnvelope(kind, (id, v) => setValue(param(id), v, tone))} />
      )}
    </div>
    </Lit>
  );
}

// One part of the column: a thin strip on the left with the part's name reading upwards (and its (i)), its controls
// beside it.
function Block({ label, help, more, children }: { label: string; help?: ReactNode; more?: ReactNode; children: ReactNode }) {
  return (
    <div className="block">
      <div className="vlabel">{help}<span>{label}</span>{more}</div>
      <div className="block-body">{children}</div>
    </div>
  );
}

// An LFO's waveform as icon buttons, and its rate as a knob.
function LfoLine({ tone, n }: ToneProps & { n: 1 | 2 }) {
  const { patch, setValue } = useEditor();
  const wave = param(`lfo${n}Wave`);
  const value = getParam(patch, wave, tone);
  return (
    <div className="lfo-line">
      <span className="lbl">LFO{n}</span>
      <Lit ids={[wave.id]}>
      <div className="seg wave-btns">
        {(wave.labels ?? []).map((shape, i) => (
          <button key={shape} className={`btn ${i === value ? "sel" : ""}`} title={shape} aria-label={shape}
            onClick={() => setValue(wave, i, tone)}>
            <WaveIcon shape={shape} />
          </button>
        ))}
      </div>
      </Lit>
      <ParamKnob def={`lfo${n}Rate`} tone={tone} label="RATE" />
    </div>
  );
}

// The column's parts, each with an (i) that opens its help beside a working copy of the part (`inHelp`).
type Part = "pitch" | "filter" | "amp" | "lfo";

interface PartProps extends ToneProps {
  inHelp?: boolean;
}

const PART_HELP: Readonly<Record<Part, SectionHelp>> = { pitch: PITCH_HELP, filter: FILTER_HELP, amp: AMP_HELP, lfo: LFO_HELP };
const PART_SIDE = { width: 460 };

function PartHelp({ tone, part, inHelp }: PartProps & { part: Part }) {
  if (inHelp) return null;
  const help = PART_HELP[part];
  const side = (
    <Section title={<WaveTitle tone={tone} />} className="tone" style={tintVars(TONE_COLOURS[tone]!)}>
      <PartBlock tone={tone} part={part} inHelp />
      <PartMoreInline tone={tone} part={part} />
    </Section>
  );
  return <HelpButton label={`tone ${tone + 1}: ${help.title}`} useContent={sectionContentHook(help, tone)} side={side} sideStyle={PART_SIDE} />;
}

// Three knobs over the two LFO depths, beside the part's envelope (pitch and filter).
function KnobsAndEnvelope({ tone, kind, knobs }: ToneProps & { kind: "pitch" | "filter"; knobs: readonly (readonly [string, string])[] }) {
  return (
    <div className="envrow">
      <div className="knobgrid">
        <div className="knobs">
          {knobs.map(([id, label]) => <ParamKnob key={id} def={id} tone={tone} label={label} />)}
        </div>
        <div className="knobs lfo">
          <ParamKnob def={`${kind}Lfo1`} tone={tone} label="LFO1" />
          <ParamKnob def={`${kind}Lfo2`} tone={tone} label="LFO2" />
          {kind === "filter" && <ParamKnob def="filterEnvVelSens" tone={tone} label="VEL" />}
        </div>
      </div>
      <Envelope tone={tone} kind={kind} height={ROW_ENV_HEIGHT} />
    </div>
  );
}

const PITCH_KNOBS = [["coarseTune", "COARSE"], ["fineTune", "FINE"], ["pitchEnvDepth", "ENV"]] as const;
const FILTER_KNOBS = [["cutoff", "CUTOFF"], ["resonance", "RESO"], ["filterEnvDepth", "ENV"]] as const;

function PitchBlock({ tone, inHelp }: PartProps) {
  return (
    <Block label="PITCH" help={<PartHelp tone={tone} part="pitch" inHelp={inHelp} />} more={inHelp ? undefined : <PartMore tone={tone} part="pitch" />}>
      <KnobsAndEnvelope tone={tone} kind="pitch" knobs={PITCH_KNOBS} />
    </Block>
  );
}

function FilterBlock({ tone, inHelp }: PartProps) {
  return (
    <Block label="FILTER" help={<PartHelp tone={tone} part="filter" inHelp={inHelp} />} more={inHelp ? undefined : <PartMore tone={tone} part="filter" />}>
      <ParamChoice def="filterType" tone={tone} label="Type" />
      <KnobsAndEnvelope tone={tone} kind="filter" knobs={FILTER_KNOBS} />
    </Block>
  );
}

function AmpBlock({ tone, inHelp }: PartProps) {
  return (
    <Block label="AMP" help={<PartHelp tone={tone} part="amp" inHelp={inHelp} />} more={inHelp ? undefined : <PartMore tone={tone} part="amp" />}>
      <div className="envrow">
        <div className="knobgrid">
          <div className="knobs">
            <ParamKnob def="ampLfo1" tone={tone} label="LFO1" />
            <ParamKnob def="ampLfo2" tone={tone} label="LFO2" />
            <ParamKnob def="ampEnvVelSens" tone={tone} label="VEL" />
          </div>
        </div>
        <Envelope tone={tone} kind="amp" height={AMP_ENV_HEIGHT} />
      </div>
    </Block>
  );
}

function LfoBlock({ tone, inHelp }: PartProps) {
  return (
    <Block label="LFO" help={<PartHelp tone={tone} part="lfo" inHelp={inHelp} />} more={inHelp ? undefined : <PartMore tone={tone} part="lfo" />}>
      <LfoLine tone={tone} n={1} />
      <LfoLine tone={tone} n={2} />
    </Block>
  );
}

const PART_BLOCKS: Readonly<Record<Part, (p: PartProps) => ReactNode>> = { pitch: PitchBlock, filter: FilterBlock, amp: AmpBlock, lfo: LfoBlock };

function PartBlock({ part, ...props }: PartProps & { part: Part }) {
  const PartView = PART_BLOCKS[part];
  return <PartView {...props} />;
}

// The wave's settings (gain, FXM), tone delay and MIDI receive switches, from the tone's header.
const waveMore = (tone: number) => (
  <PopoverButton label="⋯" title={`Tone ${tone + 1}: wave, tone delay and MIDI`} className="more-btn">
    <WaveMore tone={tone} />
  </PopoverButton>
);

export function ToneColumn({ tone }: ToneProps) {
  return (
    <Section title={<WaveTitle tone={tone} />} className="tone" style={tintVars(TONE_COLOURS[tone]!)}
      extra={<><StructureButton tone={tone} />{waveMore(tone)}</>}>
      <PitchBlock tone={tone} />
      <FilterBlock tone={tone} />
      <AmpBlock tone={tone} />
      <LfoBlock tone={tone} />
    </Section>
  );
}
