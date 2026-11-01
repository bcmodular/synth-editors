// Electron main process: one window, Web MIDI + SysEx permissions granted to our own page.
const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");

const MIDI_PERMISSIONS = new Set(["midi", "midiSysex"]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1640,
    height: 860,
    minWidth: 640,
    minHeight: 360,
    title: "TB-3 Editor",
    backgroundColor: "#121214",
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(MIDI_PERMISSIONS.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => MIDI_PERMISSIONS.has(permission));
  createWindow();
});

app.on("window-all-closed", () => app.quit());
