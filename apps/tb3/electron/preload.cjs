// Preload: exposes the patch library's file access (handled in main.cjs) as window.tb3Files.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tb3Files", {
  choose: () => ipcRenderer.invoke("lib:choose"),
  open: (dir) => ipcRenderer.invoke("lib:open", dir),
  list: () => ipcRenderer.invoke("lib:list"),
  read: (rel) => ipcRenderer.invoke("lib:read", rel),
  write: (rel, data, overwrite) => ipcRenderer.invoke("lib:write", rel, data, overwrite),
  rename: (from, to) => ipcRenderer.invoke("lib:rename", from, to),
  trash: (rel) => ipcRenderer.invoke("lib:trash", rel),
  mkdir: (rel) => ipcRenderer.invoke("lib:mkdir", rel),
  rmdir: (rel) => ipcRenderer.invoke("lib:rmdir", rel),
  reveal: (rel) => ipcRenderer.invoke("lib:reveal", rel),
  onChanged: (cb) => {
    const listener = () => cb();
    ipcRenderer.on("lib:changed", listener);
    return () => ipcRenderer.removeListener("lib:changed", listener);
  },
});
