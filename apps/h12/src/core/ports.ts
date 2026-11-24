// The H12's port index as the H12 labels it (docs/h12-spec.md › Port index), as an output unless said otherwise.
export function portName(index: number, side: "In" | "Out" = "Out"): string {
  if (index < 16) return `USB host ${index + 1}`;
  if (index < 24) return `USB-C cable ${index - 15}`;
  return `MIDI ${side} ${index - 23}`;
}
