// Drawings for the chorus and reverb, after the SP-404 app's effect views. Each fills its section's width; handles
// and areas drag the parameters they draw (Shift = fine), and their values show at the top.
//   Chorus: two LFO voices (drag: rate sideways, depth up / down), then the delay line: the dry signal, the first
//   tap after the pre-delay (drag sideways) and its repeats dying away by the feedback (drag up / down).
//   Reverb: a decaying tail whose length is the time; for DELAY and PAN-DLY the echoes instead, spaced by the time
//   and dying away by the delay feedback (PAN-DLY alternating left and right).

import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { dragXY } from "../ui/dragXY";
import { Drawing, Handle } from "../ui/Drawing";
import { useEditor } from "./EditorContext";
import { Lit } from "./help/Lit";

const PAD = 8;
const REPEATS = 7;
const DELAY_TYPES = 6; // Reverb Type 6 = DELAY, 7 = PAN-DLY

// A parameter's raw value and how to drag it.
function useParamAxis(id: string, px: number) {
  const { patch, setValue } = useEditor();
  const def = param(id);
  const value = getParam(patch, def);
  return { value, axis: { value, min: def.min, max: def.max, px, onChange: (v: number) => setValue(def, v) } };
}

// Repeats dying away: heights 1, f, f², … for feedback 0–127.
const repeatHeights = (feedback: number) => Array.from({ length: REPEATS }, (_, i) => Math.pow(Math.min(feedback / 127, 0.95), i));

interface Box {
  width: number;
  top: number;
  height: number;
}

interface Sine {
  cycles: number; // across the box
  depth: number; // 0–1 of half the box's height
  phase: number;
}

