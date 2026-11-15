// The whole voice's signal flow (core/help/voice.ts), drawn live at the top of every help panel: each path as strong
// as its levels and depths let through, switched-off sources and an off distortion dimmed, each effect showing its
// type. The panel's own section stands out in its colour. Pointing at a block or path lights up its rows and
// controls, and the other way round.
import { efxTypes } from "../../core/efx";
import { gainIds, strength, share, VOICE_FLOW } from "../../core/help/voice";
import type { Point, VoiceBlock, VoiceEdge, VoiceSection } from "../../core/help/voice";
import { getEfxType, getRaw } from "../../core/patch";
import type { Patch } from "../../core/patch";
import { paramById } from "../../core/params";
import { useEditor } from "../EditorContext";

interface Props {
  here?: VoiceSection;
  hot: ReadonlySet<string>;
  hover: (ids: readonly string[]) => void;
}

// What the diagram reads from the patch; with no patch every path is drawn full and no values are shown.
interface Reader {
  amount: (id: string) => number;
  isOn: (id: string) => boolean;
  text: (id: string) => string | undefined;
  efxType: (efx: 1 | 2) => string | undefined;
}

function reader(patch: Patch | null): Reader {
  if (!patch) return { amount: () => 1, isOn: () => true, text: () => undefined, efxType: () => undefined };
  const raw = (id: string) => getRaw(patch, paramById(id));
  return {
    amount: (id) => share(paramById(id), raw(id)),
    isOn: (id) => raw(id) !== 0,
    text: (id) => paramById(id).display(raw(id)),
    efxType: (efx) => efxTypes(efx)[getEfxType(patch, efx)]?.name,
  };
}

const pathOf = (points: readonly Point[]) => points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
const edgeIds = (e: VoiceEdge) => (e.gain ? gainIds(e.gain) : []);
const lit = (ids: readonly string[], hot: ReadonlySet<string>) => ids.some((id) => hot.has(id));
const sectionClass = (s: VoiceSection, here?: VoiceSection) => `vf-${s} ${s === here ? "here" : ""}`;

// The line under a block's name, in a block tall enough for one: its value, its effect's type, or OFF.
function subline(b: VoiceBlock, r: Reader): string | undefined {
  if (b.h < 30) return undefined;
  if (b.off && !r.isOn(b.off)) return "OFF";
  if (b.efx) return r.efxType(b.efx);
  return b.value ? r.text(b.value) : undefined;
}

function Block({ b, r, here, hot, hover }: { b: VoiceBlock; r: Reader } & Props) {
  const [x, y] = b.at;
  const sub = subline(b, r);
  const off = (b.off && !r.isOn(b.off)) || sub === "BYPASS";
  const cls = `vf-block ${sectionClass(b.section, here)} ${off ? "off" : ""} ${lit(b.ids, hot) ? "hot" : ""}`;
  return (
    <g className={cls} onPointerEnter={() => hover(b.ids)} onPointerLeave={() => hover([])}>
      <rect x={x - b.w / 2} y={y - b.h / 2} width={b.w} height={b.h} rx={4} />
      <text x={x} y={sub ? y - 3 : y + 4} textAnchor="middle">{b.label}</text>
      {sub && <text className="v" x={x} y={y + 12} textAnchor="middle">{sub}</text>}
    </g>
  );
}

// How strong a path is (0…1).
const edgeGain = (e: VoiceEdge, r: Reader) => (e.gain ? strength(e.gain, r.amount, r.isOn) : 1);

// The value beside a path, if it shows one: OFF while its switch is off.
function EdgeValue({ e, r }: { e: VoiceEdge; r: Reader }) {
  if (!e.text) return null;
  const off = e.gain?.on !== undefined && !r.isOn(e.gain.on);
  const text = off ? "OFF" : r.text(e.text.id);
  return text ? <text className="vf-val" x={e.text.at[0]} y={e.text.at[1]}>{text}</text> : null;
}

function Edge({ e, r, here, hot, hover }: { e: VoiceEdge; r: Reader } & Props) {
  const gain = edgeGain(e, r);
  const ids = edgeIds(e);
  const cls = `vf-edge ${sectionClass(e.section, here)} ${e.control ? "ctl" : ""} ${lit(ids, hot) ? "hot" : ""}`;
  return (
    <g className={cls} onPointerEnter={() => hover(ids)} onPointerLeave={() => hover([])}>
      <path className="hit" d={pathOf(e.points)} />
      <path className="ln" d={pathOf(e.points)} style={{ strokeOpacity: 0.15 + 0.85 * gain }}
        markerEnd={e.arrow === false ? undefined : "url(#vf-arrow)"} />
      {e.branch && <circle className="dot" cx={e.points[0]![0]} cy={e.points[0]![1]} r={2.5} />}
      <EdgeValue e={e} r={r} />
    </g>
  );
}

export function VoiceDiagram(p: Props) {
  const r = reader(useEditor().patch);
  const f = VOICE_FLOW;
  const [mx, my] = f.mix;
  return (
    <svg className="voice-flow" viewBox={`0 0 ${f.width} ${f.height}`} role="img" aria-label="The TB-3 voice's signal flow">
      <defs>
        <marker id="vf-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8"
          markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" />
        </marker>
      </defs>
      <rect className={`vf-frame ${sectionClass("osc", p.here)}`} x={f.frame.x} y={f.frame.y} width={f.frame.w}
        height={f.frame.h} rx={6} />
      <text className="vf-note" x={72} y={102} textAnchor="middle">from SAW · SQR</text>
      <text className="vf-note" x={72} y={115} textAnchor="middle">WHITE · PINK</text>
      <text className="vf-note" x={726} y={170} textAnchor="middle">order not documented</text>
      {f.edges.map((e) => <Edge key={e.id} e={e} r={r} {...p} />)}
      <g className="vf-sum">
        <circle cx={mx} cy={my} r={8} />
        <path d={`M${mx - 4},${my}H${mx + 4}M${mx},${my - 4}V${my + 4}`} />
      </g>
      {f.blocks.map((b) => <Block key={b.id} b={b} r={r} {...p} />)}
      <text className="vf-io" x={f.out[0] + 6} y={f.out[1] + 4}>OUT</text>
    </svg>
  );
}
