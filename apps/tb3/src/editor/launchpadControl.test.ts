import { describe, expect, it, vi } from "vitest";
import { launchpadHandler } from "./launchpadControl";
import type { LaunchpadSession } from "./launchpadControl";
import { LP_BUTTON } from "./launchpadView";

type Fake = LaunchpadSession & { calls: string[] };

function fakeSession(): Fake {
  const calls: string[] = [];
  const slot = (name: string) => ({ name, patch: { name } }) as never;
  const s = {
    calls,
    state: { slots: [slot("A"), slot("B"), null, ...Array(13).fill(null)], active: 0 },
    activePatch: {},
    mode: null,
    morphTarget: null,
    previewKey: null,
    setMode: (m: Fake["mode"]) => {
      s.mode = m;
      calls.push(`mode ${m}`);
    },
    preview: (_p: unknown, key: string) => {
      s.previewKey = key;
      calls.push(`preview ${key}`);
    },
    endPreview: () => {
      s.previewKey = null;
      calls.push("endPreview");
    },
    recall: (i: number) => calls.push(`recall ${i}`),
    store: (i: number) => calls.push(`store ${i}`),
    clear: (i: number) => calls.push(`clear ${i}`),
    chooseMorphTarget: (i: number) => {
      s.morphTarget = i;
      calls.push(`target ${i}`);
    },
    setMorph: (v: number) => calls.push(`morph ${v}`),
  } as unknown as Fake;
  return s;
}

function setup() {
  const s = fakeSession();
  const deps = { session: () => s, sync: vi.fn(), cycleBrightness: vi.fn(), onHeld: vi.fn() };
  return { s, deps, handle: launchpadHandler(deps) };
}

const pad = (note: number, velocity: number) => ({ type: "pad", note, velocity }) as const;
const button = (cc: number, value: number) => ({ type: "button", cc, value }) as const;

describe("launchpadHandler", () => {
  it("recalls a filled slot, stores into an empty one and ignores other pads", () => {
    const { s, deps, handle } = setup();
    handle(pad(82, 100));
    handle(pad(82, 0));
    handle(pad(83, 100));
    handle(pad(11, 100));
    expect(s.calls).toEqual(["recall 1", "store 2"]);
    expect(deps.onHeld).toHaveBeenLastCalledWith(new Set([2]));
  });

  it("deletes while DELETE is held, then leaves the mode", () => {
    const { s, handle } = setup();
    handle(button(LP_BUTTON.delete, 127));
    handle(pad(81, 100));
    handle(pad(83, 100)); // empty: nothing
    handle(button(LP_BUTTON.delete, 0));
    expect(s.calls).toEqual(["mode delete", "clear 0", "mode null"]);
  });

  it("auditions while GRAB and the pad are held", () => {
    const { s, handle } = setup();
    handle(button(LP_BUTTON.grab, 127));
    handle(pad(82, 100));
    handle(pad(82, 0));
    handle(button(LP_BUTTON.grab, 0));
    expect(s.calls).toEqual(["mode grab", "preview slot:1", "endPreview", "endPreview", "mode null"]);
  });

  it("MORPH toggles target picking; pressure on the target sets the amount", () => {
    const { s, handle } = setup();
    handle(button(LP_BUTTON.morph, 127));
    handle(button(LP_BUTTON.morph, 0));
    handle(pad(82, 100));
    handle({ type: "pressure", note: 82, value: 40 });
    handle({ type: "pressure", note: 81, value: 50 }); // not the target
    handle({ type: "channelPressure", value: 90 });
    handle(pad(82, 0));
    handle(pad(82, 100)); // already the target: kept, so the blend isn't rebased
    handle(button(LP_BUTTON.morph, 127));
    expect(s.calls).toEqual(["mode target", "target 1", "morph 40", "morph 90", "mode null"]);
  });

  it("CLICK syncs from the TB-3 and USER cycles the brightness", () => {
    const { deps, handle } = setup();
    handle(button(LP_BUTTON.sync, 127));
    handle(button(LP_BUTTON.brightness, 127));
    handle(button(LP_BUTTON.brightness, 0));
    expect(deps.sync).toHaveBeenCalledTimes(1);
    expect(deps.cycleBrightness).toHaveBeenCalledTimes(1);
  });
});
