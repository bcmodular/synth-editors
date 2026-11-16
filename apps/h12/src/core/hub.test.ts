import { describe, expect, it } from "vitest";
import { readHub } from "./hub";
import { findSysexPort, type Lane, type Listen } from "./link";
import { Command } from "./sysex";
import { errorAnswer, firmwareAnswer, presetAnswer } from "./testFrames";

interface FakeHubInit {
  answersOn?: string; // the output that answers SysEx
  firmware?: number;
  preset?: number;
  presetError?: boolean; // the preset read is answered with error 0x7F
}

// An H12 with eight virtual cables. Only `answersOn` answers; every request on every lane is recorded.
function fakeHub(init: FakeHubInit = {}) {
  const sent: { lane: string; data: number[] }[] = [];
  const listeners = new Set<(data: number[], input: string) => void>();
  const reply = (data: number[]) => queueMicrotask(() => listeners.forEach((fn) => fn(data, "H12MIDI-Pro Port 1")));
  const answer = (d: number[]) => {
    if (d[6] !== Command.readSetting) return firmwareAnswer(init.firmware ?? 0x47);
    return init.presetError ? errorAnswer(d[6]!, 0x7f) : presetAnswer(init.preset ?? 0);
  };
  const lanes: Lane[] = Array.from({ length: 8 }, (_, i) => ({
    name: `H12MIDI-Pro Port ${8 - i}`,
    send(data) {
      sent.push({ lane: this.name, data });
      if (this.name === (init.answersOn ?? "H12MIDI-Pro Port 1")) reply(answer(data));
    },
  }));
  const listen: Listen = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  return { lanes, listen, sent };
}

describe("findSysexPort", () => {
  it("asks Port 1 first and stops when it answers", async () => {
    const hub = fakeHub();
    const probe = await findSysexPort(hub.lanes, hub.listen);
    expect(probe.kind).toBe("found");
    expect(hub.sent.map((s) => s.lane)).toEqual(["H12MIDI-Pro Port 1"]);
  });

  it("goes on to the next port until one answers", async () => {
    const hub = fakeHub({ answersOn: "H12MIDI-Pro Port 3" });
    const probe = await findSysexPort(hub.lanes, hub.listen);
    expect(probe.kind === "found" && probe.lane.name).toBe("H12MIDI-Pro Port 3");
    expect(hub.sent.map((s) => s.lane)).toEqual(["H12MIDI-Pro Port 1", "H12MIDI-Pro Port 2", "H12MIDI-Pro Port 3"]);
  });

  it("says when nothing answers", async () => {
    const hub = fakeHub({ answersOn: "none" });
    expect(await findSysexPort(hub.lanes.slice(0, 2), hub.listen)).toEqual({
      kind: "silent", tried: ["H12MIDI-Pro Port 7", "H12MIDI-Pro Port 8"],
    });
  });
});

async function check(init: FakeHubInit = {}) {
  const hub = fakeHub(init);
  const probe = await findSysexPort(hub.lanes, hub.listen);
  if (probe.kind !== "found") throw new Error("no answer");
  return { report: await readHub(probe.lane, probe.reply, hub.listen), sent: hub.sent };
}

describe("readHub", () => {
  it("reads the firmware and preset", async () => {
    const { report } = await check();
    expect(report).toMatchObject({
      output: "H12MIDI-Pro Port 1", input: "H12MIDI-Pro Port 1", firmwareOk: true, preset: { index: 0 }, problems: [],
    });
    expect(report.firmware?.version).toBe("4.7");
  });

  it("flags firmware older than 4.7", async () => {
    const { report } = await check({ firmware: 0x46 });
    expect(report.firmwareOk).toBe(false);
    expect(report.firmware?.version).toBe("4.6");
  });

  it("reports an error answer", async () => {
    const { report } = await check({ presetError: true });
    expect(report.preset).toBeUndefined();
    expect(report.problems).toEqual(["Current preset: the H12 answered error 0x7F (unknown command or parameter)"]);
  });

  it("only ever reads", async () => {
    const { sent } = await check();
    expect(sent.every((s) => s.data[6] === Command.readStatus || s.data[6] === Command.readSetting)).toBe(true);
  });
});
