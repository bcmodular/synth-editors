// The SP-404's USB serial link for the editor: connects by itself to a port the user granted before (at start
// and when the SP-404 is plugged back in), or through Connect, and tears down cleanly when it's unplugged.

import { useCallback, useEffect, useRef, useState } from "react";
import { choosePort, isSp404Port, openSp404 } from "../serial/openPort";
import { SerialLink, type LinkLog } from "../serial/serialLink";
import { CaptureLog } from "../spike/captureLog";
import { emptyDeviceState, Sp404Session, type DeviceState } from "./session";

export type LinkState = "off" | "connecting" | "on";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Dev builds write every serial chunk to a capture file (fixtures/local/sp404-captures), as the spike does, so
// what the device reported can be checked afterwards.
function devCapture(): LinkLog | undefined {
  if (!import.meta.env.DEV || !window.sp404Capture) return undefined;
  const log = new CaptureLog(() => {});
  void log.start().then((file) => console.info("Serial capture:", file));
  return (direction, bytes) => log.bytes(direction, bytes);
}

// Open the port and start a session on it. `onClosed` runs when the link ends (unplugged, or the port closed).
async function openSession(port: SerialPort, onState: (s: DeviceState) => void, onClosed: () => void) {
  await openSp404(port);
  const { readable, writable } = port;
  if (!readable || !writable) throw new Error("The SP-404's port opened without streams");
  const serial = new SerialLink({ readable, writable }, devCapture());
  const session = new Sp404Session(serial, onState);
  void serial.closed.then(() => {
    session.stop();
    void port.close().catch(() => {});
    onClosed();
  });
  return session;
}

// Whenever a serial device is plugged in (and once at start), offer the SP-404's port if it was granted before.
// Only the SP-404's: other USB serial devices on the Mac answer too, but not in its protocol.
function useGrantedPort(attach: (port: SerialPort) => void) {
  useEffect(() => {
    const serial = navigator.serial;
    if (!serial) return;
    const tryGranted = () => void serial.getPorts().then((ports) => {
      const port = ports.find(isSp404Port);
      if (port) attach(port);
    });
    tryGranted();
    serial.addEventListener("connect", tryGranted);
    return () => serial.removeEventListener("connect", tryGranted);
  }, [attach]);
}

export function useDevice() {
  const [device, setDevice] = useState<DeviceState>(emptyDeviceState);
  const [link, setLink] = useState<LinkState>("off");
  const [error, setError] = useState<string>();
  const session = useRef<Sp404Session | null>(null);
  const busy = useRef(false);

  const attach = useCallback(async (port: SerialPort) => {
    if (busy.current || session.current) return;
    busy.current = true;
    setError(undefined);
    setLink("connecting");
    try {
      const s = await openSession(port, setDevice, () => {
        if (session.current === s) session.current = null;
        setLink("off");
      });
      session.current = s;
      setLink("on");
      await s.start();
    } catch (e) {
      setError(message(e));
      setLink(session.current ? "on" : "off");
    } finally {
      busy.current = false;
    }
  }, []);

  useGrantedPort(attach);

  const connect = useCallback(() => {
    choosePort().then(attach, (e: unknown) => setError(message(e)));
  }, [attach]);

  return { device, link, error, connect, session };
}

export type Device = ReturnType<typeof useDevice>;
