import { describe, expect, it } from "vitest";
import list from "../targets.json";
import { inUse } from "./mapper";
import { Setting } from "./sysex";
import { currentTarget, parseTargets, settingKey, targetSettings, type Target } from "./targets";

const TB3: Target = { name: "TB-3", output: 0, channel: 2, pedalCc: null };
const JV: Target = { name: "JV-2080", output: 1, channel: 6, pedalCc: 11 };
const SP: Target = { name: "SP-404 Mk2", output: 28, channel: 16, pedalCc: null };

describe("targetSettings", () => {
  it("routes the Launchkey to the target's output only, and the pedal nowhere without a pedal CC", () => {
    const s = targetSettings(SP);
    expect(s.find((v) => v.index === 26 && v.setting === Setting.routing)!.words).toEqual([1 << 28]);
    expect(s.find((v) => v.index === 25 && v.setting === Setting.routing)!.words).toEqual([0]);
    expect(s.some((v) => v.setting === Setting.mapper && v.index === 23)).toBe(false); // mapper 23 left alone
  });

  it("writes mappers 18–22 onto the target's channel, 0-based", () => {
    const mappers = targetSettings(TB3).filter((v) => v.setting === Setting.mapper);
    expect(mappers.map((m) => m.index)).toEqual([18, 19, 20, 21, 22]);
    expect(mappers.every((m) => ((m.words[2]! >>> 24) & 0x0f) === 1 && inUse(m.words))).toBe(true);
  });

  it("routes the pedal with the keys and maps CC 11 to the target's pedal CC", () => {
    const s = targetSettings(JV);
    expect(s.find((v) => v.index === 25 && v.setting === Setting.routing)!.words).toEqual([1 << 1]);
    const pedal = s.find((v) => v.setting === Setting.mapper && v.index === 23)!;
    expect(pedal.label).toBe("Mapper 23 (pedal)");
    expect(pedal.words[1]! >>> 24).toBe(11);
    expect((pedal.words[2]! >>> 24) & 0x0f).toBe(5);
  });

  it("only touches inputs 25 and 26 and mappers 18–23", () => {
    for (const t of [TB3, JV, SP]) {
      for (const v of targetSettings(t)) {
        const ok = v.setting === Setting.routing ? [25, 26].includes(v.index) : v.index >= 18 && v.index <= 23;
        expect(ok).toBe(true);
      }
    }
  });
});

describe("currentTarget", () => {
  const read = (t: Target) => new Map(targetSettings(t).map((v) => [settingKey(v), v.words]));

  it("finds the target whose settings match", () => {
    expect(currentTarget([TB3, JV, SP], read(JV))?.name).toBe("JV-2080");
  });

  it("tells apart targets on one output by their channel", () => {
    const td3: Target = { name: "TD-3-MO", output: 24, channel: 5, pedalCc: null };
    const m300: Target = { name: "TC M300", output: 24, channel: 1, pedalCc: null };
    expect(currentTarget([td3, m300], read(m300))?.name).toBe("TC M300");
  });

  it("finds nothing when a setting differs", () => {
    const current = read(TB3);
    current.set(settingKey({ setting: Setting.routing, index: 26 }), [3]);
    expect(currentTarget([TB3], current)).toBeUndefined();
  });
});

describe("parseTargets", () => {
  it("accepts the bundled list", () => {
    const parsed = parseTargets(list);
    expect("targets" in parsed && parsed.targets).toHaveLength(12);
  });

  it("lists every problem", () => {
    const parsed = parseTargets([
      { name: "A", output: 30, channel: 1, pedalCc: null },
      { name: "B", output: 0, channel: 0, pedalCc: null },
      { name: "C", output: 0, channel: 1, pedalCc: 128 },
      { output: 0, channel: 1, pedalCc: null },
      { name: "A", output: 0, channel: 1, pedalCc: null },
    ]);
    expect(parsed).toEqual({ problems: [
      "A: output must be a port index from 0 to 29",
      "B: channel must be from 1 to 16",
      "C: pedalCc must be null or from 0 to 127",
      "Target 4: no name",
      "A: the name is used twice",
    ] });
  });

  it("refuses something that isn't a list", () => {
    expect(parseTargets({})).toEqual({ problems: ["The target list must be a JSON array"] });
  });
});
