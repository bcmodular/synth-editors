// Preload: lets the renderer zoom the whole page to fit the window. Electron's zoom scales layout
// and pointer coordinates together, so drag distances stay in CSS px at any size.
const { contextBridge, webFrame } = require("electron");

contextBridge.exposeInMainWorld("tb3Shell", {
  setZoom: (factor) => webFrame.setZoomFactor(factor),
  getZoom: () => webFrame.getZoomFactor(),
});
