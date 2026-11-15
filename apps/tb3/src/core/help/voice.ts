// The TB-3 voice's signal flow, for the help panels: the sound sources and their cross and ring modulation, the
// mix, filter, amplifier, distortion and the two effects, with the LFO and envelopes as control paths. Laid out by
// hand in the diagram's own units. The blocks and paths follow the patch's parameters (Dope Robot's SysEx
// Implementation); the order of distortion, EFX1 and EFX2 isn't documented anywhere we found, so it is drawn as the
// panel and SysEx list them.

export type VoiceSection = "osc" | "xmod" | "ring" | "vcf" | "vca" | "lfo" | "dist" | "efx1" | "efx2";

export type Point = readonly [number, number];

// How strongly a path passes the signal, from parameters: the largest of `ids` (each as a share of its full
// scale, or of its larger side for a signed one), times `times`, and nothing while the switch `on` is off.
export interface Gain {
  ids: readonly string[];
  on?: string;
  times?: string;
}

export interface VoiceBlock {
  id: string;
  label: string;
  at: Point; // centre
  w: number;
  h: number;
  section: VoiceSection;
  ids: readonly string[]; // the parameters it stands for (lit together with their rows and controls)
  value?: string; // a parameter whose value is shown under the label
  efx?: 1 | 2; // shows that effect's type
  off?: string; // a switch: the block is dimmed while it's off
}

export interface VoiceEdge {
  id: string;
  points: readonly Point[];
  section: VoiceSection;
  gain?: Gain;
  text?: { id: string; at: Point }; // a parameter's value shown beside the path
  control?: boolean; // a modulation path (LFO, envelope, cross mod), drawn dashed
  arrow?: boolean; // false where paths join a bus, so only its end has an arrow
  branch?: boolean; // leaves another path: a dot where it starts
}

export interface VoiceFlow {
  width: number;
  height: number;
  blocks: readonly VoiceBlock[];
  edges: readonly VoiceEdge[];
  frame: { x: number; y: number; w: number; h: number }; // round the oscillators, where the LFO's pitch path lands
  mix: Point; // the sum the sources meet at
  out: Point;
}

// --- How strong a path is ---

export interface Scale {
  max: number;
  center?: number;
}

// A raw value as a share (0…1) of its full scale, or of its larger side when it's signed.
export function share(s: Scale, raw: number): number {
  if (s.center === undefined) return raw / Math.max(1, s.max);
  return Math.abs(raw - s.center) / Math.max(1, s.center, s.max - s.center);
}

export function strength(g: Gain, amount: (id: string) => number, isOn: (id: string) => boolean): number {
  if (g.on && !isOn(g.on)) return 0;
  const most = Math.max(0, ...g.ids.map(amount));
  return g.times ? most * amount(g.times) : most;
}

// Every parameter a gain reads.
export const gainIds = (g: Gain): string[] => [...g.ids, ...(g.times ? [g.times] : []), ...(g.on ? [g.on] : [])];

// --- The layout ---

const SRC_X = 190;
const ROW = { saw: 54, sqr: 94, sin: 134, white: 174, pink: 214, ring: 268 } as const;
const BUS_X = 330; // where the sources turn towards the mix
const MIX: Point = [350, 134];
const RM_BUS = 258; // where the sources branch off to the ring modulator
const CHAIN_Y = MIX[1];

interface Source {
  key: "saw" | "sqr" | "sin" | "white" | "pink";
  label: string;
  level: string;
  sw: string;
  rm: string; // its depth into the ring modulator
}

const SOURCES: readonly Source[] = [
  { key: "saw", label: "SAW", level: "vco_saw_level", sw: "vco_saw_sw", rm: "rm_saw_depth" },
  { key: "sqr", label: "SQR", level: "vco_sqr_level", sw: "vco_sqr_sw", rm: "rm_sqr_depth" },
  { key: "sin", label: "SIN", level: "vco_sin_level", sw: "vco_sin_sw", rm: "rm_ring_depth" },
  { key: "white", label: "WHITE", level: "vco_white_level", sw: "vco_wh_noise_sw", rm: "rm_white_depth" },
  { key: "pink", label: "PINK", level: "vco_pink_level", sw: "vco_pk_noise_sw", rm: "rm_pink_depth" },
];

const TUNING: Readonly<Record<string, readonly string[]>> = {
  saw: ["saw_tuning"], sqr: ["sqr_tuning"], sin: ["ring_sin_tuning"],
};

