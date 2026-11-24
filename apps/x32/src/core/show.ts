// Scenes and snippets by name (docs/x32-spec.md, phase 9): recall either, and save the desk's routing as a snippet
// ("save this as TR-8S into SP-404"). A snippet holds what its filters select, so saving one sets them first: the
// sends, the output patches and the strips' config (names), and optionally the inserts and effects.

import type { DeskIO, Mismatch } from "./applier";
import { sameName } from "./names";
import { int, str } from "./osc";
import { change, guarded, Refused, type Plan, type PlanChange, type PlanContext } from "./planner";
import { LOAD, SAVE, scene, SCENE_SLOTS, snippet } from "./routing";
import { SCENE_NAME_MAX, type Requester } from "./scenes";

export type ShowKind = "scene" | "snippet";

// A /save or /load the operator sends after a plan's changes.
export interface ShowCommand {
  action: "save" | "load";
  kind: ShowKind;
  index: number; // 0-99
  name: string;
}

export interface ShowSlot {
  index: number;
  name: string;
  used: boolean;
}

const SLOTS = Array.from({ length: SCENE_SLOTS }, (_, i) => i);
const addresses = (kind: ShowKind, n: number) => (kind === "scene" ? scene(n) : snippet(n));

// Every scene's and snippet's name and whether it holds anything, for the read list.
export const showParams = () =>
  (["scene", "snippet"] as const).flatMap((kind) => SLOTS.flatMap((n) => [addresses(kind, n).name, addresses(kind, n).hasdata]));

export function showSlots(get: PlanContext["get"], kind: ShowKind): ShowSlot[] {
  return SLOTS.map((index) => {
    const a = addresses(kind, index);
    return { index, name: String(get(a.name.address) ?? ""), used: get(a.hasdata.address) === 1 };
  });
}

// "Studio base", or the one name that contains what was asked ("base").
function findSlot(slots: ShowSlot[], kind: ShowKind, name: string): ShowSlot {
  const used = slots.filter((s) => s.used && s.name);
  const exact = used.find((s) => sameName(s.name, name));
  const loose = used.filter((s) => s.name.toLowerCase().includes(name.trim().toLowerCase()));
  const found = exact ?? (loose.length === 1 ? loose[0] : undefined);
  if (found) return found;
  const names = used.map((s) => `"${s.name}"`).join(", ") || "none";
  throw new Refused(`No ${kind} named "${name}"${loose.length > 1 ? " (several match)" : ""}. ${kind === "scene" ? "Scenes" : "Snippets"}: ${names}`);
}

const RECALL_CONFIRM: Record<ShowKind, string> = {
  scene: "Loading a scene changes the whole desk (except its scene safes), and can't be undone from here",
  snippet: "Loading a snippet changes everything it holds, and can't be undone from here",
};

export function recallPlan(ctx: PlanContext, req: { kind: ShowKind; name: string }): Plan {
  const slot = findSlot(showSlots(ctx.get, req.kind), req.kind, req.name);
  return {
    summary: `Load ${req.kind} ${slot.index} "${slot.name}"`, changes: [], confirm: RECALL_CONFIRM[req.kind],
    show: { action: "load", kind: req.kind, index: slot.index, name: slot.name },
  };
}

// What a routing snippet holds (Maillot p. 47): Config (names, for the Sampler bus), Sends 1-8, 9-12 and 13-16, and
// Out Patch; with effects, also Insert and FX 1-8.
const EVENT_BITS = { config: 1, insert: 4, sends: [8, 9, 10], fx: [13, 14, 15, 16, 17, 18, 19, 20], outPatch: 24 };
const bits = (list: number[]) => list.reduce((v, b) => v | (1 << b), 0);
export const ROUTING_EVENTS = bits([EVENT_BITS.config, ...EVENT_BITS.sends, EVENT_BITS.outPatch]);
export const EFFECT_EVENTS = bits([EVENT_BITS.insert, ...EVENT_BITS.fx]);
const ALL = -1; // every bit: all 32 channels; all aux ins, FX returns and buses

export interface SnippetRequest {
  name: string;
  effects: boolean; // also hold the inserts and FX settings
}

// The slot it goes in: the snippet of that name (replaced), or the first empty one.
function snippetSlot(ctx: PlanContext, name: string): { slot: ShowSlot; replaces: boolean } {
  const slots = showSlots(ctx.get, "snippet");
  const same = slots.find((s) => s.used && sameName(s.name, name));
  if (same) return { slot: same, replaces: true };
  const free = slots.find((s) => !s.used);
  if (!free) throw new Refused("Every snippet slot is in use; delete one on the desk first");
  return { slot: free, replaces: false };
}

export function saveSnippetPlan(ctx: PlanContext, req: SnippetRequest): Plan {
  const name = req.name.trim();
  if (!name || name.length > SCENE_NAME_MAX) throw new Refused(`A snippet name is 1-${SCENE_NAME_MAX} characters`);
  const { slot, replaces } = snippetSlot(ctx, name);
  const s = snippet(slot.index);
  const filter = (param: typeof s.eventtyp, value: number, what: string): PlanChange[] =>
    change(ctx.get, { param, value, what: `snippet ${slot.index} holds ${what}`, step: 1 });
  const changes = [
    ...filter(s.eventtyp, ROUTING_EVENTS | (req.effects ? EFFECT_EVENTS : 0), req.effects ? "sends, outputs, names, inserts and FX" : "sends, outputs and names"),
    ...filter(s.channels, ALL, "every channel"),
    ...filter(s.auxbuses, ALL, "every aux in, FX return and bus"),
    ...filter(s.maingrps, 0, "no matrix, main or DCA"),
  ];
  return guarded(ctx, {
    summary: `Save the ${req.effects ? "routing and effects" : "routing"} as snippet ${slot.index} "${name}"${replaces ? ", replacing it" : ""}`,
    changes,
    confirm: replaces ? `It replaces snippet ${slot.index} "${slot.name}"` : null,
    show: { action: "save", kind: "snippet", index: slot.index, name },
  });
}

// Send the /save or /load; null if the desk says it worked (and, for a save, the name reads back).
const failed = (cmd: ShowCommand, got: string | undefined): Mismatch => ({
  change: { param: addresses(cmd.kind, cmd.index).name, value: cmd.name, what: `${cmd.action} ${cmd.kind} ${cmd.index} "${cmd.name}"` },
  got,
});

// `/save ,sis <kind> <n> <name>` or `/load ,si <kind> <n>`: true if the desk answers 1.
async function send(desk: Requester, cmd: ShowCommand): Promise<boolean> {
  const address = cmd.action === "save" ? SAVE : LOAD;
  const args = [str(cmd.kind), int(cmd.index), ...(cmd.action === "save" ? [str(cmd.name)] : [])];
  const reply = await desk.request(address, args, (m) => m.address === address);
  return reply.args[1]?.value === 1;
}

// After a save, the name and "has data" read back, which also tells the cache the slot holds something.
async function savedName(desk: DeskIO, cmd: ShowCommand): Promise<string> {
  const a = addresses(cmd.kind, cmd.index);
  const [name] = await Promise.all([desk.read(a.name).catch(() => ""), desk.read(a.hasdata).catch(() => 0)]);
  return String(name);
}

export async function runShowCommand(desk: DeskIO & Requester, cmd: ShowCommand): Promise<Mismatch | null> {
  if (!(await send(desk, cmd))) return failed(cmd, undefined);
  if (cmd.action === "load") return null;
  const name = await savedName(desk, cmd);
  return sameName(name, cmd.name) ? null : failed(cmd, name);
}
