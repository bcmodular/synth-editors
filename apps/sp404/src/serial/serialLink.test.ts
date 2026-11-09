import { describe, expect, it } from "vitest";
import { longFrame, shortFrame } from "../core/serialFrames";
import { parseStatus, statusFrame } from "../core/serialMessages";
import { SerialLink, type Direction } from "./serialLink";

// A fake SP-404: answers every status poll with project 6, bank C, pad 2, nothing playing, split in two chunks.
function fakeDevice() {
  const sent: Uint8Array[] = [];
  let push: (chunk: Uint8Array) => void = () => {};
  const readable = new ReadableStream<Uint8Array>({ start: (c) => void (push = (chunk) => c.enqueue(chunk)) });
  const reply = new Uint8Array(19);
  reply.set([0x7e, 5, 0, 2, 0, 1]);
  reply.fill(0xff, 8, 12);
  const writable = new WritableStream<Uint8Array>({
    write(bytes) {
      sent.push(bytes);
      if (bytes[4] !== 0xfe) return;
      const frame = longFrame(5, reply);
      push(frame.subarray(0, 10));
      push(frame.subarray(10));
    },
  });
  return { streams: { readable, writable }, sent, push: (chunk: Uint8Array) => push(chunk) };
}

describe("SerialLink", () => {
  it("pairs a request with its reply across split chunks, and logs both ways", async () => {
    const device = fakeDevice();
    const log: Direction[] = [];
    const link = new SerialLink(device.streams, (d) => log.push(d));
    const status = await link.request(statusFrame(), parseStatus);
    expect(status).toEqual({ project: 5, selectedBank: 2, selectedPad: 1, playingFrames: undefined, mode: 0 });
    expect(log).toEqual(["out", "in", "in"]);
    await link.close();
  });

  it("gives up after the timeout when nothing matches", async () => {
    const device = fakeDevice();
    const link = new SerialLink(device.streams);
    expect(await link.request(shortFrame(5, [0x9e, 0, 0]), parseStatus, 20)).toBeUndefined();
    await link.close();
  });

  it("passes unsolicited frames to listeners", async () => {
    const device = fakeDevice();
    const link = new SerialLink(device.streams);
    const seen: number[] = [];
    link.onFrame((f) => seen.push(f.payload[0] ?? -1));
    device.push(shortFrame(5, [0x1a, 0x03]));
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([0x1a]);
    await link.close();
  });
});
