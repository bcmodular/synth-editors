// The BCR2000 (docs/sp404-design.md › Controllers › BCR2000) against the fake MIDI ports: its encoders drive the FX,
// its rings follow the app, and its unused buttons stay dark.
import { expect, test } from "@playwright/test";
import { bcrSent, finish, midiSent, playBcr, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

const module = (r: Sp404App, bus: number) => r.page.locator(`.bus[data-bus="${bus}"]`);

// Filter + Drive on BUS 1: CUTOFF 70, RESO 50, DRIVE 30, TYPE 64, LOW FREQ 20, LOW GAIN 80.
async function withDrive(r: Sp404App) {
  await r.page.getByRole("button", { name: "BUS 1 effect" }).click();
  await r.page.getByRole("dialog", { name: "Effects for BUS 1" }).getByRole("button", { name: "Filter + Drive", exact: true }).click();
}

test("on connect the buttons go dark and the rings follow the effect's values", async () => {
  const r = (running = await start());
  await expect(r.page.getByText("BCR2000 ●")).toBeVisible();
  await expect.poll(async () => bcrSent(r.page)).toContainEqual([0xb5, 65, 0]);
  await withDrive(r);
  // Slots 1–3 down the left column (CC 81, 89, 97), 4–6 down the right (CC 82, 90, 98).
  await expect.poll(async () => (await bcrSent(r.page)).slice(-6)).toEqual([
    [0xb5, 81, 70], [0xb5, 89, 50], [0xb5, 97, 30], [0xb5, 82, 64], [0xb5, 90, 20], [0xb5, 98, 80],
  ]);
  await expect(module(r, 1).locator(".slot").nth(3)).toContainText("TYPE"); // top of the right column
});

test("an encoder sets its parameter, after the first message from the preset re-sends its rings", async () => {
  const r = (running = await start());
  await withDrive(r);
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(8);
  const before = (await bcrSent(r.page)).length;
  await playBcr(r.page, 0xb5, 81, 99); // dropped: the BCR's stored position
  await expect.poll(async () => (await bcrSent(r.page)).length).toBe(before + 4 * 7);
  await playBcr(r.page, 0xb5, 81, 100);
  const cutoff = module(r, 1).getByRole("slider", { name: "CUTOFF" });
  await expect(cutoff).toHaveAttribute("aria-valuenow", "100");
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 16, 100]);
  expect((await bcrSent(r.page)).length).toBe(before + 4 * 7); // not echoed
  await cutoff.hover();
  await r.page.mouse.wheel(0, -40); // the screen moves it: the ring follows
  await expect.poll(async () => (await bcrSent(r.page)).at(-1)).toEqual([0xb5, 81, 101]);
});

test("a pressed button goes dark again and morph amount follows the top encoder only while morphing", async () => {
  const r = (running = await start());
  await withDrive(r);
  await playBcr(r.page, 0xb5, 81, 70); // first message: dropped
  await expect.poll(async () => (await midiSent(r.page)).length).toBe(8);
  const sent = 8;
  await playBcr(r.page, 0xb5, 65, 127);
  await expect.poll(async () => (await bcrSent(r.page)).at(-1)).toEqual([0xb5, 65, 0]);
  await playBcr(r.page, 0xb5, 1, 64); // morph is off: the ring goes back to 0
  await expect.poll(async () => (await bcrSent(r.page)).at(-1)).toEqual([0xb5, 1, 0]);
  expect((await midiSent(r.page)).length).toBe(sent);

  await r.page.getByRole("button", { name: "BUS 1 preset 1" }).click();
  await r.page.getByRole("button", { name: "Bus 1 morph on" }).click();
  await r.page.getByRole("button", { name: "BUS 1 preset 1" }).click(); // the target
  await playBcr(r.page, 0xb5, 1, 127);
  await expect(r.page.getByRole("slider", { name: "Bus 1 morph" })).toHaveAttribute("aria-valuenow", "100");
});