// A source's block, its switch dimming it.
const sourceBlock = (s: Source): VoiceBlock => ({
  id: s.key, label: s.label, at: [SRC_X, ROW[s.key]], w: 74, h: 24, section: "osc",
  ids: [s.level, s.sw, ...(TUNING[s.key] ?? [])], off: s.sw,
});

// A source's path into the mix: along its row to the bus, then up or down into the sum.
const toMix = (y: number): Point[] => [[SRC_X + 37, y], [BUS_X, y], [BUS_X, CHAIN_Y], [MIX[0] - 8, CHAIN_Y]];

const RM_IDS = ["rm_saw_depth", "rm_sqr_depth", "rm_ring_depth", "rm_white_depth", "rm_pink_depth", "rm_depth"];
const XMOD_SAW = ["cm_sqr_saw", "cm_saw_saw", "cm_white_saw", "cm_pink_saw"];
const XMOD_SQR = ["cm_sqr_sqr", "cm_saw_sqr", "cm_white_sqr", "cm_pink_sqr"];
const VCF_ENV = ["vcf_attack", "vcf_decay", "vcf_sustain", "vcf_release", "vcf_env_depth"];
const VCA_ENV = ["vca_attack", "vca_decay", "vca_sustain", "vca_release"];
const LFO_IDS = [
  "lfo_saw", "lfo_sqr", "lfo_tri", "lfo_sin", "lfo_sh", "lfo_rate", "lfo_delay", "lfo_cv_offset", "lfo_bpm_sync",
  "lfo_retrigger", "vco_lfo_depth", "vcf_lfo_depth", "vca_lfo_depth",
];
const FILTER_IDS = ["vcf_cutoff", "vcf_resonance", "vcf_key_follow"];
const DIST_IDS = [
  "dist_sw", "dist_type", "dist_color", "dist_drive", "dist_bottom", "dist_tone", "dist_efx_level", "dist_dry_level",
];

// A block on the main chain, centred at `x`.
type ChainBlock = Partial<VoiceBlock> & Pick<VoiceBlock, "id" | "label" | "section"> & { x: number };
const chain = ({ x, ...b }: ChainBlock): VoiceBlock => ({ at: [x, CHAIN_Y], w: 76, h: 36, ids: [], ...b });

const VCF_X = 432;
const VCA_X = 526;
const LFO: Point = [479, 52];
const ENV_Y = 210;

const BLOCKS: readonly VoiceBlock[] = [
  ...SOURCES.map(sourceBlock),
  { id: "ring", label: "RING MOD", at: [SRC_X, ROW.ring], w: 74, h: 24, section: "ring", ids: RM_IDS },
  { id: "xmod", label: "X-MOD", at: [72, 74], w: 70, h: 24, section: "xmod", ids: [...XMOD_SAW, ...XMOD_SQR] },
  chain({ id: "vcf", label: "FILTER", x: VCF_X, section: "vcf", ids: FILTER_IDS, value: "vcf_cutoff" }),
  chain({ id: "vca", label: "AMP", x: VCA_X, section: "vca", ids: ["master_volume"], value: "master_volume" }),
  chain({ id: "dist", label: "DIST", x: 622, section: "dist", ids: DIST_IDS, value: "dist_type", off: "dist_sw", w: 84 }),
  chain({ id: "efx1", label: "EFX1", x: 726, section: "efx1", efx: 1, w: 84 }),
  chain({ id: "efx2", label: "EFX2", x: 830, section: "efx2", efx: 2, w: 84 }),
  { id: "lfo", label: "LFO", at: LFO, w: 64, h: 24, section: "lfo", ids: LFO_IDS },
  { id: "vcfEnv", label: "ENV", at: [VCF_X, ENV_Y], w: 50, h: 22, section: "vcf", ids: VCF_ENV },
  { id: "vcaEnv", label: "ENV", at: [VCA_X, ENV_Y], w: 50, h: 22, section: "vca", ids: VCA_ENV },
];

// Cross modulation into an oscillator: out of X-MOD's right side at `from`, into the oscillator's left at `to`.
interface XmodPath {
  id: string;
  from: number;
  to: number;
  ids: readonly string[];
}
const xmodTo = ({ id, from, to, ids }: XmodPath): VoiceEdge => ({
  id, points: [[107, from], [132, from], [132, to], [153, to]], section: "xmod", control: true, gain: { ids },
});

