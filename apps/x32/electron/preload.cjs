// Preload: exposes the UDP relay (main.cjs) to the page as window.x32. Typed in src/desk/relay.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("x32", {
  host: () => ipcRenderer.invoke("x32:host"),
  setHost: (text) => ipcRenderer.invoke("x32:setHost", text),
  discover: (query) => ipcRenderer.invoke("x32:discover", query),
  send: (bytes) => ipcRenderer.send("x32:send", bytes),
  onMessage: (cb) => {
    const listener = (_e, bytes) => cb(bytes);
    ipcRenderer.on("x32:message", listener);
    return () => ipcRenderer.removeListener("x32:message", listener);
  },
});
