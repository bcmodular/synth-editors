// The keyboard controller on KEYS IN (docs/tb3-phase4-design.md), with a fake one beside the TB-3: notes pass through
// to the TB-3's channel, and CC learn assigns a knob to a parameter.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { efxTypes } from "../src/core/efx";
import { setEfxRaw, setEfxType, setRaw } from "../src/core/patch";
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
  await page.getByRole("slider", { name: "RESONANCE", exact: true }).click();
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

// EFX1 set to COMP (type 1): the patch the TB-3 should hold, and COMP's offset for a slot name.
const COMP = 1;
const compOffset = (name: string) => efxTypes(1)[COMP]!.slots.find((x) => x?.name === name)!.offset;

test("an EFX knob learns a CC, which moves it only while its type is selected", async () => {
  const { page } = t;
  const efx1 = page.locator(".efx1");
  await efx1.getByRole("button", { name: "COMP", exact: true }).click();
  const knob = efx1.locator(".efxknobs").getByRole("slider").first();
  const name = (await knob.getAttribute("aria-label"))!;
  await page.locator(".tb3").getByRole("button", { name: "CC", exact: true }).click();
  await page.locator(".ccsettings").getByRole("button", { name: "LEARN", exact: true }).first().click();
  await knob.click();
  await expect(page.locator(".ccsettings .status")).toContainText(`Move a knob or fader for EFX1 COMP ${name}`);
  await play(page, [0xb0, 22, 5]);
  const row = page.locator(".cclist tr", { hasText: `EFX1 COMP ${name}` });
  await expect(row).toContainText("CC 22");
  await row.locator("select").selectOption("jump");
  await play(page, [0xb0, 22, 127]);
  const comp = setEfxType(t.patches.a, 1, COMP);
  const offset = compOffset(name);
  const max = efxTypes(1)[COMP]!.slots.find((x) => x?.offset === offset)!.max;
  await expectTb3(page, setEfxRaw(comp, 1, offset, max), "the EFX knob at its maximum from the CC");
  await efx1.getByRole("button", { name: "DELAY", exact: true }).click();
  await play(page, [0xb0, 22, 0]); // DELAY is selected: the COMP value stays
  await efx1.getByRole("button", { name: "COMP", exact: true }).click();
  await expectTb3(page, setEfxRaw(comp, 1, offset, max), "unchanged while another type was selected");
});

test("a drawing handle that sets two values asks which one learns the CC", async () => {
  const { page } = t;
  const efx1 = page.locator(".efx1");
  await efx1.getByRole("button", { name: "COMP", exact: true }).click();
  await page.locator(".tb3").getByRole("button", { name: "CC", exact: true }).click();
  await page.locator(".ccsettings").getByRole("button", { name: "LEARN", exact: true }).first().click();
  await efx1.locator(".efxdraw").getByRole("slider", { name: "THRESHOLD" }).locator(".hit").click();
  await page.locator(".dialog").getByRole("button", { name: "GAIN", exact: true }).click();
  await expect(page.locator(".ccsettings .status")).toContainText("Move a knob or fader for EFX1 COMP GAIN");
  await play(page, [0xb0, 23, 5]);
  await expect(page.locator(".cclist tr", { hasText: "EFX1 COMP GAIN" })).toContainText("CC 23");
});
