import { describe, expect, it } from "vitest";
import { backupOf, parseBackup } from "./backup";
import { applySettings, readSwitchSettings } from "./switcher";
import { Setting } from "./sysex";
import { currentTarget, settingKey, targetSettings, type Target } from "./targets";
import { testHub, type TestHubInit } from "./testHub";

const TB3: Target = { name: "TB-3", output: 0, channel: 2, pedalCc: null };
const JV: Target = { name: "JV-2080", output: 1, channel: 6, pedalCc: 11 };

async function switchTo(hub: ReturnType<typeof testHub>, t: Target) {
  const current = await readSwitchSettings(hub.io);
  if ("problem" in current) throw new Error(current.problem);
  return applySettings(hub.io, targetSettings(t), current.ok);
}

const freshHub = (init: TestHubInit = {}) => testHub({ settings: { "0:26": [0x3fffffff], "0:25": [1 << 24] }, ...init });

describe("applySettings", () => {
  it("writes a target and reads every write back", async () => {
    const hub = freshHub();
    const report = await switchTo(hub, JV);
    expect(report.problem).toBeUndefined();
    expect(hub.writes()).toEqual(["0:25", "0:26", "3:18", "3:19", "3:20", "3:21", "3:22", "3:23"]);
    const after = await readSwitchSettings(hub.io);
    expect("ok" in after && currentTarget([TB3, JV], after.ok)?.target.name).toBe("JV-2080");
  });

  it("writes nothing the second time (acceptance test 4)", async () => {
    const hub = freshHub();
    await switchTo(hub, TB3);
    const before = hub.writes().length;
    const report = await switchTo(hub, TB3);
    expect(hub.writes()).toHaveLength(before);
    expect(report.written).toEqual([]);
    expect(report.skipped).toHaveLength(7);
  });

  it("writes only what changes between targets", async () => {
    const hub = freshHub();
    await switchTo(hub, TB3);
    const before = hub.writes().length;
    await switchTo(hub, { ...TB3, name: "TB-3 on 3", channel: 3 });
    expect(hub.writes().slice(before)).toEqual(["3:18", "3:19", "3:20", "3:21", "3:22"]); // routing unchanged
  });

  it("refuses to write in another preset", async () => {
    const hub = freshHub({ preset: 1 });
    const report = await switchTo(hub, TB3);
    expect(report.problem).toBe("The H12 is on preset 2: switch it to preset 1 first");
    expect(hub.writes()).toEqual([]);
  });

  it("stops at an error answer and reports it (acceptance test 5)", async () => {
    const hub = freshHub({ failWrite: "3:18" });
    const report = await switchTo(hub, TB3);
    expect(report.problem).toBe("Writing Mapper 18 (Launchkey Note On): the H12 answered error 0x7C (parameter out of range)");
    expect(report.written).toEqual(["Routing of MIDI In 2 (pedal)", "Routing of MIDI In 3 (Launchkey)"]);
    expect(hub.writes()).toEqual(["0:25", "0:26", "3:18"]);
  });

  it("stops when a setting reads back differently (acceptance test 6)", async () => {
    const hub = freshHub({ garble: "0:26" });
    const report = await switchTo(hub, TB3);
    expect(report.problem).toBe("Routing of MIDI In 3 (Launchkey): wrote 00000001 but read back 00000000");
    expect(hub.writes()).toEqual(["0:25", "0:26"]);
  });

  it("refuses a setting outside the allowed list", async () => {
    const hub = freshHub();
    const filter = { label: "Message filter", setting: Setting.messageFilter, index: 30, words: [0] };
    await expect(applySettings(hub.io, [filter], new Map())).rejects.toThrow("Not a setting");
    expect(hub.writes()).toEqual([]);
  });

  it("only ever writes routing of inputs 25 and 26 and mappers 18–23", async () => {
    const hub = freshHub();
    await switchTo(hub, TB3);
    await switchTo(hub, JV);
    expect(hub.writes().every((k) => ["0:25", "0:26"].includes(k) || /^3:(1[89]|2[0-3])$/.test(k))).toBe(true);
  });
});

describe("backup", () => {
  it("restores the H12's previous settings", async () => {
    const hub = freshHub({ settings: { "0:26": [7], "0:25": [8], "3:18": [1, 2, 3, 4, 5, 6] } });
    const first = await readSwitchSettings(hub.io);
    if (!("ok" in first)) throw new Error();
    const backup = parseBackup(JSON.parse(JSON.stringify(backupOf(first.ok, new Date(0)))))!;
    await switchTo(hub, JV);
    const current = await readSwitchSettings(hub.io);
    const report = await applySettings(hub.io, backup.settings, "ok" in current ? current.ok : new Map());
    expect(report.problem).toBeUndefined();
    expect(hub.settings.get("0:26")).toEqual([7]);
    expect(hub.settings.get(settingKey({ setting: 3, index: 18 }))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(hub.settings.get("3:23")).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("refuses a backup that isn't exactly the switch settings", () => {
    const b = backupOf(new Map(), new Date(0));
    expect(parseBackup(b)).toBeUndefined(); // empty words
    expect(parseBackup({ savedAt: "x", settings: [] })).toBeUndefined();
    expect(parseBackup(null)).toBeUndefined();
  });
});
