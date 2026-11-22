import { describe, expect, it } from "vitest";
import studio from "../../rig/studio.json";
import { cardTargets } from "./cardRouting";
import { desiredTargets } from "./desired";
import { parseRigFile } from "./rigFile";

const rig = parseRigFile(studio);
const targets = desiredTargets(rig);
const value = (address: string) => targets.find((t) => t.param.address === address)?.value;

describe("desiredTargets for the studio rig", () => {
  it("routes every channel through its own user-in slot", () => {
    expect(value("/config/routing/IN/1-8")).toBe(20);
    expect(value("/config/routing/IN/25-32")).toBe(23);
    expect(value("/config/userrout/in/03")).toBe(165); // TD-3-MO on aux in 5
    expect(value("/config/userrout/in/11")).toBe(161); // P-6 on aux in 1
    expect(value("/config/userrout/in/21")).toBe(129); // Ableton 1 on card in 1
    expect(value("/config/userrout/in/32")).toBe(140); // Ableton 12 on card in 12
    expect(value("/config/userrout/in/04")).toBe(166); // King Rat on aux in 6
  });

  it("names, links and colours channels, and mutes and whitens the aux strips", () => {
    expect(value("/ch/11/config/name")).toBe("P-6");
    expect(value("/ch/12/config/name")).toBe("P-6");
    expect(value("/config/chlink/11-12")).toBe(1);
    expect(value("/config/chlink/3-4")).toBe(0); // TD-3 and King Rat are both mono
    expect(value("/ch/04/config/color")).toBe(4); // BL
    expect(value("/ch/01/config/color")).toBe(2); // GN, a synth
    expect(value("/auxin/05/mix/on")).toBe(0);
    expect(value("/auxin/05/config/name")).toBe("");
    expect(value("/auxin/05/config/color")).toBe(7); // WH
    expect(value("/auxin/07/mix/on")).toBeUndefined(); // USB L/R left alone
  });

  it("sets bus names, links, taps and outputs", () => {
    expect(value("/bus/11/config/name")).toBe("Sampler");
    expect(value("/config/buslink/1-2")).toBe(1);
    expect(value("/config/buslink/9-10")).toBe(0); // King Rat is mono
    expect(value("/ch/01/mix/11/type")).toBe(3); // pre
    expect(value("/fxrtn/08/mix/03/type")).toBe(4); // post
    expect(value("/ch/01/mix/12/type")).toBeUndefined();
    expect(value("/outputs/aux/06/src")).toBe(12); // bus 9, King Rat
    expect(value("/outputs/main/01/src")).toBe(14); // bus 11, Sampler → SP-404
  });

  it("switches the Sampler's other targets off and unnames the spare buses", () => {
    expect(value("/outputs/main/03/src")).toBe(0); // Koala
    expect(value("/outputs/aux/01/src")).toBe(0); // P-6
    expect(targets.find((t) => t.param.address === "/outputs/aux/02/src")?.what).toBe("aux out 2 off (Sampler → P-6 when switched)");
    expect(value("/bus/10/config/name")).toBe("");
    expect(value("/bus/13/config/color")).toBe(7);
    expect(value("/bus/13/mix/on")).toBeUndefined(); // only aux strips are muted
  });

  it("feeds FX 1-4 from buses 1-8 and leaves the effect types alone", () => {
    expect(value("/fx/1/source/l")).toBe(1);
    expect(value("/fx/2/source/l")).toBe(3);
    expect(value("/fx/4/source/r")).toBe(8);
    expect(targets.some((t) => t.param.address.endsWith("/type") && t.param.address.startsWith("/fx/"))).toBe(false);
  });

  it("never sets phantom power, gain, the main bus, sends or any fader but a bus master", () => {
    const off = /headamp|\/main\/st|\/mix\/\d+\/(on|level)$/;
    const channelFader = (a: string) => a.endsWith("/mix/fader") && !a.startsWith("/bus/");
    expect(targets.filter((t) => off.test(t.param.address) || channelFader(t.param.address))).toEqual([]);
  });

  it("sets the bus masters to 0 dB, after everything else", () => {
    const masters = targets.filter((t) => t.param.address.startsWith("/bus/") && t.param.address.endsWith("/mix/fader"));
    expect(masters.map((t) => t.param.address.slice(5, 7))).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "11", "12"]);
    expect(masters[2]).toMatchObject({ step: 6, what: "bus 3 master at 0 dB" });
  });

  it("sets each address once", () => {
    const addresses = targets.map((t) => t.param.address);
    expect(new Set(addresses).size).toBe(addresses.length);
  });
});

describe("cardTargets", () => {
  const card = cardTargets(rig);
  const v = (address: string) => card.find((t) => t.param.address === address)?.value;

  it("sends ch 1-16 direct outs, post-fader, through P16", () => {
    expect(v("/config/routing/CARD/1-8")).toBe(22);
    expect(v("/config/routing/CARD/9-16")).toBe(23);
    expect(v("/outputs/p16/01/src")).toBe(26);
    expect(v("/outputs/p16/16/src")).toBe(41);
    expect(v("/outputs/p16/01/pos")).toBe(8);
  });

  it("sends card 17-32 through user-out slots and free outputs, never ones the buses use", () => {
    expect(v("/config/routing/CARD/17-24")).toBe(28);
    expect(v("/config/routing/CARD/25-32")).toBe(29);
    expect(v("/config/userrout/out/17")).toBe(177); // Outputs 9
    expect(v("/outputs/main/09/src")).toBe(42); // ch 17 direct
    expect(v("/config/userrout/out/21")).toBe(0); // card 21 unused
    expect(v("/outputs/main/13/src")).toBe(66); // card 23 = FX rtn 1
    expect(v("/config/userrout/out/31")).toBe(203); // aux out 3
    expect(v("/outputs/aux/03/src")).toBe(1); // main L
    for (const n of [1, 2, 3, 4]) expect(v(`/outputs/main/0${n}/src`)).toBeUndefined();
    expect(v("/outputs/aux/01/src")).toBeUndefined();
  });

  it("says when there are too few free outputs", () => {
    const greedy = { ...rig, cardOut: Array.from({ length: 16 }, (_, i) => ({ card: 17 + i, source: { kind: "ch" as const, n: 1 }, tap: "post" as const })) };
    const busy = { ...greedy, buses: [{ ...rig.buses[0]!, buses: [1, 2, 3], outputs: [{ kind: "main" as const, n: 9 }, { kind: "main" as const, n: 10 }, { kind: "main" as const, n: 11 }] }] };
    expect(() => cardTargets(busy)).toThrow("No free output left");
  });
});
