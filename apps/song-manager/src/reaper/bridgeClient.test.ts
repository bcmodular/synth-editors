import { describe, expect, it } from "vitest";
import { BridgeError, ReaperBridge } from "./bridgeClient.ts";
import { FakeWebInterface } from "./fakeWebInterface.ts";
import type { BridgeState } from "./types.ts";
import { base64url, extState, parseResponse, unescapeValue } from "./webInterface.ts";

const S = "SongManager";

function decodeCommand(raw: string): Record<string, unknown> {
  const binary = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
}

/** A fake whose "script" answers every command with ok and echoes the command back as data. */
function answering(fake = new FakeWebInterface()) {
  fake.onRequest = (f) => {
    const raw = f.get(S, "cmd");
    if (!raw) return;
    f.ext.delete(`${S}/cmd`);
    const cmd = decodeCommand(raw);
    f.set(S, "result", JSON.stringify({ id: cmd.id, ok: cmd.type !== "dance", data: cmd, error: "nope" }));
  };
  return fake;
}

const bridgeFor = (fake: FakeWebInterface, extra = {}) =>
  new ReaperBridge({ url: "http://localhost:8080/", fetch: fake.fetch, pollMs: 1, ...extra });

const state = (name: string): BridgeState => ({
  tracks: [],
  playing: false,
  paused: false,
  recording: false,
  tempo: 120,
  ports: { inputs: [name], outputs: [] },
});

describe("web interface protocol", () => {
  it("unescapes left to right, so an escaped backslash before n stays a backslash and n", () => {
    expect(unescapeValue("a\\nb\\tc\\\\d")).toBe("a\nb\tc\\d");
    expect(unescapeValue("\\\\n")).toBe("\\n");
  });

  it("reads EXTSTATE lines and treats an empty value as unset", () => {
    const lines = parseResponse("EXTSTATE\tSongManager\talive\t3\nEXTSTATE\tSongManager\tstate\t\n");
    expect(extState(lines, S, "alive")).toBe("3");
    expect(extState(lines, S, "state")).toBeUndefined();
    expect(extState(lines, S, "missing")).toBeUndefined();
  });

  it("encodes commands as base64url, with no slash, semicolon or percent", () => {
    const encoded = base64url(JSON.stringify({ port: "a/b;c%d", name: "é?>>>" }));
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCommand(encoded)).toEqual({ port: "a/b;c%d", name: "é?>>>" });
  });
});

describe("ReaperBridge", () => {
  it("sends a command and returns the result with the same id", async () => {
    const fake = answering();
    const result = await bridgeFor(fake).send({ type: "arm", track: "{G}", on: true });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ type: "arm", track: "{G}", on: true });
    expect(fake.requests[0]).toMatch(/^http:\/\/localhost:8080\/_\/SET\/EXTSTATE\/SongManager\/cmd\/[A-Za-z0-9_-]+$/);
  });

  it("ignores a result left over from another command", async () => {
    const fake = new FakeWebInterface();
    fake.set(S, "result", JSON.stringify({ id: "old-1", ok: true }));
    let calls = 0;
    fake.onRequest = (f) => {
      calls += 1;
      if (calls < 3) return;
      const raw = f.get(S, "cmd");
      if (raw) f.set(S, "result", JSON.stringify({ id: decodeCommand(raw).id, ok: true, data: "new" }));
    };
    expect((await bridgeFor(fake).send({ type: "ping" })).data).toBe("new");
  });

  it("run() throws the bridge's error for a failed command", async () => {
    await expect(bridgeFor(answering()).run({ type: "dance" } as never)).rejects.toThrow("dance: nope");
  });

  it("gives up when no script answers", async () => {
    const bridge = bridgeFor(new FakeWebInterface(), { timeoutMs: 30 });
    await expect(bridge.send({ type: "ping" })).rejects.toBeInstanceOf(BridgeError);
  });

  it("reports a refused request", async () => {
    const fake = new FakeWebInterface();
    fake.status = 401;
    await expect(bridgeFor(fake).alive()).rejects.toThrow("answered 401");
  });

  it("sends the web interface password as basic auth", async () => {
    let headers: HeadersInit | undefined;
    const fake = new FakeWebInterface();
    const fetchFn = (input: string | URL | Request, init?: RequestInit) => {
      headers = init?.headers;
      return fake.fetch(input);
    };
    await new ReaperBridge({ url: "http://x", auth: "will:pw", fetch: fetchFn as typeof fetch }).alive();
    expect(headers).toEqual({ Authorization: `Basic ${btoa("will:pw")}` });
  });

  it("polls the sequence and fetches the state only when it moves", async () => {
    const fake = new FakeWebInterface();
    const bridge = bridgeFor(fake);
    expect(await bridge.poll(undefined)).toBeUndefined();
    fake.set(S, "state_seq", "1-1");
    fake.set(S, "state", JSON.stringify(state('Port "3"\\new\tline')));
    const first = await bridge.poll(undefined);
    expect(first?.state.ports.inputs[0]).toBe('Port "3"\\new\tline');
    const requests = fake.requests.length;
    expect(await bridge.poll("1-1")).toBeUndefined();
    expect(fake.requests.length).toBe(requests + 1);
  });

  it("watch() reports each change once", async () => {
    const fake = new FakeWebInterface();
    fake.set(S, "state_seq", "1-1");
    fake.set(S, "state", JSON.stringify(state("A")));
    const seen: string[] = [];
    const stop = bridgeFor(fake).watch((s) => seen.push(s.state.ports.inputs[0] ?? ""), 1);
    await new Promise((r) => setTimeout(r, 20));
    fake.set(S, "state_seq", "1-2");
    fake.set(S, "state", JSON.stringify(state("B")));
    await new Promise((r) => setTimeout(r, 20));
    stop();
    expect(seen).toEqual(["A", "B"]);
  });
});
