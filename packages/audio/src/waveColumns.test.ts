import { describe, expect, it } from "vitest";
import { createWaveColumns, forEachColumn, pushSamples, samplesPerColumn } from "./waveColumns";

const columns = (w: ReturnType<typeof createWaveColumns>) => {
  const out: [number, number][] = [];
  forEachColumn(w, (_, min, max) => out.push([min, max]));
  return out;
};

describe("waveColumns", () => {
  it("starts flat", () => {
    expect(columns(createWaveColumns(3, 2))).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });

  it("keeps each column's lowest and highest sample, newest on the right", () => {
    const w = createWaveColumns(3, 2);
    pushSamples(w, [0.5, -0.25, 0.75, 0.5]);
    expect(columns(w)).toEqual([
      [0, 0],
      [-0.25, 0.5],
      [0.5, 0.75],
    ]);
  });

  it("carries a part-built column over to the next push", () => {
    const w = createWaveColumns(2, 3);
    pushSamples(w, [0.5, 0.25]);
    expect(columns(w)).toEqual([
      [0, 0],
      [0, 0],
    ]);
    pushSamples(w, [-0.5]);
    expect(columns(w)[1]).toEqual([-0.5, 0.5]);
  });

  it("scrolls the oldest columns off the left", () => {
    const w = createWaveColumns(2, 1);
    pushSamples(w, [0.25, 0.5, 0.75]);
    expect(columns(w)).toEqual([
      [0.5, 0.5],
      [0.75, 0.75],
    ]);
  });

  it("spreads a span over the width", () => {
    expect(samplesPerColumn(4, 400, 48000)).toBe(480);
  });
});
