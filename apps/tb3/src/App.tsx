// Phase 0 spike: prove TB-3 RQ1/DT1 and Launchpad Pro Mk1 I/O before building the real editor.
import { useCallback, useEffect, useState } from "react";
import { allLedsOff, ledRgb, padToSlot, parseLaunchpad, programmerLayout, slotToPad } from "@synth-editors/launchpad";
import {
  findInputByName,
  findOutputByName,
  listInputs,
  listOutputs,
  requestMidi,
  toHex,
  type PortInfo,
} from "@synth-editors/midi";
import { PATCH_BLOCKS, addrKey, dt1Nibble16, parseDt1, rq1, type Address } from "./core/sysex";

const VCF_CUTOFF: Address = [0x10, 0x00, 0x0a, 0x00];
const SLOT_DIM_BLUE = [0, 8, 24] as const;
const SLOT_BRIGHT_BLUE = [0, 24, 63] as const;
const LOG_LIMIT = 200;

type PortRole = "tb3In" | "tb3Out" | "lpIn" | "lpOut";

function loadPortName(role: PortRole): string | null {
  try {
    return localStorage.getItem(`port.${role}`);
  } catch {
    return null;
  }
}

function savePortName(role: PortRole, name: string) {
  try {
    localStorage.setItem(`port.${role}`, name);
  } catch {
    // Port memory is a convenience; ignore storage failures.
  }
}

interface ReceivedBlock {
  data: number[];
  checksumOk: boolean;
}

