// The clock forwarder against fake ports: always on, the Nome II's clock and transport go to the Launchkey's MIDI
// port only (never its DAW port or the H12), as they arrive.
import { expect, test } from "@playwright/test";
import { finish, playLaunchkey, playNome, sent, sentTo, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

const LK = "Launchkey MK4 49 MIDI In";
const CLOCK = 0xf8;

test("forwards the Nome II's clock, Start, Continue and Stop without being asked, and nothing else", async () => {
  const r = (running = await start());
  await expect(r.page.locator(".panel.clock")).toContainText("Forwarding clock");
  await playNome(r.page, 0xfa);
  for (let i = 0; i < 3; i++) await playNome(r.page, CLOCK);
  await playNome(r.page, 0x90, 60, 100);
  await playNome(r.page, 0xfe); // active sensing
  await playNome(r.page, 0xfc);
  await playNome(r.page, 0xfb);
  await playLaunchkey(r.page, CLOCK); // the Launchkey's own clock never goes back to it
  const forwarded = [0xfa, CLOCK, CLOCK, CLOCK, 0xfc, 0xfb];
  await expect.poll(async () => (await sentTo(r.page, LK)).map((m) => m.data[0])).toEqual(forwarded);
  expect((await sentTo(r.page, LK)).every((m) => m.data.length === 1 && m.at === undefined)).toBe(true);
  const elsewhere = (await sent(r.page)).filter((m) => m.port !== LK);
  expect(elsewhere.every((m) => m.data[0] === 0xf0 && m.port.startsWith("H12MIDI"))).toBe(true); // only SysEx
});
