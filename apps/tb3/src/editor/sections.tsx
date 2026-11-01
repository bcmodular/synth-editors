// Synthesis sections of layout A (docs/tb3-phase2-design.md).
import { DIST_TYPES } from "../core/display";
import { getRaw } from "../core/patch";
import { paramById } from "../core/params";
import { EnvelopeEditor } from "../ui/EnvelopeEditor";
import type { Stage } from "../ui/EnvelopeEditor";
import { HFader } from "../ui/Fader";
import { LfoView } from "../ui/LfoView";
import { Section, Segmented, Stepper } from "../ui/controls";
import { XmodMatrix } from "../ui/XmodMatrix";
import { useEditor } from "./EditorContext";
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
        <ParamH id="saw_tuning" label="SAW" />
        <ParamH id="sqr_tuning" label="SQR" />
        <ParamH id="ring_sin_tuning" label="RING+SIN" />
      </div>
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
        width={96}
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
      <h3>RING MOD</h3>
      <div className="grid2">
        <ParamH id="rm_saw_depth" label="SAW" width={120} labelWidth={56} />
        <ParamH id="rm_white_depth" label="WHITE" width={120} labelWidth={56} />
        <ParamH id="rm_sqr_depth" label="SQR" width={120} labelWidth={56} />
        <ParamH id="rm_pink_depth" label="PINK" width={120} labelWidth={56} />
        <ParamH id="rm_ring_depth" label="RING" width={120} labelWidth={56} />
        <ParamH id="rm_depth" label="DEPTH" width={120} labelWidth={56} />
      </div>
    </Section>
  );
}

function Envelope(p: { prefix: "vcf" | "vca"; label: string; width?: number }) {
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
      width={p.width}
      disabled={!ed.patch}
      onChange={(k, raw) => ed.setParam(ids[k], raw)}
    />
  );
}

export function VcfSection() {
  return (
    <Section title="VCF" className="vcf">
      <Envelope prefix="vcf" label="ENV" />
      <div className="col">
        <ParamH id="vcf_cutoff" label="CUTOFF" width={200} />
        <ParamH id="vcf_resonance" label="RESONANCE" width={200} />
        <ParamH id="vcf_env_depth" label="ENV DEPTH" width={200} />
        <ParamH id="vcf_key_follow" label="KEY FOLLOW" width={200} />
      </div>
    </Section>
  );
}

export function VcaSection() {
  return (
    <Section title="VCA" className="vca">
      <Envelope prefix="vca" label="ENV" width={280} />
      <div className="col">
        <ParamH id="master_volume" label="VOLUME" width={200} />
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
        <Stepper items={DIST_TYPES} groups={DIST_GROUPS} index={type.value} onChange={type.set} disabled={type.disabled} />
      </Assignable>
      <div className="row">
        <ParamLed id="dist_color" label="COLOR" />
      </div>
      <div className="col">
        <ParamH id="dist_drive" label="DRIVE" />
        <ParamH id="dist_bottom" label="BOTTOM" />
        <ParamH id="dist_tone" label="TONE" />
        <ParamH id="dist_efx_level" label="EFX LVL" />
        <ParamH id="dist_dry_level" label="DRY LVL" />
      </div>
    </Section>
  );
}

export function LfoSection() {
  const ed = useEditor();
  const g = (id: string) => (ed.patch ? getRaw(ed.patch, paramById(id)) : 0);
  const input = ed.patch
    ? {
        saw: g("lfo_saw"),
        sqr: g("lfo_sqr"),
        tri: g("lfo_tri"),
        sin: g("lfo_sin"),
        sh: g("lfo_sh"),
        rate: g("lfo_rate"),
        delay: g("lfo_delay"),
        cvOffset: g("lfo_cv_offset"),
      }
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
        <LfoView input={input} />
        <div className="row tight">
          <ParamV id="lfo_saw" label="SAW" color="cyan" height={110} />
          <ParamV id="lfo_sqr" label="SQR" color="cyan" height={110} />
          <ParamV id="lfo_tri" label="TRI" color="cyan" height={110} />
          <ParamV id="lfo_sin" label="SIN" color="cyan" height={110} />
          <ParamV id="lfo_sh" label="S&H" color="cyan" height={110} />
        </div>
      </div>
      <div className="grid2">
        <ParamH id="lfo_rate" label="RATE" />
        <ParamH id="vco_lfo_depth" label="→ VCO" />
        <ParamH id="lfo_delay" label="DELAY" />
        <ParamH id="vcf_lfo_depth" label="→ VCF" />
        <ParamH id="lfo_cv_offset" label="CV OFFSET" />
        <ParamH id="vca_lfo_depth" label="→ VCA" />
      </div>
    </Section>
  );
}

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
      <div className="col">
        <ParamH id="porta_time" label="TIME" width={120} labelWidth={50} />
        <ParamH id="bender_range" label="BEND" width={120} labelWidth={50} />
      </div>
    </Section>
  );
}
