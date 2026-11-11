// The window's last position and size, kept in the app's user data folder and restored at launch. Not used by the
// end-to-end tests (they run with SP404_NO_REAL_SERIAL), so a test run never moves the user's window.
const fs = require("node:fs");
const path = require("node:path");
const { app, screen } = require("electron");

const DEFAULT = { width: 1400, height: 900 };
const SAVE_DELAY_MS = 500;

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

// Restore only bounds that still overlap a display (a monitor may have been unplugged since).
function onSomeDisplay(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
}

function isBounds(b) {
  return b && ["x", "y", "width", "height"].every((k) => Number.isFinite(b[k])) && b.width > 200 && b.height > 150;
}

// { x, y, width, height, maximized } from last time, or the default size.
function loadWindowState(enabled) {
  if (!enabled) return { ...DEFAULT };
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    return isBounds(saved) && onSomeDisplay(saved) ? saved : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

// Save the window's normal (unmaximised) bounds as it moves and resizes, and when it closes.
function keepWindowState(win, enabled) {
  if (!enabled) return;
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    if (win.isDestroyed()) return;
    const state = { ...win.getNormalBounds(), maximized: win.isMaximized() };
    try {
      fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
      fs.writeFileSync(stateFile(), JSON.stringify(state));
    } catch (e) {
      console.warn("Couldn't save the window position:", e);
    }
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };
  for (const event of ["move", "resize", "maximize", "unmaximize"]) win.on(event, later);
  win.on("close", save);
}

module.exports = { loadWindowState, keepWindowState };
