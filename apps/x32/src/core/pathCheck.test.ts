import { describe, expect, it } from "vitest";
import { memoryDesk, studioShared } from "../../e2e/studio";
import { dca, fader, groups, MAIN, muteGroup, send, strip, stripOn } from "./addresses";
import { checkPath, pathText } from "./pathCheck";
import type { PlanContext } from "./planner";
import { userIn } from "./routing";

function setup() {
  const desk = memoryDesk();
  const ctx: PlanContext = { get: (a) => desk.values.get(a), shared: studioShared };
  return { ctx, set: (p: { address: string }, v: number) => desk.values.set(p.address, v) };
}

describe("checkPath", () => {
  it("finds nothing wrong on a working path, and says what to check outside the desk", () => {
    const { ctx } = setup();
    const r = checkPath(ctx, { source: "TB-3", destination: "Reverb" });
    expect(r.route).toBe("TB-3 (ch 7-8) → Reverb (bus 1-2) → FX 1");
    expect(r.blocks).toEqual([]);
    expect(pathText(r)).toContain("Nothing in the desk's settings stops it");
  });

  it("lists a muted send, a muted channel and a mute group (acceptance 16)", () => {
    const { ctx, set } = setup();
    set(send(strip("ch", 7), 1).on, 0);
    set(stripOn(strip("ch", 8)), 0);
    set(groups(strip("ch", 7)).mute, 0b10);
    set(muteGroup(2), 1);
    expect(checkPath(ctx, { source: "TB-3", destination: "Reverb" }).blocks).toEqual([
      "ch 7 is in mute group 2, which is on", "ch 8 is muted", "ch 7's send to bus 1 is off",
    ]);
  });

  it("only counts the fader and DCAs for a post-fader send", () => {
    const { ctx, set } = setup();
    set(fader(strip("ch", 9)), 0);
    set(groups(strip("ch", 9)).dca, 0b1);
    set(dca(1).on, 0);
    for (const ch of [9, 10]) for (const bus of [3, 4, 11, 12]) set(send(strip("ch", ch), bus).level, 0.75);
    expect(checkPath(ctx, { source: "S-1", destination: "Delay" }).blocks).toEqual([
      "ch 9's fader is at -∞", "ch 9 is in DCA 1, which is muted",
    ]);
    expect(checkPath(ctx, { source: "S-1", destination: "Sampler" }).blocks).toEqual([]); // pre-fader
  });

  it("says when the Sampler goes somewhere else, and gives the device's notes", () => {
    const { ctx } = setup();
    const r = checkPath(ctx, { source: "S-1", destination: "P-6" });
    expect(r.blocks.at(-1)).toBe("the Sampler goes to the SP-404 Mk2, not the P-6 (send to the P-6 to switch it)");
    expect(r.notes[0]).toMatch(/MIX IN/);
  });

  it("checks the way to the main mix, and a channel with no input", () => {
    const { ctx, set } = setup();
    set(MAIN.fader, 0);
    set(userIn(3), 0);
    expect(checkPath(ctx, { source: "TD-3-MO", destination: "main" }).blocks).toEqual(["ch 3 has no input: no socket is routed to it", "the main fader is at -∞"]);
  });
});
