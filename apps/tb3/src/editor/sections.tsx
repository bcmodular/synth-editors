// Synthesis sections of layout A (docs/tb3-phase2-design.md).
import { DIST_TYPES } from "../core/display";
import { lfoShape } from "../core/lfoShape";
import { getRaw } from "../core/patch";
import type { Patch } from "../core/patch";
import { paramById } from "../core/params";
import { vcoShape } from "../core/vcoShape";
import { EnvelopeEditor } from "../ui/EnvelopeEditor";
import type { Stage } from "../ui/EnvelopeEditor";
import { Section, Segmented, Stepper } from "../ui/controls";
import type { SegOption } from "../ui/controls";
import { WaveView } from "../ui/WaveView";
import { XmodMatrix } from "../ui/XmodMatrix";
import { useEditor } from "./EditorContext";
import { LiveWave } from "./LiveWave";
import type { LiveGraph } from "./liveEngine";
import type { Tb3Audio } from "./useTb3Audio";
import { Assignable, ParamFader, ParamKnob, ParamLed, useParam } from "./Param";

// The source levels (each under its on/off switch) and the tunings: the left of the VCO group.
function VcoControls() {
  const src: [string, string, string][] = [
    ["SAW", "vco_saw_level", "vco_saw_sw"],
    ["SQR", "vco_sqr_level", "vco_sqr_sw"],
    ["SIN", "vco_sin_level", "vco_sin_sw"],
    ["WHITE", "vco_white_level", "vco_wh_noise_sw"],
    ["PINK", "vco_pink_level", "vco_pk_noise_sw"],
    ["RING", "vco_ring_level", "vco_ring_sw"],
  ];
  return (
    <div className="vcoctl">
      <div className="knobrow">
        {src.map(([label, id, sw]) => (
          <div key={id} className="vsrc">
            <ParamLed id={sw} label={label} />
            <ParamKnob id={id} label={label} swId={sw} bare />
          </div>
        ))}
      </div>
      <h3>TUNING</h3>
      <div className="knobrow">
        <ParamKnob id="saw_tuning" label="SAW" />
        <ParamKnob id="sqr_tuning" label="SQR" />
        <ParamKnob id="ring_sin_tuning" label="RING+SIN" />
      </div>
    </div>
  );
}

const raw = (patch: Patch, id: string) => getRaw(patch, paramById(id));
const level = (patch: Patch, id: string, sw: string) => (raw(patch, sw) ? raw(patch, id) : 0);
const offset = (patch: Patch, id: string) => raw(patch, id) - (paramById(id).center ?? 0);

// DRAWN: the mix pictured from the settings. LIVE: the TB-3's actual output, as a waveform, spectrum or spectrogram.
const VIEWS: SegOption[] = [
  { label: "DRAWN", value: 0 },
  { label: "LIVE", value: 1 },
];
const GRAPHS: readonly LiveGraph[] = ["wave", "spectrum", "spectrogram"];
const GRAPH_OPTIONS: SegOption[] = GRAPHS.map((g, i) => ({ label: g.toUpperCase(), value: i }));

function ViewSwitch(p: { audio: Tb3Audio }) {
  const live = p.audio.view === "live";
  return (
    <>
      {live && (
        <Segmented
          options={GRAPH_OPTIONS}
          value={GRAPHS.indexOf(p.audio.graph)}
          onChange={(i) => p.audio.setGraph(GRAPHS[i]!)}
        />
      )}
      <Segmented options={VIEWS} value={live ? 1 : 0} onChange={(v) => p.audio.setView(v ? "live" : "drawn")} />
    </>
  );
}

const MIX_W = 564;
const MIX_H = 236;

