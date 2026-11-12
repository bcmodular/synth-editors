// CC learn (PLAN.md, "CC learn and controller behaviour"): assignments from a controller's CCs to an app's targets,
// and how a CC value moves a target. Nothing is sent back to the controller, so a knob can disagree with the value
// it drives; each assignment's mode decides what happens then:
// - relative: the controller sends steps around 64 (65 = +1, 63 = −1: Novation's relative encoders). No jumps.
// - pickup: absolute values are ignored until the knob reaches the target's value, then it follows.
// - jump: the target follows the knob at once.

export type CcMode = "relative" | "pickup" | "jump";
export const CC_MODES: readonly CcMode[] = ["relative", "pickup", "jump"];

export interface CcAssignment {
  channel: number | null; // 1–16, or null for any channel
  cc: number;
  target: string; // the app's target id
  mode: CcMode;
}

// Where a CC message came from.
export interface CcSource {
  channel: number; // 1–16
  cc: number;
}

const matches = (a: CcAssignment, from: CcSource) => a.cc === from.cc && (a.channel ?? from.channel) === from.channel;

export const findAssignment = (list: readonly CcAssignment[], from: CcSource) => list.find((a) => matches(a, from));

// Assign `cc` on `channel` to `target`, replacing whatever that CC (on that channel, or on any) or that target had.
export function learn(list: readonly CcAssignment[], add: CcAssignment): CcAssignment[] {
  const overlaps = (a: CcAssignment) => a.cc === add.cc && (a.channel ?? add.channel) === (add.channel ?? a.channel);
  return [...list.filter((a) => a.target !== add.target && !overlaps(a)), add];
}

export const forget = (list: readonly CcAssignment[], target: string) => list.filter((a) => a.target !== target);

export const setMode = (list: readonly CcAssignment[], change: Pick<CcAssignment, "target" | "mode">) =>
  list.map((a) => (a.target === change.target ? { ...a, mode: change.mode } : a));

// Assignments read back from storage; anything malformed is dropped.
export function parseAssignments(json: string | null): CcAssignment[] | null {
  if (!json) return null;
  try {
    const list: unknown = JSON.parse(json);
    return Array.isArray(list) ? list.filter(isAssignment) : null;
  } catch {
    return null;
  }
}

function isAssignment(a: unknown): a is CcAssignment {
  const x = a as CcAssignment;
  return (
    typeof x === "object" && x !== null && typeof x.cc === "number" && typeof x.target === "string" &&
    CC_MODES.includes(x.mode) && (x.channel === null || typeof x.channel === "number")
  );
}

// What an assignment remembers between messages, for pickup.
export interface Takeover {
  knob: number | null; // the knob's last position, scaled to the target's range
  sent: number | null; // the value it last set
}
export const NO_TAKEOVER: Takeover = { knob: null, sent: null };

export interface CcInput {
  mode: CcMode;
  value: number; // the CC value, 0–127
  current: number | null; // the target's value now; null when unknown (then only jump works)
  max: number; // the target's range is 0–max
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
const stepOf = (max: number) => Math.max(1, Math.round(max / 127));

const knobOf = (i: CcInput) => Math.round((clamp(i.value, 127) / 127) * i.max);

function relative(i: CcInput): number | null {
  if (i.current === null || i.value === 64) return null;
  return clamp(i.current + (i.value - 64) * stepOf(i.max), i.max);
}

// The knob has reached the value: it's within a step, or it moved across it since last time.
function reaches(i: CcInput & { current: number }, was: Takeover): boolean {
  const knob = knobOf(i);
  if (Math.abs(knob - i.current) <= stepOf(i.max)) return true;
  return was.knob !== null && (was.knob - i.current) * (knob - i.current) <= 0;
}

function pickup(i: CcInput, was: Takeover): number | null {
  if (i.current === null) return knobOf(i);
  const following = was.sent !== null && was.sent === i.current; // nothing else has moved it since
  return following || reaches({ ...i, current: i.current }, was) ? knobOf(i) : null;
}

// The target's new value for a CC message (null: leave it), and what to remember for the next one.
export function ccValue(i: CcInput, was: Takeover): { value: number | null; takeover: Takeover } {
  const value = i.mode === "relative" ? relative(i) : i.mode === "pickup" ? pickup(i, was) : knobOf(i);
  return { value, takeover: { knob: knobOf(i), sent: value ?? was.sent } };
}
