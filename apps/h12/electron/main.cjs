// Electron main process for the H12 target switcher: one window (its position remembered), with Web MIDI and SysEx
// granted to our own page. All H12 traffic goes through Web MIDI in the renderer (src/hub/).
const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
const { keepWindowState, loadWindowState } = require("./windowState.cjs");

// End-to-end tests set this so the app can never reach the real H12: MIDI is refused, and the tests' fake Web MIDI
// (e2e/fakeH12.ts) stands in for it.
const NO_REAL_MIDI = process.env.H12_NO_REAL_MIDI === "1";
// They also set this to keep the window off screen and out of the Dock, painting as if it were shown.
const HIDDEN = process.env.E2E_HIDDEN === "1";
const PERMISSIONS = new Set(["midi", "midiSysex"]);
// Tests set this to save downloads (the dump's JSON) there, with no save dialog.
const DOWNLOAD_DIR = process.env.H12_DOWNLOAD_DIR;

let win = null;

function createWindow() {
  const remember = !NO_REAL_MIDI; // the tests leave the user's window position alone
  const { maximized, ...bounds } = loadWindowState(remember);
  win = new BrowserWindow({
    ...bounds,
    title: "H12 Target Switcher",
    backgroundColor: "#121214",
    autoHideMenuBar: process.platform !== "darwin",
    show: !HIDDEN,
    webPreferences: { backgroundThrottling: !HIDDEN },
  });
  if (maximized) win.maximize();
  keepWindowState(win, remember);
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  if (HIDDEN) app.dock?.hide();
  const allowed = (permission) => !NO_REAL_MIDI && PERMISSIONS.has(permission);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed(permission));
  // A download (Save JSON) asks where to save, starting in Downloads.
  session.defaultSession.on("will-download", (_e, item) => {
    const name = item.getFilename();
    if (DOWNLOAD_DIR) item.setSavePath(path.join(DOWNLOAD_DIR, name));
    else item.setSaveDialogOptions({ defaultPath: path.join(app.getPath("downloads"), name) });
  });
  createWindow();
});

app.on("window-all-closed", () => app.quit());
