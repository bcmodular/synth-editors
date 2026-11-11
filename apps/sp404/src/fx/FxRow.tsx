// The FX row, in the SP-404's signal order: INPUT FX, the pad buses BUS 1 and BUS 2, then the master chain BUS 3 →
// BUS 4. The last column holds the 16 FX scenes, the STORE and DEL modes, and RESEND.

import type { PointerEvent } from "react";
import type { Bus } from "../core/fxTypes";
import { currentScene } from "./fxLibrary";
import { FxModule } from "./FxModule";
import type { Fx } from "./useFx";

function Group({ title, buses, fx }: { title: string; buses: Bus[]; fx: Fx }) {
  return (
    <div className="grp">
      <div className="gt">{title}</div>
      <div className="gb">
        {buses.map((bus) => (
          <FxModule key={bus} bus={bus} fx={fx} />
        ))}
      </div>
    </div>
  );
}

const SCENE_TIP = "A scene is all five buses. Empty: press to store. Stored: press to recall (locked buses stay), "
  + "hold Shift to preview";

function Scene({ slot, fx }: { slot: number; fx: Fx }) {
  const { play, state } = fx;
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    play.pressScene(slot, e.shiftKey);
  };
  const on = currentScene(state) === slot ? "on" : "";
  return (
    <button className={`${state.scenes[slot] ? "stored" : ""} ${on}`} aria-label={`FX scene ${slot + 1}`}
      onPointerDown={onPointerDown} onPointerUp={play.release} onLostPointerCapture={play.release}>
      {slot + 1}
    </button>
  );
}

function ModeButtons({ fx }: { fx: Fx }) {
  const { mode, setMode } = fx.play;
  return (
    <div className="modes">
      <button className={`btn store ${mode === "store" ? "on" : ""}`} aria-pressed={mode === "store"}
        title="STORE: presets, DEF and scenes store when pressed, over what's there" onClick={() => setMode("store")}>
        STORE
      </button>
      <button className={`btn del ${mode === "delete" ? "on" : ""}`} aria-pressed={mode === "delete"}
        title="DEL: pressing a stored preset or scene deletes it; a bus number clears the bus"
        onClick={() => setMode("delete")}>
        DEL
      </button>
    </div>
  );
}

function SceneColumn({ fx }: { fx: Fx }) {
  return (
    <div className="side">
      <div className="h">FX SCENES</div>
      <div className={`scenes mode-${fx.play.mode}`} title={SCENE_TIP}>
        {fx.state.scenes.map((_, i) => <Scene key={i} slot={i} fx={fx} />)}
      </div>
      <ModeButtons fx={fx} />
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
