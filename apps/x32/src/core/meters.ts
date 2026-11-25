// Meters (docs/x32-osc-reference.md §10, Maillot p. 16-19): `/meters ,s /meters/N` subscribes to a bank for 10 s, and
// the desk sends `/meters/N ,b <blob>` every 50 ms. The blob holds a little-endian count, then that many little-endian
// float32s, linear (1.0 = 0 dBFS).

import type { OscMessage } from "./osc";

export const METERS = "/meters";
export const bankAddress = (bank: number) => `/meters/${bank}`;

// Where a strip, output or the main mix is in the banks the trace uses. Checked on the desk 25 Nov with the TB-3
// playing into the Sampler: ch 7-8 at bank 0 [6-7] (pre-fader: they read with the fader at -inf), bus 11-12 at bank 0
// [58-59], XLR out 1-2 at bank 4 [40-41]. The aux outs and the main mix aren't checked yet.
export const METER_AT = {
  ch: (n: number) => ({ bank: 0, index: n - 1 }),
  auxin: (n: number) => ({ bank: 0, index: 32 + n - 1 }),
  fxrtn: (n: number) => ({ bank: 0, index: 40 + n - 1 }),
  bus: (n: number) => ({ bank: 0, index: 48 + n - 1 }),
  output: (n: number) => ({ bank: 4, index: 40 + n - 1 }), // Outputs 1-16 (the Rack's XLR outs are 1-8)
  auxOut: (n: number) => ({ bank: 4, index: 72 + n - 1 }), // inferred: "6 aux sends" after the P16 outputs
  mainL: () => ({ bank: 2, index: 22 }),
};

export interface MeterAt {
  bank: number;
  index: number;
}

// The values in a /meters/N message, or null if it isn't one.
export function readMeters(m: OscMessage): { bank: number; values: number[] } | null {
  const bank = /^\/meters\/(\d+)$/.exec(m.address)?.[1];
  const arg = m.args[0];
  if (bank === undefined || arg?.type !== "b") return null;
  const view = new DataView(arg.value.buffer, arg.value.byteOffset, arg.value.byteLength);
  const count = Math.min(view.getInt32(0, true), (arg.value.byteLength - 4) / 4);
  return { bank: Number(bank), values: Array.from({ length: count }, (_, i) => view.getFloat32(4 + i * 4, true)) };
}

// The blob a bank of values travels in (for the fake desk and tests).
export function meterBlob(values: number[]): Uint8Array {
  const view = new DataView(new ArrayBuffer(4 + values.length * 4));
  view.setInt32(0, values.length, true);
  values.forEach((v, i) => view.setFloat32(4 + i * 4, v, true));
  return new Uint8Array(view.buffer);
}

export const dbfs = (linear: number): number => (linear > 0 ? 20 * Math.log10(linear) : -Infinity);

// The loudest value seen at each place, over a listening window.
export class Peaks {
  private readonly peaks = new Map<number, number[]>();

  take(m: OscMessage): void {
    const r = readMeters(m);
    if (!r) return;
    const old = this.peaks.get(r.bank) ?? [];
    this.peaks.set(r.bank, r.values.map((v, i) => Math.max(v, old[i] ?? 0)));
  }

  at(where: MeterAt): number {
    return this.peaks.get(where.bank)?.[where.index] ?? 0;
  }
}
