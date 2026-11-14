import { describe, expect, it } from "vitest";
import { bpmBars, compOut, delayTaps, lfoBars, ratioOf, tailLevel, trWave } from "./efxShapes";

describe("compressor", () => {
  const flat = { threshold: 20, ratio: 6, knee: 0, gain: 40 }; // −20 dB, 1:2, hard, 0 dB

  it("reads ratios from the table", () => {
    expect(ratioOf({ ratio: 0 })).toBe(1);
    expect(ratioOf({ ratio: 6 })).toBe(2);
    expect(ratioOf({ ratio: 13 })).toBe(Infinity);
  });

  it("leaves levels under the threshold alone and divides what's over it", () => {
    expect(compOut(flat, -30)).toBeCloseTo(-30);
    expect(compOut(flat, -20)).toBeCloseTo(-20);
    expect(compOut(flat, 0)).toBeCloseTo(-10);
  });

  it("holds at the threshold with an infinite ratio", () => {
    expect(compOut({ ...flat, ratio: 13 }, 0)).toBeCloseTo(-20);
  });

  it("adds makeup gain", () => {
    expect(compOut({ ...flat, gain: 46 }, -30)).toBeCloseTo(-24);
  });

  it("rounds the corner with a soft knee, meeting the hard curve outside it", () => {
    const soft = { ...flat, knee: 5 }; // 10 dB wide
    expect(compOut(soft, -20)).toBeLessThan(-20);
    expect(compOut(soft, -26)).toBeCloseTo(-26);
    expect(compOut(soft, -14)).toBeCloseTo(compOut(flat, -14));
  });
});

describe("tremolo waves", () => {
  it("draws each TYPE", () => {
    expect(trWave({ type: 0, shape: 0 }, 0.25)).toBeCloseTo(0); // TRI rising through the middle
    expect(trWave({ type: 1, shape: 0 }, 0)).toBe(-1); // UP SAW
    expect(trWave({ type: 2, shape: 0 }, 0)).toBe(1); // DN SAW
    expect(trWave({ type: 3, shape: 0 }, 0.25)).toBeCloseTo(1); // SIN
    expect(trWave({ type: 4, shape: 0 }, 0.75)).toBe(-1); // SQR
    expect(trWave({ type: 5, shape: 0 }, 0.1)).toBe(trWave({ type: 5, shape: 0 }, 0.9)); // RND holds for a cycle
  });

  it("squares the wave up with SHAPE, staying within ±1", () => {
    const [square, sine] = [trWave({ type: 3, shape: 100 }, 0.1), trWave({ type: 3, shape: 0 }, 0.1)];
    expect(Math.abs(square)).toBeGreaterThan(Math.abs(sine));
    expect(trWave({ type: 3, shape: 100 }, 0.25)).toBeCloseTo(1);
  });
});

describe("time", () => {
  it("reads BPM SYNC divisions as bars", () => {
    expect(bpmBars({ sync: 0 })).toBeUndefined();
    expect(bpmBars({ sync: 4 })).toBe(1);
    expect(bpmBars({ sync: 10 })).toBe(0.25);
    expect(bpmBars({ sync: 2 })).toBe(1.5);
  });

  it("takes an LFO's period from the sync division, or the rate", () => {
    expect(lfoBars({ rate: 50, sync: 10 })).toBe(0.25);
    expect(lfoBars({ rate: 100, sync: 0 })).toBeCloseTo(0.01);
    expect(lfoBars({ rate: 0, sync: 0 })).toBeCloseTo(4);
  });
});

describe("delay taps", () => {
  it("spaces repeats by the time, each quieter by the feedback", () => {
    const taps = delayTaps({ time: 0.25, feedback: 50, mode: 0 });
    expect(taps.map((t) => t.at)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(taps.map((t) => t.level)).toEqual([1, 0.5, 0.25, 0.125]);
  });

  it("stops when the repeats die away", () => {
    expect(delayTaps({ time: 0.1, feedback: 0, mode: 0 })).toHaveLength(1);
  });

  it("alternates sides in STEREO and pairs left and right taps in PAN", () => {
    expect(delayTaps({ time: 0.4, feedback: 80, mode: 2 }).map((t) => t.side)).toEqual([-1, 1]);
    const pan = delayTaps({ time: 0.5, feedback: 80, mode: 1, tap: 0.5 });
    expect(pan.map((t) => [t.at, t.side])).toEqual([[0.25, -1], [0.5, 1], [0.75, -1], [1, 1]]);
  });
});

describe("reverb", () => {
  it("falls 60 dB over the reverb time", () => {
    expect(tailLevel({ time: 2 }, 0)).toBe(1);
    expect(tailLevel({ time: 2 }, 2)).toBeCloseTo(0.001);
    expect(tailLevel({ time: 2 }, -0.1)).toBe(0);
  });
});
