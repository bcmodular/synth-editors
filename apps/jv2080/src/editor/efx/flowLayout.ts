// Where a signal flow (core/efxHelp.ts) is drawn: each node's centre from its grid place, and each edge as square
// turns. An edge on one row is a straight line; one between rows runs along its source's row, then turns up or
// down into the target; a feedback loop drops under the row and comes back into the sum before its block.

import type { Flow, FlowEdge, FlowNode } from "../../core/efxHelp";

export const FLOW = { colW: 84, rowH: 62, padX: 44, padY: 26, fxW: 74, fxH: 30, sumR: 8, fbDrop: 26 } as const;

export interface Point {
  x: number;
  y: number;
}

export interface Route {
  points: readonly Point[];
  label: Point; // where a label for the edge goes
  corner?: Point; // where the edge leaves its source's row (a branch, when other edges share the row)
}

export const nodeAt = (n: FlowNode): Point => ({ x: FLOW.padX + n.col * FLOW.colW, y: FLOW.padY + n.row * FLOW.rowH });

export function flowSize(flow: Flow): { width: number; height: number } {
  const cols = Math.max(...flow.nodes.map((n) => n.col));
  const rows = Math.max(...flow.nodes.map((n) => n.row));
  return { width: 2 * FLOW.padX + cols * FLOW.colW, height: 2 * FLOW.padY + rows * FLOW.rowH + FLOW.fbDrop };
}

// How far from its centre a node's edges start and end, sideways and up or down.
function halfWidth(n: FlowNode): number {
  if (n.kind === "fx") return FLOW.fxW / 2;
  return n.kind === "sum" ? FLOW.sumR : 0; // in / out are points, with their labels outside
}
const halfHeight = (n: FlowNode) => (n.kind === "fx" ? FLOW.fxH / 2 : FLOW.sumR);

function feedbackRoute(from: FlowNode, to: FlowNode): Route {
  const a = nodeAt(from);
  const b = nodeAt(to);
  const out = a.x + halfWidth(from) + 8;
  const low = a.y + FLOW.fbDrop + halfHeight(from);
  const points = [{ x: a.x + halfWidth(from), y: a.y }, { x: out, y: a.y }, { x: out, y: low }, { x: b.x, y: low }, { x: b.x, y: b.y + halfHeight(to) }];
  return { points, label: { x: (out + b.x) / 2, y: low - 5 }, corner: { x: out, y: a.y } };
}

export function routeEdge(e: FlowEdge, from: FlowNode, to: FlowNode): Route {
  if (e.kind === "fb") return feedbackRoute(from, to);
  const a = nodeAt(from);
  const b = nodeAt(to);
  const start = { x: a.x + halfWidth(from), y: a.y };
  if (a.y === b.y) {
    const end = { x: b.x - halfWidth(to), y: b.y };
    return { points: [start, end], label: { x: (start.x + end.x) / 2, y: a.y - 6 } };
  }
  const down = b.y > a.y;
  const end = { x: b.x, y: b.y + (down ? -1 : 1) * halfHeight(to) };
  const corner = { x: b.x, y: a.y };
  return { points: [start, corner, end], label: { x: b.x + 5, y: (a.y + end.y) / 2 + 4 }, corner };
}

export const pathOf = (points: readonly Point[]) => points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
