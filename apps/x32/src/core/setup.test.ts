import { describe, expect, it } from "vitest";
import studio from "../../rig/studio.json";
import type { Param } from "./addresses";
import { applyChanges, NotAllowed, SETUP_ALLOWED } from "./applier";
import type { DeskValue } from "./cache";
import { desiredTargets } from "./desired";
import { int, str, type OscArg } from "./osc";
import { parseRigFile } from "./rigFile";
import { backupName, pickSlots, SCENE_NAME_MAX, sceneSlots } from "./scenes";
import { runSetup } from "./setup";
import { planSetup, type Change } from "./setupPlan";

// An in-memory desk that records what happens, in order.
function memoryDesk(values = new Map<string, DeskValue>(), refuse = new Set<string>()) {
  const log: string[] = [];
  return {
    values, log,
    write: (p: Param, v: DeskValue) => {
      log.push(`write ${p.address}`);
      if (!refuse.has(p.address)) values.set(p.address, v);
    },
    read: async (p: Param) => {
      const v = values.get(p.address);
      if (v === undefined) throw new Error("timeout");
      return v;
    },
    request: async (address: string, args: OscArg[]) => {
      log.push(`${address} ${args.map((a) => a.value).join(" ")}`);
      return { address, args: [str("scene"), int(1)] };
    },
  };
}

const rig = parseRigFile(studio);
const targets = desiredTargets(rig);
const factory = () => new Map<string, DeskValue>(targets.map((t) => [t.param.address, typeof t.value === "string" ? "" : 0]));
const freeSlots = () => sceneSlots(() => undefined);

describe("the desired setup", () => {
  it("only uses allowed addresses", () => {
    expect(targets.filter((t) => !SETUP_ALLOWED.some((r) => r.test(t.param.address))).map((t) => t.param.address)).toEqual([]);
  });
});

describe("applyChanges", () => {
  const change = (address: string, value: DeskValue, step: Change["step"] = 6): Change =>
    ({ area: "channels", step, param: { address, type: "s" }, value, what: address, from: "" });

  it("refuses an address outside the allowed list before writing anything", async () => {
    const desk = memoryDesk();
    const changes = [change("/ch/01/config/name", "Kick"), change("/headamp/000/phantom", 1)];
    await expect(applyChanges(desk, changes, SETUP_ALLOWED)).rejects.toBeInstanceOf(NotAllowed);
    expect(desk.log).toEqual([]);
  });

  it("writes in apply order and reads back", async () => {
    const desk = memoryDesk();
    const result = await applyChanges(desk, [change("/ch/01/config/name", "Kick", 6), change("/config/userrout/in/01", 1, 1)], SETUP_ALLOWED);
    expect(desk.log).toEqual(["write /config/userrout/in/01", "write /ch/01/config/name"]);
    expect(result).toEqual({ written: 2, total: 2, mismatches: [] });
  });

  it("waits for a desk that answers with the old value just after a write", async () => {
    const desk = memoryDesk(new Map([["/config/userrout/in/02", 0]]));
    let stale = 2; // the first two reads after the write still see the old value
    const read = desk.read;
    desk.read = async (p) => (stale-- > 0 ? 0 : read(p));
    const result = await applyChanges(desk, [change("/config/userrout/in/02", 2, 1)], SETUP_ALLOWED);
    expect(result.mismatches).toEqual([]);
  });

  it("stops at the first batch that doesn't read back", async () => {
    const desk = memoryDesk(new Map(), new Set(["/ch/02/config/name"]));
    const changes = Array.from({ length: 40 }, (_, i) => change(`/ch/${String(i + 1).padStart(2, "0")}/config/name`, `C${i}`));
    const result = await applyChanges(desk, changes, SETUP_ALLOWED);
    expect(result.written).toBe(16);
    expect(result.mismatches.map((m) => [m.change.param.address, m.got])).toEqual([["/ch/02/config/name", undefined]]);
  });
});

