// The TypeScript client against the real Lua bridge (on the mock Reaper), through a fake web interface:
// after each request, the bridge script gets one tick, as it would in Reaper.

import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ReaperBridge } from "./bridgeClient.ts";
import { FakeWebInterface } from "./fakeWebInterface.ts";
import { checkBridge, cleanUp, runDemo } from "./tryout.ts";

const driverFile = fileURLToPath(new URL("../../reaper/test/driver.lua", import.meta.url));
const lua = ["lua", "/opt/homebrew/bin/lua", "lua5.4"].find((c) => spawnSync(c, ["-v"]).status === 0);

let child: ChildProcessWithoutNullStreams | undefined;
afterEach(() => child?.kill());

async function luaBackedBridge(): Promise<ReaperBridge> {
  const proc = spawn(lua as string, [driverFile]);
  child = proc;
  const lines = createInterface({ input: proc.stdout })[Symbol.asyncIterator]();
  const fake = new FakeWebInterface();
  const takeExt = async () => {
    const next = await lines.next();
    const { ext } = JSON.parse(next.value as string) as { ext: Record<string, string> };
    fake.ext.clear();
    for (const [k, v] of Object.entries(ext)) fake.ext.set(k, v);
  };
  let now = 0;
  const tick = async () => {
    now += 0.04;
    proc.stdin.write(`${JSON.stringify({ ext: Object.fromEntries(fake.ext), now })}\n`);
    await takeExt();
  };
  await takeExt(); // the keys the script's start() wrote
  const fetchFn = async (input: string | URL | Request) => {
    const response = await fake.fetch(input);
    await tick();
    return response;
  };
  return new ReaperBridge({ url: "http://reaper", fetch: fetchFn as typeof fetch, pollMs: 0 });
}

describe.skipIf(!lua)("client and Lua bridge together", () => {
  it("check, demo and cleanup run through", async () => {
    const bridge = await luaBackedBridge();
    await bridge.request([]); // first tick: the bridge publishes its state
    const log: string[] = [];
    expect(await checkBridge(bridge, (l) => log.push(l))).toBe(true);
    const options = { input: "H12MIDI-Pro Port 3", output: "H12MIDI-Pro Port 2", channel: 6, notes: [36, 38] };
    const guid = await runDemo(bridge, options, (l) => log.push(l));
    const track = (await bridge.snapshot())?.state.tracks.find((t) => t.guid === guid);
    expect(track).toMatchObject({
      name: "SM test",
      part: "sm-test",
      input: { kind: "midi", port: "H12MIDI-Pro Port 3", channel: 6 },
      midiOut: { port: "H12MIDI-Pro Port 2", channel: 6 },
      noteFilter: [36, 38],
      monitor: 0,
      arm: true,
      mute: false,
      solo: 0,
    });
    expect(log.join("\n")).toContain("FX chain read");
    expect(await cleanUp(bridge, () => {})).toBe(1);
    expect((await bridge.snapshot())?.state.tracks.map((t) => t.name)).toEqual(["Existing"]);
  });

  it("the demo stops early on a port Reaper doesn't have", async () => {
    const bridge = await luaBackedBridge();
    await bridge.request([]);
    await expect(runDemo(bridge, { input: "Nope", channel: 1 }, () => {})).rejects.toThrow('no MIDI input called "Nope"');
  });
});
