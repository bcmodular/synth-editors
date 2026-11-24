// The editor against the fake JV: reading its patch, edits and undo, the bank browser, a new EFX type's start values,
// and a JV that doesn't answer.
import { expect, test } from "@playwright/test";
import { getParam, setParam } from "../src/core/patch";
import { EFX_TYPES, efxParamOffset, efxStartValue } from "../src/core/efx";
import { param } from "../src/core/paramValue";
import {
  cutoffOf, expectJv, finish, knob, panelEdit, PATCHES, patchTitle, PATCH_CHANNEL, PRESET_PROGRAM, programsChosen, readJv, start,
  type JvApp,
} from "./jv";

let running: JvApp | undefined;
test.afterEach(async () => finish(running));

test("reads the JV's patch on start", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await expect(knob(page, "CUTOFF")).toHaveAttribute("aria-valuenow", String(cutoffOf(PATCHES.jv)));
});

test("an edit goes to the JV, and undo and redo put it back", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  const cutoff = knob(page, "CUTOFF");
  await cutoff.hover();
  await page.mouse.wheel(0, -100); // one notch up
  const edited = setParam(PATCHES.jv, param("cutoff"), cutoffOf(PATCHES.jv) + 1);
  await expectJv(page, edited, "the edited cutoff");
  await expect(page.getByRole("button", { name: "UNDO" })).toHaveAttribute("title", /Cutoff \(tone 1\)/);
  await page.keyboard.press("ControlOrMeta+z");
  await expectJv(page, PATCHES.jv, "the patch from before the edit");
  await expect(cutoff).toHaveAttribute("aria-valuenow", String(cutoffOf(PATCHES.jv)));
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expectJv(page, edited, "the edit again");
});

test("the bank browser chooses the patch on the JV and reads it in; undo goes back", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await page.locator(".bank input.num").fill(String(PRESET_PROGRAM + 1));
  await page.locator(".bank").getByRole("button", { name: "LOAD" }).click();
  await expect(patchTitle(page)).toHaveText("A PRESET");
  expect(await programsChosen(page)).toEqual([PRESET_PROGRAM]);
  const sent = await page.evaluate(() => (window as unknown as { __fakeJv: { sent: number[][] } }).__fakeJv.sent);
  expect(sent.find((m) => (m[0]! & 0xf0) === 0xc0)?.[0]).toBe(0xc0 | PATCH_CHANNEL);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await expectJv(page, PATCHES.jv, "the patch from before the load");
});

test("a new EFX type goes to the JV with its start values", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  const type = 15; // STEP-FLANGER
  await page.locator(".efx .pick-title").first().click();
  await page.locator(`.ch-fx[data-type="${type}"]`).click();
  await expect(page.locator(".efx .pick-title").first()).toHaveText(/STEP-FLANGER/);
  await expect.poll(async () => getParam(await readJv(page), param("efxType"))).toBe(type);
  const common = (await readJv(page))[0]!;
  for (const p of EFX_TYPES[type]!.params) expect(common[efxParamOffset(p.slot)], p.name).toBe(efxStartValue(p));
  await page.keyboard.press("ControlOrMeta+z"); // the type and its values are one step
  await expect.poll(async () => getParam(await readJv(page), param("efxType"))).toBe(getParam(PATCHES.jv, param("efxType")));
});

test("a JV that doesn't answer is reported", async () => {
  const { page } = (running = await start({ silent: true }));
  await expect(page.locator(".read-failed")).toHaveText("NO REPLY FROM THE JV", { timeout: 10_000 });
  await expect(page.locator(".empty")).toContainText("No reply from the JV");
});

test("an edit on the JV's panel shows in the editor", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await panelEdit(page, { block: 2, offset: param("cutoff").offset, bytes: [33] }); // tone 2's cutoff
  await expect(knob(page, "CUTOFF", 1)).toHaveAttribute("aria-valuenow", "33");
  await expect(knob(page, "CUTOFF", 0)).toHaveAttribute("aria-valuenow", String(cutoffOf(PATCHES.jv)));
});

test("the controllers: a destination for tone 1 and an EFX source go to the JV", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await page.getByRole("button", { name: "Controllers" }).click();
  const pop = page.locator(".popover");
  await pop.getByRole("button", { name: "CTRL 2" }).click();
  await pop.locator(".ct-col").first().locator("select").first().selectOption({ label: "CUT" });
  await expect.poll(async () => getParam(await readJv(page), param("ctrl2Dest1"), 0)).toBe(2);
  await pop.getByRole("button", { name: "EFX", exact: true }).click();
  await pop.locator(".ct-efx select").first().selectOption({ label: "AFTERTOUCH" });
  await expect.poll(async () => getParam(await readJv(page), param("efxCtrlSource1"))).toBe(10);
});
