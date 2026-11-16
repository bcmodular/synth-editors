// DESK, SCOPE or KEYS in the mixer area (docs/sp404-design.md › Scopes), remembered between runs.
import { useCallback, useState } from "react";

export type MixerView = "desk" | "scope" | "keys";
const VIEWS: readonly MixerView[] = ["desk", "scope", "keys"];
const KEY = "sp404.mixerView";

export function useMixerView() {
  const [view, setView] = useState<MixerView>(() => {
    const stored = localStorage.getItem(KEY) as MixerView;
    return VIEWS.includes(stored) ? stored : "desk";
  });
  const choose = useCallback((next: MixerView) => {
    localStorage.setItem(KEY, next);
    setView(next);
  }, []);
  return [view, choose] as const;
}
