// The FX row, in the SP-404's signal order: INPUT FX, the pad buses BUS 1 and BUS 2, then the master chain BUS 3 →
// BUS 4. The last column holds the 16 FX scenes and SYNC ALL FX. The DEL and GRAB modes are in the top bar
// (FxModes).

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

const SCENE_TIP = "A scene is all five buses. Empty: press to store. Stored: press to recall (locked buses stay); "
  + "hold with GRAB on (or Shift) to preview";

function Scene({ slot, fx }: { slot: number; fx: Fx }) {
  const { play, state } = fx;
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no focus, so no focus ring after Shift
    e.currentTarget.setPointerCapture(e.pointerId);
    play.pressScene(slot, play.grab || e.shiftKey);
  };
  const on = currentScene(state) === slot ? "on" : "";
  return (
    <button className={`${state.scenes[slot] ? "stored" : ""} ${on}`} aria-label={`FX scene ${slot + 1}`}
      onPointerDown={onPointerDown} onPointerUp={play.release} onLostPointerCapture={play.release}>
      {slot + 1}
    </button>
  );
}

// The library's modes, in the top bar: DEL (red) and GRAB (white). Each stays on until pressed again.
export function FxModes({ fx }: { fx: Fx }) {
  const { mode, setMode, grab, toggleGrab } = fx.play;
  return (
    <>
      <button className={`pill mode del ${mode === "delete" ? "on" : ""}`} aria-pressed={mode === "delete"}
        title="DEL: pressing a stored preset or scene deletes it; a bus number clears the bus"
        onClick={() => setMode("delete")}>
        DEL
      </button>
      <button className={`pill mode grab ${grab ? "on" : ""}`} aria-pressed={grab}
        title="GRAB: hold a stored preset or scene to hear it; letting go puts back what was there (or hold Shift)"
        onClick={toggleGrab}>
        GRAB
      </button>
    </>
  );
}

function SceneColumn({ fx }: { fx: Fx }) {
  return (
    <div className="side">
      <div className="h">FX SCENES</div>
      <div className={`scenes mode-${fx.play.mode}`} title={SCENE_TIP}>
        {fx.state.scenes.map((_, i) => <Scene key={i} slot={i} fx={fx} />)}
      </div>
      <button className="btn sync" disabled={!fx.outputName} onClick={fx.syncAll}
        title="Send every bus to the SP-404 again (after it was switched off, say)">
        SYNC ALL FX
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
