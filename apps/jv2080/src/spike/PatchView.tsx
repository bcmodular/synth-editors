// Decoded readout of the temporary patch, with each block's raw bytes. The Wave Group ID column answers which raw
// values mean INT-A and INT-B.

import { commonSummary, PATCH_BLOCKS, receivedCount, toneSummary, type PatchBuffer } from "../core/patch";
import { addOffset, addrHex } from "../core/sysex";

const REVERB = ["ROOM1", "ROOM2", "STAGE1", "STAGE2", "HALL1", "HALL2", "DELAY", "PAN-DLY"];
const FILTER = ["OFF", "LPF", "BPF", "HPF", "PKG"];
const GROUP_TYPE = ["INT", "PCM", "EXP"];

function HexDump({ bytes, received, base }: { bytes: number[]; received: boolean[]; base: readonly [number, number, number, number] }) {
  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const cells = bytes.slice(i, i + 16).map((b, j) =>
      received[i + j] ? b.toString(16).toUpperCase().padStart(2, "0") : "··");
    rows.push(`${addrHex(addOffset(base, i))}  ${String(i).padStart(3)}  ${cells.join(" ")}`);
  }
  return <pre className="hex">{rows.join("\n")}</pre>;
}

function ToneTable({ patch }: { patch: PatchBuffer }) {
  return (
    <table>
      <thead>
        <tr><th></th><th>On</th><th>Group type</th><th>Group ID (raw)</th><th>Wave</th><th>Filter</th><th>Cutoff</th><th>Reso</th><th>Level</th><th>Rev send (off. 128)</th></tr>
      </thead>
      <tbody>
        {[1, 2, 3, 4].map((t) => {
          const s = toneSummary(patch.blocks[t]!);
          return (
            <tr key={t}>
              <th>Tone {t}</th><td>{s.on ? "ON" : "off"}</td><td>{GROUP_TYPE[s.groupType] ?? s.groupType}</td>
              <td>{s.groupId}</td><td>{String(s.wave).padStart(3, "0")}</td><td>{FILTER[s.filterType] ?? s.filterType}</td>
              <td>{s.cutoff}</td><td>{s.resonance}</td><td>{s.level}</td><td>{s.reverbSend}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PatchView({ patch }: { patch: PatchBuffer }) {
  const c = commonSummary(patch.blocks[0]!);
  return (
    <>
      <div className="row patch-head">
        <span className="big">{c.name || "—"}</span>
        <span>EFX type {c.efxType}</span><span>Reverb {REVERB[c.reverbType] ?? c.reverbType}</span>
        <span>Level {c.level}</span><span>Pan {c.pan}</span><span>Tempo {c.tempo}</span>
      </div>
      <ToneTable patch={patch} />
      {PATCH_BLOCKS.map((def, i) => (
        <details key={def.name}>
          <summary>{def.name} · {addrHex(def.addr)} · {receivedCount(patch, i)}/{def.size} bytes</summary>
          <HexDump bytes={patch.blocks[i]!} received={patch.received[i]!} base={def.addr} />
        </details>
      ))}
    </>
  );
}
