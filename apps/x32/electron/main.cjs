// Electron main process for X32 chat control: one window (its position remembered), and the UDP relay to the desk.
// The relay only moves bytes: OSC encoding, the cache and everything else are in the renderer (src/core/), reached
// through preload.cjs as window.x32.
const { app, BrowserWindow, ipcMain } = require("electron");
const dgram = require("node:dgram");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { keepWindowState, loadWindowState } = require("./windowState.cjs");

const X32_PORT = 10023;
// End-to-end tests set this so the app can never reach the real desk: only a host on this machine (their fake,
// e2e/fakeX32.ts) is accepted.
const NO_REAL_DESK = process.env.X32_NO_REAL_DESK === "1";
// They also set this to keep the window off screen and out of the Dock, painting as if it were shown.
const HIDDEN = process.env.E2E_HIDDEN === "1";
// X32_CAPTURE=1 writes every OSC packet in and out to captures/ in the data folder, to check the fake against the desk.
// A path instead of 1 writes them there (the hardware tests use a throwaway profile).
const CAPTURE = process.env.X32_CAPTURE && process.env.X32_CAPTURE !== "0" ? process.env.X32_CAPTURE : null;

let win = null;
let socket = null;
let desk = null; // { address, port }
let capture = null;

const configFile = () => path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(config, null, 2));
}

// "192.168.1.50" or "127.0.0.1:50123" → { address, port }, or null if it isn't a host we may talk to.
function parseHost(text) {
  const m = /^\s*([\w.-]+)(?::(\d{1,5}))?\s*$/.exec(text ?? "");
  if (!m) return null;
  const host = { address: m[1], port: m[2] ? Number(m[2]) : X32_PORT };
  if (NO_REAL_DESK && host.address !== "127.0.0.1" && host.address !== "localhost") return null;
  return host;
}

// The desk's address: X32_HOST wins (tests, the fake), then the saved setting.
const currentHost = () => process.env.X32_HOST ?? readConfig().host ?? "";

function record(dir, bytes) {
  if (!CAPTURE) return;
  if (!capture) {
    const dir_ = CAPTURE === "1" ? path.join(app.getPath("userData"), "captures") : CAPTURE;
    fs.mkdirSync(dir_, { recursive: true });
    capture = fs.createWriteStream(path.join(dir_, `${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`));
  }
  capture.write(JSON.stringify({ t: Date.now(), dir, b64: Buffer.from(bytes).toString("base64") }) + "\n");
}

function openSocket() {
  socket = dgram.createSocket("udp4");
  socket.on("message", (msg, rinfo) => {
    if (!desk || rinfo.port !== desk.port) return; // only the desk's packets
    record("in", msg);
    // Packets can still arrive while the window closes; there's nowhere to deliver them then.
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("x32:message", new Uint8Array(msg));
  });
  socket.on("error", (e) => console.warn("X32 socket:", e));
  socket.bind(0);
}

// Finding desks: send the renderer's query (/xinfo) to every broadcast address and hand back whatever answers in time.
// In tests only X32_DISCOVER_TO (the fake desk, on this machine) is asked, so nothing goes onto the network.
const DISCOVER_MS = 1200;

function broadcastTargets() {
  if (NO_REAL_DESK) return process.env.X32_DISCOVER_TO ? [parseHost(process.env.X32_DISCOVER_TO)].filter(Boolean) : [];
  const subnets = Object.values(os.networkInterfaces()).flat()
    .filter((l) => l && l.family === "IPv4" && !l.internal)
    .map((l) => {
      const mask = l.netmask.split(".").map(Number);
      return l.address.split(".").map((o, i) => o | (~mask[i] & 255)).join(".");
    });
  return [...new Set(["255.255.255.255", ...subnets])].map((address) => ({ address, port: X32_PORT }));
}

function discover(query) {
  return new Promise((resolve) => {
    const replies = [];
    const s = dgram.createSocket("udp4");
    s.on("message", (msg, rinfo) => replies.push({ from: `${rinfo.address}:${rinfo.port}`, bytes: new Uint8Array(msg) }));
    s.on("error", () => resolve(replies));
    s.bind(0, () => {
      s.setBroadcast(true);
      for (const t of broadcastTargets()) s.send(Buffer.from(query), t.port, t.address);
      setTimeout(() => {
        s.close();
        resolve(replies);
      }, DISCOVER_MS);
    });
  });
}

function setDesk(text) {
  desk = parseHost(text);
  return desk ? `${desk.address}:${desk.port}` : null;
}

function createWindow() {
  const remember = !NO_REAL_DESK; // the tests leave the user's window position alone
  const { maximized, ...bounds } = loadWindowState(remember);
  win = new BrowserWindow({
    ...bounds,
    title: "X32 Chat Control",
    backgroundColor: "#121214",
    autoHideMenuBar: process.platform !== "darwin",
    show: !HIDDEN,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), backgroundThrottling: !HIDDEN },
  });
  if (maximized) win.maximize();
  win.on("closed", () => {
    win = null;
  });
  keepWindowState(win, remember);
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  if (HIDDEN) app.dock?.hide();
  openSocket();
  setDesk(currentHost());
  ipcMain.handle("x32:host", () => (desk ? `${desk.address}:${desk.port}` : currentHost()));
  ipcMain.handle("x32:setHost", (_e, text) => {
    const set = setDesk(text);
    if (set && !process.env.X32_HOST) writeConfig({ ...readConfig(), host: text.trim() });
    return set;
  });
  ipcMain.handle("x32:discover", (_e, query) => discover(query));
  ipcMain.on("x32:send", (_e, bytes) => {
    if (!desk || !socket) return;
    record("out", bytes);
    socket.send(Buffer.from(bytes), desk.port, desk.address);
  });
  createWindow();
});

app.on("window-all-closed", () => {
  socket?.close();
  socket = null;
  capture?.end();
  app.quit();
});
