// The SCOPE view, in place of the desk (docs/sp404-design.md › Scopes): the spectrum of L + R, L and R waveform
// lanes with a beat grid from MIDI clock, the stereo correlation, and HOLD.

import { SPANS, type Span } from "./scopeEngine";
import type { Scopes } from "./useScopes";

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

export function ScopeView({ scopes }: { scopes: Scopes }) {
  const { part } = scopes;
  return (
    <div className="scope" aria-label="Scopes">
      <div className="scopebar">
        <span className="lbl">SPECTRUM · L + R · 1/6 OCT · +4.5 dB/OCT</span>
        <span className="sp" />
        <span ref={part("clock")} className="clocktext" />
        <SpanButtons span={scopes.span} onSpan={scopes.setSpan} />
        <button className={`btn hold ${scopes.held ? "on" : ""}`} aria-pressed={scopes.held} onClick={scopes.toggleHold}>
          HOLD
        </button>
      </div>
      <canvas ref={part("spectrum")} className="spectrum" aria-label="Spectrum" />
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
