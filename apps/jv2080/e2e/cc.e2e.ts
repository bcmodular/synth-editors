// CC learn against the fake JV and its stand-in controller: learning a CC by clicking a control, then driving it.
import { expect, test } from "@playwright/test";
import { getParam, setParam } from "../src/core/patch";
import { param } from "../src/core/paramValue";
import { FAKE_ONLY, HW, CONTROLLER_PORT, cutoffOf, expectJv, finish, knob, PATCHES, patchTitle, readJv, sendCc, start, type JvApp } from "./jv";

let running: JvApp | undefined;
test.skip(HW, FAKE_ONLY); // the controller is the fake JV's stand-in
test.afterEach(async () => finish(running));

test("learn a CC for a knob, then the controller moves it on the JV", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await page.getByRole("button", { name: /^CC/ }).click();
  await page.locator(".cc-pop select").first().selectOption(CONTROLLER_PORT);
  await page.locator(".cc-pop").getByRole("button", { name: "LEARN" }).click();
  await expect(page.locator(".learnbar")).toContainText("Click a control");
  const cutoff = knob(page, "CUTOFF");
  await cutoff.click();
  await expect(page.locator(".learnbar")).toContainText("Tone 1 · Cutoff");
  await expect(cutoff).toHaveAttribute("aria-valuenow", String(cutoffOf(PATCHES.jv))); // the click didn't move it
  await sendCc(page, { channel: 3, cc: 74, value: 0 });
  await expect(page.locator(".learnbar")).toHaveCount(0);

  // Pick-up: the knob must reach the value before it takes over.
  const now = cutoffOf(PATCHES.jv);
  await sendCc(page, { channel: 3, cc: 74, value: 10 });
  await expect(cutoff).toHaveAttribute("aria-valuenow", String(now));
  await sendCc(page, { channel: 3, cc: 74, value: now });
  await sendCc(page, { channel: 3, cc: 74, value: 100 });
  await expect(cutoff).toHaveAttribute("aria-valuenow", "100");
  await expectJv(page, setParam(PATCHES.jv, param("cutoff"), 100), "the cutoff the controller set");
  await sendCc(page, { channel: 4, cc: 74, value: 100 }); // another channel: not this CC
  await page.getByRole("button", { name: /^CC 1/ }).click();
  await expect(page.locator(".cclist .cctarget")).toHaveText("Tone 1 · Cutoff");
  await expect(page.locator(".cclist .ccch")).toHaveText("ch 3");
});

test("learned CCs are remembered", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await page.evaluate((port) => {
    localStorage.setItem("jv2080.ctrlIn", port);
    localStorage.setItem("jv2080.cc", JSON.stringify([{ channel: null, cc: 71, target: "param:resonance:0", mode: "jump" }]));
  }, CONTROLLER_PORT);
  await page.reload();
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await sendCc(page, { channel: 1, cc: 71, value: 77 });
  await expect(knob(page, "RESO")).toHaveAttribute("aria-valuenow", "77");
});

test("learn a CC from an envelope point, choosing its level", async () => {
  const { page } = (running = await start());
  await expect(patchTitle(page)).toHaveText("ON THE JV");
  await page.getByRole("button", { name: /^CC/ }).click();
  await page.locator(".cc-pop select").first().selectOption(CONTROLLER_PORT);
  await page.locator(".cc-pop").getByRole("button", { name: "LEARN" }).click();
  await page.locator(".envg").nth(1).locator(".hit").nth(1).click(); // tone 1's filter envelope, the end of stage 2
  await page.locator(".dialog").getByRole("button", { name: "Filter Env L2" }).click();
  await expect(page.locator(".learnbar")).toContainText("Tone 1 · Filter Env L2");
  await sendCc(page, { channel: 1, cc: 20, value: 0 });
  await page.locator(".cc-set button").first().click();
  await page.locator(".cclist select").selectOption("jump");
  await page.keyboard.press("Escape");
  await sendCc(page, { channel: 1, cc: 20, value: 33 });
  await expect.poll(async () => getParam(await readJv(page), param("filterEnvLevel2"), 0)).toBe(33);
});
