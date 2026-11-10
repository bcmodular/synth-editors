// Stereo correlation, −1 (out of phase) to +1 (mono), averaged over about 300 ms (docs/sp404-design.md › Scopes).

const TIME_CONSTANT_S = 0.3;
const SILENT = 1e-9; // below this energy there's nothing to correlate

export interface Correlation {
  readonly rate: number;
  lr: number;
  ll: number;
  rr: number;
}

export const createCorrelation = (rate: number): Correlation => ({ rate, lr: 0, ll: 0, rr: 0 });

// Add a frame's samples, left and right in step. Older frames fade with the time constant.
export function pushCorrelation(c: Correlation, left: ArrayLike<number>, right: ArrayLike<number>) {
  let lr = 0;
  let ll = 0;
  let rr = 0;
  for (let i = 0; i < left.length; i++) {
    const l = left[i]!;
    const r = right[i] ?? l;
    lr += l * r;
    ll += l * l;
    rr += r * r;
  }
  const keep = Math.exp(-left.length / (TIME_CONSTANT_S * c.rate));
  c.lr = c.lr * keep + lr;
  c.ll = c.ll * keep + ll;
  c.rr = c.rr * keep + rr;
}

// The correlation now, or NaN in silence.
export function correlationOf(c: Correlation): number {
  const energy = Math.sqrt(c.ll * c.rr);
  return energy < SILENT ? NaN : Math.max(-1, Math.min(1, c.lr / energy));
}
