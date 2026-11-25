import { describe, expect, it } from "vitest";
import { checkRules, dumpJson, payloadValues, readDump, type Dump } from "./dump";
import { checksum, encodeWord, HEADER, HUB } from "./sysex";
import { testHub } from "./testHub";

const frame = (body: number[]) => [...HEADER, HUB, ...body, checksum(body), 0xf7];

// A rig that keeps every rule: clock only from MIDI In 1, channels 13–14 blocked on synth outputs, only 14 to the OXI.
function good(): Dump {
  const channelFilters = new Array<number>(60).fill(0);
  for (const out of [0, 1, 2, 24, 26, 28, 29]) channelFilters[30 + out] = 0x3000;
  channelFilters[33] = 0xdfff;
  const routing = new Array<number>(30).fill(0);
  routing[24] = 1; // the Nome II
  routing[26] = 2; // the Launchkey, which blocks clock
  const messageFilters = new Array<number>(60).fill(0);
  messageFilters[26] = 1 << 12;
  return { savedAt: "2026-11-24T00:00:00.000Z", routing, channelFilters, messageFilters, mappers: [] };
}

describe("payloadValues", () => {
  it("reads an Int16 (channel filter) or words", () => {
    expect(payloadValues(frame([0x42, 1, 1, 30, 0x00, 0x00, 0x18]))).toEqual([0x3000]);
    expect(payloadValues(frame([0x42, 3, 2, 0, ...encodeWord(5), ...encodeWord(0x5a000000)]))).toEqual([5, 0x5a000000]);
  });
});

describe("readDump", () => {
  it("reads the whole preset, and only reads", async () => {
    const hub = testHub({ settings: { "0:24": [1], "3:23": [1, 2, 3, 4, 5, 6] } });
    const d = await readDump(hub.io, { firmware: "4.7" });
    expect(d.routing).toHaveLength(30);
    expect(d.channelFilters).toHaveLength(60);
    expect(d.messageFilters).toHaveLength(60);
    expect(d.mappers[23]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(hub.writes()).toEqual([]);
    expect(JSON.parse(dumpJson(d)).routing[24]).toBe("00000001");
  });
});

describe("checkRules", () => {
  it("passes a rig that keeps the rules", () => {
    expect(checkRules(good()).every((r) => r.ok)).toBe(true);
  });

  it("counts clock as blocked when the output's filter blocks it", () => {
    const d = good();
    d.messageFilters[26] = 0;
    d.messageFilters[30 + 1] = 1 << 12; // USB host 2 blocks clock
    expect(checkRules(d)[0]!.ok).toBe(true);
  });

  it("names what breaks them", () => {
    const d = good();
    d.messageFilters[26] = 0; // the Launchkey lets clock through
    d.channelFilters[30 + 28] = 0; // the SP-404 gets channels 13–14
    d.channelFilters[33] = 0;
    const r = checkRules(d);
    expect(r.map((x) => x.ok)).toEqual([false, false, false]);
    expect(r[0]!.detail).toBe("Clock can also pass: MIDI In 3 → USB host 2");
    expect(r[1]!.detail).toBe("Not blocked on: SP-404 Mk2");
    expect(r[2]!.detail).toBe("The OXI's output channel filter is 0000, not DFFF");
  });
});
