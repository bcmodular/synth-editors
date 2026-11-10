import { afterEach, describe, expect, it, vi } from "vitest";
import type { MidiMessage } from "../core/midi";
import { MidiSender } from "./midiSender";

afterEach(() => vi.useRealTimers());

describe("MidiSender", () => {
  it("sends the first message at once and the rest one per gap, in order", () => {
    vi.useFakeTimers();
    const sent: MidiMessage[] = [];
    const s = new MidiSender((m) => sent.push(m), 2);
    s.send([[0xb0, 83, 3], [0xb0, 19, 127], [0xb0, 16, 64]]);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(4);
    expect(sent).toEqual([[0xb0, 83, 3], [0xb0, 19, 127], [0xb0, 16, 64]]);
  });

  it("keeps only the latest waiting value for a bus and CC", () => {
    vi.useFakeTimers();
    const sent: MidiMessage[] = [];
    const s = new MidiSender((m) => sent.push(m), 2);
    s.send([[0xb0, 16, 1]]);
    s.send([[0xb0, 16, 2]]);
    s.send([[0xb0, 16, 3], [0xb1, 16, 9]]);
    vi.advanceTimersByTime(10);
    expect(sent).toEqual([[0xb0, 16, 1], [0xb0, 16, 3], [0xb1, 16, 9]]);
  });
});
