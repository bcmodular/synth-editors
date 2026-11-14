// The Launchpad Pro (docs/tb3-phase4-design.md), with a fake one beside the TB-3: Programmer layout and the slot
// LEDs, pads recalling slots, DELETE held, MORPH and pad pressure.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { controllerSent, installFakeController, pressController } from "./fakeController";
import { finish, openTestSet, sideButton, slot, start } from "./tb3";
import type { Tb3App } from "./tb3";

const LP = "Launchpad Pro";
const PROGRAMMER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x10, 0x2c, 0x03, 0xf7];

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

async function withLaunchpad(): Promise<Page> {
  running = undefined;
  running = await start();
  const { page } = running;
  await page.addInitScript(installFakeController, LP);
  await page.evaluate(() => {
    localStorage.setItem("port.lpIn", "Launchpad Pro");
    localStorage.setItem("port.lpOut", "Launchpad Pro");
    localStorage.setItem("launchpad.brightness", "normal");
  });
  await page.reload();
  await page.locator(".side").waitFor();
  await openTestSet(page);
  return page;
}


const press = (page: Page, bytes: number[]) => pressController(page, LP, bytes);
const sent = (page: Page) => controllerSent(page, LP);

// The colour each LED was last set to, from every LED message sent.
async function leds(page: Page) {
  const got: Record<number, number[]> = {};
  for (const m of (await sent(page)).filter((m) => m[6] === 0x0b)) {
    for (let i = 7; i + 3 < m.length; i += 4) got[m[i]!] = m.slice(i + 1, i + 4);
  }
  return got;
}
const ledOf = async (page: Page, led: number) => (await leds(page))[led] ?? [0, 0, 0];

test("lights the slots and recalls one from its pad", async () => {
  const page = await withLaunchpad();
  expect((await sent(page))[0]).toEqual(PROGRAMMER);
  await expect.poll(() => ledOf(page, 82)).toEqual([0, 12, 19]); // slot 2, filled: row 1 cyan
  expect(await ledOf(page, 84)).toEqual([0, 0, 0]); // slot 4, empty
  await press(page, [0x90, 82, 100]);
  await press(page, [0x80, 82, 0]);
  await expect(slot(page, 1)).toHaveClass(/active/);
  await expect.poll(() => ledOf(page, 82)).toEqual([6, 63, 14]);
});

test("DELETE held clears slots from their pads", async () => {
  const page = await withLaunchpad();
  await press(page, [0xb0, 50, 127]);
  await expect(page.locator(".slotgrid")).toHaveClass(/delete/);
  await press(page, [0x90, 83, 100]);
  await press(page, [0x80, 83, 0]);
  await press(page, [0xb0, 50, 0]);
  await expect(page.locator(".slotgrid .slot.filled")).toHaveCount(2);
  await expect(page.locator(".slotgrid")).not.toHaveClass(/delete/);
  await expect.poll(() => ledOf(page, 83)).toEqual([0, 0, 0]);
});

test("MORPH picks a target and pad pressure sets the amount", async () => {
  const page = await withLaunchpad();
  await slot(page, 0).click();
  await press(page, [0xb0, 40, 127]);
  await press(page, [0xb0, 40, 0]);
  await press(page, [0x90, 82, 100]);
  await expect(page.locator(".morphname")).toHaveText(/^2 · B/);
  await press(page, [0xa0, 82, 64]);
  await expect(page.locator(".morph .hrow").nth(1)).toContainText("50%");
  await expect.poll(() => ledOf(page, 82)).toEqual([63, 22, 0]);
  await press(page, [0x80, 82, 0]);
  await press(page, [0xb0, 40, 127]);
  await expect(sideButton(page, "morph", "PICK")).not.toHaveClass(/sel/);
});
