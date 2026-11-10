// Loudness in LUFS (ITU-R BS.1770-4, EBU R128; docs/sp404-design.md › Scopes): K-weighting, then mean squares in
// 100 ms blocks. Short-term (LUFS-S) is the last 3 s; integrated (LUFS-I) is 400 ms blocks every 100 ms, gated at
// −70 LUFS and then 10 LU below their mean. The gated blocks are kept as a histogram, so memory doesn't grow.

// A biquad's coefficients, normalised so a0 is 1.
export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

// The two K-weighting stages for a sample rate (the BS.1770 filters, derived as in libebur128).
export function kWeighting(rate: number): [Biquad, Biquad] {
  const shelf = (() => {
    const k = Math.tan((Math.PI * 1681.974450955533) / rate);
    const q = 0.7071752369554196;
    const vh = 10 ** (3.999843853973347 / 20);
    const vb = vh ** 0.4996667741545416;
    const a0 = 1 + k / q + k * k;
    return {
      b0: (vh + (vb * k) / q + k * k) / a0,
      b1: (2 * (k * k - vh)) / a0,
      b2: (vh - (vb * k) / q + k * k) / a0,
      a1: (2 * (k * k - 1)) / a0,
      a2: (1 - k / q + k * k) / a0,
    };
  })();
  const k = Math.tan((Math.PI * 38.13547087602444) / rate);
  const q = 0.5003270373238773;
  const a0 = 1 + k / q + k * k;
  const highPass = { b0: 1, b1: -2, b2: 1, a1: (2 * (k * k - 1)) / a0, a2: (1 - k / q + k * k) / a0 };
  return [shelf, highPass];
}

// One channel's K-weighting filter, run sample by sample (direct form II transposed).
interface Channel {
  stages: [Biquad, Biquad];
  z: Float64Array; // two state values per stage
  sum: number; // sum of squares in the block being built
}

const newChannel = (rate: number): Channel => ({ stages: kWeighting(rate), z: new Float64Array(4), sum: 0 });

function filterStage(f: Biquad, z: Float64Array, at: number, x: number): number {
  const y = f.b0 * x + z[at]!;
  z[at] = f.b1 * x - f.a1 * y + z[at + 1]!;
  z[at + 1] = f.b2 * x - f.a2 * y;
  return y;
}

const weigh = (c: Channel, x: number) => filterStage(c.stages[1], c.z, 2, filterStage(c.stages[0], c.z, 0, x));

const SHORT_BLOCKS = 30; // 3 s of 100 ms blocks
const GATE_BLOCKS = 4; // 400 ms
const ABSOLUTE_GATE = -70;
const RELATIVE_GATE = 10;
const HIST_LOW = ABSOLUTE_GATE;
const HIST_STEP = 0.1; // LU per histogram bin
const HIST_BINS = 800; // −70 to +10 LUFS

export interface Loudness {
  readonly blockSize: number; // samples per 100 ms
  channels: [Channel, Channel];
  filled: number; // samples in the block being built
  blocks: Float64Array; // the last SHORT_BLOCKS block powers, a ring
  blockCount: number;
  gateFrom: number; // the block count at the last reset: gating blocks start from there
  histCount: Float64Array; // gated 400 ms blocks per loudness bin
  histPower: Float64Array; // and the sum of their powers
}

export function createLoudness(rate: number): Loudness {
  return {
    blockSize: Math.round(rate / 10),
    channels: [newChannel(rate), newChannel(rate)],
    filled: 0,
    blocks: new Float64Array(SHORT_BLOCKS),
    blockCount: 0,
    gateFrom: 0,
    histCount: new Float64Array(HIST_BINS),
    histPower: new Float64Array(HIST_BINS),
  };
}

export const lufsOf = (power: number) => (power > 0 ? -0.691 + 10 * Math.log10(power) : -Infinity);

// The mean power of the newest `n` blocks (fewer if there aren't that many yet).
function recentPower(m: Loudness, n: number): number {
  const count = Math.min(n, m.blockCount, SHORT_BLOCKS);
  if (count === 0) return 0;
  let sum = 0;
  for (let i = 1; i <= count; i++) sum += m.blocks[(m.blockCount - i) % SHORT_BLOCKS]!;
  return sum / count;
}

function addGatingBlock(m: Loudness) {
  if (m.blockCount - m.gateFrom < GATE_BLOCKS) return;
  const power = recentPower(m, GATE_BLOCKS);
  const lufs = lufsOf(power);
  if (lufs <= ABSOLUTE_GATE) return;
  const bin = Math.min(HIST_BINS - 1, Math.floor((lufs - HIST_LOW) / HIST_STEP));
  m.histCount[bin]! += 1;
  m.histPower[bin]! += power;
}

function closeBlock(m: Loudness) {
  const [l, r] = m.channels;
  m.blocks[m.blockCount % SHORT_BLOCKS] = (l.sum + r.sum) / m.blockSize;
  m.blockCount++;
  l.sum = 0;
  r.sum = 0;
  m.filled = 0;
  addGatingBlock(m);
}

// Add the samples that arrived, left and right in step.
export function pushLoudness(m: Loudness, left: ArrayLike<number>, right: ArrayLike<number>) {
  const [l, r] = m.channels;
  for (let i = 0; i < left.length; i++) {
    const wl = weigh(l, left[i]!);
    const wr = weigh(r, right[i] ?? left[i]!);
    l.sum += wl * wl;
    r.sum += wr * wr;
    if (++m.filled === m.blockSize) closeBlock(m);
  }
}

// LUFS-S: the last 3 s (or as much as has arrived).
export const shortTermLufs = (m: Loudness) => lufsOf(recentPower(m, SHORT_BLOCKS));

function gatedMean(m: Loudness, fromBin: number): { power: number; count: number } {
  let power = 0;
  let count = 0;
  for (let i = Math.max(0, fromBin); i < HIST_BINS; i++) {
    power += m.histPower[i]!;
    count += m.histCount[i]!;
  }
  return { power, count };
}

// LUFS-I since the last reset.
export function integratedLufs(m: Loudness): number {
  const all = gatedMean(m, 0);
  if (all.count === 0) return -Infinity;
  const threshold = lufsOf(all.power / all.count) - RELATIVE_GATE;
  const gated = gatedMean(m, Math.ceil((threshold - HIST_LOW) / HIST_STEP));
  return gated.count ? lufsOf(gated.power / gated.count) : -Infinity;
}

export function resetIntegrated(m: Loudness) {
  m.histCount.fill(0);
  m.histPower.fill(0);
  m.gateFrom = m.blockCount;
}

// "−14.2", or "–" below the absolute gate (silence).
export const formatLufs = (lufs: number) => (lufs <= ABSOLUTE_GATE ? "–" : lufs.toFixed(1).replace("-", "−"));
