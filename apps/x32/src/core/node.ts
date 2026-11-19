// The text the desk sends back for /node batch reads. Phase 1 maps the values to addresses.

// One line of a /node reply, e.g. `/ch/01/config "Volca Kick" 1 YE 1` → path and the values as the desk wrote them.
// Quoted values may contain spaces; quotes are removed. Value meanings depend on the path (phase 1).
export interface NodeLine {
  path: string;
  values: string[];
}

export function parseNodeLine(text: string): NodeLine | null {
  const tokens = [...text.trim().matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? "");
  const [path, ...values] = tokens;
  return path?.startsWith("/") ? { path, values } : null;
}
