// EFX drawings for tone and dynamics: EQ curve, spectrum bars, drive curve, enhancer harmonics, compressor and
// limiter. Handles drag the parameters the spec names (Shift = fine).

import type { PanelSpec } from "./specs";
import { dragXY } from "../../ui/dragXY";
import { Handle } from "../../ui/Drawing";
import { clamp, curvePoints, dbY, Frame, freqX, hzOf, PAD, TOP, type Size } from "./drawKit";
import { amount, fraction, type EfxParam, type GetParam } from "./useEfx";

type Spec<K extends PanelSpec["kind"]> = Extract<PanelSpec, { kind: K }>;

interface PanelProps<K extends PanelSpec["kind"]> {
  spec: Spec<K>;
  get: GetParam;
  size: Size;
}

// --- EQ: shelves and peaks; each band's handle drags its gain (and frequency, from a list) ---

interface BandShape {
  shape: "low" | "high" | "peak";
  hz: number;
  db: number;
  q: number;
}

function bandDb(b: BandShape, f: number): number {
  if (b.shape === "low") return b.db / (1 + (f / b.hz) ** 2);
  if (b.shape === "high") return b.db / (1 + (b.hz / f) ** 2);
  return b.db / (1 + (b.q * (f / b.hz - b.hz / f)) ** 2);
}

const xToHz = (x: number, width: number) => 20 * 10 ** (((x - PAD) / (width - 2 * PAD)) * 3);

export function EqPanel({ spec, get, size }: PanelProps<"eq">) {
  const { width, height } = size;
  const bands = spec.bands.map((band) => {
    const gain = get(band.gain);
    const freq = band.freq ? get(band.freq) : undefined;
    const hz = (freq ? hzOf(freq.text) : band.hz) ?? 1000;
    const q = band.q ? Number(get(band.q).text) || 1 : 1;
    return { band, gain, freq, shape: { shape: band.shape, hz, db: amount(gain), q } };
  });
  const total = (x: number) => dbY(bands.reduce((sum, b) => sum + bandDb(b.shape, xToHz(x, width)), 0), height);
  return (
    <Frame size={size} title={spec.title} values={bands.map((b) => `${b.band.label} ${b.gain.text}`).join("  ")}>
      <line className="axis" x1={0} x2={width} y1={dbY(0, height)} y2={dbY(0, height)} />
      <polyline className="cv" points={curvePoints(width, total)} />
      {bands.map(({ band, gain, freq, shape }) => (
        <g key={band.label}>
          <Handle x={freqX(shape.hz, width)} y={dbY(shape.db, height)}
            onPointerDown={(e) => dragXY(e, { y: gain.axis(height - TOP - PAD), x: freq?.axis(width * 0.6) })} />
          <text className="gl" x={freqX(shape.hz, width)} y={height - 3} textAnchor="middle">{band.label}</text>
        </g>
      ))}
    </Frame>
  );
}

// --- Spectrum: eight fixed bands as bars; drag a bar up or down ---

const SPECTRUM_HZ = [250, 500, 1000, 1250, 2000, 3150, 4000, 8000];

export function SpectrumPanel({ spec, get, size }: PanelProps<"spectrum">) {
  const { width, height } = size;
  const q = Number(get(spec.q).text) || 1;
  const bands = spec.bands.map((name, i) => ({ x: get(name), hz: SPECTRUM_HZ[i]! }));
  const curve = (x: number) =>
    dbY(bands.reduce((s, b) => s + bandDb({ shape: "peak", hz: b.hz, db: amount(b.x), q: q * 1.5 }, xToHz(x, width)), 0), height);
  const zero = dbY(0, height);
  const slot = (width - 2 * PAD) / bands.length;
  return (
    <Frame size={size} title={spec.title} values={`Q ${get(spec.q).text}`}>
      <line className="axis" x1={0} x2={width} y1={zero} y2={zero} />
      {bands.map(({ x, hz }, i) => {
        const cx = PAD + slot * (i + 0.5);
        const y = dbY(amount(x), height);
        return (
          <g key={hz}>
            <rect className="bar" x={cx - slot * 0.3} width={slot * 0.6} y={Math.min(y, zero)} height={Math.abs(zero - y)} />
            <Handle x={cx} y={y} onPointerDown={(e) => dragXY(e, { y: x.axis(height - TOP - PAD) })} />
            <text className="gl" x={cx} y={height - 3} textAnchor="middle">{hz >= 1000 ? `${hz / 1000}k` : hz}</text>
          </g>
        );
      })}
      <polyline className="cv2" points={curvePoints(width, curve)} />
    </Frame>
  );
}

// --- Drive: the transfer curve (soft for overdrive, harder for distortion); drag up / down for the drive ---

function driveCurve(drive: number, hard: boolean) {
  const k = 1 + (drive / 127) * (hard ? 18 : 8);
  return (x: number) => (hard ? clamp(Math.tanh(k * x) * 1.15, -1, 1) : Math.tanh(k * x) / Math.tanh(k));
}

