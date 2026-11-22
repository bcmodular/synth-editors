import { describe, expect, it } from "vitest";
import { defaultDesk } from "../../e2e/rig";
import { config, insert, link, send, strip, type Param } from "./addresses";
import type { DeskValue } from "./cache";
import { deriveRig, stripLabel, busName, type Rig } from "./rig";
import { output } from "./routing";

// The fake desk's studio rig, with changes on top.
function rigWith(changes: [Param, DeskValue][] = []): Rig {
  const values = new Map([...defaultDesk()].map(([a, arg]) => [a, arg.value as DeskValue]));
  for (const [p, v] of changes) values.set(p.address, v);
  return deriveRig((a) => values.get(a));
}

const source = (rig: Rig, name: string) => rig.sources.find((s) => s.name === name)!;
const destination = (rig: Rig, name: string) => rig.destinations.find((d) => d.name === name)!;

describe("deriveRig on the studio rig", () => {
  const rig = rigWith();

  it("finds the named sources, stereo pairs as one", () => {
    expect(rig.sources.map((s) => `${stripLabel(s)} ${s.name}`)).toEqual([
      "ch 1 Volca Kick", "ch 2 Volca Bass", "ch 3-4 JV-2080", "ch 5-6 Koala", "ch 7-8 SP-404 Mk2", "ch 9-10 TR-8S",
      "ch 11-12 TB-3", "ch 13 Mic", "ch 14 Guitar", "aux 1-2 P-6", "aux 3-4 S-1", "aux 5 TD-3-MO", "aux 6 King Rat",
      "FX rtn 1-2 Reverb Rtn", "FX rtn 3-4 Delay Rtn", "FX rtn 5-6 FX 3 Rtn",
    ]);
  });

  it("lists the sends that are switched on", () => {
    expect(source(rig, "TR-8S").sends).toEqual([{ bus: 11, level: 0.75, tap: "pre" }]);
    expect(busName(rig, 11)).toBe("P-6");
    expect(busName(rig, 2)).toBe("bus 2");
  });

  it("pairs device feeds with their returns by name, and finds outputs", () => {
    const p6 = destination(rig, "P-6");
    expect(stripLabel(p6)).toBe("bus 11-12");
    expect(p6.deviceReturn && stripLabel(p6.deviceReturn)).toBe("aux 1-2");
    expect(p6.outputs).toEqual(["Aux out 1-2"]);
    expect(destination(rig, "Koala").deviceReturn?.numbers).toEqual([5, 6]);
    expect(destination(rig, "SP-404 Mk2").outputs).toEqual(["XLR out 1-2"]);
    expect(destination(rig, "King Rat").outputs).toEqual(["Aux out 6"]);
  });

  it("works out FX roles from what feeds them", () => {
    expect(destination(rig, "Reverb").fxSlot).toBe(1);
    expect(destination(rig, "Reverb").deviceReturn).toBeNull();
    expect(rig.fx.slice(0, 4).map((f) => f.role)).toEqual(["send", "send", "free", "free"]);
    expect(rig.fx[2]?.sourceBuses).toEqual([13, 14]);
  });

  it("treats unnamed channels as spare and finds nothing odd", () => {
    expect(rig.spare.slice(0, 2)).toEqual([15, 16]);
    expect(rig.spare).not.toContain(1);
    expect(rig.oddities).toEqual([]);
  });
});

describe("deriveRig changes and oddities", () => {
  it("follows a rename", () => {
    const rig = rigWith([[config(strip("bus", 11)).name, "P-6 Mix"], [config(strip("bus", 12)).name, "P-6 Mix"]]);
    expect(rig.destinations.map((d) => d.name)).toContain("P-6 Mix");
    expect(rig.oddities).toEqual([]); // still goes to aux out 1-2: a shared bus, like the Sampler
  });

  it("flags a named bus that goes nowhere", () => {
    const unpatched: [Param, DeskValue][] = [1, 2].map((n) => [output({ kind: "aux", n }), 0]);
    const rig = rigWith([[config(strip("bus", 11)).name, "P-6 Mix"], [config(strip("bus", 12)).name, "P-6 Mix"], ...unpatched]);
    expect(rig.oddities).toEqual(['bus 11-12 "P-6 Mix" has no channel with the same name, feeds no effect and goes to no output']);
  });

  it("marks an FX slot as an insert when a channel inserts it", () => {
    const i = insert(strip("ch", 15));
    const rig = rigWith([[config(strip("ch", 15)).name, "TD-3-MO"], [i.on, 1], [i.sel, 7]]); // FX4L
    expect(rig.fx[3]).toMatchObject({ role: "insert", insertedOn: ["TD-3-MO"] });
    expect(rig.oddities).toContain('Source name "TD-3-MO" is used by ch 15 and aux 5');
  });

  it("reports linked pairs named differently", () => {
    const rig = rigWith([[config(strip("ch", 8)).name, "SP-404 R"]]);
    expect(rig.oddities).toContain('ch 7-8 are linked but named "SP-404 Mk2" and "SP-404 R"');
  });

  it("splits a pair that isn't linked", () => {
    const rig = rigWith([[link(strip("ch", 9)), 0]]);
    expect(rig.sources.filter((s) => s.name === "TR-8S").map(stripLabel)).toEqual(["ch 9", "ch 10"]);
    expect(rig.oddities).toContain('Source name "TR-8S" is used by ch 9 and ch 10');
  });

  it("reports a device return already sent to its own feed", () => {
    const m = send(strip("auxin", 1), 11);
    const rig = rigWith([[m.on, 1], [m.level, 0.75]]);
    expect(rig.oddities).toContain('aux 1-2 "P-6" is sent to its own feed, bus 11-12: a feedback loop');
  });
});
