// Decoded readout of the temporary patch, with each block's raw bytes. Values come from the core parameter table.

import { getParam, PATCH_BLOCKS, patchName, receivedCount, type Patch, type PatchBuffer } from "../core/patch";
import { param } from "../core/paramValue";
import { addOffset, addrHex, type Address } from "../core/sysex";
import { waveLabel } from "../core/waves";

function HexDump({ bytes, received, base }: { bytes: number[]; received: boolean[]; base: Address }) {
  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const cells = bytes.slice(i, i + 16).map((b, j) =>
      received[i + j] ? b.toString(16).toUpperCase().padStart(2, "0") : "··");
    rows.push(`${addrHex(addOffset(base, i))}  ${String(i).padStart(3)}  ${cells.join(" ")}`);
  }
  return <pre className="hex">{rows.join("\n")}</pre>;
}

// The display value of a parameter.
const shown = (patch: Patch, id: string, tone = 0) => {
  const p = param(id);
  return p.display(getParam(patch, p, tone));
};

const TONE_COLUMNS = ["toneSwitch", "filterType", "cutoff", "resonance", "toneLevel", "tonePan", "reverbSend"];

function ToneTable({ patch }: { patch: Patch }) {
  return (
    <table>
      <thead>
        <tr><th></th><th>Wave</th>{TONE_COLUMNS.map((id) => <th key={id}>{param(id).name}</th>)}</tr>
      </thead>
      <tbody>
        {[0, 1, 2, 3].map((t) => {
          const raw = (id: string) => getParam(patch, param(id), t);
          return (
            <tr key={t}>
              <th>Tone {t + 1}</th>
              <td>{waveLabel(raw("waveGroupType"), raw("waveGroupId"), raw("waveNumber"))}</td>
              {TONE_COLUMNS.map((id) => <td key={id}>{shown(patch, id, t)}</td>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const COMMON_FIELDS = ["efxType", "reverbType", "patchLevel", "patchPan", "tempo"];

export function PatchView({ patch }: { patch: PatchBuffer }) {
  const blocks = patch.blocks;
  return (
    <>
      <div className="row patch-head">
        <span className="big">{patchName(blocks) || "—"}</span>
        {COMMON_FIELDS.map((id) => <span key={id}>{param(id).name} {shown(blocks, id)}</span>)}
      </div>
      <ToneTable patch={blocks} />
      {PATCH_BLOCKS.map((def, i) => (
        <details key={def.name}>
          <summary>{def.name} · {addrHex(def.addr)} · {receivedCount(patch, i)}/{def.size} bytes</summary>
          <HexDump bytes={patch.blocks[i]!} received={patch.received[i]!} base={def.addr} />
        </details>
      ))}
    </>
  );
}
