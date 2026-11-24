// While CC learn waits for a control: a press on anything with a data-cc-target (a knob, a fader, a row of buttons),
// or on a drawing's handle or an envelope point, picks it instead of changing it, and the target being listened for
// is marked. Esc cancels learning.
import { useEffect } from "react";
import { useDialog } from "../ui/dialogs";
import { setDragPicker, type CcPick } from "../ui/dragXY";
import type { CcLearn } from "./useCcLearn";

const LISTENING = "cc-listening";

// A press on a control picks it while learning waits for one.
function usePick(picking: boolean, listenFor: CcLearn["listenFor"]) {
  useEffect(() => {
    if (!picking) return;
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-cc-target]");
      const target = el?.getAttribute("data-cc-target");
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      listenFor(target);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [picking, listenFor]);
}

// A drawing's handle or an envelope point picks what it sets; one that sets two values (time and level, gain and
// frequency) asks which.
function useDragPick(picking: boolean, listenFor: CcLearn["listenFor"]) {
  const ask = useDialog();
  useEffect(() => {
    if (!picking) return;
    setDragPicker((picks: CcPick[]) => {
      if (picks.length === 1) return listenFor(picks[0]!.target);
      void ask({ title: "Learn a CC for", message: "This handle sets two values.", buttons: picks.map((p) => p.label) })
        .then((r) => {
          const pick = picks.find((p) => p.label === r?.button);
          if (pick) listenFor(pick.target);
        });
    });
    return () => setDragPicker(null);
  }, [picking, listenFor, ask]);
}

// The controls of the target waiting for its CC are marked.
function useListeningMark(target: string | null) {
  useEffect(() => {
    if (!target) return;
    const els = [...document.querySelectorAll(`[data-cc-target="${CSS.escape(target)}"]`)];
    els.forEach((el) => el.classList.add(LISTENING));
    return () => els.forEach((el) => el.classList.remove(LISTENING));
  }, [target]);
}

function useCancelKey(on: boolean, cancel: () => void) {
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, cancel]);
}

export function useLearnPick({ learning, listenFor, cancel }: CcLearn) {
  usePick(learning === "pick", listenFor);
  useDragPick(learning === "pick", listenFor);
  useListeningMark(learning && learning !== "pick" ? learning.target : null);
  useCancelKey(learning !== null, cancel);
}
