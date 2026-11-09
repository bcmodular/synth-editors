import { describe, expect, it } from "vitest";
import {
  EFFECTS, busChannel, busGroup, canLoad, cc83For, displayValue, effectById, effectsForBus, initialValues,
  paramMode, stepIndex, stepLabels, stepRaw, syncParam,
} from "./fx";
import { BUSES, FX_CCS, type FxParam } from "./fxTypes";
import { VALUE_TABLES } from "./valueTables";

const fx = (name: string) => {
  const found = EFFECTS.find((e) => e.name === name);
  if (!found) throw new Error(name);
  return found;
};
const param = (fxName: string, key: string): FxParam => {
  const p = fx(fxName).params.find((q) => q.key === key);
  if (!p) throw new Error(`${fxName} ${key}`);
  return p;
};

describe("effects table", () => {
  it("has the 46 effects in order, with unique names", () => {
    expect(EFFECTS).toHaveLength(46);
    EFFECTS.forEach((e, i) => expect(e.id).toBe(i + 1));
    expect(new Set(EFFECTS.map((e) => e.name)).size).toBe(46);
    expect(effectById(20)?.name).toBe("Cassette Sim");
  });

  it("uses the knob CCs in order, each once", () => {
    for (const e of EFFECTS) {
      const slots = e.params.map((p) => FX_CCS.indexOf(p.cc));
      expect(slots.every((s, i) => s >= 0 && (i === 0 || s > (slots[i - 1] ?? -1))), e.name).toBe(true);
    }
  });

  it("has a value for every raw value or step", () => {
    for (const e of EFFECTS) {
      for (const p of e.params) {
        for (const mode of [paramMode(p, false), paramMode(p, true)]) {
          if (mode.display in VALUE_TABLES) {
            const table = VALUE_TABLES[mode.display as keyof typeof VALUE_TABLES];
            expect(table.length, `${e.name} ${p.key}`).toBe(mode.starts ? mode.starts.length : 128);
          }
          if (mode.starts) {
            expect(mode.starts[0]).toBe(0);
            expect([...mode.starts].sort((a, b) => a - b)).toEqual(mode.starts);
          }
        }
      }
    }
  });

  it("pairs every synced parameter with a SYNC switch", () => {
    for (const e of EFFECTS) {
      const synced = e.params.filter((p) => p.sync);
      expect(synced.length > 0, e.name).toBe(syncParam(e) !== undefined);
      expect(synced.length).toBeLessThanOrEqual(1);
    }
    expect(EFFECTS.filter((e) => syncParam(e)).map((e) => e.name)).toEqual([
      "Zan-Zou", "To-Gu-Ro", "TimeCtrlDly", "Super Filter", "Flanger", "Phaser", "Wah", "Slicer", "Tremolo/Pan",
      "DJFX Delay",
    ]);
  });

  it("marks the tuning parameters", () => {
    const tuning = EFFECTS.flatMap((e) => e.params.filter((p) => p.tuning).map((p) => `${e.name} ${p.label}`));
    expect(tuning).toEqual([
      "Resonator ROOT", "Resonator CHORD", "Hyper-Reso NOTE", "Hyper-Reso SCALE", "Auto Pitch KEY", "Vocoder NOTE",
      "Vocoder SCALE", "Vocoder CHORD", "Harmony KEY", "Harmony HARMONY",
    ]);
  });
});

describe("buses", () => {
  it("maps buses to groups and channels", () => {
    expect(BUSES.map(busGroup)).toEqual(["bus12", "bus12", "bus34", "bus34", "input"]);
    expect(BUSES.map(busChannel)).toEqual([0, 1, 2, 3, 4]);
  });

  it("lists the effects each bus can load", () => {
    expect(effectsForBus(1)).toHaveLength(42);
    expect(effectsForBus(3)).toHaveLength(40);
    expect(effectsForBus(5)).toHaveLength(17);
    expect(canLoad(fx("Stopper"), 1)).toBe(true);
    expect(canLoad(fx("Stopper"), 3)).toBe(false);
    expect(canLoad(fx("Vocoder"), 5)).toBe(true);
    expect(canLoad(fx("Vocoder"), 2)).toBe(false);
  });

  it("gives every effect a unique CC 83 number within a bus group", () => {
    for (const bus of [1, 3, 5] as const) {
      const values = effectsForBus(bus).map((e) => cc83For(e, bus));
      expect(new Set(values).size).toBe(values.length);
      expect(values.every((v) => v >= 1 && v <= 127)).toBe(true);
    }
    expect(cc83For(fx("Cassette Sim"), 1)).toBe(20);
    expect(cc83For(fx("Cassette Sim"), 4)).toBe(3);
    expect(cc83For(fx("Cassette Sim"), 5)).toBe(14);
  });
});

