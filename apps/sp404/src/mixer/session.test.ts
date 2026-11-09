import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeSp404Port, type FakeSp404 } from "../../e2e/fakeSp404";
import { bankVolumeFrame, mixChangeFrame } from "../core/serialMessages";
import { SerialLink } from "../serial/serialLink";
import { Sp404Session, wasHit, type DeviceState } from "./session";

const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true), { timeout: 2000 });

function open(fake: FakeSp404) {
  const link = new SerialLink(fake.port);
  const states: DeviceState[] = [];
  const session = new Sp404Session(link, (s) => states.push(s));
  const last = () => states.at(-1)!;
  return { link, session, last };
}

const DEVICE = {
  project: 2,
  projectName: "LIVE",
  pads: [
    { pad: 0, name: "KICK", level: 100 },
    { pad: 17, name: "BASS", pan: 40, routing: 2 },
  ],
  bankVolumes: [127, 90, 127, 127, 127, 127, 127, 127, 127, 127],
};

let running: ReturnType<typeof open> | undefined;
afterEach(async () => {
  running?.session.stop();
  await running?.link.close();
  vi.useRealTimers();
});

describe("Sp404Session", () => {
  it("loads the project: name, bank volumes and the loaded pads", async () => {
    const fake = fakeSp404Port(DEVICE);
    running = open(fake);
    await running.session.start();
    const s = running.last();
    expect(s).toMatchObject({ loading: false, project: 2, projectName: "LIVE" });
    expect(s.bankVolumes[1]).toBe(90);
    expect(s.pads.map((p) => [p.pad, p.name, p.mix.level, p.mix.pan, p.mix.routing])).toEqual([
      [0, "KICK", 100, 64, 1],
      [17, "BASS", 127, 40, 2],
    ]);
  });

  it("sends only the latest of several queued writes to the same target", async () => {
    const fake = fakeSp404Port(DEVICE);
    running = open(fake);
    await running.session.start();
    const before = fake.sent.length;
    for (const level of [10, 20, 30, 40]) running.session.send("level:0", mixChangeFrame({ pad: 0, field: "level", value: level }));
    running.session.send("bank:1", bankVolumeFrame(1, 64));
    await until(() => fake.bankVolume(1) === 64);
    const writes = fake.sent.slice(before).filter((m) => m.command === 0x01);
    expect(writes.map((w) => w.value)).toEqual([10, 40, 63]);
    expect(fake.pad(0)?.level).toBe(40);
  });

  it("reloads when the device switches project", async () => {
    const fake = fakeSp404Port(DEVICE);
    running = open(fake);
    await running.session.start();
    fake.setProject(4);
    await until(() => running!.last().project === 4 && !running!.last().loading);
  }, 5000);

  it("re-reads the selected pad when the selection changes, picking up edits made on the device", async () => {
    const fake = fakeSp404Port(DEVICE);
    running = open(fake);
    await running.session.start();
    fake.pad(17)!.level = 55; // turned on the SP-404 itself
    fake.select(1, 1);
    await until(() => running!.last().pads.find((p) => p.pad === 17)?.mix.level === 55);
    expect(running.last().status).toMatchObject({ selectedBank: 1, selectedPad: 1 });
  }, 5000);
});

describe("wasHit", () => {
  const status = (pad: number, playingFrames?: number, mode = 0) =>
    ({ project: 0, selectedBank: 0, selectedPad: pad, playingFrames, mode });

  it("sees a new selection as a hit, even if the sound is already over", () => {
    expect(wasHit(status(1), status(2))).toBe(true);
  });

  it("sees a pad starting to sound, or restarting, as a hit", () => {
    expect(wasHit(status(1), status(1, 400))).toBe(true);
    expect(wasHit(status(1, 9000), status(1, 300))).toBe(true);
  });

  it("doesn't count a pad that keeps sounding or stays quiet", () => {
    expect(wasHit(status(1, 300), status(1, 9000))).toBe(false);
    expect(wasHit(status(1), status(1))).toBe(false);
    expect(wasHit(undefined, status(1, 300))).toBe(false);
  });

  it("doesn't count anything while a pattern plays (mode 4)", () => {
    expect(wasHit(status(12), status(12, 2048, 4))).toBe(false);
  });
});
