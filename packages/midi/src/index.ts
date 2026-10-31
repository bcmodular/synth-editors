// Thin wrapper over Web MIDI: access with SysEx, port listing, remembered port choices.

export interface PortInfo {
  id: string;
  name: string;
}

export async function requestMidi(): Promise<MIDIAccess> {
  if (!navigator.requestMIDIAccess) {
    throw new Error("Web MIDI is not available in this browser");
  }
  return navigator.requestMIDIAccess({ sysex: true });
}

export function listInputs(access: MIDIAccess): PortInfo[] {
  return [...access.inputs.values()].map((p) => ({ id: p.id, name: p.name ?? p.id }));
}

export function listOutputs(access: MIDIAccess): PortInfo[] {
  return [...access.outputs.values()].map((p) => ({ id: p.id, name: p.name ?? p.id }));
}

// Port ids are not stable across reconnects; names are. Resolve a remembered name back to a port.
export function findInputByName(access: MIDIAccess, name: string | null): MIDIInput | undefined {
  if (!name) return undefined;
  return [...access.inputs.values()].find((p) => p.name === name);
}

export function findOutputByName(access: MIDIAccess, name: string | null): MIDIOutput | undefined {
  if (!name) return undefined;
  return [...access.outputs.values()].find((p) => p.name === name);
}

export function toHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

export function isSysex(bytes: ArrayLike<number>): boolean {
  return bytes.length >= 2 && bytes[0] === 0xf0 && bytes[bytes.length - 1] === 0xf7;
}

// Split a .syx file's bytes into individual F0…F7 messages. Bytes outside a message are dropped.
export function splitSysex(bytes: ArrayLike<number>): number[][] {
  const messages: number[][] = [];
  let current: number[] | null = null;
  for (const b of Array.from(bytes)) {
    if (b === 0xf0) current = [b];
    else if (current) {
      current.push(b);
      if (b === 0xf7) {
        messages.push(current);
        current = null;
      }
    }
  }
  return messages;
}