// VCO: the sources and tunings beside the mix (DRAWN or LIVE), in green, the TB-3's own colour, as the main voice.
export function VcoSection(p: { audio: Tb3Audio }) {
  const { patch } = useEditor();
  const ys = patch
    ? vcoShape({
        saw: level(patch, "vco_saw_level", "vco_saw_sw"),
        sqr: level(patch, "vco_sqr_level", "vco_sqr_sw"),
        sin: level(patch, "vco_sin_level", "vco_sin_sw"),
        white: level(patch, "vco_white_level", "vco_wh_noise_sw"),
        pink: level(patch, "vco_pink_level", "vco_pk_noise_sw"),
        ring: level(patch, "vco_ring_level", "vco_ring_sw"),
        sawTune: offset(patch, "saw_tuning"),
        sqrTune: offset(patch, "sqr_tuning"),
        sinTune: offset(patch, "ring_sin_tuning"),
      })
    : null;
  return (
    <Section title="VCO" className="vco vcosum" extra={<ViewSwitch audio={p.audio} />}>
      <div className="row top">
        <VcoControls />
        {p.audio.view === "live" ? (
          <LiveWave audio={p.audio} width={MIX_W} height={MIX_H} />
        ) : (
          <WaveView ys={ys} width={MIX_W} height={MIX_H} />
        )}
      </div>
    </Section>
  );
}

const XM_SOURCES = ["SQR", "SAW", "WHITE", "PINK"] as const;
const XM_DESTS = ["SAW", "SQR"] as const;
const xmId = (r: number, c: number) => `cm_${XM_SOURCES[r]!.toLowerCase()}_${XM_DESTS[c]!.toLowerCase()}`;

function XmodCell(p: { row: number; col: number }) {
  return (
    <ParamFader id={xmId(p.row, p.col)} label={`${XM_SOURCES[p.row]} → ${XM_DESTS[p.col]}`} width={150} signColors />
  );
}

export function ModSection() {
  const { patch } = useEditor();
  const amounts = patch
    ? XM_SOURCES.map((_, r) => XM_DESTS.map((_, c) => getRaw(patch, paramById(xmId(r, c))) - 64))
    : null;
  return (
    <Section title="CROSS MOD" className="mod">
      <XmodMatrix
        sources={XM_SOURCES}
        dests={XM_DESTS}
        amounts={amounts}
        range={64}
        renderCell={(r, c) => <XmodCell row={r} col={c} />}
      />
    </Section>
  );
}

export function RingModSection() {
  return (
    <Section title="RING MOD" className="ring">
      <div className="knobrow">
        <ParamKnob id="rm_saw_depth" label="SAW" />
        <ParamKnob id="rm_sqr_depth" label="SQR" />
        <ParamKnob id="rm_ring_depth" label="RING" />
        <ParamKnob id="rm_white_depth" label="WHITE" />
        <ParamKnob id="rm_pink_depth" label="PINK" />
        <ParamKnob id="rm_depth" label="DEPTH" />
      </div>
    </Section>
  );
}

function Envelope(p: { prefix: "vcf" | "vca"; label: string }) {
  const ed = useEditor();
  const ids: Record<Stage, string> = {
    a: `${p.prefix}_attack`,
    d: `${p.prefix}_decay`,
    s: `${p.prefix}_sustain`,
    r: `${p.prefix}_release`,
  };
  const v = (k: Stage) => (ed.patch ? getRaw(ed.patch, paramById(ids[k])) : 0);
  return (
    <EnvelopeEditor
      a={v("a")}
      d={v("d")}
      s={v("s")}
      r={v("r")}
      label={p.label}
      width={232}
      height={120}
      disabled={!ed.patch}
      readOnly={ed.armed !== null || ed.learning}
      wrapValue={(k, node) => (
        <Assignable def={paramById(ids[k])} className="inline">
          {node}
        </Assignable>
      )}
      onChange={(k, raw) => ed.setParam(ids[k], raw)}
    />
  );
}

export function VcfSection() {
  return (
    <Section title="VCF" className="vcf">
      <div className="row top">
        <Envelope prefix="vcf" label="ENV" />
        <div className="knobgrid two">
          <ParamKnob id="vcf_cutoff" label="CUTOFF" />
          <ParamKnob id="vcf_resonance" label="RESONANCE" />
          <ParamKnob id="vcf_env_depth" label="ENV DEPTH" />
          <ParamKnob id="vcf_key_follow" label="KEY FOLLOW" />
        </div>
      </div>
    </Section>
  );
}

