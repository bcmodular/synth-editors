import type { PortInfo } from "@synth-editors/midi";
import type { JvLink } from "../link/useJvLink";

function PortSelect({ ports, value, onChange }: { ports: PortInfo[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">(choose)</option>
      {ports.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
    </select>
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function PortsPanel({ link }: { link: JvLink }) {
  return (
    <section>
      <h2>MIDI</h2>
      <div className="row">
        <label>Out <PortSelect ports={link.outputs} value={link.outName} onChange={link.setOutName} /></label>
        <label>In <PortSelect ports={link.inputs} value={link.inName} onChange={link.setInName} /></label>
        <label>Device ID
          <select value={link.device} onChange={(e) => link.setDevice(Number(e.target.value))}>
            {range(16).map((i) => <option key={i} value={0x10 + i}>{17 + i}</option>)}
          </select>
        </label>
        <label>Patch channel
          <select value={link.channel} onChange={(e) => link.setChannel(Number(e.target.value))}>
            {range(16).map((i) => <option key={i} value={i}>{i + 1}</option>)}
          </select>
        </label>
      </div>
      <p className="dim">The JV ignores SysEx unless SYSTEM › MIDI › Rx Sys Excl is ON, and in GM mode.</p>
    </section>
  );
}
