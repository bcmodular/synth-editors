// The SCOPE view, in place of the desk (docs/sp404-design.md › Scopes): the spectrum or spectrogram of L + R, L and
// R waveform lanes over a span in seconds or bars at the MIDI clock's tempo, the stereo correlation, and HOLD.

import { SPANS, type Span } from "./scopeEngine";
import type { Graph, Scopes } from "./useScopes";

const spanLabel = (s: Span) => (s === "4s" ? "4 S" : `${s} BAR${s > 1 ? "S" : ""}`);
const SPAN_TIP = "Waveform span: 4 seconds, or bars at the MIDI clock's tempo (4 s without clock)";

function SpanButtons({ span, onSpan }: { span: Span; onSpan: (s: Span) => void }) {
  return (
    <div className="seg" role="group" aria-label="Waveform span" title={SPAN_TIP}>
      {SPANS.map((s) => (
        <button key={s} className={`btn ${span === s ? "on" : ""}`} aria-pressed={span === s} onClick={() => onSpan(s)}>
          {spanLabel(s)}
        </button>
      ))}
    </div>
  );
}

const GRAPHS: { graph: Graph; label: string; tip: string }[] = [
  { graph: "spectrum", label: "SPECTRUM", tip: "Spectrum of L + R: 1/6 octave, tilted +4.5 dB per octave, with peaks" },
  { graph: "spectrogram", label: "SPECTROGRAM", tip: "Spectrogram of L + R, scrolling over the waveform span" },
];

function GraphButtons({ graph, onGraph }: { graph: Graph; onGraph: (g: Graph) => void }) {
  return (
    <div className="seg graphs" role="group" aria-label="Top panel">
      {GRAPHS.map((g) => (
        <button key={g.graph} className={`btn ${graph === g.graph ? "on" : ""}`} aria-pressed={graph === g.graph}
          title={g.tip} onClick={() => onGraph(g.graph)}>
          {g.label}
        </button>
      ))}
    </div>
  );
}

export function ScopeView({ scopes }: { scopes: Scopes }) {
  const { part, graph } = scopes;
  return (
    <div className="scope" aria-label="Scopes">
      <div className="scopebar">
        <GraphButtons graph={graph} onGraph={scopes.setGraph} />
        <span className="lbl">L + R</span>
        <span className="sp" />
        <span ref={part("clock")} className="clocktext" />
        <SpanButtons span={scopes.span} onSpan={scopes.setSpan} />
        <button className={`btn hold ${scopes.held ? "on" : ""}`} aria-pressed={scopes.held} onClick={scopes.toggleHold}>
          HOLD
        </button>
      </div>
      {graph === "spectrum"
        ? <canvas key="spectrum" ref={part("spectrum")} className="spectrum" aria-label="Spectrum" />
        : <canvas key="spectrogram" ref={part("spectrogram")} className="spectrum" aria-label="Spectrogram" />}
      <div className="lane"><span className="lbl">L</span><canvas ref={part("waveL")} aria-label="Left waveform" /></div>
      <div className="lane"><span className="lbl">R</span><canvas ref={part("waveR")} aria-label="Right waveform" /></div>
      <div className="corr">
        <span className="lbl">CORRELATION</span>
        <span className="end">−1</span>
        <canvas ref={part("correlation")} aria-label="Stereo correlation" />
        <span className="end">+1</span>
        <span ref={part("corrText")} className="v" />
      </div>
    </div>
  );
}
