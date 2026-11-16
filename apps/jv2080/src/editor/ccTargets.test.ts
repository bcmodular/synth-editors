import { describe, expect, it } from "vitest";
import { EFX_TYPES } from "../core/efx";
import { getParam, setParam } from "../core/patch";
import { param } from "../core/paramValue";
import { efxTarget, paramTarget, parseTarget, readTarget, targetLabel, writeTarget } from "./ccTargets";
import { demoPatch } from "./demoPatch";
import { efxSlotParam } from "./efx/efxParams";

const patch = demoPatch();
const cutoff = param("cutoff");
const tempo = param("tempo");

describe("CC targets", () => {
  it("name a parameter, in its tone for a tone parameter", () => {
    expect(paramTarget(cutoff, 2)).toBe("param:cutoff:2");
    expect(paramTarget(param("patchLevel"), 2)).toBe("param:patchLevel:0");
    expect(targetLabel("param:cutoff:2")).toBe("Tone 3 · Cutoff");
    expect(targetLabel(efxTarget(15, 1))).toBe("EFX STEP-FLANGER · Pre Delay");
  });

  it("leave out stand-ins that aren't patch parameters", () => {
    expect(paramTarget(efxSlotParam(EFX_TYPES[0]!.params[0]!))).toBeNull();
    expect(parseTarget("param:nope:0")).toBeNull();
    expect(parseTarget("efx:99:0")).toBeNull();
  });

  it("read and write from the parameter's minimum", () => {
    expect(readTarget(patch, "param:tempo:0")).toEqual({ current: getParam(patch, tempo) - 20, max: 230 });
    let written: unknown[] = [];
    writeTarget(patch, "param:tempo:0", 100, (...a) => (written = a));
    expect(written).toEqual([tempo, 120, 0]);
    writeTarget(patch, "param:cutoff:3", 5, (...a) => (written = a));
    expect(written).toEqual([cutoff, 5, 3]);
  });

  it("move an EFX parameter only while its type is selected", () => {
    const type = getParam(patch, param("efxType"));
    const other = setParam(patch, param("efxType"), type + 1);
    const p = EFX_TYPES[type]!.params[0]!;
    expect(readTarget(patch, efxTarget(type, p.slot)).current).not.toBeNull();
    expect(readTarget(other, efxTarget(type, p.slot)).current).toBeNull();
    let calls = 0;
    writeTarget(other, efxTarget(type, p.slot), 3, () => calls++);
    expect(calls).toBe(0);
    writeTarget(patch, efxTarget(type, p.slot), 3, (def, v) => {
      calls++;
      expect([def.offset, v]).toEqual([efxSlotParam(p).offset, 3]);
    });
    expect(calls).toBe(1);
  });
});
