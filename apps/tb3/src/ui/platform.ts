// Mac or not: shortcut and file-manager wording in the UI follows the platform.
export const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent);

export const KEYS = IS_MAC
  ? { undo: "⌘Z", redo: "⇧⌘Z", alt: "Option" }
  : { undo: "Ctrl+Z", redo: "Ctrl+Y", alt: "Alt" };

export const REVEAL_LABEL = IS_MAC ? "Reveal in Finder" : "Show in Explorer";
