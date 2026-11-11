// Preload: exposes the serial capture log (written by main.cjs) as window.sp404Capture, and the FX library file
// (library.cjs) as window.sp404Library.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sp404Capture", {
  start: () => ipcRenderer.invoke("capture:start"),
  append: (lines) => ipcRenderer.invoke("capture:append", lines),
  reveal: () => ipcRenderer.invoke("capture:reveal"),
});

contextBridge.exposeInMainWorld("sp404Library", {
  load: () => ipcRenderer.invoke("library:load"),
  save: (json) => ipcRenderer.invoke("library:save", json),
  exportFile: (json) => ipcRenderer.invoke("library:export", json),
  importFile: () => ipcRenderer.invoke("library:import"),
  reveal: () => ipcRenderer.invoke("library:reveal"),
  path: () => ipcRenderer.invoke("library:path"),
});
