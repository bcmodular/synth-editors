// Electron main process for the SP-404 MK2 editor (Phase 0 spike): one window, Web MIDI and Web Serial
// granted to our own page, and a capture log the page appends to (exposed by preload.cjs).
const { app, BrowserWindow, ipcMain, session, shell } = require("electron");
const fsp = require("node:fs/promises");
const path = require("node:path");

const PERMISSIONS = new Set(["midi", "midiSysex", "serial"]);
// The SP-404 MK2's vendor serial port. Electron reports USB ids as strings; accept hex or decimal.
const SP404 = { vendorId: 0x0582, productId: 0x02e7 };
// Gitignored: a capture holds the user's sample names. Copy what tests need into fixtures by hand.
const CAPTURE_DIR = path.resolve(__dirname, "..", "..", "..", "fixtures", "local", "sp404-captures");

// End-to-end tests set this so the app can never reach a real SP-404: no serial port is offered or granted.
const NO_REAL_SERIAL = process.env.SP404_NO_REAL_SERIAL === "1";

let win = null;
let captureFile = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "SP-404 MK2 Editor",
    backgroundColor: "#121214",
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

const sameId = (reported, wanted) =>
  reported !== undefined && (parseInt(reported, 16) === wanted || parseInt(reported, 10) === wanted);

const isSp404 = (port) => sameId(port.vendorId, SP404.vendorId) && sameId(port.productId, SP404.productId);

// navigator.serial.requestPort() has no chooser in Electron: pick the SP-404, else refuse.
function registerSerialChooser() {
  session.defaultSession.on("select-serial-port", (event, ports, _wc, callback) => {
    event.preventDefault();
    console.log("Serial ports:", ports.map((p) => `${p.portName} ${p.vendorId}:${p.productId} ${p.displayName ?? ""}`));
    callback(NO_REAL_SERIAL ? "" : (ports.find(isSp404)?.portId ?? ""));
  });
}

function registerCaptureIpc() {
  ipcMain.handle("capture:start", async () => {
    await fsp.mkdir(CAPTURE_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    captureFile = path.join(CAPTURE_DIR, `serial-${stamp}.log`);
    await fsp.writeFile(captureFile, `# SP-404 MK2 serial capture ${new Date().toISOString()}\n`);
    return captureFile;
  });
  ipcMain.handle("capture:append", (_e, lines) => (captureFile ? fsp.appendFile(captureFile, lines) : undefined));
  ipcMain.handle("capture:reveal", () => captureFile && shell.showItemInFolder(captureFile));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(PERMISSIONS.has(permission)));
  session.defaultSession.setPermissionCheckHandler(
    (_wc, permission) => PERMISSIONS.has(permission) && !(NO_REAL_SERIAL && permission === "serial"),
  );
  session.defaultSession.setDevicePermissionHandler(
    (details) => !NO_REAL_SERIAL && details.deviceType === "serial" && isSp404(details.device),
  );
  registerSerialChooser();
  registerCaptureIpc();
  createWindow();
});

app.on("window-all-closed", () => app.quit());
