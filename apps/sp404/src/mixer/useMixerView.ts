// DESK or SCOPE in the mixer area (docs/sp404-design.md › Scopes), remembered between runs.
import { useCallback, useState } from "react";

export type MixerView = "desk" | "scope";
const KEY = "sp404.mixerView";

export function useMixerView() {
  const [view, setView] = useState<MixerView>(() => (localStorage.getItem(KEY) === "scope" ? "scope" : "desk"));
  const choose = useCallback((next: MixerView) => {
    localStorage.setItem(KEY, next);
    setView(next);
  }, []);
  return [view, choose] as const;
}
