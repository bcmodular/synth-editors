// Where a signal flow (core/efxHelp) is drawn: each node's centre from its grid place, and each path as straight
// runs and square turns (or a straight diagonal for "line"), by its route (see FlowRoute).

import type { Flow, FlowEdge, FlowNode, FlowRoute } from "../../core/efxHelp";

export const FLOW = { colW: 84, rowH: 62, padX: 44, padY: 26, fxW: 74, fxH: 30, tapW: 50, tapH: 20, sumR: 8, loop: 26, jog: 14, arc: 24 } as const;

export interface Point {
  x: number;
  y: number;
}

export interface Route {
  points: readonly Point[];
  label: Point; // where the path's values go
  anchor: "start" | "middle"; // how the label lines up on that point
  corner?: Point; // where the path leaves its source's line (a branch, when other paths share it)
}

export const nodeAt = (n: FlowNode): Point => ({ x: FLOW.padX + n.col * FLOW.colW, y: FLOW.padY + n.row * FLOW.rowH });

// Wide enough for every node, and for the outputs' labels to their right (about 7 px a character).
export function flowSize(flow: Flow): { width: number; height: number } {
  const right = (n: FlowNode) => nodeAt(n).x + (n.kind === "out" ? 10 + (n.label ?? "").length * 7 : FLOW.padX);
  const rows = Math.max(...flow.nodes.map((n) => n.row));
  return { width: Math.max(...flow.nodes.map(right)), height: 2 * FLOW.padY + rows * FLOW.rowH };
}

// Half a node's size: where its paths start and end.
// Blocks grow to fit their labels (about 6.5 px a character at the diagram's size).
const fits = (n: FlowNode, least: number, extra = 0) => Math.max(least, (n.label ?? "").length * 6.5 + 16 + extra) / 2;

export function halfSize(n: FlowNode): { w: number; h: number } {
  if (n.kind === "fx") return { w: fits(n, FLOW.fxW), h: FLOW.fxH / 2 };
  if (n.kind === "tap") return { w: fits(n, FLOW.tapW, n.value ? 26 : 0), h: FLOW.tapH / 2 };
  if (n.kind === "sum") return { w: FLOW.sumR, h: FLOW.sumR };
  return { w: 0, h: 0 }; // in / out are points, with their labels outside
}

function defaultRoute(from: FlowNode, to: FlowNode): FlowRoute {
  if (from.kind === "in" && to.kind !== "sum") return "vh";
  return to.kind === "sum" ? "hv" : "hvh";
}

interface Ends {
  a: Point;
  b: Point;
  from: { w: number; h: number };
  to: { w: number; h: number };
}

const vertical = (a: Point, b: Point) => (b.y > a.y ? 1 : -1);

// Into the target from above or below.
function hv({ a, b, from, to }: Ends): Route {
  const start = { x: a.x + from.w, y: a.y };
  const corner = { x: b.x, y: a.y };
  const end = { x: b.x, y: b.y - vertical(a, b) * to.h };
  return { points: [start, corner, end], label: { x: b.x + 5, y: (a.y + end.y) / 2 + 4 }, anchor: "start", corner };
}

// Along, then up or down just before the target, then into its left side.
function hvh({ a, b, from, to }: Ends): Route {
  const x = b.x - to.w - FLOW.jog;
  const start = { x: a.x + from.w, y: a.y };
  const points = [start, { x, y: a.y }, { x, y: b.y }, { x: b.x - to.w, y: b.y }];
  return { points, label: { x: x + 5, y: (a.y + b.y) / 2 + 4 }, anchor: "start", corner: { x, y: a.y } };
}

// A short way out of the source, up or down, then along into the target's left side.
function vh({ a, b, from, to }: Ends): Route {
  const x = a.x + from.w + FLOW.jog;
  const start = { x: a.x + from.w, y: a.y };
  const end = { x: b.x - to.w, y: b.y };
  return { points: [start, { x, y: a.y }, { x, y: b.y }, end], label: { x: (x + end.x) / 2, y: b.y - 6 }, anchor: "middle", corner: { x, y: a.y } };
}

