// CC learn (docs/sp404-design.md › Controllers › CC learn) against the fake MIDI ports: LEARN, click a cell, move a
// knob on another controller; the knob then drives the parameter; Settings lists it.
import { expect, test } from "@playwright/test";
import { finish, midiSent, playKnobs, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

test("LEARN, a click on CUTOFF's cell and a knob assign it; the knob then sets CUTOFF", async () => {
  const r = (running = await start());
  await r.page.getByRole("button", { name: "BUS 1 effect" }).click();
  await r.page.getByRole("dialog", { name: "Effects for BUS 1" }).getByRole("button", { name: "Filter + Drive", exact: true }).click();
  await r.page.getByRole("button", { name: "LEARN", exact: true }).click();
  await expect(r.page.locator(".learnbar")).toContainText("Click a parameter");
  await r.page.locator('.bus[data-bus="1"] [data-slot="0"]').click();
  await expect(r.page.locator(".learnbar")).toContainText("BUS 1 · 1 CUTOFF");
  await playKnobs(r.page, 0xb2, 40, 5); // channel 3, CC 40: learned, not applied
  await expect(r.page.locator(".learnbar")).toHaveCount(0);
  const cutoff = r.page.locator('.bus[data-bus="1"]').getByRole("slider", { name: "CUTOFF" });
  await expect(cutoff).toHaveAttribute("aria-valuenow", "70");
  await playKnobs(r.page, 0xb2, 40, 70); // pickup: reaches 70, then follows
  await playKnobs(r.page, 0xb2, 40, 90);
  await expect(cutoff).toHaveAttribute("aria-valuenow", "90");
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 16, 90]);
  await playKnobs(r.page, 0xb3, 40, 10); // another channel: nothing
  await expect(cutoff).toHaveAttribute("aria-valuenow", "90");

  await r.page.getByRole("button", { name: "SETTINGS" }).click();
  const settings = r.page.getByRole("dialog", { name: "Settings" });
  await expect(settings.getByText("BUS 1 · 1 CUTOFF")).toBeVisible();
  await settings.getByRole("combobox", { name: "BUS 1 · 1 CUTOFF mode" }).selectOption("jump");
  await settings.getByRole("button", { name: "CLOSE" }).click();
  await playKnobs(r.page, 0xb2, 40, 10);
  await expect(cutoff).toHaveAttribute("aria-valuenow", "10");
});
