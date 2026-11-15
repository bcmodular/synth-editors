import { describe, expect, it } from "vitest";
import { EFX_TYPES } from "./efx";
import { EFX_HELP } from "./efxHelp";

const entries = Object.entries(EFX_HELP).map(([type, help]) => ({ type: Number(type), help: help! }));

describe("EFX help", () => {
  it.each(entries)("type $type describes exactly its own parameters", ({ type, help }) => {
    const names = EFX_TYPES[type]!.params.map((p) => p.name);
    expect(Object.keys(help.params).sort()).toEqual([...names].sort());
  });

  it.each(entries)("type $type's flow joins nodes that exist and names its own parameters", ({ type, help }) => {
    const names = new Set(EFX_TYPES[type]!.params.map((p) => p.name));
    const ids = new Set(help.flow.nodes.map((n) => n.id));
    expect(ids.size).toBe(help.flow.nodes.length);
    for (const e of help.flow.edges) {
      expect(ids.has(e.from) && ids.has(e.to), `${e.from} → ${e.to}`).toBe(true);
    }
    const used = [...help.flow.nodes.flatMap((n) => n.params ?? []), ...help.flow.edges.flatMap((e) => e.params ?? [])];
    for (const name of used) expect(names.has(name), name).toBe(true);
  });

  it.each(entries)("type $type's balance edges name a balance parameter", ({ type, help }) => {
    for (const e of help.flow.edges.filter((x) => x.kind === "dry" || x.kind === "wet")) {
      const p = EFX_TYPES[type]!.params.find((x) => x.name === e.params?.[0]);
      expect(p?.kind, `${e.from} → ${e.to}`).toBe("balance");
    }
  });
});
