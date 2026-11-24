import { describe, expect, it } from "vitest";
import { applySettings, readSettings } from "./switcher";
import {
  allExternal, modeOf, NOME_IN, nomeTransportOpen, setMode, setNomeTransport, SYNC_DEVICES, SYNC_MASK, SYNC_SETTINGS,
  syncState, TRANSPORT, withMode, type Plan,
} from "./sync";
import { testHub } from "./testHub";

const CHANNEL_BITS = 0x7f; // note, CC… : bits the app must never change
const TB3 = SYNC_DEVICES[0]!;
const JV = SYNC_DEVICES[1]!;
const ok = (p: Plan) => ("ok" in p ? p.ok : expect.fail(p.problem));

// Every filter: outputs External (with some other bits set), the Nome II's input blocking transport.
const external = () => new Map<string, number[]>([
  ...SYNC_DEVICES.map((d) => [`2:${30 + d.output}`, [(TRANSPORT | CHANNEL_BITS) >>> 0]] as [string, number[]]),
  [`2:${NOME_IN}`, [TRANSPORT | 1]],
]);

describe("modes", () => {
  it("reads each mode from the sync bits only", () => {
    expect(modeOf(0)).toBe("own");
    expect(modeOf(TRANSPORT | CHANNEL_BITS)).toBe("external");
    expect(modeOf(SYNC_MASK)).toBe("free");
    expect(modeOf(1 << 12)).toBe("custom"); // clock blocked, Start not
  });

  it("changes the sync bits and keeps the rest", () => {
    expect(withMode(CHANNEL_BITS | 0x10000, "free")).toBe((CHANNEL_BITS | 0x10000 | SYNC_MASK) >>> 0);
    expect(withMode(SYNC_MASK | CHANNEL_BITS, "own")).toBe(CHANNEL_BITS);
  });
});

describe("plans", () => {
  it("sets one device, on its own output's filter", () => {
    expect(ok(setMode(external(), TB3, "own"))).toEqual([{ label: "Message filter of TB-3", setting: 2, index: 30,
      words: [CHANNEL_BITS] }]);
  });

  it("offers the JV-2080 no sequencer", () => {
    expect(setMode(external(), JV, "own")).toEqual({ problem: "JV-2080 has no own mode" });
  });

  it("lets Start/Stop through the Nome II's input only when nothing would start", () => {
    const current = external();
    expect(ok(setNomeTransport(current, true))[0]!.words).toEqual([1]); // clock and the other bits kept
    current.set("2:30", [0]); // TB-3 on Own sequencer
    expect(setNomeTransport(current, true)).toEqual({
      problem: "Set these to External or Free first, so nothing starts: TB-3" });
    expect(ok(setNomeTransport(current, false))[0]!.words).toEqual([TRANSPORT | 1]); // blocking again is always fine
  });

  it("sets every device to External", () => {
    const current = external();
    current.set("2:32", [SYNC_MASK]);
    expect(ok(allExternal(current)).find((v) => v.index === 32)!.words).toEqual([TRANSPORT]);
  });

  it("reads the state", () => {
    const state = syncState(external())!;
    expect(state.nomeOpen).toBe(false);
    expect(state.devices.every((d) => d.mode === "external")).toBe(true);
    expect(nomeTransportOpen(0)).toBe(true);
    expect(syncState(new Map())).toBeUndefined();
  });
});

describe("writing through the switcher", () => {
  it("writes a device's mode and reads it back", async () => {
    const hub = testHub({ settings: Object.fromEntries(external()) });
    const before = await readSettings(hub.io, SYNC_SETTINGS);
    const current = "ok" in before ? before.ok : expect.fail("unread");
    const report = await applySettings(hub.io, ok(setMode(current, TB3, "free")), current, SYNC_SETTINGS);
    expect(report).toEqual({ written: ["Message filter of TB-3"], skipped: [] });
    expect(hub.settings.get("2:30")).toEqual([(SYNC_MASK | CHANNEL_BITS) >>> 0]);
  });

  it("refuses a change outside the sync bits (acceptance test 9)", async () => {
    const hub = testHub();
    const current = external();
    const bad = { label: "Message filter of TB-3", setting: 2, index: 30, words: [TRANSPORT] }; // clears note bits
    await expect(applySettings(hub.io, [bad], current, SYNC_SETTINGS)).rejects.toThrow("only bits 0000F200 may change");
    const clock = { label: "Message filter of MIDI In 1 (Nome II)", setting: 2, index: NOME_IN, words: [TRANSPORT | 1 | (1 << 12)] };
    await expect(applySettings(hub.io, [clock], current, SYNC_SETTINGS)).rejects.toThrow("may change");
    expect(hub.writes()).toEqual([]);
  });

  it("refuses a filter outside the list, and routing in the sync list", async () => {
    const hub = testHub();
    const other = { label: "x", setting: 2, index: 33, words: [0] }; // the OXI's output: not a sync device
    await expect(applySettings(hub.io, [other], external(), SYNC_SETTINGS)).rejects.toThrow("Not a setting");
    const routing = { label: "x", setting: 0, index: 26, words: [1] };
    await expect(applySettings(hub.io, [routing], external(), SYNC_SETTINGS)).rejects.toThrow("Not a setting");
  });
});
