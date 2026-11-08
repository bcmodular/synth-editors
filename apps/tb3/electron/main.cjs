// Electron main process: one window, Web MIDI + SysEx permissions granted to our own page, and
// the patch library's file access (IPC handlers below, exposed to the page by preload.cjs).
const { app, BrowserWindow, dialog, ipcMain, session, shell } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const MIDI_PERMISSIONS = new Set(["midi", "midiSysex"]);
const LIBRARY_EXTS = new Set([".syx", ".tb3set"]);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1640,
    height: 860,
    minWidth: 640,
    minHeight: 360,
    title: "TB-3 Editor",
    backgroundColor: "#121214",
    autoHideMenuBar: process.platform !== "darwin", // Windows: no menu bar over the editor (Alt shows it)
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

// --- Patch library -------------------------------------------------------------------------
// The page names files by paths relative to the library root ("Bass/Acid 1.syx"); every path is
// resolved here and must stay inside the root.

let root = null;
let watcher = null;
let changeTimer;

function abs(rel) {
  if (!root) throw new Error("No library folder chosen");
  const p = path.resolve(root, rel);
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error("Path is outside the library");
  return p;
}

const relOf = (p) => path.relative(root, p).split(path.sep).join("/");

async function openRoot(dir) {
  const stat = await fsp.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`Library folder not found: ${dir}`);
  root = path.resolve(dir);
  watcher?.close();
  // Finder changes (and our own) refresh the browser; bursts are coalesced.
  watcher = fs.watch(root, { recursive: true }, () => {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => win?.webContents.send("lib:changed"), 150);
  });
  return root;
}

// Folders first, then names in natural order ("Patch 2" before "Patch 10").
const byName = (a, b) =>
  (a.kind === "dir" ? 0 : 1) - (b.kind === "dir" ? 0 : 1) ||
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

async function listDir(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const nodes = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      nodes.push({ kind: "dir", name: e.name, path: relOf(p), children: await listDir(p) });
    } else if (e.isFile() && LIBRARY_EXTS.has(path.extname(e.name).toLowerCase())) {
      const ext = path.extname(e.name).toLowerCase();
      // Patches are a few hundred bytes: send them along so the page can validate every one.
      const data = ext === ".syx" ? new Uint8Array(await fsp.readFile(p)) : undefined;
      const st = await fsp.stat(p);
      nodes.push({
        kind: ext === ".syx" ? "patch" : "set",
        name: e.name,
        path: relOf(p),
        data,
        created: st.birthtimeMs,
        modified: st.mtimeMs,
      });
    }
  }
  return nodes.sort(byName);
}

async function exists(p) {
  return fsp.access(p).then(
    () => true,
    () => false,
  );
}

function registerLibraryIpc() {
  ipcMain.handle("lib:choose", async () => {
    const r = await dialog.showOpenDialog(win, {
      title: "Choose the TB-3 patch library folder",
      properties: ["openDirectory", "createDirectory"],
    });
    return r.canceled || !r.filePaths[0] ? null : openRoot(r.filePaths[0]);
  });
  ipcMain.handle("lib:open", (_e, dir) => openRoot(dir));
  ipcMain.handle("lib:list", () => listDir(abs("")));
  ipcMain.handle("lib:read", async (_e, rel) => new Uint8Array(await fsp.readFile(abs(rel))));
  ipcMain.handle("lib:write", async (_e, rel, data, overwrite) => {
    const p = abs(rel);
    if (!overwrite && (await exists(p))) throw new Error(`EXISTS: ${rel}`);
    await fsp.writeFile(p, typeof data === "string" ? data : Buffer.from(data));
  });
  ipcMain.handle("lib:rename", async (_e, from, to) => {
    const dest = abs(to);
    if (await exists(dest)) throw new Error(`EXISTS: ${to}`);
    await fsp.rename(abs(from), dest);
  });
  ipcMain.handle("lib:trash", (_e, rel) => shell.trashItem(abs(rel)));
  ipcMain.handle("lib:mkdir", (_e, rel) => fsp.mkdir(abs(rel)));
  ipcMain.handle("lib:rmdir", (_e, rel) => fsp.rmdir(abs(rel))); // empty folders only (undo of new folder)
  ipcMain.handle("lib:reveal", (_e, rel) => shell.showItemInFolder(abs(rel)));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(MIDI_PERMISSIONS.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => MIDI_PERMISSIONS.has(permission));
  registerLibraryIpc();
  createWindow();
});

app.on("window-all-closed", () => app.quit());
