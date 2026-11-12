// A stand-in Launchpad Pro for the end-to-end tests: one input and one output named "Launchpad Pro", added to
// whatever navigator.requestMIDIAccess already gives (the fake TB-3, or the real ports). The output records what
// the app sends; window.__fakeLaunchpad.press(bytes) plays a message from the Launchpad.
//
// Playwright serialises this function into the page, so it must not use anything from outside it.
export function installFakeLaunchpad() {
  const NAME = "Launchpad Pro";
  const sent: number[][] = [];
  type Listener = (e: { data: Uint8Array }) => void;
  const listeners = new Set<Listener>();
  const port = (id: string, type: string) => ({
    id, name: NAME, manufacturer: "test", type, state: "connected", connection: "open", onstatechange: null,
    open: async () => undefined, close: async () => undefined,
  });
  const input = {
    ...port("fake-lp-in", "input"),
    onmidimessage: null as Listener | null,
    addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
    removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
  };
  const output = {
    ...port("fake-lp-out", "output"),
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
  (window as unknown as { __fakeLaunchpad: unknown }).__fakeLaunchpad = { sent, press };
}
