# H12 Target Switcher

Picks one target synth for the Launchkey 49 Mk4 and the DOREMIDI pedal by writing routing and mapper settings to the
CME H12MIDI Pro over SysEx. Requirements: [docs/h12-spec.md](../../docs/h12-spec.md).

So far the app has steps 1–3 of the build order: a **read-only check** of the H12, a **Launchkey clock test** and
**target switching**, the only part that writes to the H12.

## Read-only check

On start-up, and whenever the H12's ports come or go, the app:

1. sends the serial-and-firmware status request (`F0 00 20 63 0F 26 01 00 01 F7`) to each `H12MIDI-Pro` output in
   turn, Port 1 first, and stops at the first one that answers;
2. shows that port, the firmware (warning below 4.7) and the serial number;
3. reads the current preset (setting 4) and warns unless it is preset 1;
4. lists every problem: no answer, an error answer from the H12, or an answer with a wrong checksum.

It never writes a setting or sends an action.

## Target switching

One button per target in [src/targets.json](src/targets.json) (output port index, channel 1–16, pedal CC or `null`).
A target can list `channels` to choose from, as the JV-2080 does for its parts 6–10: small channel buttons under it.
The lit one is the target the H12 is set to now, worked out by reading its settings back. Clicking another:

1. reads the routing of MIDI In 2 (pedal) and MIDI In 3 (Launchkey) and mappers 18–23;
2. the first time ever, keeps those values as a backup, so **Put them back** can restore them;
3. refuses unless the H12 is on preset 1;
4. writes only the settings that differ, each read back before the next, and stops at the first problem (an error
   answer, no answer, a bad checksum, or a value that reads back differently).

The Launchkey's input is routed to the target's output only, and mappers 18–22 turn its channel 1 (Note On, Note Off,
CC, Pitch Bend, Channel AT) into the target's channel. The pedal follows the keys and mapper 23 turns its CC 11 into
the target's pedal CC; with no pedal CC, the pedal is routed nowhere and mapper 23 is left alone. Nothing else on the
H12 is ever written: `core/switcher.ts` refuses any other setting. The backup is kept in the app's local storage
(separately for `npm run dev:h12` and a packaged build).

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
  and its payload looks like raw memory (`64 0B 00 20` = 0x20000B64). Answers come doubled or truncated.
- **Host ports, checked in HxMIDI Tools instead:** U6MIDI Pro-1/2/3 are on host ports 1/2/3 (indices 0/1/2) and
  OXI ONE MKII-1/2/3 on 4/5/6 (indices 3/4/5), inputs and outputs alike, as the spec's target table assumes. All six
  are reserved, so the numbers don't depend on the order the devices are found. CME's page calls these "USB-A
  host ports"; the sockets are USB-C and HxMIDI Tools calls them "USB-C Host".

- **Before the first switch** (read 2026-11-16): mappers 0–23 all hold the factory value, with no inputs enabled
  (words 4 and 5 zero): `7F007F00 7F007F00 00F00F0F 5A000187 0 0`. Word 3's init flag reads 2, and bits 27, 28 and 30
  are set, which CME doesn't document; a mapper written as the spec says has init flag 5 and those bits clear. The
  Launchkey's input (26) was routed to `2500000F` (U6MIDI Pro 1–3, OXI-1, MIDI Out 1, 3 and 6) and the pedal's (25)
  nowhere.

- **Mapper inputs:** CME's page puts the MIDI inputs in word 5 bits 16–21. The H12 doesn't read those: the first
  switch stored the mappers, but HxMIDI Tools showed them with no input, and the keys stayed on channel 1. Selecting
  MIDI In 3 on one of them in HxMIDI Tools changed word 5 from `00040000` to `04000000`, and nothing else. So the
  MIDI inputs are bits 24–29, the same numbering as the port index. HxMIDI kept the app's option word `05000006`
  (init flag 5), so the factory `5A…` value isn't needed.

## Findings on the Launchkey 49 Mk4 (2026-11-16)

- **The arpeggiator follows clock sent to its USB MIDI port** (`Launchkey MK4 49 MIDI In`), both generated here and
  forwarded from the Nome II: changing the tempo changes the arpeggio rate. Forwarding through Web MIDI in the
  renderer sounded fine, so a native MIDI library isn't needed so far.
- **Start (`FA`) restarts the arpeggio** from its first step, so forwarding Start keeps it in phase with the Nome II.
- **Stop (`FC`) doesn't stop it**: the arpeggio runs while keys are held, whatever the transport. That is expected.
