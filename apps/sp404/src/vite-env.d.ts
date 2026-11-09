/// <reference types="vite/client" />

// Exposed by electron/preload.cjs; absent when the renderer runs in a plain browser.
interface Window {
  sp404Capture?: {
    start(): Promise<string>; // new capture file under fixtures/local/sp404-captures; returns its path
    append(lines: string): Promise<void>;
    reveal(): Promise<void>;
  };
}

// The parts of Web Serial the app uses (not in TypeScript's DOM library).
interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: "none" }): Promise<void>;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  close(): Promise<void>;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}

interface Navigator {
  readonly serial?: {
    requestPort(options?: { filters?: SerialPortFilter[] }): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
    addEventListener(type: "connect" | "disconnect", listener: () => void): void;
    removeEventListener(type: "connect" | "disconnect", listener: () => void): void;
  };
}