const EDGES: readonly VoiceEdge[] = [
  ...SOURCES.map((s): VoiceEdge => ({
    id: `${s.key}Mix`, points: toMix(ROW[s.key]), section: "osc", gain: { ids: [s.level], on: s.sw }, arrow: false,
    text: { id: s.level, at: [278, ROW[s.key] - 5] },
  })),
  {
    id: "ringMix", points: toMix(ROW.ring), section: "osc", arrow: false,
    gain: { ids: ["vco_ring_level"], on: "vco_ring_sw" },
    text: { id: "vco_ring_level", at: [278, ROW.ring - 5] },
  },
  // Every source into the ring modulator: off each source's path, down a bus, under the sources, up into it.
  ...SOURCES.map((s): VoiceEdge => ({
    id: `${s.key}Ring`, section: "ring", gain: { ids: [s.rm], times: "rm_depth" }, arrow: s.key === "pink", branch: true,
    points: [[RM_BUS, ROW[s.key]], [RM_BUS, ROW.ring + 30], [SRC_X, ROW.ring + 30], [SRC_X, ROW.ring + 12]],
  })),
  xmodTo({ id: "xmodSaw", from: 68, to: ROW.saw, ids: XMOD_SAW }),
  xmodTo({ id: "xmodSqr", from: 80, to: ROW.sqr, ids: XMOD_SQR }),
  { id: "mixVcf", points: [[MIX[0] + 8, CHAIN_Y], [VCF_X - 38, CHAIN_Y]], section: "vcf" },
  { id: "vcfVca", points: [[VCF_X + 38, CHAIN_Y], [VCA_X - 38, CHAIN_Y]], section: "vca" },
  { id: "vcaDist", points: [[VCA_X + 38, CHAIN_Y], [580, CHAIN_Y]], section: "dist", gain: { ids: ["master_volume"] } },
  { id: "distEfx1", points: [[664, CHAIN_Y], [684, CHAIN_Y]], section: "efx1" },
  { id: "efx1Efx2", points: [[768, CHAIN_Y], [788, CHAIN_Y]], section: "efx2" },
  { id: "efx2Out", points: [[872, CHAIN_Y], [896, CHAIN_Y]], section: "efx2" },
  {
    id: "vcfEnvVcf", points: [[VCF_X, ENV_Y - 11], [VCF_X, CHAIN_Y + 18]], section: "vcf", control: true,
    gain: { ids: ["vcf_env_depth"] }, text: { id: "vcf_env_depth", at: [VCF_X + 6, 180] },
  },
  { id: "vcaEnvVca", points: [[VCA_X, ENV_Y - 11], [VCA_X, CHAIN_Y + 18]], section: "vca", control: true },
  {
    id: "lfoVcf", points: [[LFO[0] - 32, LFO[1]], [VCF_X, LFO[1]], [VCF_X, CHAIN_Y - 18]], section: "lfo", control: true,
    gain: { ids: ["vcf_lfo_depth"] }, text: { id: "vcf_lfo_depth", at: [VCF_X + 6, 90] },
  },
  {
    id: "lfoVca", points: [[LFO[0] + 32, LFO[1]], [VCA_X, LFO[1]], [VCA_X, CHAIN_Y - 18]], section: "lfo", control: true,
    gain: { ids: ["vca_lfo_depth"] }, text: { id: "vca_lfo_depth", at: [VCA_X + 6, 90] },
  },
  {
    id: "lfoVco", points: [[LFO[0], LFO[1] - 12], [LFO[0], 16], [SRC_X, 16], [SRC_X, 34]], section: "lfo", control: true,
    gain: { ids: ["vco_lfo_depth"] }, text: { id: "vco_lfo_depth", at: [SRC_X + 8, 12] },
  },
];

export const VOICE_FLOW: VoiceFlow = {
  width: 940,
  height: 310,
  blocks: BLOCKS,
  edges: EDGES,
  frame: { x: 142, y: 34, w: 96, h: 196 },
  mix: MIX,
  out: [896, CHAIN_Y],
};

// Every parameter a block or path stands for, for a check that they are real.
export const voiceIds = (f: VoiceFlow): string[] => [
  ...f.blocks.flatMap((b) => [...b.ids, ...(b.value ? [b.value] : []), ...(b.off ? [b.off] : [])]),
  ...f.edges.flatMap((e) => (e.gain ? gainIds(e.gain) : [])),
];
