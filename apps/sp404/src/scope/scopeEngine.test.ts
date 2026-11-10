import { newBeatClock } from "@synth-editors/audio";
import type { Frame, Listening } from "@synth-editors/audio";
import { describe, expect, it } from "vitest";
import {
  advanceScope, columnOfTime, emptyScope, setHeld, spanSeconds, SPECTRUM_FFT, type ScopeLayout,
} from "./scopeEngine";

const RATE = 48000;
const FRAME = 800; // 1/60 s

// A listening stand-in: a 1 kHz tone at −20 dBFS on the left, silence on the right.
function fakeListening(): Listening & { frames: number } {
  const l = {
    name: "SP-404MKII-IN",
    sampleRate: RATE,
    frames: 0,
    read(): Frame {
      const start = l.frames++ * FRAME;
      const at = (i: number) => (2 * Math.PI * 1000 * (start + i)) / RATE;
      const left = Float32Array.from({ length: FRAME }, (_, i) => 0.1 * Math.sin(at(i)));
      const right = new Float32Array(FRAME);
      return { left, right, mix: left, now: (start + FRAME) / RATE };
    },
    spectrum: (into: Float32Array) => into.fill(-80).fill(-30, 160, 180),
    audioTimeOf: (ms: number) => ms / 1000,
    stop: () => undefined,
  };
  return l;
}

const layout = (p: Partial<ScopeLayout> = {}): ScopeLayout =>
  ({ waveWidth: 400, spectrumWidth: 300, span: "4s", clock: newBeatClock(), ...p });

describe("scopeEngine", () => {
  it("meters each side and fills the waveform lanes and the spectrum", () => {
    const s = emptyScope();
    const l = fakeListening();
    for (let i = 0; i < 60; i++) advanceScope(s, l, layout());
    expect(s.meters[0].db).toBeCloseTo(-20, 0);
    expect(s.meters[1].db).toBe(-Infinity);
    expect(s.waves!.lanes[0].perColumn).toBe((4 * RATE) / 400);
    expect(Math.max(...s.waves!.lanes[0].maxs)).toBeCloseTo(0.1, 2);
    expect(s.spectrum!.bins.length).toBe(SPECTRUM_FFT / 2);
    expect(Math.max(...s.spectrum!.line)).toBeGreaterThan(-40);
  });

  it("skips the waveform and spectrum while the scope view is hidden", () => {
    const s = emptyScope();
    advanceScope(s, fakeListening(), layout({ waveWidth: 0, spectrumWidth: 0 }));
    expect(s.waves).toBeNull();
    expect(s.spectrum).toBeNull();
    expect(s.loudness).not.toBeNull();
  });

  it("HOLD freezes the waveform but not the meter, and starts it afresh afterwards", () => {
    const s = emptyScope();
    const l = fakeListening();
    advanceScope(s, l, layout());
    const frozenAt = s.waves!.now;
    setHeld(s, true);
    advanceScope(s, l, layout());
    expect(s.waves!.now).toBe(frozenAt);
    expect(s.meters[0].at).toBeGreaterThan(frozenAt);
    setHeld(s, false);
    expect(s.waves).toBeNull();
  });

  it("spans bars at the clock's tempo, else 4 s", () => {
    expect(spanSeconds(2, 120)).toBe(4);
    expect(spanSeconds(1, 90)).toBeCloseTo(2.667, 3);
    expect(spanSeconds(4, undefined)).toBe(4);
    expect(spanSeconds("4s", 120)).toBe(4);
  });

  it("places an audio time on the lane, newest on the right", () => {
    const s = emptyScope();
    const l = fakeListening();
    for (let i = 0; i < 30; i++) advanceScope(s, l, layout());
    const w = s.waves!;
    expect(columnOfTime(w, w.now)).toBe(399);
    expect(columnOfTime(w, w.now - 2)).toBeCloseTo(199, 5);
    expect(columnOfTime(w, w.now - 5)).toBeUndefined();
  });
});
