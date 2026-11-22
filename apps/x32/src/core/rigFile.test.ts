import { describe, expect, it } from "vitest";
import studio from "../../rig/studio.json";
import type { Strip } from "./addresses";
import { busOutputs, parseRange, parseRigFile, parseSockets, parseStrips, RigFileError } from "./rigFile";

const stripName = (s: Strip) => `${s.kind} ${s.n}`;

describe("rig file parts", () => {
  it("parses ranges, strips and sockets", () => {
    expect(parseRange({ value: "5-6", where: "x" })).toEqual([5, 6]);
    expect(parseStrips({ value: "aux 3-4", where: "x" })).toEqual([{ kind: "auxin", n: 3 }, { kind: "auxin", n: 4 }]);
    expect(parseStrips({ value: "fxrtn 1", where: "x" })).toEqual([{ kind: "fxrtn", n: 1 }]);
    expect(parseSockets({ value: "XLR 9-10", where: "x" })).toEqual([9, 10]);
    expect(parseSockets({ value: "aux in 5", where: "x" })).toEqual([165]);
    expect(parseSockets({ value: "card 1", where: "x" })).toEqual([129]);
  });

  it("says where a mistake is", () => {
    expect(() => parseRange({ value: "6-5", where: "sources[2]" })).toThrow("Rig file, sources[2]");
    expect(() => parseStrips({ value: "channel 1", where: "x" })).toThrow(RigFileError);
    expect(() => parseStrips({ value: "ch 33", where: "x" })).toThrow("No ch 33");
    expect(() => parseSockets({ value: "jack 1", where: "x" })).toThrow("isn't a socket");
  });

  it("rejects bad names, colours, icons and mismatched sockets", () => {
    const one = (source: object) => () => parseRigFile({ sources: [source] });
    expect(one({ strip: "ch 1", name: "A name that is far too long" })).toThrow("1-12 characters");
    expect(one({ strip: "ch 1", name: "Kick", colour: "PINK" })).toThrow('colour "PINK"');
    expect(one({ strip: "ch 1", name: "Kick", icon: "Theremin" })).toThrow('icon "Theremin"');
    expect(one({ strip: "ch 1-2", name: "Kick", socket: "XLR 1" })).toThrow("doesn't match the number");
    expect(one({ strip: "aux 1", name: "Kick", socket: "XLR 1" })).toThrow("only channels take a socket");
    expect(() => parseRigFile({ buses: [{ bus: "3-4", name: "Reverb", level: "loud" }] })).toThrow('level "loud"');
    const shared = (targets: unknown, extra = {}) => () => parseRigFile({ buses: [{ bus: "11-12", name: "Sampler", targets, ...extra }] });
    expect(shared([])).toThrow("targets must be a list");
    expect(shared([{ name: "P-6" }])).toThrow('target "P-6": every target needs an output');
    expect(shared([{ name: "P-6", output: "aux out 1" }])).toThrow("doesn't match the number");
    expect(shared([{ name: "P-6", output: "aux out 1-2" }], { output: "XLR out 1-2" })).toThrow("takes its output from the first");
  });
});

describe("the studio rig file", () => {
  const rig = parseRigFile(studio);

  it("parses", () => {
    expect(rig.sources.find((s) => s.name === "P-6")).toMatchObject({
      strips: [{ kind: "ch", n: 11 }, { kind: "ch", n: 12 }], sockets: [161, 162], colour: 6, icon: 32,
    });
    expect(rig.unused.map(stripName)).toEqual(["auxin 1", "auxin 2", "auxin 3", "auxin 4", "auxin 5", "auxin 6", "bus 10", "bus 13", "bus 14", "bus 15", "bus 16"]);
    expect(rig.unusedColour).toBe(7);
    expect(rig.spare).toEqual([]);
    const sampler = rig.buses.find((b) => b.name === "Sampler")!;
    expect(sampler).toMatchObject({ buses: [11, 12], tap: "pre", level: 767 / 1023, outputs: [{ kind: "main", n: 1 }, { kind: "main", n: 2 }] });
    expect(sampler.targets.map((t) => t.name)).toEqual(["SP-404 Mk2", "Koala", "P-6"]);
    expect(busOutputs(sampler)).toHaveLength(6);
    expect(rig.fx.map((f) => f.sourceBuses)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]]);
    expect(rig.cardOut).toHaveLength(30);
    expect(rig.cardOut.at(-1)).toEqual({ card: 32, source: { kind: "main", side: "R" }, tap: "post" });
  });

  it("gives every channel at most one source", () => {
    const channels = [...rig.sources, ...rig.spare].flatMap((s) => s.strips).filter((s) => s.kind === "ch").map((s) => s.n);
    expect(new Set(channels).size).toBe(channels.length);
  });
});
