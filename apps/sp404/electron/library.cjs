// The FX library file (docs/sp404-design.md › FX library file): `fx-library.json` in the app's user data folder,
// written whole by the page a moment after each change (to a temporary file, then renamed, so a crash mid-write
// leaves the last good copy). Export and Import copy it to or from a file the user picks.
const fs = require("node:fs/promises");
const path = require("node:path");
const { app, dialog, ipcMain, shell } = require("electron");

const libraryFile = () => path.join(app.getPath("userData"), "fx-library.json");

async function readIfThere(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

async function writeWhole(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, text);
  await fs.rename(temp, file);
}

const JSON_FILTERS = [{ name: "SP-404 FX library", extensions: ["json"] }];

async function exportTo(win, text) {
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Export the FX library", defaultPath: `SP-404 FX library ${stamp}.json`, filters: JSON_FILTERS,
  });
  if (canceled || !filePath) return undefined;
  await writeWhole(filePath, text);
  return filePath;
}

async function importFrom(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "Import an FX library", properties: ["openFile"], filters: JSON_FILTERS,
  });
  return canceled || !filePaths[0] ? undefined : fs.readFile(filePaths[0], "utf8");
}

function registerLibraryIpc(getWindow) {
  ipcMain.handle("library:load", () => readIfThere(libraryFile()));
  ipcMain.handle("library:save", (_e, text) => writeWhole(libraryFile(), String(text)));
  ipcMain.handle("library:export", (_e, text) => exportTo(getWindow(), String(text)));
  ipcMain.handle("library:import", () => importFrom(getWindow()));
  ipcMain.handle("library:reveal", () => shell.showItemInFolder(libraryFile()));
  ipcMain.handle("library:path", () => libraryFile());
}

module.exports = { registerLibraryIpc };
