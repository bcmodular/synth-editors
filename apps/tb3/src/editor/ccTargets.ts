// What a learned CC can drive in the TB-3 editor (docs/tb3-phase4-design.md): a patch parameter, an EFX parameter,
// GLOBAL TUNE, the morph AMOUNT, or one of the TB-3's own performance CCs (the EFFECT knob, the XY pad), passed on
// as that CC.
import type { CcAssignment, CcMode } from "@synth-editors/cc-learn";
import { efxParamAt } from "../core/efx";
import type { EfxNum, EfxParam } from "../core/efx";
import { paramById, PARAMS } from "../core/params";

// "param:<id>" | "efx:<1|2>:<offset>" | "tuning" | "morph" | "tb3cc:<n>"
export type CcTarget = string;

export const TB3_CCS: readonly { cc: number; label: string }[] = [
  { cc: 17, label: "EFFECT KNOB" },
  { cc: 12, label: "PAD X" },
  { cc: 13, label: "PAD Y" },
  { cc: 1, label: "XY MOD" },
];

export const paramTarget = (id: string): CcTarget => `param:${id}`;
export const tb3CcTarget = (cc: number): CcTarget => `tb3cc:${cc}`;
export const tb3CcOf = (t: CcTarget): number | null => (t.startsWith("tb3cc:") ? Number(t.slice(6)) : null);
export const paramOf = (t: CcTarget): string | null => {
  const id = t.startsWith("param:") ? t.slice(6) : null;
  return id && PARAMS.some((p) => p.id === id) ? id : null;
};

// An EFX parameter, by its byte offset in the EFX block: one parameter of one type (core/efx.ts efxParamAt).
export const efxTarget = (efx: EfxNum, offset: number): CcTarget => `efx:${efx}:${offset}`;
export function efxOf(t: CcTarget): EfxParam | null {
  const m = /^efx:([12]):(\d+)$/.exec(t);
  return (m && efxParamAt(Number(m[1]) as EfxNum, Number(m[2]))) ?? null;
}

const FIXED_LABELS: Record<string, string> = { tuning: "GLOBAL TUNE", morph: "MORPH AMOUNT" };

export function targetLabel(t: CcTarget): string {
  const id = paramOf(t);
  if (id) return paramById(id).name;
  const efx = efxOf(t);
  if (efx) return `EFX${efx.efx} ${efx.type.name} ${efx.slot.name}`;
  const cc = tb3CcOf(t);
  return FIXED_LABELS[t] ?? TB3_CCS.find((c) => c.cc === cc)?.label ?? t;
}

// The TB-3's own CCs have no value the editor knows, so they can only follow the knob.
export const modesFor = (t: CcTarget): readonly CcMode[] =>
  tb3CcOf(t) === null ? ["relative", "pickup", "jump"] : ["jump"];
export const defaultModeFor = (t: CcTarget): CcMode => (tb3CcOf(t) === null ? "pickup" : "jump");

const seed = (cc: number, target: CcTarget): CcAssignment => ({
  channel: null,
  cc,
  target,
  mode: defaultModeFor(target),
});

// The Launchkey defaults from the TouchOSC panel.
export const DEFAULT_ASSIGNMENTS: readonly CcAssignment[] = [
  seed(74, paramTarget("vcf_cutoff")),
  seed(71, paramTarget("vcf_resonance")),
  seed(16, paramTarget("accent")),
  seed(17, tb3CcTarget(17)),
  seed(12, tb3CcTarget(12)),
  seed(13, tb3CcTarget(13)),
  seed(104, "tuning"),
  seed(105, "morph"),
  seed(1, tb3CcTarget(1)),
];
