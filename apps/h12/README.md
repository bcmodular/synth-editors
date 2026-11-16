# H12 Target Switcher

Picks one target synth for the Launchkey 49 Mk4 and the DOREMIDI pedal by writing routing and mapper settings to the
CME H12MIDI Pro over SysEx. Requirements: [docs/h12-spec.md](../../docs/h12-spec.md).

So far the app has steps 1 and 2 of the build order: a **read-only check** of the H12 and a **Launchkey clock test**.
Neither writes to the H12.

## Read-only check

 On start-up, and whenever the H12's ports
come or go, the app:

1. sends the serial-and-firmware status request (`F0 00 20 63 0F 26 01 00 01 F7`) to each `H12MIDI-Pro` output in
   turn, Port 1 first, and stops at the first one that answers;
2. shows that port, the firmware (warning below 4.7) and the serial number;
3. reads the current preset (setting 4) and warns unless it is preset 1;
4. lists every problem: no answer, an error answer from the H12, or an answer with a wrong checksum.

It never writes a setting or sends an action.

## Launchkey clock test

Does the Launchkey 49 Mk4's arpeggiator follow clock sent to its USB MIDI port? The panel sends clock to
`Launchkey MK4 49 MIDI In` (never its DAW port), from one of two sources:

- **Generated here**, at the tempo set on the slider (30–300 BPM). Ticks are scheduled 100 ms ahead with Web MIDI
  timestamps, so timer jitter doesn't reach them. A tempo change takes effect at once, without restarting.
- **Forwarded from the Nome II**: each message from `Nome II Clock` is sent on as it arrives. The panel shows the
  tempo the Nome II is sending.

Clock only by default; **Also send Start, Stop and Continue** adds transport, in case the arpeggiator needs it to
reset its phase. Turn Ableton's Sync off for the Launchkey's ports while testing, so it gets one clock only.

```bash
npm run dev:h12        # Vite dev server + Electron window
npm run test:e2e:h12   # Playwright against a fake H12 (real MIDI refused)
npm run test:h12       # the read-only check against the real H12
```

## Findings on the real H12 (firmware 4.7, 2026-11-16)

- **SysEx port:** `H12MIDI-Pro Port 1` (USB-C virtual cable 1) answers; the answer comes back on input Port 1. As
  the app stops at the first answer, the other lanes never get the request.
- **Firmware** 4.7; current preset 1 (Main).
- **Answer flags:** answers can have bit 4 of the command byte set as well as bit 6 (`0x51` for a status answer).
  CME says to ignore the high bits; the parser keeps only the low four.
- **Status 0x02 (USB device on a port) can't be used.** Whatever index is asked for, the answer has port 0 in byte 9,
  and its payload looks like raw memory (`64 0B 00 20` = 0x20000B64). Answers come doubled or truncated. So the
  USB-A host port numbers in the spec's target table still need checking another way: on the device, in HxMIDI
  Tools, or with the reports that action 0x06 (start reports) sends.
