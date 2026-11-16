// The Launchpad Pro (docs/sp404-design.md › Controllers › Launchpad Pro) against the fake MIDI ports: Programmer
// layout on connect, its buttons and pads driving the FX, its LEDs following.
import { expect, test } from "@playwright/test";
import { finish, launchpadLed, launchpadSent, midiSent, playLaunchpad, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

const NOTE = 0x90;
const CC = 0xb0;
const PINK = [63, 23, 39]; // BUS 1's colour, full

test("on connect it goes into Programmer layout on the Standalone port, and the pill lights", async () => {
  const r = (running = await start());
  await expect(r.page.getByText("LAUNCHPAD ●")).toBeVisible();
  const sent = await launchpadSent(r.page);
  expect(sent[0]).toEqual([0xf0, 0x00, 0x20, 0x29, 0x02, 0x10, 0x2c, 0x03, 0xf7]);
  await expect.poll(() => launchpadLed(r.page, 3)).toEqual([11, 0, 0]); // LOCK 3, idle red (night)
});

test("Device + a bus button chooses an effect on the grid; the bus button then switches it", async () => {
  const r = (running = await start());
  await playLaunchpad(r.page, CC, 97, 127);
  await playLaunchpad(r.page, CC, 91, 127);
  await playLaunchpad(r.page, CC, 91, 0);
  await playLaunchpad(r.page, CC, 97, 0);
  await expect.poll(() => launchpadLed(r.page, 81)).not.toEqual([0, 0, 0]); // Filter + Drive's cell
  await playLaunchpad(r.page, NOTE, 81, 100);
  await playLaunchpad(r.page, NOTE, 81, 0);
  await expect.poll(() => launchpadLed(r.page, 81)).toEqual([63, 63, 63]); // marked
  await playLaunchpad(r.page, NOTE, 81, 100);
  await playLaunchpad(r.page, NOTE, 81, 0);
  await expect(r.page.getByRole("button", { name: "BUS 1 effect" })).toHaveText("FILTER + DRIVE");
  await expect.poll(() => launchpadLed(r.page, 91)).toEqual(PINK);

  await expect.poll(async () => (await midiSent(r.page)).length).toBe(8); // the effect's block
  await playLaunchpad(r.page, CC, 91, 127);
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 19, 0]);
  await expect.poll(() => launchpadLed(r.page, 91)).not.toEqual(PINK);
});

test("a preset pad stores and recalls; scenes too; Delete held deletes", async () => {
  const r = (running = await start());
  await r.page.getByRole("button", { name: "BUS 1 effect" }).click();
  await r.page.getByRole("dialog", { name: "Effects for BUS 1" }).getByRole("button", { name: "Filter + Drive", exact: true }).click();
  await playLaunchpad(r.page, NOTE, 71, 100); // preset 2
  await playLaunchpad(r.page, NOTE, 71, 0);
  await expect(r.page.getByRole("button", { name: "BUS 1 preset 2" })).toHaveClass(/stored/);
  await expect.poll(() => launchpadLed(r.page, 71)).toEqual(PINK);
  await playLaunchpad(r.page, NOTE, 87, 100); // scene 1
  await playLaunchpad(r.page, NOTE, 87, 0);
  await expect(r.page.getByRole("button", { name: "FX scene 1", exact: true })).toHaveClass(/stored/);

  await playLaunchpad(r.page, CC, 50, 127);
  await expect(r.page.getByRole("button", { name: "DEL" })).toHaveAttribute("aria-pressed", "true");
  await playLaunchpad(r.page, NOTE, 71, 100);
  await playLaunchpad(r.page, NOTE, 71, 0);
  await playLaunchpad(r.page, CC, 50, 0);
  await expect(r.page.getByRole("button", { name: "DEL" })).toHaveAttribute("aria-pressed", "false");
  await expect(r.page.getByRole("button", { name: "BUS 1 preset 2" })).not.toHaveClass(/stored/);
  await expect.poll(() => launchpadLed(r.page, 71)).toEqual([0, 0, 0]);
});

test("a bottom button locks its bus; Quantise + bus starts morph and the target's pressure sets the amount", async () => {
  const r = (running = await start());
  await playLaunchpad(r.page, CC, 2, 127);
  await expect(r.page.getByRole("button", { name: "BUS 2 lock" })).toHaveAttribute("aria-pressed", "true");

  await r.page.getByRole("button", { name: "BUS 1 effect" }).click();
  await r.page.getByRole("dialog", { name: "Effects for BUS 1" }).getByRole("button", { name: "Filter + Drive", exact: true }).click();
  await playLaunchpad(r.page, NOTE, 81, 100);
  await playLaunchpad(r.page, NOTE, 81, 0);
  await playLaunchpad(r.page, CC, 40, 127);
  await playLaunchpad(r.page, CC, 91, 127);
  await playLaunchpad(r.page, CC, 40, 0);
  await playLaunchpad(r.page, NOTE, 81, 100); // the target
  await playLaunchpad(r.page, 0xa0, 81, 127);
  await expect(r.page.getByRole("slider", { name: "Bus 1 morph" })).toHaveAttribute("aria-valuenow", "100");
});
