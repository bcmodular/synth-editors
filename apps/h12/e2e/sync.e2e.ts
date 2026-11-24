// Sync modes against the fake H12: the modes read back, the safe order (every device External before the Nome II's
// input lets Start/Stop through), and only the sync bits of the listed filters written.
import { expect, test, type Page } from "@playwright/test";
import { fakeSetting, finish, settingWrites, start, type H12App } from "./h12";

let running: H12App | undefined;
test.afterEach(async () => finish(running));

const TRANSPORT = 0xe200;
const SYNC = 0xf200;
// As on the real H12: every output passes everything (reads as Own sequencer), with a bit outside the sync bits set
// on the Thru5's filter; the Nome II's input blocks Start/Stop.
const BEFORE = { "2:24": [TRANSPORT], "2:54": [0x80] };

const panel = (page: Page) => page.locator(".panel.sync");
const mode = (page: Page, label: string, device: string) =>
  panel(page).getByRole("button", { name: `${label} for ${device}`, exact: false });

test("refuses to let Start/Stop through until nothing would start, then does", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await expect(mode(r.page, "Own sequencer", "TB-3")).toHaveAttribute("aria-pressed", "true");
  await panel(r.page).getByRole("button", { name: "Let Start/Stop through" }).click();
  await expect(panel(r.page).getByRole("alert")).toContainText("Set these to External or Free first");
  expect(await settingWrites(r.page)).toEqual([]);

  await panel(r.page).getByRole("button", { name: "All External" }).click();
  await expect(panel(r.page).getByRole("status")).toHaveText("Set every device to External: wrote 7 settings.");
  await expect(mode(r.page, "External", "TB-3")).toHaveAttribute("aria-pressed", "true");
  expect(await fakeSetting(r.page, "2:54")).toEqual([TRANSPORT | 0x80]); // the other bit kept

  await panel(r.page).getByRole("button", { name: "Let Start/Stop through" }).click();
  await expect(panel(r.page)).toContainText("lets Start/Stop through");
  expect(await fakeSetting(r.page, "2:24")).toEqual([0]);
  expect((await settingWrites(r.page)).every((k) => k.startsWith("2:"))).toBe(true);
});

test("sets one device's mode, leaving the others", async () => {
  const r = (running = await start({ settings: BEFORE }));
  await mode(r.page, "Free", "TR-8S").click();
  await expect(mode(r.page, "Free", "TR-8S")).toHaveAttribute("aria-pressed", "true");
  expect(await fakeSetting(r.page, "2:32")).toEqual([SYNC]);
  expect(await settingWrites(r.page)).toEqual(["2:32"]);
  await expect(panel(r.page).getByRole("button", { name: "Own sequencer for JV-2080" })).toHaveCount(0);
  await expect(r.page.locator(".monitor tbody tr").first()).toContainText("Set TR-8S to Free");
});

test("shows a mix of bits it doesn't write as custom", async () => {
  const r = (running = await start({ settings: { ...BEFORE, "2:30": [1 << 12] } }));
  await expect(panel(r.page).locator("tr").first()).toContainText("custom bits");
});
