// Opening the SP-404 MK2's vendor serial port over Web Serial: 921600 baud 8N1 with DTR and RTS raised.

import { SERIAL_BAUD, SERIAL_USB_ID } from "../core/serialFrames";

const OPEN_SETTLE_MS = 350; // SparkyMK2's notes: their app waits this long; whether it's needed is untested

export const SP404_FILTER = { usbVendorId: SERIAL_USB_ID.vendorId, usbProductId: SERIAL_USB_ID.productId };

export const isSp404Port = (port: SerialPort): boolean => {
  const info = port.getInfo?.();
  return info?.usbVendorId === SERIAL_USB_ID.vendorId && info.usbProductId === SERIAL_USB_ID.productId;
};

export async function openSp404(port: SerialPort): Promise<SerialPort> {
  try {
    await port.open({ baudRate: SERIAL_BAUD, dataBits: 8, stopBits: 1, parity: "none" });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`The SP-404's USB port is busy or unavailable (is another app using it?): ${reason}`);
  }
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await new Promise((r) => setTimeout(r, OPEN_SETTLE_MS));
  return port;
}

export async function choosePort(): Promise<SerialPort> {
  if (!navigator.serial) throw new Error("Web Serial isn't available");
  return navigator.serial.requestPort({ filters: [SP404_FILTER] });
}
