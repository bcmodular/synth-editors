// The Launchkey clock test against fake ports: clock goes to the Launchkey's MIDI port only (never its DAW port or
// the H12), at the set tempo, generated or forwarded from the Nome II.
import { expect, test, type Page } from "@playwright/test";
import { finish, playLaunchkey, playNome, sent, sentTo, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

const LK = "Launchkey MK4 49 MIDI In";
const CLOCK = 0xf8;

const clockTicks = async (page: Page) => (await sentTo(page, LK)).filter((m) => m.data[0] === CLOCK);

// The average gap between scheduled ticks, in ms.
async function spacing(page: Page, from = 0) {
  const times = (await clockTicks(page)).slice(from).map((m) => m.at!);
  return (times.at(-1)! - times[0]!) / (times.length - 1);
}

async function startClock(page: Page) {
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(async () => (await clockTicks(page)).length).toBeGreaterThan(30);
}

test("generates clock at the set tempo on the Launchkey's MIDI port only", async () => {
  const r = (running = await start());
  await r.page.getByLabel("Tempo", { exact: true }).fill("120");
  await startClock(r.page);
  expect(await spacing(r.page)).toBeCloseTo(500 / 24, 1);
  await r.page.getByRole("button", { name: "Stop" }).click();
  await expect(r.page.getByText(/clock ticks sent/)).toHaveCount(0);

  const elsewhere = (await sent(r.page)).filter((m) => m.port !== LK);
  expect(elsewhere.every((m) => m.data[0] === 0xf0 && m.port.startsWith("H12MIDI"))).toBe(true); // only the check
  expect((await sentTo(r.page, LK)).every((m) => m.data.length === 1 && m.data[0] === CLOCK)).toBe(true);
});

test("follows a tempo change without restarting", async () => {
  const r = (running = await start());
  await r.page.getByLabel("Tempo", { exact: true }).fill("120");
  await startClock(r.page);
  const before = (await clockTicks(r.page)).length;
  await r.page.getByLabel("Tempo", { exact: true }).fill("60");
  await expect.poll(async () => (await clockTicks(r.page)).length).toBeGreaterThan(before + 30);
  expect(await spacing(r.page, before + 10)).toBeCloseTo(1000 / 24, 1);
});

test("sends Start before the clock and Stop after it, when asked", async () => {
  const r = (running = await start());
  await r.page.getByLabel("Also send Start, Stop and Continue").check();
  await startClock(r.page);
  await r.page.getByRole("button", { name: "Stop" }).click();
  await expect.poll(async () => (await sentTo(r.page, LK)).at(-1)?.data).toEqual([0xfc]);
  expect((await sentTo(r.page, LK))[0]!.data).toEqual([0xfa]);
});

test("forwards the Nome II's clock, and nothing else", async () => {
  const r = (running = await start());
  await r.page.getByLabel("Forwarded from the Nome II").check();
  await r.page.getByRole("button", { name: "Start" }).click();
  await playNome(r.page, 0xfa); // transport off: not forwarded
  for (let i = 0; i < 5; i++) await playNome(r.page, CLOCK);
  await playNome(r.page, 0x90, 60, 100);
  await playLaunchkey(r.page, CLOCK); // the Launchkey's own clock never goes back to it
  await expect.poll(async () => (await sentTo(r.page, LK)).length).toBe(5);
  expect((await sentTo(r.page, LK)).every((m) => m.data[0] === CLOCK && m.at === undefined)).toBe(true);
});

test("forwards the Nome II's Start and Stop when asked", async () => {
  const r = (running = await start());
  await r.page.getByLabel("Forwarded from the Nome II").check();
  await r.page.getByLabel("Also send Start, Stop and Continue").check();
  await r.page.getByRole("button", { name: "Start" }).click();
  await playNome(r.page, 0xfa);
  await playNome(r.page, CLOCK);
  await playNome(r.page, 0xfc);
  await expect.poll(async () => (await sentTo(r.page, LK)).map((m) => m.data[0])).toEqual([0xfa, CLOCK, 0xfc]);
});
