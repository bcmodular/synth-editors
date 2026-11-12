// Launchpad Pro input → session actions (docs/tb3-phase4-design.md). The top two rows are the slots, clicked as on
// screen; DELETE and GRAB are held; MORPH toggles target picking, and pad pressure on the target sets the amount.
import { padToSlot } from "@synth-editors/launchpad";
import type { LaunchpadEvent } from "@synth-editors/launchpad";
import { LP_BUTTON } from "./launchpadView";
import type { Session } from "./useSession";

export type LaunchpadSession = Pick<
  Session,
  | "state" | "activePatch" | "mode" | "setMode" | "morphTarget" | "previewKey" | "preview" | "endPreview" | "recall"
  | "store" | "clear" | "chooseMorphTarget" | "setMorph"
>;

export interface LaunchpadDeps {
  session: () => LaunchpadSession; // the latest
  sync: () => void; // SYNC FROM TB-3
  cycleBrightness: () => void;
  onHeld: (held: ReadonlySet<number>) => void; // slots whose pads are down, for their LEDs
}

const slotKey = (i: number) => `slot:${i}`;

type Slot = LaunchpadSession["state"]["slots"][number];

// A pad press on slot `i`, by mode: as a click on screen, except that target picking stays on.
type PressSlot = (s: LaunchpadSession, i: number, slot: Slot) => void;
const PRESS_SLOT: Record<NonNullable<LaunchpadSession["mode"]> | "none", PressSlot> = {
  grab: (s, i, slot) => slot && s.preview(slot.patch, slotKey(i), slot.name),
  delete: (s, i, slot) => slot && s.clear(i),
  target: (s, i, slot) => slot && s.morphTarget !== i && s.chooseMorphTarget(i), // the same target keeps its blend
  none: (s, i, slot) => (slot ? s.recall(i) : s.activePatch && s.store(i)),
};

const pressSlot = (s: LaunchpadSession, i: number) => PRESS_SLOT[s.mode ?? "none"](s, i, s.state.slots[i] ?? null);

function releaseSlot(s: LaunchpadSession, i: number) {
  if (s.previewKey === slotKey(i)) s.endPreview();
}

const morphing = (s: LaunchpadSession, i: number | undefined) =>
  s.mode === "target" && s.morphTarget === i && s.activePatch !== null;

// Pressure on the morph target's pad sets the morph amount.
function pressure(s: LaunchpadSession, i: number | undefined, value: number) {
  if (i !== undefined && morphing(s, i)) s.setMorph(value);
}

const HELD_MODES = { [LP_BUTTON.delete]: "delete", [LP_BUTTON.grab]: "grab" } as const;
type HeldMode = (typeof HELD_MODES)[keyof typeof HELD_MODES];

// DELETE and GRAB are on while held.
function holdMode(s: LaunchpadSession, mode: HeldMode, down: boolean) {
  if (s.mode === "grab") s.endPreview();
  if (down) s.setMode(mode);
  else if (s.mode === mode) s.setMode(null);
}

const PRESS_BUTTON: Record<number, (d: LaunchpadDeps, s: LaunchpadSession) => void> = {
  [LP_BUTTON.morph]: (_d, s) => s.setMode(s.mode === "target" ? null : "target"),
  [LP_BUTTON.sync]: (d) => d.sync(),
  [LP_BUTTON.brightness]: (d) => d.cycleBrightness(),
};

function button(d: LaunchpadDeps, cc: number, down: boolean) {
  const held = HELD_MODES[cc as keyof typeof HELD_MODES];
  if (held) holdMode(d.session(), held, down);
  else if (down) PRESS_BUTTON[cc]?.(d, d.session());
}

// A handler for the Launchpad's input; it keeps which pads are down.
export function launchpadHandler(d: LaunchpadDeps): (e: LaunchpadEvent) => void {
  const held = new Set<number>();
  let last: number | undefined; // the last pad pressed, for channel pressure
  const pad = (i: number, down: boolean) => {
    if (down) {
      held.add(i);
      last = i;
      pressSlot(d.session(), i);
    } else {
      held.delete(i);
      releaseSlot(d.session(), i);
    }
    d.onHeld(new Set(held));
  };
  const slotOf = (note: number) => {
    const n = padToSlot(note);
    return n === undefined ? undefined : n - 1;
  };
  return (e) => {
    if (e.type === "button") return button(d, e.cc, e.value > 0);
    if (e.type === "channelPressure") return pressure(d.session(), held.has(last ?? -1) ? last : undefined, e.value);
    const i = slotOf(e.note);
    if (i === undefined) return;
    if (e.type === "pad") pad(i, e.velocity > 0);
    else pressure(d.session(), i, e.value);
  };
}
