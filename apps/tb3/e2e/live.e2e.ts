// VCO MIX's LIVE view, against Chromium's fake audio input (a tone with beeps; see tb3.ts).
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { finish, start } from "./tb3";
import type { Tb3App } from "./tb3";

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

const vcoMix = (page: Page) => page.locator(".vcosum");
const reading = (page: Page, name: "level" | "correlation" | "spectrum") =>
  vcoMix(page).locator(".wavelanes").evaluate((el, key) => Number((el as HTMLElement).dataset[key]), name);

test("LIVE asks for an input when there's no TB-3 audio, then shows the chosen one's readings", async () => {
  const { page } = (running = await start());
  await vcoMix(page).getByRole("button", { name: "LIVE" }).click();
  await expect(vcoMix(page).locator(".livestatus")).toContainText("No TB-3 audio input");

  await page.locator(".strip .tb3").getByRole("button", { name: "MIDI", exact: true }).click();
  const menu = page.locator(".settings label", { hasText: "AUDIO IN" }).locator("select");
  const fake = await menu.locator("option").nth(1).getAttribute("value");
  expect(fake).toMatch(/fake/i);
  await menu.selectOption(fake!);
  await page.getByRole("button", { name: "CLOSE" }).click();

  await expect(vcoMix(page).locator(".livestatus")).toHaveCount(0);
  await expect.poll(() => reading(page, "level"), { timeout: 5000 }).toBeGreaterThan(-48);
  await expect(vcoMix(page).locator(".lanelabel")).toHaveText(["L", "R"]);
  const corr = await reading(page, "correlation");
  expect(corr).toBeGreaterThanOrEqual(-1);
  expect(corr).toBeLessThanOrEqual(1);

  await vcoMix(page).getByRole("button", { name: "SPECTRUM" }).click();
  await expect(vcoMix(page).getByLabel("Spectrum")).toHaveCount(1);
  await expect(vcoMix(page).locator(".lanelabel")).toHaveCount(0);
  await expect.poll(() => reading(page, "spectrum"), { timeout: 5000 }).toBeGreaterThan(-110);
  await vcoMix(page).getByRole("button", { name: "SPECTROGRAM" }).click();
  await expect(vcoMix(page).getByLabel("Spectrogram")).toHaveCount(1);
});

test("DRAWN goes back to the picture", async () => {
  const { page } = (running = await start());
  await vcoMix(page).getByRole("button", { name: "LIVE" }).click();
  await expect(vcoMix(page).locator(".livewave")).toHaveCount(1);
  await vcoMix(page).getByRole("button", { name: "DRAWN" }).click();
  await expect(vcoMix(page).locator(".livewave")).toHaveCount(0);
  await expect(vcoMix(page).locator("svg.wave")).toHaveCount(1);
});
