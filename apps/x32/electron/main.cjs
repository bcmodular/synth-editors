// Electron main process for X32 chat control: one window (its position remembered), the UDP relay to the desk, and
// the Claude relay. The relays only move bytes and requests: OSC encoding, the cache, the agent loop and everything else
// are in the renderer (src/core/), reached through preload.cjs as window.x32 and window.claude.
const { app, BrowserWindow, ipcMain } = require("electron");
const { execFile } = require("node:child_process");
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

// Send failures (macOS refusing local network access, no route to the desk) go to the page as well as the console, so
// "Desk not reachable" can say why.
function reportSocketError(e) {
  console.warn("X32 socket:", e);
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("x32:error", e.code ?? e.message);
}

function openSocket() {
  socket = dgram.createSocket("udp4");
  socket.on("message", (msg, rinfo) => {
    if (!desk || rinfo.port !== desk.port) return; // only the desk's packets
    record("in", msg);
    // Packets can still arrive while the window closes; there's nowhere to deliver them then.
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("x32:message", new Uint8Array(msg));
  });
  socket.on("error", reportSocketError);
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

// The Claude relay (docs/x32-spec.md, "Agent loop"). The API key comes from the macOS Keychain and stays in this
// process: never in the renderer, the config file, the chat log or the repo. X32_FAKE_CLAUDE=1 (the end-to-end tests)
// answers from global.fakeClaude.replies instead, and keeps every request in global.fakeClaude.requests.
const KEYCHAIN = { service: "X32 Chat Control", account: "anthropic-api-key" };
const DEFAULT_MODEL = "claude-haiku-5-5";
const FAKE_CLAUDE = process.env.X32_FAKE_CLAUDE === "1";
let claude = null; // { client } or { problem }

function readKey() {
  return new Promise((resolve) => {
    execFile("security", ["find-generic-password", "-s", KEYCHAIN.service, "-a", KEYCHAIN.account, "-w"], (e, out) =>
      resolve(e ? null : out.trim() || null));
  });
}

async function claudeClient() {
  if (claude) return claude;
  if (FAKE_CLAUDE) {
    global.fakeClaude = { replies: [], requests: [] };
    return (claude = { fake: true });
  }
  const apiKey = await readKey();
  if (!apiKey) return { problem: "no-key" }; // not kept, so adding a key works without a restart
  const Anthropic = require("@anthropic-ai/sdk").default;
  return (claude = { client: new Anthropic({ apiKey }) });
}

async function claudeStatus() {
  const c = await claudeClient();
  return { ready: !c.problem, problem: c.problem ?? null, model: readConfig().model ?? DEFAULT_MODEL, keychain: KEYCHAIN };
}

async function claudeCreate(request) {
  const c = await claudeClient();
  if (c.problem) return { error: "There's no API key in the Keychain." };
  if (c.fake) {
    global.fakeClaude.requests.push(request);
    const reply = global.fakeClaude.replies.shift();
    return reply ?? { error: "The fake Claude has no reply left." };
  }
  try {
    return { message: await c.client.messages.create(request) };
  } catch (e) {
    return { error: e.message ?? String(e) };
  }
}

// The FX preset catalogue (src/core/presets.ts): X32_FX_PRESETS, else fx-presets.json in the data folder, else the
// repo's fixtures/local/x32-fx-presets.json. It's derived from third-party preset files, so it's never in the repo.
function readPresets() {
  const places = [
    process.env.X32_FX_PRESETS,
    path.join(app.getPath("userData"), "fx-presets.json"),
    path.join(__dirname, "..", "..", "..", "fixtures", "local", "x32-fx-presets.json"),
  ].filter(Boolean);
  for (const file of places) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      // not there, or not JSON: try the next place
    }
  }
  return null;
}

// The chat log: one JSON Lines file per day in the data folder (never in the repo, which is public).
function appendChatLog(entry) {
  const dir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`), JSON.stringify(entry) + "\n");
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
  ipcMain.handle("claude:status", () => claudeStatus());
  ipcMain.handle("claude:create", (_e, request) => claudeCreate(request));
  ipcMain.handle("chat:log", (_e, entry) => appendChatLog(entry));
  ipcMain.handle("x32:presets", () => readPresets());
  ipcMain.on("x32:send", (_e, bytes) => {
    if (!desk || !socket) return;
    record("out", bytes);
    socket.send(Buffer.from(bytes), desk.port, desk.address, (e) => e && reportSocketError(e));
  });
  createWindow();
});

app.on("window-all-closed", () => {
  socket?.close();
  socket = null;
  capture?.end();
  app.quit();
});
