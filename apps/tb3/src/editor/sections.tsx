// Synthesis sections of layout A (docs/tb3-phase2-design.md).
import { DIST_TYPES } from "../core/display";
import { lfoShape } from "../core/lfoShape";
import { getRaw } from "../core/patch";
import type { Patch } from "../core/patch";
import { paramById } from "../core/params";
import { vcoShape } from "../core/vcoShape";
import { EnvelopeEditor } from "../ui/EnvelopeEditor";
import type { Stage } from "../ui/EnvelopeEditor";
import { HFader } from "../ui/Fader";
import { Section, Segmented, Stepper } from "../ui/controls";
import { WaveView } from "../ui/WaveView";
import { XmodMatrix } from "../ui/XmodMatrix";
import { useEditor } from "./EditorContext";
import { LiveWave } from "./LiveWave";
import type { Tb3Audio } from "./useTb3Audio";
import { Assignable, ParamH, ParamLed, ParamV, useParam } from "./Param";

export function VcoSection() {
  const src: [string, string, string][] = [
    ["SAW", "vco_saw_level", "vco_saw_sw"],
    ["SQR", "vco_sqr_level", "vco_sqr_sw"],
    ["SIN", "vco_sin_level", "vco_sin_sw"],
    ["WHITE", "vco_white_level", "vco_wh_noise_sw"],
    ["PINK", "vco_pink_level", "vco_pk_noise_sw"],
    ["RING", "vco_ring_level", "vco_ring_sw"],
  ];
  return (
    <Section title="VCO" className="vco">
      <div className="row tight">
        {src.map(([label, id, sw]) => (
          <ParamV key={id} id={id} swId={sw} label={label} />
        ))}
      </div>
      <h3>TUNING</h3>
      <div className="col">
        <ParamH id="saw_tuning" label="SAW" width={220} />
        <ParamH id="sqr_tuning" label="SQR" width={220} />
        <ParamH id="ring_sin_tuning" label="RING+SIN" width={220} />
      </div>
    </Section>
  );
}

const raw = (patch: Patch, id: string) => getRaw(patch, paramById(id));
const level = (patch: Patch, id: string, sw: string) => (raw(patch, sw) ? raw(patch, id) : 0);
const offset = (patch: Patch, id: string) => raw(patch, id) - (paramById(id).center ?? 0);

// DRAWN: the mix pictured from the settings. LIVE: the TB-3's actual output.
function ViewSwitch(p: { audio: Tb3Audio }) {
  return (
    <Segmented
      options={[
        { label: "DRAWN", value: 0 },
        { label: "LIVE", value: 1 },
      ]}
      value={p.audio.view === "live" ? 1 : 0}
      onChange={(v) => p.audio.setView(v ? "live" : "drawn")}
    />
  );
}

export function VcoSumSection(p: { audio: Tb3Audio }) {
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
    <Section title="VCO MIX" className="vcosum" extra={<ViewSwitch audio={p.audio} />}>
      {p.audio.view === "live" ? (
        <LiveWave audio={p.audio} width={370} height={236} />
      ) : (
        <WaveView ys={ys} width={370} height={236} />
      )}
    </Section>
  );
}

const XM_SOURCES = ["SQR", "SAW", "WHITE", "PINK"] as const;
const XM_DESTS = ["SAW", "SQR"] as const;
const xmId = (r: number, c: number) => `cm_${XM_SOURCES[r]!.toLowerCase()}_${XM_DESTS[c]!.toLowerCase()}`;

function XmodCell(p: { row: number; col: number }) {
  const { def, value, disabled, set } = useParam(xmId(p.row, p.col));
  return (
    <Assignable def={def}>
      <HFader
        className="cell"
        width={110}
        value={value}
        max={def.max}
        center={def.center}
        format={def.display}
        onChange={set}
        disabled={disabled}
        signColors
      />
    </Assignable>
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
      <div className="grid2">
        <ParamH id="rm_saw_depth" label="SAW" width={110} labelWidth={48} />
        <ParamH id="rm_white_depth" label="WHITE" width={110} labelWidth={48} />
        <ParamH id="rm_sqr_depth" label="SQR" width={110} labelWidth={48} />
        <ParamH id="rm_pink_depth" label="PINK" width={110} labelWidth={48} />
        <ParamH id="rm_ring_depth" label="RING" width={110} labelWidth={48} />
        <ParamH id="rm_depth" label="DEPTH" width={110} labelWidth={48} />
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
      width={290}
      height={130}
      disabled={!ed.patch}
      readOnly={ed.armed !== null}
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
        <div className="col">
          <ParamH id="vcf_cutoff" label="CUTOFF" width={150} />
          <ParamH id="vcf_resonance" label="RESONANCE" width={150} />
          <ParamH id="vcf_env_depth" label="ENV DEPTH" width={150} />
          <ParamH id="vcf_key_follow" label="KEY FOLLOW" width={150} />
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
        <div className="col">
          <ParamH id="master_volume" label="VOLUME" width={150} />
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
      <div className="col">
        <ParamH id="dist_drive" label="DRIVE" width="fill" />
        <ParamH id="dist_bottom" label="BOTTOM" width="fill" />
        <ParamH id="dist_tone" label="TONE" width="fill" />
        <ParamH id="dist_efx_level" label="EFX LVL" width="fill" />
        <ParamH id="dist_dry_level" label="DRY LVL" width="fill" />
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
        <div className="row tight">
          <ParamV id="lfo_saw" label="SAW" height={110} />
          <ParamV id="lfo_sqr" label="SQR" height={110} />
          <ParamV id="lfo_tri" label="TRI" height={110} />
          <ParamV id="lfo_sin" label="SIN" height={110} />
          <ParamV id="lfo_sh" label="S&H" height={110} />
        </div>
      </div>
      <div className="grid2 fill">
        <ParamH id="lfo_rate" label="RATE" width="fill" />
        <ParamH id="vco_lfo_depth" label="→ VCO" width="fill" labelWidth={50} />
        <ParamH id="lfo_delay" label="DELAY" width="fill" />
        <ParamH id="vcf_lfo_depth" label="→ VCF" width="fill" labelWidth={50} />
        <ParamH id="lfo_cv_offset" label="CV OFFSET" width="fill" />
        <ParamH id="vca_lfo_depth" label="→ VCA" width="fill" labelWidth={50} />
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
      <ParamH id="porta_time" label="TIME" width={170} labelWidth={50} />
      <ParamH id="bender_range" label="BEND" width={170} labelWidth={50} />
    </Section>
  );
}
