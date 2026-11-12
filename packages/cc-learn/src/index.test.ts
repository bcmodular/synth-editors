import { describe, expect, it } from "vitest";
import { NO_TAKEOVER, ccValue, findAssignment, forget, learn, parseAssignments, setMode } from "./index";
import type { CcAssignment, CcInput, Takeover } from "./index";

const a = (cc: number, target: string, channel: number | null = 1): CcAssignment => ({
  channel,
  cc,
  target,
  mode: "jump",
});

describe("assignments", () => {
  it("finds by channel and CC, with null matching any channel", () => {
    const list = [a(74, "cutoff"), a(1, "mod", null)];
    expect(findAssignment(list, { channel: 1, cc: 74 })?.target).toBe("cutoff");
    expect(findAssignment(list, { channel: 2, cc: 74 })).toBeUndefined();
    expect(findAssignment(list, { channel: 9, cc: 1 })?.target).toBe("mod");
  });

  it("learning replaces the CC's old target and the target's old CC", () => {
    const list = [a(74, "cutoff"), a(71, "reso")];
    expect(learn(list, a(71, "cutoff"))).toEqual([a(71, "cutoff")]);
    expect(learn(list, a(10, "accent"))).toHaveLength(3);
    expect(learn([a(74, "cutoff", null)], a(74, "reso"))).toEqual([a(74, "reso")]); // a seed on any channel
    expect(learn([a(74, "cutoff", 2)], a(74, "reso"))).toHaveLength(2); // another channel
  });

  it("forgets and changes modes by target", () => {
    const list = [a(74, "cutoff"), a(71, "reso")];
    expect(forget(list, "cutoff")).toEqual([a(71, "reso")]);
    expect(setMode(list, { target: "reso", mode: "pickup" })[1]!.mode).toBe("pickup");
  });

  it("reads stored assignments, dropping bad ones", () => {
    expect(parseAssignments(null)).toBeNull();
    expect(parseAssignments("nope")).toBeNull();
    expect(parseAssignments(JSON.stringify([a(74, "cutoff"), { cc: "x" }, { ...a(1, "m"), mode: "odd" }]))).toEqual([
      a(74, "cutoff"),
    ]);
  });
});

// Runs a sequence of CC values through one assignment; `current` is the target's value before each, unless the
// last value set is kept (current: "follow").
function run(mode: CcInput["mode"], values: number[], start: number | null, max = 127) {
  let t: Takeover = NO_TAKEOVER;
  let current = start;
  const out: (number | null)[] = [];
  for (const value of values) {
    const r = ccValue({ mode, value, current, max }, t);
    t = r.takeover;
    out.push(r.value);
    if (r.value !== null) current = r.value;
  }
  return out;
}

describe("ccValue", () => {
  it("jump follows the knob, scaled to the range", () => {
    expect(run("jump", [0, 64, 127], 30, 255)).toEqual([0, 129, 255]);
    expect(run("jump", [100], null)).toEqual([100]);
  });

  it("relative steps around 64, scaled for wide ranges and clamped", () => {
    expect(run("relative", [65, 65, 62, 64], 10)).toEqual([11, 12, 10, null]);
    expect(run("relative", [66], 100, 255)).toEqual([104]);
    expect(run("relative", [70], 125)).toEqual([127]);
    expect(run("relative", [65], null)).toEqual([null]); // unknown value: nothing to step from
  });

  it("pickup waits for the knob to reach the value, then follows", () => {
    expect(run("pickup", [10, 20, 49, 60, 30], 50)).toEqual([null, null, 49, 60, 30]);
    expect(run("pickup", [10, 90, 91], 50)).toEqual([null, 90, 91]); // jumped across it
  });

  it("pickup lets go when something else moves the value", () => {
    let t: Takeover = NO_TAKEOVER;
    const step = (value: number, current: number) => {
      const r = ccValue({ mode: "pickup", value, current, max: 127 }, t);
      t = r.takeover;
      return r.value;
    };
    expect(step(50, 50)).toBe(50);
    expect(step(52, 50)).toBe(52);
    expect(step(54, 100)).toBeNull(); // a preset recall moved it to 100
    expect(step(101, 100)).toBe(101);
  });
});
