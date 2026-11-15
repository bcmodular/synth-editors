// The four tones' key and velocity ranges (splits and layers, manual p. 76), from the mixer's header: a drawing of
// each tone's span of the keyboard and of velocity (with its cross-fade), and a row of knobs for each tone.

import { getParam, type Patch } from "../core/patch";
import { param } from "../core/paramValue";
import { fmtNote } from "../core/display";
import { PopoverButton } from "../ui/Popover";
import { TONE_COLOURS } from "./colours";
import { useEditor } from "./EditorContext";
import { ParamKnob, ParamSwitch } from "./ParamControls";

const TONES = [0, 1, 2, 3];
const W = 480;
const ROW = 22;
const LABEL = 24;
const X = (v: number) => LABEL + (v / 127) * (W - LABEL - 6);

interface Span {
  lo: number;
  hi: number;
  fade: number;
}

// Which parameters give a tone's span: its lower and upper ends, and (for velocity) its cross-fade.
interface SpanIds {
  lo: string;
  hi: string;
  fade?: string;
}

const KEYS: SpanIds = { lo: "keyLower", hi: "keyUpper" };
const VELOCITY: SpanIds = { lo: "velocityLower", hi: "velocityUpper", fade: "velocityFade" };

const spanOf = (patch: Patch, tone: number, ids: SpanIds): Span => ({
  lo: getParam(patch, param(ids.lo), tone),
  hi: getParam(patch, param(ids.hi), tone),
  fade: ids.fade ? getParam(patch, param(ids.fade), tone) : 0,
});

// A tone's span: a bar from lo to hi, with ramps either side as wide as its cross-fade.
function SpanBar({ s, y, colour, on }: { s: Span; y: number; colour: string; on: boolean }) {
  const h = 8;
  const pts = [[X(Math.max(0, s.lo - s.fade)), y + h], [X(s.lo), y], [X(s.hi), y], [X(Math.min(127, s.hi + s.fade)), y + h]];
  return <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={colour} opacity={on ? 0.85 : 0.25} />;
}

function RangesDrawing({ velocityOn }: { velocityOn: boolean }) {
  const { patch } = useEditor();
  const keysTop = 28;
  const velTop = keysTop + TONES.length * ROW + 22;
  const height = velTop + TONES.length * ROW;
  return (
    <svg className="ranges" width={W} height={height}>
      <text className="rg-head" x={LABEL} y={9}>KEYS</text>
      {[0, 36, 60, 96, 127].map((n) => <text key={n} className="rg-axis" x={X(n)} y={keysTop - 6} textAnchor="middle">{fmtNote(n)}</text>)}
      {TONES.map((t) => (
        <g key={t}>
          <text className="rg-tone" x={0} y={keysTop + t * ROW + 9}>{t + 1}</text>
          <SpanBar s={spanOf(patch, t, KEYS)} y={keysTop + t * ROW} colour={TONE_COLOURS[t]!} on />
        </g>
      ))}
      <text className="rg-head" x={LABEL} y={velTop - 6}>VELOCITY{velocityOn ? "" : " (off)"}</text>
      {TONES.map((t) => (
        <g key={t}>
          <text className="rg-tone" x={0} y={velTop + t * ROW + 9}>{t + 1}</text>
          <SpanBar s={spanOf(patch, t, VELOCITY)}
            y={velTop + t * ROW} colour={TONE_COLOURS[t]!} on={velocityOn} />
        </g>
      ))}
    </svg>
  );
}

function RangesPanel() {
  const { patch } = useEditor();
  const velocityOn = getParam(patch, param("velocityRangeSwitch")) === 1;
  return (
    <>
      <RangesDrawing velocityOn={velocityOn} />
      <ParamSwitch def="velocityRangeSwitch" label="VELOCITY RANGES" />
      <div className="rg-table">
        {TONES.map((t) => (
          <div key={t} className="rg-row" style={{ ["--led" as string]: TONE_COLOURS[t] }}>
            <span className="rg-tone">TONE {t + 1}</span>
            <ParamKnob def="keyLower" tone={t} label="KEY LO" />
            <ParamKnob def="keyUpper" tone={t} label="KEY HI" />
            <ParamKnob def="velocityLower" tone={t} label="VEL LO" />
            <ParamKnob def="velocityUpper" tone={t} label="VEL HI" />
            <ParamKnob def="velocityFade" tone={t} label="FADE" />
          </div>
        ))}
      </div>
      <p className="pop-note">
        Key ranges split the keyboard between tones; velocity ranges layer them by how hard you play (only while
        Velocity Ranges is on). Fade blends a tone in and out at the edges of its velocity range rather than switching.
      </p>
    </>
  );
}

export function RangesButton() {
  return (
    <PopoverButton label="RANGES" title="Key and velocity ranges" className="ranges-btn">
      <RangesPanel />
    </PopoverButton>
  );
}
