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
  const spectrum = page.getByLabel("Spectrum", { exact: true });
  await expect.poll(() => spectrum.evaluate((c) => Number((c as HTMLElement).dataset.peak)), { timeout: 5000 })
    .toBeGreaterThan(-100);
  await page.getByRole("button", { name: "HOLD" }).click();
  await expect(page.getByRole("button", { name: "HOLD" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".scope")).toHaveCount(1);
  await page.getByRole("button", { name: "DESK" }).click();
  await expect(page.locator(".ws[data-pad]").first()).toBeVisible();
});

test("SPECTROGRAM swaps the spectrum for a scrolling spectrogram, and is remembered", async () => {
  const { page } = (running = await start());
  await chooseFakeAudio(page);
  await page.getByRole("button", { name: "SCOPE" }).click();
  await page.getByRole("button", { name: "SPECTROGRAM" }).click();
  await expect(page.getByLabel("Spectrum", { exact: true })).toHaveCount(0);
  // The fake input beeps: look for its bright magma in the right half of what's drawn.
  const bright = () => page.getByLabel("Spectrogram").evaluate((c) => {
    const canvas = c as HTMLCanvasElement;
    const half = Math.floor(canvas.width / 2);
    const px = canvas.getContext("2d")!.getImageData(half, 0, canvas.width - half, canvas.height).data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i]! > 200) n++;
    return n;
  });
  await expect.poll(bright, { timeout: 8000 }).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByLabel("Spectrogram")).toBeVisible();
  await expect(page.getByRole("button", { name: "SPECTROGRAM" })).toHaveAttribute("aria-pressed", "true");
});

test("MIDI clock from the SP-404 shows the tempo", async () => {
  const { page } = (running = await start());
  await chooseFakeAudio(page);
  await page.getByRole("button", { name: "SCOPE" }).click();
  await page.getByRole("button", { name: "2 BARS" }).click();
  await page.evaluate(() => {
    const midi = (window as unknown as { __fakeSp404Midi: { play: (...b: number[]) => void } }).__fakeSp404Midi;
    midi.play(0xfa);
    setInterval(() => midi.play(0xf8), 60_000 / 120 / 24);
  });
  await expect(page.locator(".clocktext")).toContainText(/1[12]\d\.\d BPM/, { timeout: 5000 });
});
