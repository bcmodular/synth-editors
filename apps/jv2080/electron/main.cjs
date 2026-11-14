// Electron main process for the JV-2080 editor: one window with Web MIDI (SysEx included) granted to our own page.
const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");

const PERMISSIONS = new Set(["midi", "midiSysex"]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "JV-2080 Editor",
    backgroundColor: "#121214",
    autoHideMenuBar: process.platform !== "darwin",
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(PERMISSIONS.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => PERMISSIONS.has(permission));
  createWindow();
});

app.on("window-all-closed", () => app.quit());
