// Drawings for the modulation effects (after the SP-404's modulation views): the tremolo's wave (TYPE pads above
// it), the chorus voices over its HPF / LPF band, and the flanger's comb and phaser's notches.
import { TR_TYPES } from "../../core/display";
import { parseHz } from "../../core/eqResponse";
import { bpmBars, lfoBars, trWave } from "../../core/efxShapes";
import {
  Caption, clamp, dbScale, DragArea, freqX, Handle, highPass, Pads, Response, sample, Svg, Well,
} from "../../ui/draw";
import type { Hz, Px, Region } from "../../ui/draw";
import type { AxisSpec } from "./viewContext";
import { OverBand } from "./parts";
import { useEfxView } from "./viewContext";
import type { EfxView, EfxViewProps } from "./viewContext";

// Cycles of an LFO across one bar, from RATE or (when on) BPM SYNC.
const cyclesOf = (c: EfxView, rate: number, sync: number) =>
  clamp(1 / lfoBars({ rate: c.raw(rate), sync: c.raw(sync) }), 0.5, 16);

// Dragging a wave sideways: RATE, or the BPM SYNC division while it's on (never down to OFF).
const rateAxis = (c: EfxView, rate: number, sync: number): AxisSpec =>
  bpmBars({ sync: c.raw(sync) }) === undefined ? { offset: rate, px: 200 } : { offset: sync, px: 200, min: 1 };

const rateText = (c: EfxView, rate: number, sync: number) =>
  bpmBars({ sync: c.raw(sync) }) === undefined ? c.text(rate) : `${c.text(sync)} BAR`;

const quarters = (region: Region) =>
  [1, 2, 3].map((i) => (
    <line key={i} className="grid" x1={(region.width * i) / 4} y1={region.top ?? 0} x2={(region.width * i) / 4}
      y2={(region.top ?? 0) + region.height} />
  ));

// ---- tremolo

export const TREMOLO = { type: 0x19, phase: 0x1a, rate: 0x1b, sync: 0x1c, shape: 0x1d, depth: 0x1e, mode: 0x1f } as const;
const T = TREMOLO;
const PADS_H = 18;

