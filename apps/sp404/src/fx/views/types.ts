// What an effect's drawing gets: the effect, its raw values, a way to set them, and the space it has.
import type { FxDef } from "../../core/fxTypes";

export interface ViewProps {
  fx: FxDef;
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
  width: number;
  height: number;
}
