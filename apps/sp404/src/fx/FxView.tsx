// The effect's drawing: its own view when it has one (see views/), otherwise a bar per parameter.

import { useState } from "react";
import type { FxDef, FxId } from "../core/fxTypes";
import { useSize } from "../ui/useSize";
import { isSyncOn, syncParam } from "../core/fx";
import { setInView } from "./FxControls";
import { FX_LAYOUT } from "./fxLayout";
import { hotProps, ParamKeysContext, useHot } from "./hot";
import { ParamBars } from "./views/ParamBars";
import type { ViewProps } from "./views/types";
import { VIEWS } from "./views";

export interface FxViewProps {
  fx: FxDef | undefined;
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
}

// The parameters set only in the effect's own drawing (pads, steps), which the whole drawing stands for in a help
// panel. Its handles and bars light up on their own.
function drawnKeys(fx: FxDef, values: readonly number[]): string[] {
  if (!VIEWS[fx.id]) return [];
  const controls = FX_LAYOUT[fx.id - 1]?.controls ?? [];
  const sync = syncParam(fx);
  const syncOn = sync ? isSyncOn(values[fx.params.indexOf(sync)] ?? 0) : false;
  return fx.params.filter((_, i) => setInView(controls[i] ?? { kind: "knob" }, syncOn)).map((p) => p.key);
}

export const viewFor = (id: FxId): ((p: ViewProps) => React.ReactNode) => VIEWS[id] ?? ParamBars;

export function FxView({ fx, values, onValue }: FxViewProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const { width, height } = useSize(el);
  const View = fx ? viewFor(fx.id) : undefined;
  const hot = useHot();
  const keys = fx ? drawnKeys(fx, values) : [];
  return (
    <div {...hotProps(hot, keys, "view")} ref={setEl}>
      {View && width > 0 && (
        <ParamKeysContext.Provider value={fx!.params.map((p) => p.key)}>
          <View fx={fx!} values={values} onValue={onValue} width={width} height={height} />
        </ParamKeysContext.Provider>
      )}
      {!fx && <div className="empty">Click the name above to choose an effect</div>}
    </div>
  );
}
