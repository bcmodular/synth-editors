// An EFX type's signal flow, drawn live: each path is as strong as its gains (balances, pans, levels) let through,
// and shows their values; feedback loops show theirs; paths that depend on a setting (Feedback Mode) appear only
// while it's set. Hovering a block or a path lights up its parameters (and the other way round, from the list
// beside it: `hot`).

import { gainOf, gainText, valueText, type Flow, type FlowEdge, type FlowNode } from "../../core/efxHelp";
import { FLOW, flowSize, halfSize, nodeAt, pathOf, routeEdge } from "./flowLayout";
import type { GetParam } from "./useEfx";

interface Props {
  flow: Flow;
  get: GetParam;
  hot: ReadonlySet<string>;
  onHover: (params: readonly string[]) => void;
}

const SCALE = 1.35; // drawn larger than its layout units, text and all

const edgeParams = (e: FlowEdge) => [...(e.gains ?? []).map((g) => g.param), ...(e.params ?? []), ...(e.when ? [e.when.param] : [])];
const isHot = (params: readonly string[], hot: ReadonlySet<string>) => params.some((p) => hot.has(p));

// How much of the signal a path carries (0…1) and what it says: its gains, then its own values.
function edgeAmount(e: FlowEdge, get: GetParam): { gain: number; text: string } {
  const gains = (e.gains ?? []).map((g) => ({ g, x: get(g.param) }));
  const gain = gains.reduce((v, { g, x }) => v * gainOf(x.p, x.raw, g.side), 1);
  if (e.quiet) return { gain, text: "" };
  const texts = [...gains.map(({ g, x }) => gainText(x.p, x.raw, x.text, g.side)), ...(e.params ?? []).map((n) => valueText(n, get(n).text))];
  return { gain, text: texts.join(" · ") };
}

function NodeMark({ n, get, hot, onHover }: { n: FlowNode; get: GetParam; hot: boolean; onHover: Props["onHover"] }) {
  const { x, y } = nodeAt(n);
  if (n.kind === "sum") return <g className="fl-sum"><circle cx={x} cy={y} r={FLOW.sumR} /><path d={`M${x - 4},${y}H${x + 4}M${x},${y - 4}V${y + 4}`} /></g>;
  if (n.kind === "in" || n.kind === "out") {
    const left = n.kind === "in";
    return <text className="fl-io" x={x + (left ? -6 : 6)} y={y + 4} textAnchor={left ? "end" : "start"}>{n.label}</text>;
  }
  const { w, h } = halfSize(n);
  return (
    <g className={`fl-${n.kind} ${hot ? "hot" : ""}`} onPointerEnter={() => onHover(n.params ?? [])} onPointerLeave={() => onHover([])}>
      <rect x={x - w} y={y - h} width={2 * w} height={2 * h} rx={4} />
      <text x={x} y={y + 4} textAnchor="middle">{n.label}{n.value && <tspan className="v"> {get(n.value).text}</tspan>}</text>
    </g>
  );
}

function EdgeMark({ e, from, to, get, hot, onHover, branch }: {
  e: FlowEdge; from: FlowNode; to: FlowNode; get: GetParam; hot: boolean; onHover: Props["onHover"]; branch: boolean;
}) {
  const route = routeEdge(e, from, to);
  const { gain, text } = edgeAmount(e, get);
  const kind = e.route === "loop" ? "fb" : e.gains?.length ? "gain" : "plain";
  return (
    <g className={`fl-edge ${kind} ${hot ? "hot" : ""}`} onPointerEnter={() => onHover(edgeParams(e))} onPointerLeave={() => onHover([])}>
      <path className="hit" d={pathOf(route.points)} />
      <path className="ln" d={pathOf(route.points)} style={{ strokeOpacity: 0.15 + 0.85 * gain }} markerEnd="url(#fl-arrow)" />
      {branch && route.corner && <circle className="dot" cx={route.corner.x} cy={route.corner.y} r={2.5} />}
      {text && <text className="fl-val" x={route.label.x} y={route.label.y} textAnchor={route.anchor}>{text}</text>}
    </g>
  );
}

export function FlowDiagram({ flow, get, hot, onHover }: Props) {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const edges = flow.edges.filter((e) => !e.when || get(e.when.param).raw === e.when.is);
  const outs = (id: string) => edges.filter((e) => e.from === id && e.route !== "loop").length;
  const { width, height } = flowSize(flow);
  return (
    <svg className="flow" width={width * SCALE} height={height * SCALE} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <marker id="fl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse"
          orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" />
        </marker>
      </defs>
      {edges.map((e) => (
        <EdgeMark key={`${e.from}-${e.to}-${e.when?.is ?? ""}`} e={e} from={byId.get(e.from)!} to={byId.get(e.to)!} get={get}
          hot={isHot(edgeParams(e), hot)} onHover={onHover} branch={e.route !== "loop" && outs(e.from) > 1} />
      ))}
      {flow.nodes.map((n) => <NodeMark key={n.id} n={n} get={get} hot={isHot(n.params ?? [], hot)} onHover={onHover} />)}
    </svg>
  );
}
