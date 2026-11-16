// Which edits make one undo step. Everything one pointer gesture does is one step: a drag (a knob, an envelope point
// moving its time and level, an EQ handle moving gain and frequency), or a click that sets several values (a new EFX
// type and its start values, an envelope reset, a wave pick). A gesture lasts from the press until shortly after the
// release, so a click's handler still belongs to it. Edits outside a gesture (a CC from a controller, the keyboard)
// merge per parameter while they come close together (undoHistory MERGE_MS).

const AFTER_RELEASE_MS = 400;

let gesture = 0;
let pressed = false;
let releasedAt = -Infinity;
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pointerdown", () => {
    gesture++;
    pressed = true;
  }, true);
  window.addEventListener("pointerup", () => {
    pressed = false;
    releasedAt = performance.now();
  }, true);
}

export interface Merge {
  key: string;
  at: number;
}

// The undo merge for an edit to `paramKey` now.
export function mergeFor(paramKey: string, now = performance.now()): Merge {
  listen();
  const inGesture = pressed || now - releasedAt <= AFTER_RELEASE_MS;
  // A gesture's edits share a key and one time, so a pause in a drag doesn't split it.
  return inGesture ? { key: `gesture ${gesture}`, at: 0 } : { key: paramKey, at: now };
}
listen();
