import { describe, expect, it, vi } from "vitest";
import type { CcAssignment } from "@synth-editors/cc-learn";
import { choose, emptyFxState } from "../fx/fxState";
import { CcApplier, morphTarget, paramTarget, targetLabel, targetOf, type CcFx } from "./ccTargets";

const fakeFx = (over: Partial<CcFx["play"]> = {}) => ({
  state: choose(emptyFxState(), 2, 1), // Filter + Drive on BUS 2: CUTOFF 70
  setValue: vi.fn(),
  play: { morphs: {}, setMorphAmount: vi.fn(), ...over },
}) as unknown as CcFx & { setValue: ReturnType<typeof vi.fn> };

describe("CC targets", () => {
  it("names a bus's slot or morph, with the parameter there now", () => {
    expect(targetOf(paramTarget(2, 0))).toEqual({ kind: "param", bus: 2, slot: 0 });
    expect(targetOf(morphTarget(5))).toEqual({ kind: "morph", bus: 5 });
    expect(targetOf("param:6:0")).toBeUndefined();
    expect(targetOf("param:1:6")).toBeUndefined();
    expect(targetLabel(paramTarget(2, 0), fakeFx())).toBe("BUS 2 · 1 CUTOFF");
    expect(targetLabel(paramTarget(1, 0), fakeFx())).toBe("BUS 1 · 1");
    expect(targetLabel(morphTarget(5), fakeFx())).toBe("INPUT FX · MORPH");
  });

  it("drives the slot through the assignment's mode", () => {
    const list: CcAssignment[] = [
      { channel: null, cc: 20, target: paramTarget(2, 0), mode: "jump" },
      { channel: 3, cc: 21, target: paramTarget(2, 1), mode: "pickup" },
      { channel: null, cc: 22, target: paramTarget(1, 0), mode: "jump" },
    ];
    const fx = fakeFx();
    const a = new CcApplier();
    expect(a.apply(list, { channel: 1, cc: 20, value: 100 }, fx)).toBe(true);
    expect(fx.setValue).toHaveBeenLastCalledWith(2, 0, 100);
    a.apply(list, { channel: 3, cc: 21, value: 0 }, fx); // RESO is 50: pickup waits
    expect(fx.setValue).toHaveBeenCalledTimes(1);
    expect(a.apply(list, { channel: 2, cc: 21, value: 0 }, fx)).toBe(false); // wrong channel
    a.apply(list, { channel: 1, cc: 22, value: 10 }, fx); // no effect on BUS 1
    expect(fx.setValue).toHaveBeenCalledTimes(1);
  });

  it("drives morph only once it has a target", () => {
    const list: CcAssignment[] = [{ channel: null, cc: 30, target: morphTarget(2), mode: "jump" }];
    const idle = fakeFx({ morphs: { 2: { source: [], amount: 0 } } });
    new CcApplier().apply(list, { channel: 1, cc: 30, value: 127 }, idle);
    expect(idle.play.setMorphAmount).not.toHaveBeenCalled();
    const ready = fakeFx({ morphs: { 2: { slot: 0, source: [], amount: 0 } } });
    new CcApplier().apply(list, { channel: 1, cc: 30, value: 127 }, ready);
    expect(ready.play.setMorphAmount).toHaveBeenCalledWith(2, 1);
  });
});
