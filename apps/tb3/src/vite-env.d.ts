/// <reference types="vite/client" />

// Exposed by electron/preload.cjs; absent when the renderer runs in a plain browser.
interface Window {
  tb3Shell?: {
    setZoom(factor: number): void;
    getZoom(): number;
  };
}
