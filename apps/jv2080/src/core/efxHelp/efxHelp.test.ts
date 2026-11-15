import { describe, expect, it } from "vitest";
import { EFX_TYPES } from "../efx";
import { EFX_HELP, gainOf, paramHelp } from ".";

const types = EFX_TYPES.map((t, type) => ({ type, name: t.name, t, help: EFX_HELP[type]! }));

describe("EFX help", () => {
  it("covers all 40 types", () => {
    expect(EFX_HELP).toHaveLength(EFX_TYPES.length);
  });

  it.each(types)("$type $name describes every parameter, and only its own", ({ type, t, help }) => {
    for (const p of t.params) expect(paramHelp(type, p.name), p.name).toBeTruthy();
    const names = new Set(t.params.map((p) => p.name));
    for (const name of Object.keys(help.params ?? {})) expect(names.has(name), name).toBe(true);
  });

  it.each(types)("$type $name's flow joins nodes that exist and names its own parameters", ({ t, help }) => {
    const names = new Set(t.params.map((p) => p.name));
    const ids = new Set(help.flow.nodes.map((n) => n.id));
    expect(ids.size, "node ids are unique").toBe(help.flow.nodes.length);
    for (const e of help.flow.edges) expect(ids.has(e.from) && ids.has(e.to), `${e.from} → ${e.to}`).toBe(true);
    const used = [
      ...help.flow.nodes.flatMap((n) => n.params ?? []),
      ...help.flow.edges.flatMap((e) => [...(e.params ?? []), ...(e.gains ?? []).map((g) => g.param), ...(e.when ? [e.when.param] : [])]),
    ];
    for (const name of used) expect(names.has(name), name).toBe(true);
  });

  it.each(types)("$type $name's flow runs from both inputs to both outputs", ({ help }) => {
    const ids = help.flow.nodes.map((n) => n.id);
    for (const id of ["inL", "inR", "outL", "outR"]) expect(ids).toContain(id);
    const reach = (from: string) => {
      const seen = new Set([from]);
      for (let grew = true; grew;) {
        grew = false;
        for (const e of help.flow.edges) if (e.route !== "loop" && seen.has(e.from) && !seen.has(e.to)) grew = seen.add(e.to) && true;
      }
      return seen;
    };
    expect(reach("inL").has("outL")).toBe(true);
    expect(reach("inR").has("outR")).toBe(true);
  });

  it("gains follow balances and pans", () => {
    const bal = EFX_TYPES[35]!.params.find((p) => p.name === "Delay Balance")!;
    expect([gainOf(bal, 0, "left"), gainOf(bal, 0, "right")]).toEqual([1, 0]);
    expect(gainOf(bal, 100, "right")).toBe(1);
    const pan = EFX_TYPES[1]!.params.find((p) => p.name === "Pan")!;
    expect([gainOf(pan, 64, "left"), gainOf(pan, 64, "right")]).toEqual([1, 1]);
    expect([gainOf(pan, 0, "left"), gainOf(pan, 0, "right")]).toEqual([1, 0]);
  });
});