export function VcaSection() {
  return (
    <Section title="VCA" className="vca">
      <div className="row top">
        <Envelope prefix="vca" label="ENV" />
        <div className="knobgrid two">
          <ParamKnob id="master_volume" label="VOLUME" />
        </div>
      </div>
    </Section>
  );
}

// Grouping of the 25 types by family, as shown in the stepper's popover.
const DIST_GROUPS = [
  { name: "BOOST", items: [0, 1, 2] },
  { name: "OVERDRIVE", items: [3, 4, 5, 6, 7, 8, 9] },
  { name: "DISTORTION", items: [10, 11, 12, 13, 14, 15, 16, 17] },
  { name: "AMP / HIGH GAIN", items: [18, 19, 20, 21] },
  { name: "FUZZ", items: [22, 23, 24] },
];

export function DistSection() {
  const type = useParam("dist_type");
  return (
    <Section title="DISTORTION" className="dist" extra={<ParamLed id="dist_sw" label="ON" />}>
      <Assignable def={type.def}>
        <Stepper
          items={DIST_TYPES}
          groups={DIST_GROUPS}
          index={type.value}
          onChange={type.set}
          disabled={type.disabled}
        />
      </Assignable>
      <div className="row">
        <ParamLed id="dist_color" label="COLOR" />
      </div>
      <div className="knobgrid">
        <ParamKnob id="dist_drive" label="DRIVE" />
        <ParamKnob id="dist_bottom" label="BOTTOM" />
        <ParamKnob id="dist_tone" label="TONE" />
        <ParamKnob id="dist_efx_level" label="EFX LVL" />
        <ParamKnob id="dist_dry_level" label="DRY LVL" />
      </div>
    </Section>
  );
}

export function LfoSection() {
  const { patch } = useEditor();
  const ys = patch
    ? lfoShape({
        saw: raw(patch, "lfo_saw"),
        sqr: raw(patch, "lfo_sqr"),
        tri: raw(patch, "lfo_tri"),
        sin: raw(patch, "lfo_sin"),
        sh: raw(patch, "lfo_sh"),
        rate: raw(patch, "lfo_rate"),
        delay: raw(patch, "lfo_delay"),
        cvOffset: raw(patch, "lfo_cv_offset"),
      })
    : null;
  return (
    <Section
      title="LFO"
      className="lfo"
      extra={
        <>
          <ParamLed id="lfo_bpm_sync" label="BPM SYNC" />
          <ParamLed id="lfo_retrigger" label="RETRIG" />
        </>
      }
    >
      <div className="row top">
        <WaveView ys={ys} width={296} height={130} />
        <div className="knobgrid">
          <ParamKnob id="lfo_saw" label="SAW" />
          <ParamKnob id="lfo_sqr" label="SQR" />
          <ParamKnob id="lfo_tri" label="TRI" />
          <ParamKnob id="lfo_sin" label="SIN" />
          <ParamKnob id="lfo_sh" label="S&H" />
        </div>
      </div>
      <div className="knobrow">
        <ParamKnob id="lfo_rate" label="RATE" />
        <ParamKnob id="lfo_delay" label="DELAY" />
        <ParamKnob id="lfo_cv_offset" label="CV OFFSET" />
        <ParamKnob id="vco_lfo_depth" label="→ VCO" />
        <ParamKnob id="vcf_lfo_depth" label="→ VCF" />
        <ParamKnob id="vca_lfo_depth" label="→ VCA" />
      </div>
    </Section>
  );
}

// Portamento and bend: a section in the top strip.
export function PortaBendSection() {
  const mode = useParam("porta_mode");
  return (
    <Section title="PORTA · BEND" className="porta" extra={<ParamLed id="porta_sw" label="PORTA" />}>
      <Assignable def={mode.def}>
        <Segmented
          options={[
            { label: "LEGATO", value: 0 },
            { label: "ALWAYS", value: 1 },
          ]}
          value={mode.value}
          onChange={mode.set}
          disabled={mode.disabled}
        />
      </Assignable>
      <div className="knobrow">
        <ParamKnob id="porta_time" label="TIME" side />
        <ParamKnob id="bender_range" label="BEND" side />
      </div>
    </Section>
  );
}
