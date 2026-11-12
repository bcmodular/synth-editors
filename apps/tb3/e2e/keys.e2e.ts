// The keyboard controller on KEYS IN (docs/tb3-phase4-design.md), with a fake one beside the TB-3: notes pass through
// to the TB-3's channel, and CC learn assigns a knob to a parameter.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { setRaw } from "../src/core/patch";
import { paramById } from "../src/core/params";
import { installFakeController, pressController } from "./fakeController";
import { expectTb3, finish, HW, openTestSet, slot, start } from "./tb3";
import type { Tb3App } from "./tb3";

const KEYS = "Launchkey MK4";

let t: Tb3App;
let running: Tb3App | undefined;
test.beforeEach(async () => {
  running = undefined;
  t = running = await start();
  const { page } = t;
  await page.addInitScript(installFakeController, KEYS);
  await page.evaluate((name) => localStorage.setItem("port.keysIn", name), KEYS);
  await page.reload();
  await page.locator(".side").waitFor();
  await openTestSet(page);
  await slot(page, 0).click();
  await expectTb3(page, t.patches.a, "slot 1");
});
test.afterEach(async () => finish(running));

const play = (page: Page, bytes: number[]) => pressController(page, KEYS, bytes);


test("notes and pitch bend go to the TB-3 on its channel", async () => {
  test.skip(HW, "checked against the fake TB-3's record");
  const { page } = t;
  await play(page, [0x90, 60, 100]);
  await play(page, [0xe0, 0, 80]);
  await play(page, [0x80, 60, 0]);
  const sent = () => page.evaluate(() => (window as unknown as { __fakeTb3: { sent: number[][] } }).__fakeTb3.sent);
  await expect.poll(async () => (await sent()).filter((m) => m[0] !== 0xf0)).toEqual([
    [0x91, 60, 100],
    [0xe1, 0, 80],
    [0x81, 60, 0],
  ]);
});

test("LEARN, a click on a parameter and a knob assign it; the knob then moves it", async () => {
  const { page } = t;
  await page.locator(".tb3").getByRole("button", { name: "CC", exact: true }).click();
  const list = page.locator(".cclist");
  await expect(list).toContainText("VCF RESONANCE");
  await page.locator(".ccsettings").getByRole("button", { name: "LEARN", exact: true }).first().click();
  await page.locator(".hrow", { has: page.locator(".lbl", { hasText: /^RESONANCE$/ }) }).click();
  await expect(page.locator(".ccsettings .status")).toContainText("Move a knob or fader for VCF RESONANCE");
  await play(page, [0xb0, 21, 5]);
  const row = list.locator("tr", { hasText: "VCF RESONANCE" });
  await expect(row).toContainText("CC 21");
  await expect(row).toContainText("ch 1");
  await expect(list).not.toContainText("CC 71"); // the default it replaced
  await row.locator("select").selectOption("jump");
  await play(page, [0xb0, 21, 127]);
  await expectTb3(page, setRaw(t.patches.a, paramById("vcf_resonance"), 255), "resonance from the knob");
});
