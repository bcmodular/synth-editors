// Each tone part's less-used settings, in a popover from the "⋯" in its label strip (and the wave's from the tone's
// header): velocity and keyfollow, bias and pan extras, the LFOs' delay, fade and sync, the wave's gain and FXM, tone
// delay and which MIDI messages the tone obeys.

import type { ReactNode } from "react";
import { PopoverButton } from "../ui/Popover";
import { ParamChoice, ParamKnob, ParamSelect, ParamSwitch } from "./ParamControls";

interface ToneProps {
  tone: number;
}

// A group of controls with a heading and a line on what they do.
function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="pop-group">
      <div className="pop-head">{title}</div>
      <div className="pop-knobs">{children}</div>
      {note && <p className="pop-note">{note}</p>}
    </div>
  );
}

const knobs = (tone: number, list: readonly (readonly [string, string])[]) =>
  list.map(([id, label]) => <ParamKnob key={id} def={id} tone={tone} label={label} />);

// An envelope's velocity and keyfollow controls (the curve only for the filter and amp).
function EnvelopeVelocity({ tone, prefix, curve }: ToneProps & { prefix: string; curve: boolean }) {
  const list: [string, string][] = [
    ...(curve ? [[`${prefix}VelCurve`, "CURVE"] as [string, string]] : []),
    [`${prefix}VelSens`, "VEL SENS"], [`${prefix}VelTime1`, "VEL T1"], [`${prefix}VelTime4`, "VEL T4"], [`${prefix}TimeKeyfollow`, "TIME KF"],
  ];
  return (
    <Group title="ENVELOPE BY VELOCITY AND KEY"
      note="Vel Sens: harder playing deepens the envelope. Vel T1 / T4: harder playing (or a faster release) shortens the attack (or the release). Time KF: higher keys shorten the times.">
      {knobs(tone, list)}
    </Group>
  );
}

function PitchMore({ tone }: ToneProps) {
  return (
    <>
      <Group title="PITCH" note="Random: a random detune on each note, in cents. Keyfollow: how far the pitch moves per octave; 0 plays the same pitch on every key.">
        {knobs(tone, [["randomPitch", "RANDOM"], ["pitchKeyfollow", "KEYFOLLOW"]])}
      </Group>
      <EnvelopeVelocity tone={tone} prefix="pitchEnv" curve={false} />
    </>
  );
}

function FilterMore({ tone }: ToneProps) {
  return (
    <>
      <Group title="FILTER" note="Keyfollow: the cutoff opens further up the keyboard. Reso Vel: harder playing adds resonance.">
        {knobs(tone, [["cutoffKeyfollow", "KEYFOLLOW"], ["resonanceVelSens", "RESO VEL"]])}
      </Group>
      <EnvelopeVelocity tone={tone} prefix="filterEnv" curve />
    </>
  );
}

function AmpMore({ tone }: ToneProps) {
  return (
    <>
      <EnvelopeVelocity tone={tone} prefix="ampEnv" curve />
      <Group title="BIAS" note="Changes the level across the keyboard, above or below the Position key, as acoustic instruments do.">
        <ParamChoice def="biasDirection" tone={tone} label="Direction" />
        {knobs(tone, [["biasPosition", "POSITION"], ["biasLevel", "LEVEL"]])}
      </Group>
      <Group title="PAN" note="LFO depths move the pan (auto-pan); Keyfollow pans higher notes further right; Random and Alternate move each new note.">
        {knobs(tone, [["panLfo1", "LFO1"], ["panLfo2", "LFO2"], ["panKeyfollow", "KEYFOLLOW"], ["randomPan", "RANDOM"], ["alternatePan", "ALTERNATE"]])}
      </Group>
    </>
  );
}

function LfoRow({ tone, n }: ToneProps & { n: 1 | 2 }) {
  return (
    <Group title={`LFO${n}`}>
      <ParamSwitch def={`lfo${n}KeyTrigger`} tone={tone} label="KEY TRIG" />
      <ParamChoice def={`lfo${n}Offset`} tone={tone} label="Offset" />
      <ParamSelect def={`lfo${n}FadeMode`} tone={tone} label="Fade" />
      {knobs(tone, [[`lfo${n}Delay`, "DELAY"], [`lfo${n}FadeTime`, "FADE TIME"]])}
      <ParamChoice def={`lfo${n}Sync`} tone={tone} label="Sync" />
    </Group>
  );
}

function LfoMore({ tone }: ToneProps) {
  return (
    <>
      <LfoRow tone={tone} n={1} />
      <LfoRow tone={tone} n={2} />
      <p className="pop-note">
        Key Trig restarts the LFO on each note. Delay and Fade bring it in (or take it out) gradually, from the note
        or its release: ON-IN fades in after the key goes down. Offset moves its swing up or down. Sync CLOCK locks the
        rate to the tempo.
      </p>
    </>
  );
}

export function WaveMore({ tone }: ToneProps) {
  return (
    <>
      <Group title="WAVE" note="Gain: the wave's level into the tone (+12 dB drives a booster harder). FXM: a harsher, metallic edge from frequency cross-modulation.">
        <ParamChoice def="waveGain" tone={tone} label="Gain" />
        <ParamSwitch def="fxmSwitch" tone={tone} label="FXM" />
        {knobs(tone, [["fxmColor", "COLOR"], ["fxmDepth", "DEPTH"]])}
      </Group>
      <Group title="TONE DELAY" note="Delays when the tone starts: NORMAL after Time; HOLD only while the key is held; PLAYMATE by your playing; CLOCK-SYNC by the tempo; KEY-OFF on release.">
        <ParamSelect def="toneDelayMode" tone={tone} label="Mode" />
        {knobs(tone, [["toneDelayTime", "TIME"]])}
      </Group>
      <Group title="RECEIVES" note="Which MIDI messages this tone obeys. Pan CONTINUOUS follows pan changes at once; KEY-ON only from the next note.">
        <ParamSwitch def="rxVolume" tone={tone} label="VOLUME" />
        <ParamSwitch def="rxBend" tone={tone} label="BEND" />
        <ParamSwitch def="rxHold1" tone={tone} label="HOLD-1" />
        <ParamSwitch def="rxRedamper" tone={tone} label="REDAMPER" />
        <ParamChoice def="rxPan" tone={tone} label="Pan" />
      </Group>
    </>
  );
}

export type MorePart = "pitch" | "filter" | "amp" | "lfo";

const MORE: Readonly<Record<MorePart, { title: string; View: (p: ToneProps) => ReactNode }>> = {
  pitch: { title: "more pitch settings", View: PitchMore },
  filter: { title: "more filter settings", View: FilterMore },
  amp: { title: "more amp settings", View: AmpMore },
  lfo: { title: "more LFO settings", View: LfoMore },
};

// The "⋯" in a part's label strip.
export function PartMore({ tone, part }: ToneProps & { part: MorePart }) {
  const { title, View } = MORE[part];
  return (
    <PopoverButton label="⋯" title={`Tone ${tone + 1}: ${title}`} className="more-btn">
      <View tone={tone} />
    </PopoverButton>
  );
}