export function App() {
  const [access, setAccess] = useState<MIDIAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<PortInfo[]>([]);
  const [outputs, setOutputs] = useState<PortInfo[]>([]);
  const [ports, setPorts] = useState<Record<PortRole, string | null>>(() => ({
    tb3In: loadPortName("tb3In"),
    tb3Out: loadPortName("tb3Out"),
    lpIn: loadPortName("lpIn"),
    lpOut: loadPortName("lpOut"),
  }));
  const [blocks, setBlocks] = useState<Record<string, ReceivedBlock>>({});
  const [cutoff, setCutoff] = useState(128);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`${stamp}  ${line}`, ...prev].slice(0, LOG_LIMIT));
  }, []);

  useEffect(() => {
    requestMidi()
      .then((a) => {
        const refresh = () => {
          setInputs(listInputs(a));
          setOutputs(listOutputs(a));
        };
        refresh();
        a.onstatechange = refresh;
        setAccess(a);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const choosePort = (role: PortRole, name: string) => {
    savePortName(role, name);
    setPorts((prev) => ({ ...prev, [role]: name }));
  };

  const send = (role: "tb3Out" | "lpOut", bytes: number[]) => {
    const out = access && findOutputByName(access, ports[role]);
    if (!out) {
      addLog(`No ${role === "tb3Out" ? "TB-3" : "Launchpad"} output selected`);
      return false;
    }
    out.send(bytes);
    return true;
  };

  // TB-3 input: collect DT1 blocks.
  useEffect(() => {
    const input = access && findInputByName(access, ports.tb3In);
    if (!input) return;
    input.onmidimessage = (e) => {
      if (!e.data) return;
      const msg = parseDt1(e.data);
      if (!msg) {
        addLog(`TB-3 ← ${toHex(e.data)}`);
        return;
      }
      const key = addrKey(msg.addr);
      setBlocks((prev) => ({ ...prev, [key]: { data: msg.data, checksumOk: msg.checksumOk } }));
      addLog(`TB-3 ← DT1 ${key} (${msg.data.length} bytes${msg.checksumOk ? "" : ", BAD CHECKSUM"})`);
    };
    return () => {
      input.onmidimessage = null;
    };
  }, [access, ports.tb3In, addLog]);

  // Launchpad input: log events, flash the pressed pad.
  useEffect(() => {
    const input = access && findInputByName(access, ports.lpIn);
    if (!input) return;
    input.onmidimessage = (e) => {
      if (!e.data) return;
      const ev = parseLaunchpad(e.data);
      if (!ev) return;
      if (ev.type === "pad") {
        const slot = padToSlot(ev.note);
        addLog(`Launchpad pad ${ev.note} vel ${ev.velocity}${slot ? ` → slot ${slot}` : ""}`);
        if (slot) {
          const [r, g, b] = ev.velocity > 0 ? SLOT_BRIGHT_BLUE : SLOT_DIM_BLUE;
          findOutputByName(access, ports.lpOut)?.send(ledRgb(ev.note, r, g, b));
        }
      } else if (ev.type === "pressure") {
        addLog(`Launchpad pressure ${ev.note} = ${ev.value}`);
      } else {
        addLog(`Launchpad button CC ${ev.cc} = ${ev.value}`);
      }
    };
    return () => {
      input.onmidimessage = null;
    };
  }, [access, ports.lpIn, ports.lpOut, addLog]);

  const requestDump = () => {
    setBlocks({});
    for (const block of PATCH_BLOCKS) {
      if (!send("tb3Out", rq1(block.addr, block.size))) return;
    }
    addLog(`TB-3 → RQ1 × ${PATCH_BLOCKS.length}`);
  };

  const sendCutoff = (value: number) => {
    setCutoff(value);
    send("tb3Out", dt1Nibble16(VCF_CUTOFF, value));
  };

  const initLaunchpad = () => {
    if (!send("lpOut", programmerLayout())) return;
    send("lpOut", allLedsOff());
    for (let slot = 1; slot <= 16; slot++) {
      const [r, g, b] = SLOT_DIM_BLUE;
      send("lpOut", ledRgb(slotToPad(slot), r, g, b));
    }
    addLog("Launchpad → Programmer layout, 16 slots lit");
  };

  if (error) return <main className="app"><p className="error">MIDI unavailable: {error}</p></main>;
  if (!access) return <main className="app"><p>Requesting MIDI access…</p></main>;

  const portSelect = (role: PortRole, label: string, list: PortInfo[]) => (
    <label className="port">
      <span>{label}</span>
      <select value={ports[role] ?? ""} onChange={(e) => choosePort(role, e.target.value)}>
        <option value="">— none —</option>
        {list.map((p) => (
          <option key={p.id} value={p.name}>{p.name}</option>
        ))}
      </select>
    </label>
  );

  const received = PATCH_BLOCKS.filter((b) => blocks[addrKey(b.addr)]).length;

  return (
    <main className="app">
      <h1>TB-3 Editor — Phase 0 spike</h1>

      <section className="panel">
        <h2>Ports</h2>
        <div className="ports">
          {portSelect("tb3In", "TB-3 in", inputs)}
          {portSelect("tb3Out", "TB-3 out", outputs)}
          {portSelect("lpIn", "Launchpad in", inputs)}
          {portSelect("lpOut", "Launchpad out", outputs)}
        </div>
      </section>

      <section className="panel">
        <h2>TB-3</h2>
        <div className="row">
          <button onClick={requestDump}>Request patch dump</button>
          <span>{received} / {PATCH_BLOCKS.length} blocks received</span>
        </div>
        <label className="row">
          <span>VCF cutoff (DT1)</span>
          <input type="range" min={0} max={255} value={cutoff} onChange={(e) => sendCutoff(Number(e.target.value))} />
          <span className="mono">{cutoff}</span>
        </label>
        <table>
          <thead>
            <tr><th>Block</th><th>Address</th><th>Size</th><th>Data</th></tr>
          </thead>
          <tbody>
            {PATCH_BLOCKS.map((b) => {
              const key = addrKey(b.addr);
              const got = blocks[key];
              return (
                <tr key={key} className={got && !got.checksumOk ? "bad" : undefined}>
                  <td>{b.name}</td>
                  <td className="mono">{key}</td>
                  <td className="mono">{got ? `${got.data.length}/${b.size}` : `–/${b.size}`}</td>
                  <td className="mono data">{got ? toHex(got.data) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Launchpad Pro Mk1</h2>
        <div className="row">
          <button onClick={initLaunchpad}>Init Programmer layout + light slots</button>
          <span>Press a top-two-row pad to see it here.</span>
        </div>
      </section>

      <section className="panel">
        <h2>Log</h2>
        <pre className="log">{log.join("\n")}</pre>
      </section>
    </main>
  );
}