describe("steps", () => {
  const starts = [0, 43, 86];
  it("finds the step a raw value falls in", () => {
    expect([0, 42, 43, 85, 86, 127].map((r) => stepIndex(starts, r))).toEqual([0, 0, 1, 1, 2, 2]);
  });
  it("gives the raw value at the start of a step, clamped", () => {
    expect([0, 1, 2, 5, -1].map((i) => stepRaw(starts, i))).toEqual([0, 43, 86, 86, 0]);
  });
  it("labels each step", () => {
    expect(stepLabels(param("Zan-Zou", "mode"))).toEqual(["2TAP", "3TAP", "4TAP"]);
    expect(stepLabels(param("Slicer", "speed"))).toEqual([]);
    expect(stepLabels(param("Slicer", "speed"), true).slice(0, 4)).toEqual(["2/1", "1/1D", "2/1T", "1/1"]);
  });
});

describe("display values", () => {
  it("looks up continuous tables by raw value", () => {
    expect(displayValue(param("Filter + Drive", "cutoff"), 0)).toBe("20 Hz");
    expect(displayValue(param("Filter + Drive", "cutoff"), 127)).toBe("16000 Hz");
    expect(displayValue(param("Isolator", "low"), 0)).toBe("-INF");
    expect(displayValue(param("Chromatic PS", "pan1"), 64)).toBe("C");
    expect(displayValue(param("Chromatic PS", "pitch1"), 0)).toBe("-24 semi");
  });

  it("works out the formula displays", () => {
    expect(displayValue(param("Resonator", "bright"), 64)).toBe("50");
    expect(displayValue(param("Resonator", "bright"), 127)).toBe("100");
    expect(displayValue(param("Resonator", "feedback"), 127)).toBe("99%");
    expect(displayValue(param("Resonator", "root"), 60)).toBe("C4");
    expect(displayValue(param("Resonator", "root"), 0)).toBe("C-1");
    expect(displayValue(param("Filter + Drive", "low_gain"), 13)).toBe("-19 dB");
    expect(displayValue(param("Filter + Drive", "low_gain"), 64)).toBe("0 dB");
    expect(displayValue(param("WrmSaturator", "drive"), 127)).toBe("48 dB");
    expect(displayValue(param("Cassette Sim", "age"), 127)).toBe("60");
    expect(displayValue(param("DJFX Looper", "length"), 0)).toBe("0.230 s");
    expect(displayValue(param("DJFX Looper", "length"), 127)).toBe("0.012 s");
    expect(displayValue(param("SBF", "balance"), 64)).toBe("50-50%");
  });

  it("looks up discrete tables by step and leaves words without units", () => {
    expect(displayValue(param("Sync Delay", "l_damp_f"), 0)).toBe("FLAT");
    expect(displayValue(param("Sync Delay", "l_damp_f"), 11)).toBe("80 Hz");
    expect(displayValue(param("Resonator", "chord"), 127)).toBe("M11");
    expect(displayValue(param("Equalizer", "high_freq"), 127)).toBe("16000 Hz");
  });

  it("switches rate and time parameters with SYNC", () => {
    const time = param("TimeCtrlDly", "time");
    expect(displayValue(time, 0)).toBe("10 ms");
    expect(displayValue(time, 127)).toBe("800 ms");
    expect(displayValue(time, 127, true)).toBe("1/1");
    expect(displayValue(param("Super Filter", "rate"), 127, true)).toBe("1/64T");
    expect(displayValue(param("Zan-Zou", "time"), 127)).toBe("100");
    expect(displayValue(param("Flanger", "rate"), 0, true)).toBe("4.000 bar");
    expect(displayValue(param("Flanger", "rate"), 0)).toBe("0");
    expect(displayValue(param("Flanger", "sync"), 64)).toBe("SYNC ON");
  });
});

describe("initial values", () => {
  it("starts continuous parameters in the middle and discrete ones on their first step", () => {
    expect(initialValues(fx("Filter + Drive"))).toEqual([64, 64, 64, 0, 64, 64]);
    expect(initialValues(fx("Zan-Zou"))).toEqual([64, 64, 0, 64, 0, 0]);
  });
});
