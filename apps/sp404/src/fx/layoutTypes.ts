// How an effect's parameters appear in its module (from the agreed designs, see fxLayout.ts).

export type ControlKind =
  | "knob" // continuous knob
  | "sk" // stepped knob (long numeric lists)
  | "seg" // a row of buttons (two values = a switch)
  | "drop" // drop-down
  | "nv" // note-value matrix (triplet, straight, dotted rows)
  | "nv8" // note-value matrix including bars (2/1 … 1/64)
  | "big" // large latching performance button
  | "sync" // the effect's SYNC switch
  | "inview" // set in the effect's drawing; shown as a button row until it has one
  | `grid:${number}`; // button grid this many across

export interface ControlLayout {
  kind: ControlKind;
  synced?: ControlKind; // how it's shown while SYNC is on
  label?: string; // the name on a big button (LOOP, SCATTER…), where the device just says ON/OFF
}

export interface FxLayout {
  name: string;
  category: string;
  controls: readonly ControlLayout[];
  kill?: boolean; // Isolator: app-side kill buttons
  readouts?: readonly number[]; // parameters shown as readouts (set in the drawing)
  start?: readonly number[]; // starting values from the designs
}