// Straight across, ending at the edge of a sum's circle.
function line({ a, b, from, to }: Ends): Route {
  const start = { x: a.x + from.w, y: a.y };
  const dx = b.x - start.x;
  const dy = b.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const end = { x: b.x - (dx / len) * to.w, y: b.y - (dy / len) * to.w };
  const t = 0.3;
  return { points: [start, end], label: { x: start.x + dx * t, y: start.y + dy * t + (dy < 0 ? -6 : 14) }, anchor: "start" };
}

// Round the blocks between, above (over) or below (under), into the target from that side.
function around({ a, b, from, to }: Ends, dir: -1 | 1): Route {
  const y = a.y + dir * (FLOW.fxH / 2 + FLOW.arc);
  const x = a.x + from.w + FLOW.jog / 2;
  const points = [{ x: a.x + from.w, y: a.y }, { x, y: a.y }, { x, y }, { x: b.x, y }, { x: b.x, y: b.y + dir * to.h }];
  return { points, label: { x: (x + b.x) / 2, y: y + (dir < 0 ? -5 : 13) }, anchor: "middle", corner: { x, y: a.y } };
}

// Across to the other channel's sum, turning at the middle between the two rows.
function crossLoop({ a, b, from, to }: Ends): Route {
  const down = b.y > a.y;
  const x = a.x + from.w + (down ? 8 : 16);
  const y = (a.y + b.y) / 2 + (down ? -5 : 5);
  const points = [{ x: a.x + from.w, y: a.y }, { x, y: a.y }, { x, y }, { x: b.x, y }, { x: b.x, y: b.y + (down ? -to.h : to.h) }];
  return { points, label: { x: x + 6, y: down ? (a.y + y) / 2 + 4 : (y + a.y) / 2 + 4 }, anchor: "start", corner: { x, y: a.y } };
}

// A feedback loop: out of the block's right, under (or over) it, back into the sum before it; or across to the
// other channel's sum when that is on another row.
function loop(ends: Ends, up: boolean): Route {
  const { a, b, from, to } = ends;
  if (a.y !== b.y) return crossLoop(ends);
  const dir = up ? -1 : 1;
  const x = a.x + from.w + 8;
  const y = a.y + dir * (from.h + FLOW.loop);
  const points = [{ x: a.x + from.w, y: a.y }, { x, y: a.y }, { x, y }, { x: b.x, y }, { x: b.x, y: b.y + dir * to.h }];
  return { points, label: { x: (x + b.x) / 2, y: y - dir * 5 + (up ? 9 : 0) }, anchor: "middle", corner: { x, y: a.y } };
}

// Straight up or down, into the target directly above or below.
function upright({ a, b, from, to }: Ends): Route {
  const dir = vertical(a, b);
  const start = { x: a.x, y: a.y + dir * from.h };
  const end = { x: b.x, y: b.y - dir * to.h };
  return { points: [start, end], label: { x: a.x + 6, y: (start.y + end.y) / 2 + 4 }, anchor: "start" };
}

function straight({ a, b, from, to }: Ends): Route {
  const start = { x: a.x + from.w, y: a.y };
  const end = { x: b.x - to.w, y: b.y };
  return { points: [start, end], label: { x: (start.x + end.x) / 2, y: a.y - 6 }, anchor: "middle" };
}

const ROUTES: Readonly<Record<Exclude<FlowRoute, "loop">, (ends: Ends) => Route>> = {
  hv, hvh, vh, line, over: (ends) => around(ends, -1), under: (ends) => around(ends, 1),
};

export function routeEdge(e: FlowEdge, from: FlowNode, to: FlowNode): Route {
  const ends: Ends = { a: nodeAt(from), b: nodeAt(to), from: halfSize(from), to: halfSize(to) };
  const route = e.route ?? defaultRoute(from, to);
  if (route === "loop") return loop(ends, e.up ?? false);
  const along = route === "hv" || route === "hvh";
  if (along && ends.a.y === ends.b.y) return straight(ends);
  if (along && Math.abs(ends.a.x - ends.b.x) < 1) return upright(ends);
  return ROUTES[route](ends);
}

export const pathOf = (points: readonly Point[]) => points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
