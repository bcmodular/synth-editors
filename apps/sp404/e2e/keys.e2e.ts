// KEYS (docs/sp404-design.md › Controllers › Keyboard) against the fake MIDI ports: the Launchkey's keys, pads and
// encoders, and the on-screen piano.
import { expect, test } from "@playwright/test";
import { finish, launchkeySent, midiSent, playLaunchkey, start, type Sp404App } from "./sp404";

let running: Sp404App | undefined;
test.afterEach(async () => finish(running));

async function chooseOn(r: Sp404App, bus: string, effect: string) {
  await r.page.getByRole("button", { name: `${bus} effect` }).click();
  await r.page.getByRole("dialog", { name: `Effects for ${bus}` }).getByRole("button", { name: effect, exact: true }).click();
}

async function keysOn(r: Sp404App, target: string) {
  await r.page.getByRole("button", { name: "KEYS", exact: true }).click();
  await r.page.getByRole("group", { name: "Keyboard on" }).getByRole("button", { name: target, exact: true }).click();
}

test("on Resonator a key sets ROOT, a pad sets CHORD, an encoder turns its slot and the rings follow", async () => {
  const r = (running = await start());
  await chooseOn(r, "BUS 1", "Resonator");
  await keysOn(r, "BUS 1");
  await expect(r.page.getByText("LAUNCHKEY ●")).toBeVisible();
  await playLaunchkey(r.page, 0x90, 57, 100);
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 16, 57]);
  await playLaunchkey(r.page, 0x99, 42, 100); // pad 3
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 80, 17]);
  await playLaunchkey(r.page, 0xb0, 22, 90); // encoder 2: BRIGHT
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb0, 17, 90]);
  await r.page.getByRole("slider", { name: "FEEDBACK" }).first().hover();
  await r.page.mouse.wheel(0, -40);
  await expect.poll(async () => (await launchkeySent(r.page)).at(-1)?.slice(0, 2)).toEqual([0xb0, 23]);
  if (process.env.KEYS_SHOT) await r.page.screenshot({ path: process.env.KEYS_SHOT });
});

test("on Hyper-Reso the screen's white keys set NOTE and the pads SCALE", async () => {
  const r = (running = await start());
  await chooseOn(r, "BUS 3", "Hyper-Reso");
  await keysOn(r, "BUS 3");
  await r.page.getByRole("button", { name: "Key 62" }).click(); // D4: degree 2
  await expect.poll(async () => (await midiSent(r.page)).at(-1)).toEqual([0xb2, 16, 66]);
  await r.page.getByRole("group", { name: /SCALE/ }).getByRole("button", { name: "MIN" }).click();
  await expect.poll(async () => (await midiSent(r.page)).at(-1)?.slice(0, 2)).toEqual([0xb2, 80]);
});

test("CHROMATIC plays the SP-404 on channel 16 within C2–C4, note off on release", async () => {
  const r = (running = await start());
  await keysOn(r, "CHROMATIC");
  await playLaunchkey(r.page, 0x90, 70, 80);
  await playLaunchkey(r.page, 0x80, 70, 0);
  await expect.poll(async () => (await midiSent(r.page)).slice(-2)).toEqual([[0x9f, 60, 80], [0x9f, 60, 0]]);
});