function TremoloWave({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const pan = c.raw(T.mode) === 1;
  const cycles = cyclesOf(c, T.rate, T.sync);
  const depth = c.raw(T.depth) / 100;
  const offset = c.raw(T.phase) / 100;
  const level = (v: number) => (pan ? (v * depth) / 2 : 1 - (depth * (1 - v)) / 2); // −0.5…0.5 or 0…1
  const y = (v: number) => (pan ? top + h / 2 - level(v) * (h - 12) : top + h - 4 - level(v) * (h - 12));
  const wave = (ph: number) => trWave({ type: c.raw(T.type), shape: c.raw(T.shape) }, ph);
  const at = (px: Px, shift: number) => y(wave((px / w) * cycles + shift));
  const phaseX = ((0.25 + offset) / cycles) * w; // the right channel's first crest
  return (
    <g>
      <Well region={region} />
      {quarters(region)}
      {pan && <line className="axis" x1={0} y1={top + h / 2} x2={w} y2={top + h / 2} />}
      <polyline className="trace2" points={sample(w, (px) => at(px, -offset), 1)} />
      <polyline className="trace" points={sample(w, (px) => at(px, 0), 1)} />
      <Caption region={region}>{pan ? "PAN · L — R - -" : "TREMOLO · L — R - -"}</Caption>
      <Caption region={region} right>
        {rateText(c, T.rate, T.sync)}
      </Caption>
      <DragArea region={region} cursor="move" label="RATE · DEPTH"
        onPointerDown={c.drag({ x: rateAxis(c, T.rate, T.sync), y: { offset: T.depth, px: 120 } })} />
      <Handle size={c.size} x={phaseX} y={at(phaseX, -offset)} label="PHASE" below
        cursor="ew-resize" onPointerDown={c.drag({ x: { offset: T.phase, px: 200 } })} onReset={c.reset(T.phase)} />
    </g>
  );
}

// TYPE as pads; the wave over one bar (drag sideways for RATE, up and down for DEPTH), the right channel dashed
// PHASE behind the left. TREMOLO dips the level, PAN swings it either side of the middle.
export function TremoloView(props: EfxViewProps) {
  const c = useEfxView(props);
  const pads: Region = { width: c.size.width, height: PADS_H, top: 0 };
  const wave: Region = { width: c.size.width, height: c.size.height - PADS_H - 4, top: PADS_H + 4 };
  return (
    <Svg size={c.size} label="TREMOLO">
      <Pads region={pads} labels={TR_TYPES} chosen={c.raw(T.type)} name="TYPE" onPick={(i) => c.set(T.type, i)} />
      <TremoloWave c={c} region={wave} />
    </Svg>
  );
}

export const TREMOLO_IN_VIEW = [T.type, T.rate, T.depth, T.phase];

// ---- chorus

export const CHORUS = { mode: 0x22, rate: 0x23, sync: 0x24, depth: 0x25, hpf: 0x27, lpf: 0x28 } as const;
const CH = CHORUS;

function Voices({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const cycles = cyclesOf(c, CH.rate, CH.sync);
  const depth = c.raw(CH.depth) / 100;
  const y = (px: Px, flip: number) => top + h / 2 - flip * Math.sin((px / w) * cycles * 2 * Math.PI) * depth * (h / 2 - 6);
  const mono = c.raw(CH.mode) === 0;
  return (
    <g>
      <Well region={region} />
      {quarters(region)}
      <line className="axis" x1={0} y1={top + h / 2} x2={w} y2={top + h / 2} />
      {!mono && <polyline className="trace2" points={sample(w, (px) => y(px, -1), 1)} />}
      <polyline className="trace" points={sample(w, (px) => y(px, 1), 1)} />
      <Caption region={region}>{mono ? "MONO" : "L — R - -"}</Caption>
      <Caption region={region} right>
        {rateText(c, CH.rate, CH.sync)}
      </Caption>
      <DragArea region={region} cursor="move" label="RATE · DEPTH"
        onPointerDown={c.drag({ x: rateAxis(c, CH.rate, CH.sync), y: { offset: CH.depth, px: 120 } })} />
    </g>
  );
}

// The voices' movement over one bar (drag sideways for RATE, up and down for DEPTH); the HPF / LPF band below.
export const ChorusView = (props: EfxViewProps) => (
  <OverBand props={props} label="CHORUS" Main={Voices} lo={CH.hpf} hi={CH.lpf} />
);

export const CHORUS_IN_VIEW = [CH.rate, CH.depth, CH.hpf, CH.lpf];

// ---- flanger and phaser

interface Notches {
  name: string;
  depth: number;
  manual: number; // MANUAL: 0–100, 50 in the middle
  reso: number;
  resoMax: number;
  hpf?: number;
  curve: (f0: Hz, res: number) => (f: Hz) => number;
}

const comb = (f0: Hz, res: number) => (f: Hz) =>
  10 * Math.log10((1 + res * res - 2 * res * Math.cos((2 * Math.PI * f) / f0)) / (1 + res * res)) * 1.6;

const notches = (count: number) => (f0: Hz, res: number) => (f: Hz) => {
  let s = 0;
  for (let k = 0; k < count; k++) {
    s += -18 * res * Math.exp(-Math.pow(Math.log2(f / (f0 * Math.pow(2, k * 0.9))) / 0.18, 2));
  }
  return s;
};

function NotchView({ props, n }: { props: EfxViewProps; n: Notches }) {
  const c = useEfxView(props);
  const region: Region = { ...c.size, top: 0 };
  const f0 = 300 * Math.pow(2, (c.raw(n.manual) / 100) * 4);
  const res = 0.3 + (c.raw(n.reso) / n.resoMax) * 0.65;
  const cut = n.hpf === undefined ? undefined : parseHz(c.text(n.hpf));
  const curve = (f: Hz) => n.curve(f0, res)(f) + (cut ? Math.max(-24, highPass(f / cut)) : 0);
  const sweep = (c.raw(n.depth) / 100) * 2;
  const [a, b] = [freqX(f0 / Math.pow(2, sweep), c.size.width), freqX(f0 * Math.pow(2, sweep), c.size.width)];
  const y = dbScale(region, 24);
  return (
    <Svg size={c.size} label={n.name}>
      <Response region={region} range={24} curve={curve} />
      <rect className="area" x={a} y={0} width={Math.max(0, b - a)} height={c.size.height} style={{ fillOpacity: 0.08 }} />
      <Caption region={region} right>{`DEPTH ${c.raw(n.depth)}`}</Caption>
      <Handle size={c.size} x={freqX(f0, c.size.width)} y={y(-18 * res)} label="MANUAL · RESO"
        onPointerDown={c.drag({ x: { offset: n.manual, px: 200 }, y: { offset: n.reso, px: 140 } })}
        onReset={c.reset(n.manual, n.reso)} />
      {n.hpf !== undefined && (
        <Handle size={c.size} x={freqX(cut ?? 20, c.size.width)} y={y(-3)} label="HPF" cursor="ew-resize"
          onPointerDown={c.drag({ x: { offset: n.hpf, px: 140 } })} onReset={c.reset(n.hpf)} />
      )}
    </Svg>
  );
}

export const FLANGER = { depth: 0x2d, manual: 0x2e, reso: 0x2f, hpf: 0x31 } as const;

// Comb notches: MANUAL sideways and RESONANCE up and down on one handle, HPF on its own; the shading is the sweep.
export const FlangerView = (props: EfxViewProps) => (
  <NotchView props={props} n={{ name: "FLANGER", ...FLANGER, resoMax: 100, curve: comb }} />
);

export const FLANGER_IN_VIEW = [FLANGER.manual, FLANGER.reso, FLANGER.hpf];

// Notches by mode (4STAGE, 8STAGE, 12STAGE, BI-PH): two per four stages.
const PHASER_NOTCHES = [2, 4, 6, 4];

export const PHASER = { mode: 0x35, depth: 0x38, manual: 0x39, reso: 0x3a } as const;

// As the flanger, with two notches per four stages.
export function PhaserView(props: EfxViewProps) {
  const c = useEfxView(props);
  const count = PHASER_NOTCHES[c.raw(PHASER.mode)] ?? 2;
  return <NotchView props={props} n={{ name: "PHASER", ...PHASER, resoMax: 127, curve: notches(count) }} />;
}

export const PHASER_IN_VIEW = [PHASER.manual, PHASER.reso];
