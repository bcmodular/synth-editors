import { describe, expect, it } from "vitest";
import { efxTypes } from "../efx";
import { paramById } from "../params";
import {
  AMP_HELP, CROSS_MOD_HELP, DIST_HELP, EFX_TYPE_HELP, FILTER_HELP, LFO_HELP, OSCILLATORS_HELP, PERFORM_HELP, PORTA_HELP,
  RING_MOD_HELP,
} from ".";

const SECTIONS = [
  OSCILLATORS_HELP, CROSS_MOD_HELP, RING_MOD_HELP, FILTER_HELP, AMP_HELP, LFO_HELP, DIST_HELP, PERFORM_HELP, PORTA_HELP,
];

describe("section help", () => {
  it.each(SECTIONS.map((h) => [h.title, h] as const))("%s names real parameters and says something about each", (_, h) => {
    expect(h.summary.length).toBeGreaterThan(20);
    for (const row of h.rows) {
      expect(row.text.length).toBeGreaterThan(10);
      for (const id of row.ids) expect(() => paramById(id)).not.toThrow();
    }
  });
});

describe("EFX help", () => {
  const types = [...efxTypes(1), ...efxTypes(2)];

  it("covers every type", () => {
    for (const t of types) expect(EFX_TYPE_HELP[t.name], t.name).toBeDefined();
  });

  it("describes every slot of every type, and only real slots", () => {
    for (const t of types) {
      const names = t.slots.filter((s) => s !== null).map((s) => s!.name);
      const help = EFX_TYPE_HELP[t.name]!;
      expect(Object.keys(help.params).sort(), t.name).toEqual([...new Set(names)].sort());
    }
  });

  it("explains the mode buttons of every type that has them", () => {
    for (const t of types) if (t.buttons.some(Boolean)) expect(EFX_TYPE_HELP[t.name]!.modes, t.name).toBeDefined();
  });
});
