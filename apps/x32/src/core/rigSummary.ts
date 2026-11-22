// The rig as text for the model (docs/x32-spec.md, "Agent loop"): sources and their sends, destinations and where they
// go, the shared bus and its targets, and the FX slots. It goes in the first message of a conversation, and get_state
// refreshes it, so the cached system prompt never changes when the desk does.

import { iconName } from "./enums";
import { formatDb } from "./faderLaw";
import { sameName } from "./names";
import { busName, deriveRig, stripLabel, type Destination, type FxSlot, type Lookup, type Rig, type Source } from "./rig";
import { liveTarget, type SharedBus } from "./shared";

export interface SummaryRequest {
  get: Lookup;
  shared: SharedBus[];
  names?: string[]; // only these sources and destinations; all when empty
}

// One entry per destination: a send to a stereo bus is one send.
const sendText = (rig: Rig, s: Source) =>
  [...new Set(s.sends.map((x) => `${busName(rig, x.bus)} ${formatDb(x.level)} (${x.tap}-fader)`))].join(", ") || "none";

const sourceLine = (rig: Rig, s: Source) =>
  `- ${s.name}: ${stripLabel(s)}${s.numbers.length > 1 ? " (stereo)" : ""}, icon ${iconName(s.icon)}; sends to: ${sendText(rig, s)}`;

function goesTo(d: Destination): string {
  return [...d.outputs, ...(d.fxSlot ? [`FX ${d.fxSlot}`] : [])].join(", ") || "nowhere";
}

function destinationLine(d: Destination, req: SummaryRequest): string {
  const back = d.deviceReturn ? `; the device returns on ${stripLabel(d.deviceReturn)}` : "";
  const sb = req.shared.find((s) => s.buses[0] === d.numbers[0]);
  const shared = sb
    ? `; shared: it goes to the ${liveTarget(req.get, sb) ?? "(no target)"} now, and can go to ${sb.targets.map((t) => t.name).join(", ")} (send to a target's name to switch it)`
    : "";
  return `- ${d.name}: ${stripLabel(d)} → ${goesTo(d)}${back}${shared}`;
}

const fxLine = (rig: Rig, f: FxSlot) => {
  const role = f.role === "send" ? `send effect fed by ${[...new Set(f.sourceBuses.map((b) => busName(rig, b)))].join("/")}` : f.role;
  return `- FX ${f.slot}: type ${f.type}, ${f.role === "insert" ? `insert on ${f.insertedOn.join(", ")}` : role}`;
};

const wanted = (req: SummaryRequest, d: { name: string }, extra: string[] = []) =>
  !req.names?.length || req.names.some((n) => [d.name, ...extra].some((x) => sameName(x, n)));

export function rigSummary(req: SummaryRequest): string {
  const rig = deriveRig(req.get);
  const targetsOf = (d: Destination) => req.shared.find((s) => s.buses[0] === d.numbers[0])?.targets.map((t) => t.name) ?? [];
  const sources = rig.sources.filter((s) => wanted(req, s)).map((s) => sourceLine(rig, s));
  const destinations = rig.destinations.filter((d) => wanted(req, d, targetsOf(d))).map((d) => destinationLine(d, req));
  const parts = [`Sources:\n${sources.join("\n") || "- (none matched)"}`, `Destinations:\n${destinations.join("\n") || "- (none matched)"}`];
  if (!req.names?.length) parts.push(`FX slots:\n${rig.fx.map((f) => fxLine(rig, f)).join("\n")}`);
  if (rig.oddities.length) parts.push(`Oddities:\n${rig.oddities.map((o) => `- ${o}`).join("\n")}`);
  return parts.join("\n\n");
}
