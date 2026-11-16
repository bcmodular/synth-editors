// The firmware check (core/firmware.ts) against the fake SP-404's MIDI: its Identity Reply sets the FW pill, and an
// untested version warns until accepted.
import { expect, test } from "@playwright/test";
import { finish, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

test("firmware 5.52 shows quietly", async () => {
  const r = (running = await start());
  await expect(r.page.getByText("FW 5.52")).toBeVisible();
  await expect(r.page.locator(".fw-warn")).toHaveCount(0);
});

test("another firmware warns; a click accepts it", async () => {
  const r = (running = await start(undefined, { firmware: [0, 5, 6, 0] }));
  const warn = r.page.getByRole("alert").filter({ hasText: "FW 5.60 · UNTESTED" });
  await expect(warn).toBeVisible();
  await warn.click();
  await expect(r.page.getByText("FW 5.60", { exact: true })).toBeVisible();
});
