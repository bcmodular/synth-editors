// Screen grabs for the README, taken against the fake H12 (made-up serial number). Not a test: run
// `npm run readme:shots -w @synth-editors/h12` to retake them after a UI change.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { finish, playH12, playLaunchkey, start, type H12App } from "./h12";

const OUT = fileURLToPath(new URL("../docs/images/", import.meta.url));
const WINDOW = { width: 900, height: 1100 };

let running: H12App | undefined;
test.afterAll(async () => finish(running));

const shot = async (page: Page, name: string, part: Locator) => {
  await page.mouse.move(0, 0);
  await part.screenshot({ path: path.join(OUT, `${name}.png`), scale: "css" });
};

// A few bars of the keys on the JV-2080's channel 8, and the mod wheel: what the Launchkey sends on channel 1, and
// the copy of what the H12 sends the JV.
async function play(page: Page) {
  const both = async (...bytes: number[]) => {
    await playLaunchkey(page, bytes[0]! & 0xf0, ...bytes.slice(1));
    await playH12(page, 8, (bytes[0]! & 0xf0) | 7, ...bytes.slice(1));
  };
  for (const note of [48, 55, 60, 63]) {
    await both(0x90, note, 96);
    await both(0x80, note, 0);
  }
  await both(0xb0, 1, 40);
  await both(0xe0, 0, 0x50);
}

test("README screenshots", async () => {
  // Sync: the Nome II's input lets Start/Stop through, the TR-8S and TB-3 on their own sequencers, the rest External.
  const external = Object.fromEntries([31, 54, 56, 58, 59].map((i) => [`2:${i}`, [0xe200]]));
  const settings = { "0:26": [1 << 1], "0:25": [1 << 1], "2:24": [0], "2:30": [0], "2:32": [0], ...external };
  const r = (running = await start({ settings }));
  await r.page.setViewportSize(WINDOW);
  await r.page.getByRole("button", { name: "Channel 8 for JV-2080" }).click();
  await expect(r.page.getByRole("button", { name: "Channel 8 for JV-2080" })).toHaveAttribute("aria-pressed", "true");
  await r.page.getByLabel(/Copy to the Mac/).click();
  await expect(r.page.getByLabel(/Copy to the Mac/)).toBeChecked();
  await expect(r.page.locator(".monitor .note").first()).not.toContainText("not connected");
  await play(r.page);
  await expect(r.page.locator(".monitor tbody tr")).toHaveCount(22); // 20 MIDI rows, and App rows for the switch and the copy
  await shot(r.page, "targets", r.page.locator(".panel.targets"));
  await shot(r.page, "monitor", r.page.locator(".panel.monitor"));
  await shot(r.page, "sync", r.page.locator(".panel.sync"));
});
