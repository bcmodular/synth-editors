// The read-only check (docs/h12-spec.md, test 1) against the fake H12: finds the SysEx port, shows the firmware
// and preset, reports problems, and never writes.
import { expect, test } from "@playwright/test";
import { facts, finish, sent, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

const isWrite = (d: number[]) => d[0] === 0xf0 && (d[6] === 0x00 || d[6] === 0x03); // an action or a setting write

test("finds the H12 on Port 1 and reads it", async () => {
  const r = (running = await start());
  expect(await facts(r.page)).toMatchObject({
    "SysEx port": "H12MIDI-Pro Port 1", Firmware: "4.7", Serial: "000000010000000200000003", Preset: "1 (Main)",
  });
  await expect(r.page.locator(".problems")).toHaveCount(0);

  const messages = await sent(r.page);
  expect(messages.filter((m) => isWrite(m.data))).toEqual([]);
  // Port 1 answered first time, so no other lane got the request.
  expect(new Set(messages.map((m) => m.port))).toEqual(new Set(["H12MIDI-Pro Port 1"]));
});

test("tries each port in turn until one answers", async () => {
  const r = (running = await start({ answersOn: 3 }));
  expect((await facts(r.page))["SysEx port"]).toBe("H12MIDI-Pro Port 3");
  const firstTried = [...new Set((await sent(r.page)).map((m) => m.port))];
  expect(firstTried).toEqual(["H12MIDI-Pro Port 1", "H12MIDI-Pro Port 2", "H12MIDI-Pro Port 3"]);
});

test("says when no port answers", async () => {
  const r = (running = await start({ answersOn: 0 }));
  await expect(r.page.getByRole("alert")).toContainText("didn't answer on any port");
});

test("warns about old firmware and another preset", async () => {
  const r = (running = await start({ firmware: 0x46, preset: 1 }));
  const f = await facts(r.page);
  expect(f.Firmware).toContain("4.6: older than 4.7");
  expect(f.Preset).toContain("2: switch to preset 1");
});

test("reports an answer with a wrong checksum", async () => {
  const r = (running = await start({ corruptPreset: true }));
  await expect(r.page.locator(".problems")).toContainText("Current preset: the answer's checksum is wrong");
});
