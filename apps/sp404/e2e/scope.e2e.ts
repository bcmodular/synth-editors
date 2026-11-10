// The scopes against Chromium's fake audio input (a tone with beeps; see sp404.ts) and the fake SP-404's MIDI.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { finish, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

const meterLevel = (page: Page) =>
  page.locator(".mx-right .metercanvas").evaluate((c) => Number((c as HTMLElement).dataset.level));

// The fake input isn't named SP-404, so choose it in Settings.
async function chooseFakeAudio(page: Page) {
  await page.getByRole("button", { name: "SETTINGS" }).click();
  const menu = page.getByLabel("AUDIO IN");
  const fake = await menu.locator("option", { hasText: /fake/i }).first().getAttribute("value");
  await menu.selectOption(fake!);
  await page.getByRole("button", { name: "Close settings" }).click();
}

test("the meter asks for an input when there's no SP-404 audio, then meters the chosen one", async () => {
  const { page } = (running = await start());
  await expect(page.locator(".mx-right .audiostatus")).toContainText("No SP-404 audio");
  await chooseFakeAudio(page);
  await expect(page.locator(".mx-right .audiostatus")).toHaveCount(0);
  await expect.poll(() => meterLevel(page), { timeout: 5000 }).toBeGreaterThan(-48);
  await expect(page.getByLabel("Short-term loudness")).toHaveText(/^−\d+\.\d$/, { timeout: 5000 });
});

test("SCOPE swaps the desk for the spectrum and waveforms; HOLD and DESK work; the view is remembered", async () => {
  const { page } = (running = await start());
  await chooseFakeAudio(page);
  await page.getByRole("button", { name: "SCOPE" }).click();
  await expect(page.locator(".wdesk")).toHaveCount(0);
  const spectrum = page.getByLabel("Spectrum");
  await expect.poll(() => spectrum.evaluate((c) => Number((c as HTMLElement).dataset.peak)), { timeout: 5000 })
    .toBeGreaterThan(-100);
  await page.getByRole("button", { name: "HOLD" }).click();
  await expect(page.getByRole("button", { name: "HOLD" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".scope")).toHaveCount(1);
  await page.getByRole("button", { name: "DESK" }).click();
  await expect(page.locator(".ws[data-pad]").first()).toBeVisible();
});

test("MIDI clock from the SP-404 shows the tempo and draws beat lines", async () => {
  const { page } = (running = await start());
  await chooseFakeAudio(page);
  await page.getByRole("button", { name: "SCOPE" }).click();
  await page.getByRole("button", { name: "2 BARS" }).click();
  await page.evaluate(() => {
    const midi = (window as unknown as { __fakeSp404Midi: { play: (...b: number[]) => void } }).__fakeSp404Midi;
    midi.play(0xfa);
    setInterval(() => midi.play(0xf8), 60_000 / 120 / 24);
  });
  await expect(page.locator(".clocktext")).toContainText("BPM", { timeout: 5000 });
  const beats = () => page.getByLabel("Left waveform").evaluate((c) => Number((c as HTMLElement).dataset.beats));
  await expect.poll(beats, { timeout: 5000 }).toBeGreaterThan(1);
});
