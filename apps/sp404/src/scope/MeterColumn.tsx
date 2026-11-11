// The USB OUT column at the desk's right, always on (docs/sp404-design.md › Scopes): L and R peak bars with
// hold and clip, the highest peak, and loudness as LUFS-S (last 3 s) and LUFS-I (since the last click).

import type { Scopes } from "./useScopes";
import type { AudioStatus } from "./useScopeAudio";

const CLIP_TIP = "Clip light and highest peak (dBFS) since the last click: click to clear";
const LUFS_I_TIP = "Integrated loudness (LUFS-I) since the last click: click to start again";

const statusText = (s: AudioStatus) => (s.kind === "error" ? s.message : s.kind === "starting" ? "Opening audio…" : "");

export function MeterColumn({ scopes, status }: { scopes: Scopes; status: AudioStatus }) {
  const { part } = scopes;
  const text = statusText(status);
  return (
    <div className="mx-right" title={status.kind === "on" ? `USB OUT: ${status.name}, after VOLUME` : undefined}>
      <div className="meterwrap">
        <canvas ref={part("meter")} className="metercanvas" aria-label="USB OUT level" />
        {text && <p className="audiostatus" role="status">{text}</p>}
      </div>
      <div className="lbl lr"><span>L</span><span>R</span></div>
      <button ref={part("clip")} className="clip" title={CLIP_TIP} onClick={scopes.clearPeaks}>
        <span ref={part("peak")} className="peak" />
      </button>
      <div className="lbl">LUFS-S</div>
      <span ref={part("lufsS")} className="lufs" aria-label="Short-term loudness" />
      <button className="lufs-i" title={LUFS_I_TIP} onClick={scopes.resetLoudness}>
        <span className="lbl">LUFS-I</span>
        <span ref={part("lufsI")} aria-label="Integrated loudness" />
      </button>
    </div>
  );
}
