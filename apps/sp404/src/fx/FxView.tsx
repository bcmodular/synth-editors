// The effect's drawing: its own view when it has one (see views/), otherwise a bar per parameter.

import { useState } from "react";
import type { FxDef, FxId } from "../core/fxTypes";
import { useSize } from "../ui/useSize";
import { ParamBars } from "./views/ParamBars";
import type { ViewProps } from "./views/types";
import { VIEWS } from "./views";

export interface FxViewProps {
  fx: FxDef | undefined;
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
}

export const viewFor = (id: FxId): ((p: ViewProps) => React.ReactNode) => VIEWS[id] ?? ParamBars;

export function FxView({ fx, values, onValue }: FxViewProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const { width, height } = useSize(el);
  const View = fx ? viewFor(fx.id) : undefined;
  return (
    <div className="view" ref={setEl}>
      {View && width > 0 && <View fx={fx!} values={values} onValue={onValue} width={width} height={height} />}
      {!fx && <div className="empty">Click the name above to choose an effect</div>}
    </div>
  );
}
