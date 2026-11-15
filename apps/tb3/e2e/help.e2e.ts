// The (i) help panels: a section's help beside a working copy of it, rows lighting up their controls.
import { expect, test } from "@playwright/test";
import { finish, start } from "./tb3";
import type { Tb3App } from "./tb3";

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

test("the filter's (i) explains it beside a working copy, and pointing at a row lights its knob", async () => {
  const { page } = (running = await start());
  await page.locator(".strip .tb3").getByRole("button", { name: "SYNC FROM TB-3" }).click();
  await expect(page.locator(".efx h2").first()).not.toHaveText("–");
  await page.getByRole("button", { name: "About the filter" }).click();
  const help = page.locator(".info-overlay");
  await expect(help.getByRole("dialog")).toContainText("18 dB per octave");
  const row = help.locator(".info-params > div", { hasText: "RESONANCE" });
  const copy = help.locator(".info-side");
  await expect(copy.getByRole("button", { name: "About the filter" })).toHaveCount(0); // no (i) in the copy
  await row.hover();
  await expect(copy.locator(".hot-ctl.hot").getByRole("slider", { name: "RESONANCE" })).toHaveCount(1);
  // The copy works: its knob changes the value the row shows.
  const value = row.locator("dt em");
  const before = Number(await value.textContent());
  await copy.getByRole("slider", { name: "RESONANCE" }).hover();
  await page.mouse.wheel(0, before > 100 ? 100 : -100);
  await expect(value).toHaveText(String(before > 100 ? before - 1 : before + 1));
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
});

test("an EFX's (i) follows its type", async () => {
  const { page } = (running = await start());
  await page.locator(".strip .tb3").getByRole("button", { name: "SYNC FROM TB-3" }).click();
  const efx2 = page.locator(".efx").nth(1);
  await efx2.getByRole("button", { name: "REVERB", exact: true }).click();
  await efx2.getByRole("button", { name: "About EFX2" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("A reverb");
  await page.locator(".info-side").getByRole("button", { name: "DELAY", exact: true }).click();
  await expect(dialog).toContainText("A delay");
  // The voice's flow shows the new type in the EFX2 block.
  await expect(dialog.locator(".vf-block.vf-efx2 .v")).toHaveText("DELAY");
});

test("the voice's flow marks the section, and lights up with its rows", async () => {
  const { page } = (running = await start());
  await page.locator(".strip .tb3").getByRole("button", { name: "SYNC FROM TB-3" }).click();
  await page.getByRole("button", { name: "About the filter" }).click();
  const dialog = page.getByRole("dialog");
  const filter = dialog.locator(".vf-block.vf-vcf.here", { hasText: "FILTER" });
  await expect(filter).toHaveCount(1);
  await dialog.locator(".info-params > div").filter({ has: page.locator("dt", { hasText: /^CUTOFF/ }) }).hover();
  await expect(filter).toHaveClass(/hot/);
  // And the other way: pointing at the LFO block lights the LFO's paths, and of this section's rows only its LFO depth.
  await dialog.locator(".vf-block.vf-lfo").hover();
  await expect(dialog.locator(".vf-edge.vf-lfo.hot").first()).toBeVisible();
  await expect(dialog.locator(".info-params > div.hot dt")).toHaveCount(1);
  await expect(dialog.locator(".info-params > div.hot dt")).toContainText("LFO");
});
