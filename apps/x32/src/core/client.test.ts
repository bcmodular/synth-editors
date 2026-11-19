import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { send, strip } from "./addresses";
import { argFor } from "./argFor";
import { DeskClient, DeskTimeout, type Transport } from "./client";
import { decodePacket, encodeMessage, float, int, str, type OscMessage } from "./osc";

// A transport whose desk is scripted: `answer` decides the reply to each message the client sends.
function scripted(answer: (m: OscMessage) => OscMessage | null = () => null) {
  let listener: ((b: Uint8Array) => void) | null = null;
  const sent: OscMessage[] = [];
  const transport: Transport = {
    send: (bytes) => {
      const [m] = decodePacket(bytes);
      sent.push(m!);
      const reply = answer(m!);
      if (reply) queueMicrotask(() => listener?.(encodeMessage(reply.address, reply.args)));
    },
    onMessage: (l) => {
      listener = l;
      return () => (listener = null);
    },
  };
  const push = (m: OscMessage) => listener?.(encodeMessage(m.address, m.args));
  return { transport, sent, push };
}

const INFO_REPLY = { address: "/info", args: [str("V2.07"), str("osc-server"), str("X32RACK"), str("4.06")] };
const desk = (m: OscMessage) => (m.address === "/info" ? INFO_REPLY : null);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DeskClient", () => {
  it("subscribes and reads /info on start, then renews every 8 s", async () => {
    const d = scripted(desk);
    const client = new DeskClient(d.transport);
    const links = vi.fn();
    client.onLink(links);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(d.sent.map((m) => m.address)).toEqual(["/xremote", "/info"]);
    expect(client.link).toBe("connected");
    expect(client.info).toEqual({ version: "V2.07", server: "osc-server", model: "X32RACK", firmware: "4.06" });
    expect(links).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(8000);
    expect(d.sent.filter((m) => m.address === "/xremote")).toHaveLength(2);
    expect(links).toHaveBeenCalledTimes(1); // still connected: no new event
    client.stop();
  });

  it("says the desk is unreachable when /info goes unanswered, and connected when it comes back", async () => {
    let up = false;
    const d = scripted((m) => (up ? desk(m) : null));
    const client = new DeskClient(d.transport);
    const links = vi.fn();
    client.onLink(links);
    client.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.link).toBe("unreachable");
    up = true;
    await vi.advanceTimersByTimeAsync(8000);
    expect(client.link).toBe("connected");
    expect(links.mock.calls.map((c) => c[0])).toEqual(["unreachable", "connected"]);
    client.stop();
  });

  it("reads a value and matches answers by address", async () => {
    const level = send(strip("auxin", 3), 11).level;
    const d = scripted((m) => (m.address === level.address ? { address: m.address, args: [float(0.75)] } : desk(m)));
    const client = new DeskClient(d.transport);
    client.start();
    await expect(client.read(level)).resolves.toBe(0.75);
    client.stop();
  });

  it("times out a read the desk doesn't answer", async () => {
    const client = new DeskClient(scripted().transport, { timeoutMs: 500 });
    client.start();
    const read = client.read(send(strip("ch", 1), 3).on);
    const check = expect(read).rejects.toBeInstanceOf(DeskTimeout);
    await vi.advanceTimersByTimeAsync(500);
    await check;
    client.stop();
  });

  it("writes with the address's OSC type", () => {
    const d = scripted();
    const client = new DeskClient(d.transport);
    const s = send(strip("ch", 9), 11);
    client.write(s.on, 1);
    client.write(s.level, 0.5);
    expect(d.sent).toEqual([
      { address: "/ch/09/mix/11/on", args: [int(1)] },
      { address: "/ch/09/mix/11/level", args: [float(0.5)] },
    ]);
  });

  it("passes notifications to listeners", async () => {
    const d = scripted(desk);
    const client = new DeskClient(d.transport);
    const seen = vi.fn();
    client.onMessage(seen);
    client.start();
    d.push({ address: "/ch/01/mix/fader", args: [float(0.5)] });
    expect(seen).toHaveBeenCalledWith({ address: "/ch/01/mix/fader", args: [float(0.5)] });
    client.stop();
  });

  it("ignores packets that aren't OSC", () => {
    let listener: ((b: Uint8Array) => void) | null = null;
    const client = new DeskClient({ send: () => {}, onMessage: (l) => ((listener = l), () => {}) });
    const seen = vi.fn();
    client.onMessage(seen);
    client.start();
    listener!(new Uint8Array([0x2f, 0x61, 0x62, 0x63])); // "/abc" with no terminating zero
    expect(seen).not.toHaveBeenCalled();
    client.stop();
  });
});

describe("argFor", () => {
  it("types values for their address", () => {
    expect(argFor({ address: "/a", type: "i" }, 1.4)).toEqual(int(1));
    expect(argFor({ address: "/a", type: "s" }, 3)).toEqual(str("3"));
    expect(() => argFor({ address: "/a", type: "f" }, "x")).toThrow("takes a number");
  });
});
