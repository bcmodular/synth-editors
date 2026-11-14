// EFX drawings (src/editor/efx/): their handles and pads edit the patch and reach the TB-3, as the faders do.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { getEfxRaw } from "../src/core/patch";
import { finish, readTb3, start } from "./tb3";
import type { Tb3App } from "./tb3";

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

const efx2 = (page: Page) => page.locator(".efx").nth(1);
const readout = (page: Page, name: string) =>
  efx2(page)
    .locator(".hrow")
    .filter({ has: page.locator(".lbl", { hasText: new RegExp(`^${name}$`) }) });

async function syncWith(page: Page, type: string) {
  await page.locator(".strip .tb3").getByRole("button", { name: "SYNC FROM TB-3" }).click();
  await expect(efx2(page).locator("h2")).not.toContainText("–");
  await efx2(page).getByRole("button", { name: type, exact: true }).click();
  await expect(efx2(page).locator("h2")).toContainText(type);
}

test("dragging the reverb's TIME handle sets the TB-3 and its readout", async () => {
  const { page } = (running = await start());
  await syncWith(page, "REVERB");
  const time = readout(page, "TIME");
  await expect(time).toHaveClass(/readout/); // set in the drawing: no fader
  await expect(time.locator(".hf")).toHaveCount(0);
  const before = Number.parseFloat((await time.locator(".rv").textContent())!);
  const dx = before < 5 ? 60 : -60;
  const box = (await efx2(page).getByRole("slider", { name: "TIME" }).locator(".hit").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(time.locator(".rv")).not.toHaveText(`${before.toFixed(1)} s`);
  const shown = Number.parseFloat((await time.locator(".rv").textContent())!);
  expect(Math.sign(shown - before)).toBe(Math.sign(dx));
  await expect.poll(async () => getEfxRaw(await readTb3(page), 2, 0x49)).toBe(Math.round(shown * 10));
});

test("a tremolo TYPE pad in the drawing sets the TB-3", async () => {
  const { page } = (running = await start());
  await syncWith(page, "TREMOLO");
  const sqr = efx2(page).getByRole("radio", { name: "SQR" });
  await sqr.click();
  await expect(sqr).toHaveAttribute("aria-checked", "true");
  await expect(readout(page, "TYPE").locator(".rv")).toHaveText("SQR");
  await expect.poll(async () => getEfxRaw(await readTb3(page), 2, 0x19)).toBe(4);
});
