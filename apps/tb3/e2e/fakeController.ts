// A stand-in controller (Launchpad, keyboard) for the end-to-end tests: one input and one output named `name`,
// added to whatever navigator.requestMIDIAccess already gives (the fake TB-3, other fakes, or the real ports). The
// output records what the app sends; window.__fakeControllers[name].press(bytes) plays a message from it.
//
// Playwright serialises installFakeController into the page, so it must not use anything from outside it.
import type { Page } from "@playwright/test";

export function installFakeController(name: string) {
  const NAME = name;
  const sent: number[][] = [];
  type Listener = (e: { data: Uint8Array }) => void;
  const listeners = new Set<Listener>();
  const port = (id: string, type: string) => ({
    id, name: NAME, manufacturer: "test", type, state: "connected", connection: "open", onstatechange: null,
    open: async () => undefined, close: async () => undefined,
  });
  const input = {
    ...port(`fake-${name}-in`, "input"),
    onmidimessage: null as Listener | null,
    addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
    removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
  };
  const output = {
    ...port(`fake-${name}-out`, "output"),
    clear: () => undefined,
    send: (d: ArrayLike<number>) => void sent.push(Array.from(d)),
  };
  const press = (bytes: number[]) => {
    const e = { data: Uint8Array.from(bytes) };
    input.onmidimessage?.(e);
    listeners.forEach((fn) => fn(e));
  };
  const original = navigator.requestMIDIAccess.bind(navigator);
  const request = async (opts?: MIDIOptions) => {
    const a = await original(opts);
    return {
      inputs: new Map<string, unknown>([...a.inputs, [input.id, input]]),
      outputs: new Map<string, unknown>([...a.outputs, [output.id, output]]),
      sysexEnabled: true, onstatechange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    };
  };
  Object.defineProperty(navigator, "requestMIDIAccess", { value: request, configurable: true });
  const w = window as unknown as { __fakeControllers?: Record<string, unknown> };
  w.__fakeControllers = { ...w.__fakeControllers, [name]: { sent, press } };
}

type Fakes = { __fakeControllers: Record<string, { sent: number[][]; press(bytes: number[]): void }> };

// From the tests: play a message from the controller named `name`, and read what the app sent it.
export const pressController = (page: Page, name: string, bytes: number[]) =>
  page.evaluate(([n, b]) => (window as unknown as Fakes).__fakeControllers[n]!.press(b), [name, bytes] as const);
export const controllerSent = (page: Page, name: string) =>
  page.evaluate((n) => (window as unknown as Fakes).__fakeControllers[n]!.sent, name);
