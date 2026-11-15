// EFX panels: the drawings' handles and pads (src/editor/efx/) and the knobs beside them edit the patch and reach the
// TB-3.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { getEfxRaw } from "../src/core/patch";
import { finish, readTb3, start } from "./tb3";
import type { Tb3App } from "./tb3";

let running: Tb3App | undefined;
test.afterEach(async () => finish(running));

const efx2 = (page: Page) => page.locator(".efx").nth(1);
async function syncWith(page: Page, type: string) {
  await page.locator(".strip .tb3").getByRole("button", { name: "SYNC FROM TB-3" }).click();
  await expect(efx2(page).locator("h2")).not.toContainText("–");
  await efx2(page).getByRole("button", { name: type, exact: true }).click();
  await expect(efx2(page).locator("h2")).toContainText(type);
}

test("dragging the reverb's TIME handle sets the TB-3 and the value it shows", async () => {
  const { page } = (running = await start());
  await syncWith(page, "REVERB");
  const handle = efx2(page).getByRole("slider", { name: "TIME", exact: true });
  await expect(handle).toHaveCount(1); // set in the drawing: no knob for it
  const valueOf = async () => Number.parseFloat((await handle.getAttribute("aria-valuetext"))!);
  const before = await valueOf();
  const dx = before < 5 ? 60 : -60;
  const box = (await handle.locator(".hit").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(valueOf).not.toBe(before);
  const shown = await valueOf();
  expect(Math.sign(shown - before)).toBe(Math.sign(dx));
  await expect.poll(async () => getEfxRaw(await readTb3(page), 2, 0x49)).toBe(Math.round(shown * 10));
});

test("a reverb knob sets the TB-3", async () => {
  const { page } = (running = await start());
  await syncWith(page, "REVERB");
  const knob = efx2(page).getByRole("slider", { name: "DENSITY", exact: true });
  const before = Number(await knob.getAttribute("aria-valuenow"));
  await knob.hover();
  await page.mouse.wheel(0, before < 5 ? -100 : 100);
  const after = before < 5 ? before + 1 : before - 1;
  await expect(knob).toHaveAttribute("aria-valuenow", String(after));
  await expect.poll(async () => getEfxRaw(await readTb3(page), 2, 0x4d)).toBe(after);
});

test("a tremolo TYPE pad in the drawing sets the TB-3", async () => {
  const { page } = (running = await start());
  await syncWith(page, "TREMOLO");
  const sqr = efx2(page).getByRole("radio", { name: "SQR" });
  await sqr.click();
  await expect(sqr).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => getEfxRaw(await readTb3(page), 2, 0x19)).toBe(4);
});
