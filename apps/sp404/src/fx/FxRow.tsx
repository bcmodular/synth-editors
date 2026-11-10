// The FX row, in the SP-404's signal order: INPUT FX, the pad buses BUS 1 and BUS 2, then the master chain BUS 3 →
// BUS 4. The last column holds the FX scenes (Phase 4) and RESEND.

import type { Bus } from "../core/fxTypes";
import { FxModule } from "./FxModule";
import type { Fx } from "./useFx";

function Group({ title, buses, fx }: { title: string; buses: Bus[]; fx: Fx }) {
  return (
    <div className="grp">
      <div className="gt">{title}</div>
      <div className="gb">
        {buses.map((bus) => (
          <FxModule key={bus} bus={bus} state={fx.buses[bus]} onChoose={fx.chooseEffect} onValue={fx.setValue}
            onToggle={fx.toggle} />
        ))}
      </div>
    </div>
  );
}

function SceneColumn({ fx }: { fx: Fx }) {
  return (
    <div className="side">
      <div className="h">FX SCENES</div>
      <div className="scenes dis" title="FX scenes arrive with the library (Phase 4)">
        {Array.from({ length: 16 }, (_, i) => <span key={i}>{i + 1}</span>)}
      </div>
      <button className="btn" disabled={!fx.outputName} onClick={fx.resendAll}
        title="Send every bus to the SP-404 again (after it was switched off, say)">
        RESEND
      </button>
    </div>
  );
}

export function FxRow({ fx }: { fx: Fx }) {
  return (
    <div className="fxrow">
      <Group title="INPUT" buses={[5]} fx={fx} />
      <Group title="PAD BUSES · BUS 1 · BUS 2" buses={[1, 2]} fx={fx} />
      <div className="flowarrow">→</div>
      <Group title="MASTER · BUS 3 → BUS 4" buses={[3, 4]} fx={fx} />
      <SceneColumn fx={fx} />
    </div>
  );
}
