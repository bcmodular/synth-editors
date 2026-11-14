// Mac or not: shortcut and file-manager wording in the UI follows the platform.
export const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent);

export const KEYS = IS_MAC
  ? { undo: "⌘Z", redo: "⇧⌘Z", copy: "Option" }
  : { undo: "Ctrl+Z", redo: "Ctrl+Y", copy: "Ctrl" };

// The platform's copy-drag key (Option on the Mac, Ctrl elsewhere) is held during a drag. It's the key the OS itself
// treats as copy; macOS cancels a drag outright while ⌘ is held.
export const copyHeld = (e: { altKey: boolean; ctrlKey: boolean }) => (IS_MAC ? e.altKey : e.ctrlKey);

export const REVEAL_LABEL = IS_MAC ? "Reveal in Finder" : "Show in Explorer";
