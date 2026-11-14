// One tone's column: wave, pitch, filter, amp envelope and LFOs (level, pan and sends are in the mixer). Envelopes are rows of times and levels for now;
// the graph editor comes later in Phase 3.

import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { WAVE_GROUPS, waveCount, waveGroupBytes, waveGroupOf, waveName, type WaveGroup } from "../core/waves";
import { Section, Segmented } from "../ui/controls";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamFader, ParamSelect, ParamSwitch } from "./ParamControls";

interface ToneProps {
  tone: number; // 0–3
}

function Wave({ tone }: ToneProps) {
  const { patch, setValue } = useEditor();
  const raw = (id: string) => getParam(patch, param(id), tone);
  const group = waveGroupOf(raw("waveGroupType"), raw("waveGroupId"));
  const number = raw("waveNumber");
  const setGroup = (g: WaveGroup) => {
    const [type, id] = waveGroupBytes(g);
    setValue(param("waveGroupType"), type, tone);
    setValue(param("waveGroupId"), id, tone);
    if (number >= waveCount(g)) setValue(param("waveNumber"), waveCount(g) - 1, tone);
  };
  const setNumber = (n: number) => group && setValue(param("waveNumber"), Math.max(0, Math.min(waveCount(group) - 1, n)), tone);
  return (
    <>
      <Segmented
        options={WAVE_GROUPS.map((g, i) => ({ label: g, value: i }))}
        value={group ? WAVE_GROUPS.indexOf(group) : -1}
        onChange={(i) => setGroup(WAVE_GROUPS[i]!)}
      />
      <div className="row tight wave">
        <button className="btn" disabled={!group || number === 0} onClick={() => setNumber(number - 1)}>‹</button>
        <select className="pick" disabled={!group} value={number} onChange={(e) => setNumber(Number(e.target.value))}>
          {group
            ? Array.from({ length: waveCount(group) }, (_, n) => (
                <option key={n} value={n}>{String(n + 1).padStart(3, "0")} {waveName(group, n)}</option>
              ))
            : <option value={number}>group {raw("waveGroupType")}/{raw("waveGroupId")} {number + 1}</option>}
        </select>
        <button className="btn" disabled={!group || number === waveCount(group) - 1} onClick={() => setNumber(number + 1)}>›</button>
      </div>
    </>
  );
}

// Envelope times and levels as two rows of small faders.
function Envelope({ tone, prefix, levels }: ToneProps & { prefix: string; levels: number }) {
  return (
    <div className="env">
      {[1, 2, 3, 4].map((i) => <ParamFader key={`t${i}`} def={`${prefix}Time${i}`} tone={tone} label={`T${i}`} />)}
      {Array.from({ length: levels }, (_, i) => (
        <ParamFader key={`l${i}`} def={`${prefix}Level${i + 1}`} tone={tone} label={`L${i + 1}`} />
      ))}
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
    <Section title={`TONE ${tone + 1}`} className="tone" extra={<ParamSwitch def="toneSwitch" tone={tone} label="ON" />}>
      <h3>WAVE</h3>
      <Wave tone={tone} />
      <h3>PITCH</h3>
      <ParamFader def="coarseTune" tone={tone} />
      <ParamFader def="fineTune" tone={tone} />
      <ParamFader def="pitchEnvDepth" tone={tone} label="Env Depth" />
      <Envelope tone={tone} prefix="pitchEnv" levels={4} />
      <h3>FILTER</h3>
      <ParamChoice def="filterType" tone={tone} label="Type" />
      <ParamFader def="cutoff" tone={tone} />
      <ParamFader def="resonance" tone={tone} />
      <ParamFader def="filterEnvDepth" tone={tone} label="Env Depth" />
      <Envelope tone={tone} prefix="filterEnv" levels={4} />
      <h3>AMP</h3>
      <Envelope tone={tone} prefix="ampEnv" levels={3} />
      <h3>LFO</h3>
      <Lfo tone={tone} n={1} />
      <Lfo tone={tone} n={2} />
    </Section>
  );
}
