// Preload: exposes the UDP relay (main.cjs) to the page as window.x32, and the Claude relay and chat log as
// window.claude. Typed in src/desk/relay.ts and src/chat/relay.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("x32", {
  host: () => ipcRenderer.invoke("x32:host"),
  setHost: (text) => ipcRenderer.invoke("x32:setHost", text),
  discover: (query) => ipcRenderer.invoke("x32:discover", query),
  send: (bytes) => ipcRenderer.send("x32:send", bytes),
  onError: (cb) => {
    const listener = (_e, code) => cb(code);
    ipcRenderer.on("x32:error", listener);
    return () => ipcRenderer.removeListener("x32:error", listener);
  },
  onMessage: (cb) => {
    const listener = (_e, bytes) => cb(bytes);
    ipcRenderer.on("x32:message", listener);
    return () => ipcRenderer.removeListener("x32:message", listener);
  },
});

contextBridge.exposeInMainWorld("claude", {
  status: () => ipcRenderer.invoke("claude:status"),
  create: (request) => ipcRenderer.invoke("claude:create", request),
  log: (entry) => ipcRenderer.invoke("chat:log", entry),
});