describe("levels", () => {
  it("match on the desk's step, as the desk sends them back", async () => {
    const zeroDb = 767 / 1023;
    const asSent = Math.fround(zeroDb); // a 32-bit float, as it comes off the wire
    const bus = { area: "buses", step: 6, param: { address: "/bus/03/mix/fader", type: "f" }, value: zeroDb, what: "bus 3 master at 0 dB" } as const;
    expect(planSetup([bus], () => asSent).changes).toEqual([]);
    expect(planSetup([bus], () => 0).changes[0]?.from).toBe(0);
    const desk = memoryDesk(new Map([["/bus/03/mix/fader", asSent]]));
    expect((await applyChanges(desk, [{ ...bus, from: 0 }], SETUP_ALLOWED)).mismatches).toEqual([]);
  });

  it("only bus masters may be written, not channel or main faders", () => {
    expect(SETUP_ALLOWED.some((r) => r.test("/bus/03/mix/fader"))).toBe(true);
    expect(SETUP_ALLOWED.some((r) => r.test("/ch/03/mix/fader"))).toBe(false);
    expect(SETUP_ALLOWED.some((r) => r.test("/main/st/mix/fader"))).toBe(false);
  });
});

describe("scenes", () => {
  it("backs up to the first free slot and reuses Studio base's slot", () => {
    const desk = new Map<string, DeskValue>([
      ["/-show/showfile/scene/001/hasdata", 1], ["/-show/showfile/scene/001/name", "Jam"],
      ["/-show/showfile/scene/004/hasdata", 1], ["/-show/showfile/scene/004/name", "Studio base"],
    ]);
    expect(pickSlots(sceneSlots((a) => desk.get(a)))).toEqual({ backup: 2, base: 4 });
    expect(pickSlots(freeSlots())).toEqual({ backup: 1, base: 2 });
    expect(backupName(new Date("2026-11-22T10:00:00Z"))).toBe("Backup 26-11-22");
    expect(backupName(new Date()).length).toBeLessThanOrEqual(SCENE_NAME_MAX);
  });
});

describe("runSetup", () => {
  it("backs up, applies, reads back and saves Studio base, then has nothing left to do", async () => {
    const desk = memoryDesk(factory());
    const plan = planSetup(targets, (a) => desk.values.get(a));
    const result = await runSetup(desk, plan, { areas: ["routing", "channels", "buses", "outputs", "fx", "card"], slots: freeSlots(), now: new Date("2026-11-22") });
    expect(desk.log[0]).toBe("/save scene 1 Backup 26-11-22 Before setup from the rig file");
    expect(desk.log.at(-1)).toBe("/save scene 2 Studio base Set up from the rig file");
    expect(result).toMatchObject({ backup: 1, base: 2, mismatches: [], written: plan.changes.length });
    expect(planSetup(targets, (a) => desk.values.get(a)).changes).toEqual([]);
  });

  it("applies only the chosen areas", async () => {
    const desk = memoryDesk(factory());
    const plan = planSetup(targets, (a) => desk.values.get(a));
    await runSetup(desk, plan, { areas: ["fx"], slots: freeSlots(), now: new Date() });
    expect(desk.log.filter((l) => l.startsWith("write"))).toHaveLength(6);
  });

  it("doesn't save Studio base when something doesn't read back", async () => {
    const desk = memoryDesk(factory(), new Set(["/fx/1/source/l"]));
    const plan = planSetup(targets, (a) => desk.values.get(a));
    const result = await runSetup(desk, plan, { areas: ["fx"], slots: freeSlots(), now: new Date() });
    expect(result.base).toBeNull();
    expect(desk.log.filter((l) => l.startsWith("/save"))).toHaveLength(1);
  });

  it("does nothing, not even a backup, when there's nothing to change", async () => {
    const desk = memoryDesk(new Map(targets.map((t) => [t.param.address, t.value])));
    const result = await runSetup(desk, planSetup(targets, (a) => desk.values.get(a)), { areas: ["routing"], slots: freeSlots(), now: new Date() });
    expect(result.backup).toBeNull();
    expect(desk.log).toEqual([]);
  });
});