export function DrivePanel({ spec, get, size }: PanelProps<"drive">) {
  const { width, height } = size;
  const drive = get(spec.drive);
  const f = driveCurve(drive.raw, spec.hard ?? false);
  const mid = (TOP + height - PAD) / 2;
  const half = (height - TOP - PAD) / 2;
  const toX = (x: number) => (2 * (x - PAD)) / (width - 2 * PAD) - 1;
  return (
    <Frame size={size} title={spec.title} values={`DRIVE ${drive.text}`}>
      <line className="axis" x1={0} x2={width} y1={mid} y2={mid} />
      <line className="axis" x1={width / 2} x2={width / 2} y1={TOP} y2={height - PAD} />
      <polyline className="cv2" points={`${PAD},${mid + half} ${width - PAD},${mid - half}`} />
      <polyline className="cv" points={curvePoints(width, (x) => mid - f(toX(x)) * half)} />
      <rect className="drag" x={0} y={TOP} width={width} height={height - TOP}
        onPointerDown={(e) => dragXY(e, { y: drive.axis(height * 1.5) })} />
    </Frame>
  );
}

// --- Enhancer: harmonics brightened by the sensitivity, mixed in by the mix; drag sideways / up-down ---

export function EnhancerPanel({ spec, get, size }: PanelProps<"enhancer">) {
  const { width, height } = size;
  const sens = get(spec.sens);
  const mix = get(spec.mix);
  const count = 10;
  const slot = (width - 2 * PAD) / count;
  const floor = height - PAD;
  const span = floor - TOP;
  return (
    <Frame size={size} title={spec.title} values={`SENS ${sens.text} · MIX ${mix.text}`}>
      <line className="axis" x1={0} x2={width} y1={floor} y2={floor} />
      {Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const base = 1 / n;
        const added = n > 1 ? fraction(sens) * fraction(mix) * (0.25 + n / count) * 0.6 : 0;
        const x = PAD + slot * (i + 0.5);
        return (
          <g key={n}>
            <rect className="bar dim" x={x - slot * 0.3} width={slot * 0.6} y={floor - base * span} height={base * span} />
            <rect className="bar" x={x - slot * 0.3} width={slot * 0.6} y={floor - (base + added) * span} height={added * span} />
          </g>
        );
      })}
      <rect className="drag" x={0} y={TOP} width={width} height={span}
        onPointerDown={(e) => dragXY(e, { x: sens.axis(width), y: mix.axis(span) })} />
    </Frame>
  );
}

// --- Compressor: a decaying note before (dashed) and after; drag the attack sideways, the sustain up-down ---

export function CompressorPanel({ spec, get, size }: PanelProps<"compressor">) {
  const { width, height } = size;
  const sustain = get(spec.sustain);
  const attack = get(spec.attack);
  const floor = height - PAD;
  const span = floor - TOP;
  const t = (x: number) => (x - PAD) / (width - 2 * PAD);
  const input = (x: number) => Math.exp(-4 * t(x));
  const attackEnd = 0.02 + fraction(attack) * 0.25;
  const squash = 1 - fraction(sustain) * 0.85;
  const output = (x: number) => (t(x) < attackEnd ? input(x) : input(x) ** squash * (0.75 + 0.25 * squash));
  const ax = PAD + attackEnd * (width - 2 * PAD);
  return (
    <Frame size={size} title={spec.title} values={`SUSTAIN ${sustain.text} · ATTACK ${attack.text}`}>
      <line className="axis" x1={0} x2={width} y1={floor} y2={floor} />
      <polyline className="cv2" points={curvePoints(width, (x) => floor - input(x) * span)} />
      <polyline className="cv" points={curvePoints(width, (x) => floor - output(x) * span)} />
      <Handle x={ax} y={floor - output(ax + 1) * span}
        onPointerDown={(e) => dragXY(e, { x: attack.axis(width * 1.2), y: sustain.axis(span) })} />
    </Frame>
  );
}

// --- Limiter: output against input; drag the threshold knee, or the top end for the ratio ---

const RATIOS = [1.5, 2, 4, 100];

export function LimiterPanel({ spec, get, size }: PanelProps<"limiter">) {
  const { width, height } = size;
  const threshold: EfxParam = get(spec.threshold);
  const ratio = get(spec.ratio);
  const r = RATIOS[ratio.raw] ?? 2;
  const th = 0.15 + fraction(threshold) * 0.85;
  const out = (v: number) => (v < th ? v : th + (v - th) / r);
  const left = PAD;
  const side = Math.min(width - 2 * PAD, height - TOP - PAD);
  const bottom = height - PAD;
  const px = (v: number) => left + v * side;
  const py = (v: number) => bottom - v * side;
  return (
    <Frame size={size} title={spec.title} values={`THRESHOLD ${threshold.text} · ${ratio.text}`}>
      <rect className="axis-box" x={left} y={bottom - side} width={side} height={side} />
      <polyline className="cv2" points={`${px(0)},${py(0)} ${px(1)},${py(1)}`} />
      <polyline className="cv" points={`${px(0)},${py(0)} ${px(th)},${py(th)} ${px(1)},${py(out(1))}`} />
      <Handle x={px(th)} y={py(th)} onPointerDown={(e) => dragXY(e, { x: threshold.axis(side) })} />
      <Handle x={px(1)} y={py(out(1))} onPointerDown={(e) => dragXY(e, { y: ratio.axis(-side * 0.5) })} />
      <text className="gl" x={left + side + 10} y={bottom - side + 12}>OUT</text>
      <text className="gl" x={left + side + 10} y={bottom}>IN →</text>
    </Frame>
  );
}

