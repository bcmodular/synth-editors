// Phase 6 (docs/x32-spec.md, "Tempo bridge"): the tempo from MIDI clock, and the delays set to it only when the button
// is pressed (acceptance test 5, the tempo part). The tests have no MIDI; the page's test clock stands in for the Nome II.
import { expect, test, type Page } from "@playwright/test";
import { fx } from "../src/core/addresses";
import { put } from "./rig";
import { studioDesk } from "./studio";
import { finish, start, status, type X32App } from "./x32";

let running: X32App | undefined;
test.afterEach(async () => finish(running));

const panel = (page: Page) => page.locator(".panel.tempo");
const button = (page: Page) => panel(page).getByRole("button", { name: /^Set delays to/ });

// Clock ticks at a tempo for some beats, from a time in ms.
async function clock(page: Page, bpm: number, beats: number, from = 0): Promise<number> {
  return page.evaluate(({ bpm, beats, from }) => {
    const tick = 60_000 / bpm / 24;
    let at = from;
    for (let i = 0; i < beats * 24; i++) window.x32TestClock!([0xf8], (at += tick));
    return at;
  }, { bpm, beats, from });
}

async function ready(): Promise<X32App> {
  const values = studioDesk();
  put(values, fx(2).type, 12); // Rhythm Delay on the Delay bus
  put(values, fx(3).type, 10); // Stereo Delay on FX 3
  const r = (running = await start({ values }));
  await expect(status(r.page)).toHaveText("Connected");
  await expect(panel(r.page).getByLabel("Clock input")).toHaveValue("Test clock");
  return r;
}

test("shows the tempo and writes the delays only when the button is pressed (acceptance 5)", async () => {
  const r = await ready();
  await expect(panel(r.page).locator(".delays")).toContainText("FX 2 Rhythm Delay (4TAP)");
  await expect(panel(r.page).locator(".delays")).toContainText("FX 3 Stereo Delay (DLY)");
  await expect(button(r.page)).toBeDisabled(); // no clock yet

  let at = await clock(r.page, 120, 3);
  await expect(panel(r.page).locator(".clock")).toHaveText("120.0 BPM");
  await expect(button(r.page)).toHaveText("Set delays to 120.0 BPM");
  await expect(panel(r.page).locator(".delays")).toContainText("→ 250 ms");
  expect(r.fake!.received.filter((m) => m.address.startsWith("/fx/") && m.args.length)).toEqual([]); // nothing yet

  at = await clock(r.page, 90, 0.5, at); // the tempo moves: not settled
  await expect(panel(r.page).locator(".clock")).toContainText("(settling)");
  await expect(button(r.page)).toBeDisabled();
  await clock(r.page, 90, 3, at);
  await expect(panel(r.page).locator(".clock")).toHaveText("90.0 BPM");

  await button(r.page).click();
  await expect(panel(r.page).locator(".outcome")).toContainText("Done: Set the delays to 90 BPM: FX 2 667 ms, FX 3 333 ms");
  expect(r.fake!.get("/fx/2/par/01")).toBeCloseTo(666 / 2999, 3); // a quarter at 90 BPM
  expect(r.fake!.get("/fx/3/par/02")).toBeCloseTo(332 / 2999, 3); // an eighth
  await expect(r.page.locator(".panel.sends .undo")).toHaveCount(0); // not on the undo stack
});

test("a delay set to run free is left alone, and the choice is remembered", async () => {
  const r = await ready();
  await panel(r.page).getByLabel("FX 3 follows the tempo").uncheck();
  await expect(panel(r.page).locator(".delays")).toContainText("runs free");
  await clock(r.page, 120, 3);
  await button(r.page).click();
  await expect(panel(r.page).locator(".outcome")).toContainText("Done: Set the delays to 120 BPM: FX 2 500 ms");
  await r.page.reload();
  await expect(panel(r.page).getByLabel("FX 3 follows the tempo")).not.toBeChecked();
});

test("keeps the last tempo after the clock stops, and can still set it", async () => {
  const r = await ready();
  const at = await clock(r.page, 128, 3);
  await r.page.evaluate((at) => window.x32TestClock!([0xfc], at + 10), at);
  await expect(panel(r.page).locator(".clock")).toHaveText("Stopped at 128.0 BPM");
  await button(r.page).click();
  await expect(panel(r.page).locator(".outcome")).toContainText("Done: Set the delays to 128 BPM");
});
