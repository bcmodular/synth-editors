// Editor controls that need a real layout to check.
import { expect, test } from "@playwright/test";
import { finish, start } from "./tb3";
import type { Tb3App } from "./tb3";

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

// DISTORTION sits on the bottom row, so its type list has to open upwards to stay in the window.
// In a 1600 px wide window (as tall as the screen allows) opening downwards cut off the longest group.
test("the distortion type list fits in the window", async () => {
  const { app, page } = (running = await start());
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1600, 1000));
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1600);
  const height = await page.evaluate(() => innerHeight);
  await page.locator(".strip .tb3").getByRole("button", { name: "SYNC FROM TB-3" }).click();
  await expect(page.locator(".dist .stepname")).not.toHaveText("–");
  await page.locator(".dist .stepname").click();
  const bottoms = await page
    .locator(".dist .popover button")
    .evaluateAll((bs) => bs.map((b) => [b.getBoundingClientRect().top, b.getBoundingClientRect().bottom]));
  expect(bottoms).toHaveLength(25);
  for (const [top, bottom] of bottoms) {
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(height);
  }
});
