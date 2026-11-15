// An EFX type's signal flow, drawn live: the balances set how strongly the dry and wet paths are drawn, and the
// feedback loops carry their values. Hovering a block or a path lights up its parameters (and the other way round,
// from the list beside it: `hot`).

import type { Flow, FlowEdge, FlowNode } from "../../core/efxHelp";
import { FLOW, flowSize, nodeAt, pathOf, routeEdge } from "./flowLayout";
import type { GetParam } from "./useEfx";

interface Props {
  flow: Flow;
  get: GetParam;
  hot: ReadonlySet<string>;
  onHover: (params: readonly string[]) => void;
}

const isHot = (params: readonly string[] | undefined, hot: ReadonlySet<string>) => (params ?? []).some((p) => hot.has(p));

// How much of the signal an edge carries (0…1), and its label: a balance's D or W side, or the loop's values.
function edgeAmount(e: FlowEdge, get: GetParam): { gain: number; text?: string } {
  const name = e.params?.[0];
  if (!name || e.kind === "plain") return { gain: 1 };
  const x = get(name);
  if (e.kind === "fb") return { gain: 1, text: (e.params ?? []).map((n) => get(n).text).join(" · ") };
  const wet = x.raw / Math.max(1, x.p.max);
  const gain = e.kind === "wet" ? wet : 1 - wet;
  return { gain, text: `${e.kind === "wet" ? "W" : "D"} ${Math.round(gain * 100)}` };
}

function NodeMark({ n, hot, onHover }: { n: FlowNode; hot: boolean; onHover: Props["onHover"] }) {
  const { x, y } = nodeAt(n);
  if (n.kind === "sum") return <g className="fl-sum"><circle cx={x} cy={y} r={FLOW.sumR} /><path d={`M${x - 4},${y}H${x + 4}M${x},${y - 4}V${y + 4}`} /></g>;
  if (n.kind !== "fx") {
    const left = n.kind === "in";
    return <text className="fl-io" x={x + (left ? -6 : 6)} y={y + 4} textAnchor={left ? "end" : "start"}>{n.label}</text>;
  }
  return (
    <g className={`fl-fx ${hot ? "hot" : ""}`} onPointerEnter={() => onHover(n.params ?? [])} onPointerLeave={() => onHover([])}>
      <rect x={x - FLOW.fxW / 2} y={y - FLOW.fxH / 2} width={FLOW.fxW} height={FLOW.fxH} rx={4} />
      <text x={x} y={y + 4} textAnchor="middle">{n.label}</text>
    </g>
  );
}

function EdgeMark({ e, from, to, get, hot, onHover, branch }: {
  e: FlowEdge; from: FlowNode; to: FlowNode; get: GetParam; hot: boolean; onHover: Props["onHover"]; branch: boolean;
}) {
  const route = routeEdge(e, from, to);
  const { gain, text } = edgeAmount(e, get);
  const style = { strokeOpacity: 0.2 + 0.8 * gain };
  const params = e.params ?? [];
  return (
    <g className={`fl-edge ${e.kind ?? "plain"} ${hot ? "hot" : ""}`} onPointerEnter={() => onHover(params)} onPointerLeave={() => onHover([])}>
      <path className="hit" d={pathOf(route.points)} />
      <path className="ln" d={pathOf(route.points)} style={style} markerEnd="url(#fl-arrow)" />
      {branch && route.corner && <circle className="dot" cx={route.corner.x} cy={route.corner.y} r={2.5} />}
      {text && <text className="fl-val" x={route.label.x} y={route.label.y} textAnchor={e.kind === "fb" ? "middle" : "start"}>{text}</text>}
    </g>
  );
}

export function FlowDiagram({ flow, get, hot, onHover }: Props) {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const outs = (id: string) => flow.edges.filter((e) => e.from === id).length;
  const { width, height } = flowSize(flow);
  return (
    <svg className="flow" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <marker id="fl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" />
        </marker>
      </defs>
      {flow.edges.map((e) => (
        <EdgeMark key={`${e.from}-${e.to}`} e={e} from={byId.get(e.from)!} to={byId.get(e.to)!} get={get}
          hot={isHot(e.params, hot)} onHover={onHover} branch={outs(e.from) > 1} />
      ))}
      {flow.nodes.map((n) => <NodeMark key={n.id} n={n} hot={isHot(n.params, hot)} onHover={onHover} />)}
    </svg>
  );
}
