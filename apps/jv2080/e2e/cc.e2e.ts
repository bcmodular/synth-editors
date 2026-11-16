// CC learn against the fake JV and its stand-in controller: learning a CC by clicking a control, then driving it.
import { expect, test } from "@playwright/test";
import { setParam } from "../src/core/patch";
import { param } from "../src/core/paramValue";
import { CONTROLLER_PORT, cutoffOf, expectJv, finish, knob, PATCHES, patchTitle, sendCc, start, type JvApp } from "./jv";

let running: JvApp | undefined;
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
  await sendCc(page, 3, 74, 0);
  await expect(page.locator(".learnbar")).toHaveCount(0);

  // Pick-up: the knob must reach the value before it takes over.
  const now = cutoffOf(PATCHES.jv);
  await sendCc(page, 3, 74, 10);
  await expect(cutoff).toHaveAttribute("aria-valuenow", String(now));
  await sendCc(page, 3, 74, now);
  await sendCc(page, 3, 74, 100);
  await expect(cutoff).toHaveAttribute("aria-valuenow", "100");
  await expectJv(page, setParam(PATCHES.jv, param("cutoff"), 100), "the cutoff the controller set");
  await sendCc(page, 4, 74, 100); // another channel: not this CC
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
  await sendCc(page, 1, 71, 77);
  await expect(knob(page, "RESO")).toHaveAttribute("aria-valuenow", "77");
});
