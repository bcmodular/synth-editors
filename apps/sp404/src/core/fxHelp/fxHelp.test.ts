import { describe, expect, it } from "vitest";
import { EFFECTS, effectById } from "../fx";
import { FX_HELP, helpRows, loadsOn } from ".";

describe("effect help", () => {
  it("covers every effect and exactly its parameters", () => {
    expect(Object.keys(FX_HELP).map(Number).sort((a, b) => a - b)).toEqual(EFFECTS.map((fx) => fx.id));
    for (const fx of EFFECTS) {
      const help = FX_HELP[fx.id]!;
      expect(help.summary, fx.name).not.toBe("");
      expect(Object.keys(help.params).sort(), fx.name).toEqual(fx.params.map((p) => p.key).sort());
      for (const text of Object.values(help.params)) expect(text.trim(), fx.name).not.toBe("");
      expect(help.notes.length, fx.name).toBeGreaterThan(0);
    }
  });

  it("shows each parameter's value and range as the SP-404 does, following SYNC", () => {
    const zanZou = effectById(10)!; // TIME follows SYNC (the sixth parameter)
    const off = helpRows(zanZou, [100, 0, 0, 0, 0, 0]);
    expect(off[0]).toMatchObject({ label: "TIME", value: "78", range: "0 – 100" });
    const on = helpRows(zanZou, [127, 0, 0, 0, 0, 127]);
    expect(on[0]!.range).toMatch(/^1\/32 – /);
    expect(on[0]!.text).not.toBe("");
  });

  it("names the buses an effect can load on", () => {
    expect(loadsOn(effectById(1)!)).toBe("Bus 1, Bus 2, Bus 3, Bus 4");
    expect(loadsOn(effectById(46)!)).toBe("Input FX");
  });
});