function sinePoints({ width, top, height }: Box, { cycles, depth, phase }: Sine) {
  const mid = top + height / 2;
  const pts: string[] = [];
  for (let x = PAD; x <= width - PAD; x += 2) {
    const a = ((x - PAD) / (width - 2 * PAD)) * cycles * 2 * Math.PI + phase;
    pts.push(`${x},${(mid - Math.sin(a) * depth * (height / 2 - 3)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const CHORUS_H = 112;
const LFO_H = 50;

export function ChorusView() {
  return (
    <Lit ids={["chorusRate", "chorusDepth", "chorusPreDelay", "chorusFeedback"]}>
      <Drawing height={CHORUS_H}>
        {(w) => <ChorusDrawing width={w} />}
      </Drawing>
    </Lit>
  );
}

function ChorusDrawing({ width }: { width: number }) {
  const rate = useParamAxis("chorusRate", width);
  const depth = useParamAxis("chorusDepth", LFO_H);
  const pre = useParamAxis("chorusPreDelay", width * 0.35);
  const fb = useParamAxis("chorusFeedback", 50);
  const lfoBox = { width, top: 14, height: LFO_H };
  const wave = { cycles: 0.5 + (rate.value / 127) * 7.5, depth: depth.value / 127 };
  const base = CHORUS_H - 6;
  const tapH = CHORUS_H - LFO_H - 22;
  const x0 = PAD + 4;
  const first = x0 + 10 + (pre.value / 127) * width * 0.35;
  const spacing = (width - first - PAD) / REPEATS;
  const heights = repeatHeights(fb.value);
  return (
    <>
      <rect className="well" width={width} height={CHORUS_H} />
      <polyline className="cv" points={sinePoints(lfoBox, { ...wave, phase: 0 })} />
      <polyline className="cv2" points={sinePoints(lfoBox, { ...wave, phase: Math.PI / 2 })} />
      <rect className="drag" x={0} y={12} width={width} height={LFO_H}
        onPointerDown={(e) => dragXY(e, { x: rate.axis, y: depth.axis })} />
      <text className="gt" x={6} y={11}>RATE {rate.value} · DEPTH {depth.value}</text>
      <text className="gt" x={width - 6} y={11} textAnchor="end">PRE-DELAY {pre.value} · FEEDBACK {fb.value}</text>
      <line className="axis" x1={0} x2={width} y1={base} y2={base} />
      <line className="dry" x1={x0} x2={x0} y1={base} y2={base - tapH} />
      {heights.map((h, i) => (
        <line key={i} className="tap" x1={first + i * spacing} x2={first + i * spacing} y1={base} y2={base - h * tapH} />
      ))}
      <Handle x={first} y={base - tapH} onPointerDown={(e) => dragXY(e, { x: pre.axis })} />
      <Handle x={first + spacing} y={base - (heights[1] ?? 0) * tapH} onPointerDown={(e) => dragXY(e, { y: fb.axis })} />
    </>
  );
}

const REVERB_H = 84;

export function ReverbView() {
  return (
    <Lit ids={["reverbTime", "delayFeedback"]}>
      <Drawing height={REVERB_H}>
        {(w) => <ReverbDrawing width={w} />}
      </Drawing>
    </Lit>
  );
}

function ReverbDrawing({ width }: { width: number }) {
  const { patch } = useEditor();
  const type = getParam(patch, param("reverbType"));
  const time = useParamAxis("reverbTime", width * 0.8);
  const fb = useParamAxis("delayFeedback", 50);
  const damp = param("reverbHfDamp").display(getParam(patch, param("reverbHfDamp")));
  const isDelay = type >= DELAY_TYPES;
  return (
    <>
      <rect className="well" width={width} height={REVERB_H} />
      <text className="gt" x={6} y={11}>TIME {time.value}{isDelay ? ` · FEEDBACK ${fb.value}` : ""}</text>
      <text className="gt" x={width - 6} y={11} textAnchor="end">HF DAMP {damp}</text>
      {isDelay
        ? <Echoes width={width} time={time} fb={fb} panned={type === DELAY_TYPES + 1} />
        : <Tail width={width} time={time} />}
    </>
  );
}

type Axis = ReturnType<typeof useParamAxis>;

function Tail({ width, time }: { width: number; time: Axis }) {
  const top = 18;
  const base = REVERB_H - 6;
  const x0 = PAD + 4;
  const len = 20 + (time.value / 127) * (width - x0 - 2 * PAD);
  const pts: string[] = [];
  for (let x = x0; x <= width - PAD; x += 2) pts.push(`${x},${(base - Math.exp((-3 * (x - x0)) / len) * (base - top)).toFixed(1)}`);
  const xt = x0 + len * 0.75;
  return (
    <>
      <line className="axis" x1={0} x2={width} y1={base} y2={base} />
      <polygon className="area" points={[`${x0},${base}`, ...pts, `${width - PAD},${base}`].join(" ")} />
      <polyline className="cv" points={pts.join(" ")} />
      <Handle x={xt} y={base - Math.exp(-2.25) * (base - top)} onPointerDown={(e) => dragXY(e, { x: time.axis })} />
    </>
  );
}

function Echoes({ width, time, fb, panned }: { width: number; time: Axis; fb: Axis; panned: boolean }) {
  const mid = panned ? (REVERB_H + 14) / 2 : REVERB_H - 6;
  const tall = panned ? (REVERB_H - 22) / 2 : REVERB_H - 26;
  const x0 = PAD + 4;
  const spacing = 8 + (time.value / 127) * (width - x0 - PAD) * 0.25;
  const heights = repeatHeights(fb.value);
  const side = (i: number) => (panned && i % 2 === 1 ? -1 : 1);
  return (
    <>
      <line className="axis" x1={0} x2={width} y1={mid} y2={mid} />
      <line className="dry" x1={x0} x2={x0} y1={mid} y2={mid - tall} />
      {heights.map((h, i) => {
        const x = x0 + (i + 1) * spacing;
        return x < width - PAD ? <line key={i} className="tap" x1={x} x2={x} y1={mid} y2={mid - side(i) * h * tall} /> : null;
      })}
      <Handle x={x0 + spacing} y={mid - tall} onPointerDown={(e) => dragXY(e, { x: time.axis })} />
      <Handle x={x0 + 2 * spacing} y={mid - side(1) * (heights[1] ?? 0) * tall} onPointerDown={(e) => dragXY(e, { y: fb.axis })} />
    </>
  );
}
