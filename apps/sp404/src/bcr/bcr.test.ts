import { describe, expect, it } from "vitest";
import type { MidiMessage } from "../core/midi";
import { BcrLink, ringsFor, type RingSource } from "./bcrLink";
import { bcrCc, parseBcr } from "./bcrMap";

const NONE: RingSource = { fxId: 0, values: [] };
const buses = (over: Partial<Record<1 | 2 | 3 | 4 | 5, RingSource>> = {}) =>
  ({ 1: NONE, 2: NONE, 3: NONE, 4: NONE, 5: NONE, ...over });

function link() {
  const sent: MidiMessage[] = [];
  const l = new BcrLink((m) => sent.push(...m));
  return { l, sent, clear: () => void sent.splice(0) };
}

describe("parseBcr", () => {
  it("reads the TouchOSC preset: bus N on channel 5 + N, slots down the left column then the right", () => {
    expect(parseBcr([0xb5, 81, 10])).toEqual({ kind: "param", bus: 1, slot: 0, value: 10 });
    expect(parseBcr([0xb5, 97, 10])).toEqual({ kind: "param", bus: 1, slot: 2, value: 10 });
    expect(parseBcr([0xb6, 82, 20])).toEqual({ kind: "param", bus: 2, slot: 3, value: 20 });
    expect(parseBcr([0xb9, 98, 30])).toEqual({ kind: "param", bus: 5, slot: 5, value: 30 });
    expect(parseBcr([0xb7, 1, 64])).toEqual({ kind: "morph", bus: 3, value: 64 });
    expect(parseBcr([0xb8, 74, 127])).toEqual({ kind: "button", bus: 4, cc: 74 });
  });

  it("ignores other channels, CCs and message types", () => {
    expect(parseBcr([0xb4, 81, 10])).toBeUndefined(); // channel 5
    expect(parseBcr([0xba, 81, 10])).toBeUndefined(); // channel 11
    expect(parseBcr([0xb5, 2, 10])).toBeUndefined(); // right top encoder
    expect(parseBcr([0xb5, 10, 127])).toBeUndefined(); // top push
    expect(parseBcr([0x95, 81, 10])).toBeUndefined();
    expect(parseBcr([0xb5, 81])).toBeUndefined();
  });

  it("builds feedback on the bus's channel, clamped", () => {
    expect(bcrCc(1, 81, 140)).toEqual([0xb5, 81, 127]);
    expect(bcrCc(5, 1, -3)).toEqual([0xb9, 1, 0]);
  });
});

describe("ringsFor", () => {
  it("shows the values, 0 for missing slots and no effect, and the morph amount", () => {
    const r = ringsFor(buses({ 1: { fxId: 3, values: [1, 2, 3, 4, 5], morph: 0.5 }, 2: { fxId: 0, values: [9, 9] } }));
    expect(r[1]).toEqual([1, 2, 3, 4, 5, 0, 64]);
    expect(r[2]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("BcrLink", () => {
  const want = ringsFor(buses({ 1: { fxId: 1, values: [10, 20, 30, 40, 50, 60] } }));

  it("on connect, darkens every button and sends every ring", () => {
    const { l, sent } = link();
    l.connect(want);
    expect(sent).toContainEqual([0xb5, 65, 0]);
    expect(sent).toContainEqual([0xb9, 74, 0]);
    expect(sent).toContainEqual([0xb5, 81, 10]);
    expect(sent).toContainEqual([0xb5, 98, 60]);
    expect(sent).toContainEqual([0xb9, 1, 0]);
    expect(sent).toHaveLength(5 * 4 + 5 * 7);
  });

  it("sends only the rings that changed", () => {
    const { l, sent, clear } = link();
    l.connect(want);
    clear();
    l.update(ringsFor(buses({ 1: { fxId: 1, values: [10, 20, 31, 40, 50, 60] } })));
    expect(sent).toEqual([[0xb5, 97, 31]]);
  });

  it("drops the first message from a preset (the BCR's stored positions) and sends that preset's rings", () => {
    const { l, sent, clear } = link();
    l.connect(want);
    clear();
    expect(l.receive([0xb5, 81, 99], want)).toBeUndefined();
    expect(sent).toHaveLength(4 * 7); // buses 1–4 again
    expect(sent).toContainEqual([0xb5, 81, 10]);
    clear();
    expect(l.receive([0xb5, 81, 11], want)).toEqual({ kind: "param", bus: 1, slot: 0, value: 11 });
    expect(l.receive([0xb9, 81, 5], want)).toBeUndefined(); // switched to the bus 5 preset
    expect(sent.filter((m) => m[0] === 0xb9)).toHaveLength(7);
    expect(l.receive([0xb9, 81, 6], want)).toEqual({ kind: "param", bus: 5, slot: 0, value: 6 });
  });

  it("doesn't echo what the BCR sent, but puts back a ring the app didn't follow", () => {
    const { l, sent, clear } = link();
    l.connect(want);
    l.receive([0xb5, 81, 10], want);
    clear();
    l.receive([0xb5, 81, 12], want);
    const followed = ringsFor(buses({ 1: { fxId: 1, values: [12, 20, 30, 40, 50, 60] } }));
    l.update(followed);
    expect(sent).toEqual([]);
    l.receive([0xb5, 1, 70], followed); // morph isn't on: the app ignores it
    l.update(followed);
    expect(sent).toEqual([[0xb5, 1, 0]]);
  });

  it("turns a pressed button's LED back off", () => {
    const { l, sent, clear } = link();
    l.connect(want);
    clear();
    expect(l.receive([0xb6, 66, 127], want)).toBeUndefined();
    expect(sent).toEqual([[0xb6, 66, 0]]);
  });
});
