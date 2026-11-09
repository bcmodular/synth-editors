// Preload: exposes the serial capture log (written by main.cjs) as window.sp404Capture.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sp404Capture", {
  start: () => ipcRenderer.invoke("capture:start"),
  append: (lines) => ipcRenderer.invoke("capture:append", lines),
  reveal: () => ipcRenderer.invoke("capture:reveal"),
});
