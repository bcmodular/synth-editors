// The settings window's state (editor/SettingsWindow.tsx): open or not, and on which tab (remembered). ⌘, and the app
// menu's Settings… open it. LEARN on the CC tab sends it out of the way while a parameter is picked and a knob moved,
// and brings it back on the CC tab when learning ends.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CcLearn } from "./useCcLearn";
import { load, save } from "./storage";

export const SETTINGS_TABS = ["midi", "controllers", "cc", "audio", "library"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const TAB_KEY = "settings.tab";
const savedTab = (): SettingsTab => SETTINGS_TABS.find((t) => t === load(TAB_KEY)) ?? "midi";

const isSettingsKey = (e: KeyboardEvent) => e.key === "," && (e.metaKey || e.ctrlKey);

// ⌘, (Ctrl+, on Windows), and Settings… in the Electron app's menu.
function useOpenKeys(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSettingsKey(e)) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    const off = window.tb3App?.onSettings(open);
    return () => {
      window.removeEventListener("keydown", onKey);
      off?.();
    };
  }, [open]);
}

export function useSettingsWindow(learn: CcLearn) {
  const [isOpen, setOpen] = useState(false);
  const [tab, setTab] = useState(savedTab);
  const reopen = useRef(false);

  const choose = useCallback((t: SettingsTab) => {
    save(TAB_KEY, t);
    setTab(t);
  }, []);
  const open = useCallback(
    (t?: SettingsTab) => {
      if (t) choose(t);
      setOpen(true);
    },
    [choose],
  );
  const close = useCallback(() => setOpen(false), []);
  const openLast = useCallback(() => setOpen(true), []);
  useOpenKeys(openLast);

  const { togglePick, learning } = learn;
  const pick = useCallback(() => {
    reopen.current = true;
    setOpen(false);
    togglePick();
  }, [togglePick]);
  useEffect(() => {
    if (!reopen.current || learning !== null) return;
    reopen.current = false;
    open("cc");
  }, [learning, open]);

  return { isOpen, tab, open, close, choose, pick };
}

export type SettingsWindowState = ReturnType<typeof useSettingsWindow>;
