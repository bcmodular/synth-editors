# H12 target switcher — requirements

App: `apps/h12` in this repo (not started). Repo conventions in CLAUDE.md take precedence over the stack suggestions here.

Pick one target synth, and the Launchkey 49 Mk4 and the DOREMIDI pedal both play that synth. The switch is done by writing routing and mapper settings to the CME H12MIDI Pro over SysEx, from a TypeScript module inside the existing Electron controller app.

## Context

- **Hub:** CME H12MIDI Pro, firmware 4.7, connected to the Mac over USB. It hosts the OXI One and a U6MIDI Pro on its USB host ports and has six TRS MIDI in/out pairs.
- **Launchkey 49 Mk4:** DIN MIDI out into H12 MIDI In 3. It has no MIDI in. Its USB goes to the Mac separately (Ableton and the custom apps); this tool does not touch that.
- **DOREMIDI MPC-10 pedal converter:** MIDI out into H12 MIDI In 2. Its protocol is undocumented (configured over a USB serial port by DOREMIDI's own tool), so it is set once and never changed by this tool.
- **Clock:** comes from a Nome II and is already routed and filtered. This tool must not change clock routing or any filters.
- **Today:** the target is chosen by changing the Launchkey's MIDI channel, plus a second H12 preset for the SP-404 and JV-2080. This tool replaces both.

## One-off setup (manual, outside the tool)

1. In DOREMIDI Pedal Config Tool, set EXP1 to **CC 11 on channel 1**, full range, and save to the device.
2. On the Launchkey, set the keys (Part A) to **channel 1**. Leave custom-mode app controls on channel 13 (already filtered off synth outputs in the H12).
3. Work in H12 preset 1 ("Main") only. Preset 2 is retired.
4. On the Nome II, set Play button 1 Output (PL.1) to **bot** and Auto-play (A.PL) to **bot**, so play button 1 and Ableton (via U-SYNC) start both outputs. Output 2 then carries clock *and* start/stop into H12 MIDI In 1, and the H12's per-output filters decide which devices get transport.

## What `setTarget(name)` does

1. Reads the target from a JSON target list (below).
2. Writes the routing for the Launchkey input (MIDI In 3, port index 26): only the target's output bit set.
3. Writes the routing for the pedal input (MIDI In 2, port index 25): the same single output bit.
4. Writes the Launchkey mappers (one per message type) so channel 1 becomes the target's channel.
5. Writes the pedal mapper so CC 11 on channel 1 becomes the target's pedal CC on the target's channel.
6. Reads every written setting back and compares. Reports success or the first mismatch.

Other routes, filters and mappers must not be changed.

## Target list (JSON, user-editable)

| Target | Output port index | Channel | Pedal CC |
|---|---|---|---|
| TB-3 | 0 (U6MIDI Pro-1) | 2 | TBD (e.g. cutoff) |
| JV-2080 | 1 (U6MIDI Pro-2) | 6 | 11 (expression) |
| TR-8S | 2 (U6MIDI Pro-3) | 10 | TBD |
| OXI (play/record into selected track) | 3 (OXI ONE MKII-1) | 14 | TBD |
| Thru5 synths: TD-3-MO | 24 (MIDI Out 1) | 5 | TBD |
| Thru5 synths: Volca Bass | 24 (MIDI Out 1) | 8 | TBD |
| Thru5 synths: Volca Kick | 24 (MIDI Out 1) | 9 | TBD |
| Thru5: TC M300 | 24 (MIDI Out 1) | 1 | TBD (M300 CCs 12–20, 50–51, 80–83) |
| S-1 | 26 (MIDI Out 3) | 3 | TBD |
| SP-404 Mk2, chromatic | 28 (MIDI Out 5) | 16 | TBD |
| P-6 sample pads | 29 (MIDI Out 6) | 11 | TBD |
| P-6 granular | 29 (MIDI Out 6) | 12 | TBD |

Store as JSON, e.g. `{ "name": "TB-3", "output": 0, "channel": 2, "pedalCc": 74 }` (channel 1-based in the file, 0-based on the wire). Unknown pedal CCs: leave null and send no pedal mapping (route the pedal nowhere).

## Sync mode per device

A second control, independent of the target: for each device, choose how it follows the Nome II. This switches a synth between running its own sequencer in sync and being played from the OXI, Ableton or the keys.

| Mode | Clock | Start/Stop/Continue/Song Position | Use when |
|---|---|---|---|
| **Own sequencer** | On | On | The synth's internal sequencer plays, started and stopped with the Nome II |
| **External** (default) | On | Off | The OXI, Ableton or the keys play it; clock still syncs its tempo-based effects and arpeggiators |
| **Free** | Off | Off | Fully independent: its own tempo, started by hand |

### How it's done

Through the H12's **message filter (setting 2)** on each output, indices 30–59 (output = 30 + port index). Read-modify-write only these bits, leaving every other bit as it is:

| Bit | Message | Set = blocked |
|---|---|---|
| 9 | Song position | Blocked in External and Free |
| 12 | Clock | Blocked in Free only |
| 13 | Start | Blocked in External and Free |
| 14 | Continue | Blocked in External and Free |
| 15 | Stop | Blocked in External and Free |

The value is one word. Never touch the channel filters (setting 1).

### Devices

| Device | Output port index | Filter index | Notes |
|---|---|---|---|
| TB-3 | 0 (U6MIDI Pro-1) | 30 | |
| JV-2080 | 1 (U6MIDI Pro-2) | 31 | No sequencer: offer External and Free only |
| TR-8S | 2 (U6MIDI Pro-3) | 32 | |
| Thru5 group: TD-3-MO, Volca Bass, Volca Kick, iPad, TC M300 | 24 (MIDI Out 1) | 54 | One setting for the whole group; the M300 ignores transport anyway |
| S-1 | 26 (MIDI Out 3) | 56 | |
| SP-404 Mk2 | 28 (MIDI Out 5) | 58 | |
| P-6 | 29 (MIDI Out 6) | 59 | |

Not controlled here: the OXI (cabled straight from Nome II Output 1) and the BCR32 (analog sync from the Nome II).

### One-off change to the Nome II input

Clear bits 9, 13, 14 and 15 of the message filter on **input 24** (MIDI In 1, Nome II), so start/stop reaches the per-output filters. Keep clock (bit 12) unblocked and leave its other bits as they are. Do this only after every synth output has been set to External, so nothing starts unexpectedly.

### Behaviour

- **Safe default:** on first run, and whenever the state is unknown, set every device to External before changing the Nome II input filter.
- **UI:** one control per device row, showing the current mode read back from the H12.
- **Presets of modes:** optional saved sets, e.g. "All external (OXI)", "TR-8S + TB-3 own sequencers", applied in one go.
- **While running:** changing a device to Own sequencer mid-song only takes effect at the next Start. Show a hint ("starts on next play").

## Clock forwarder for the Launchkey arpeggiator

The Launchkey 49 Mk4 has no MIDI input, so the H12 can't clock it. Its USB is connected to the Mac, so the app forwards clock in software.

- **Source:** the Nome II's own USB port "Nome II Clock" (macOS MIDI source). It sends clock in both dawless and Ableton modes (in Ableton mode the Nome II follows Ableton via U-SYNC), and doesn't depend on the H12.
- **Destination:** the Launchkey's **MIDI** port (not its DAW port).
- **Forward:** Timing Clock (`F8`) only by default. Start/Stop/Continue (`FA FC FB`) behind an option, in case the arpeggiator needs them to reset its phase. Tested: Start restarts the arpeggio from its first step; Stop doesn't stop it (it runs while keys are held). See apps/h12/README.md.
- **Timing:** forward each message as soon as it arrives, with no batching or timers. Use a native MIDI library (e.g. `@julusian/midi` in the Electron main process) rather than Web MIDI in the renderer, to keep jitter low. Tested: forwarding through Web MIDI in the renderer sounded fine, so start with that.
- **One clock only:** if Ableton is set to send clock to the Launchkey's port (Sync output on), the app must not forward as well. Show a warning, or provide a toggle and a note in the Ableton setup.
- **Toggle:** on/off in the app, remembered between runs. Pause automatically if the source or destination port disappears, and resume when it comes back.
- **No loops:** never forward anything coming from the Launchkey's own ports back to it.

Requires the Mac to be on and the app running. The H12 already blocks clock on the Launchkey's DIN input (MIDI In 3), so if the Launchkey echoes clock out of its DIN port it won't reach the synths.

## H12 SysEx protocol (from CME's published MIDI implementation)

Source: https://cme-pro.com/midi-implementation/H12MIDI-Pro.html

### Frame

```
F0 00 20 63 0F 26 cc pp ss ii dd… ck F7
```

- `26` = product ID of the hub side. Use it for everything here.
- `cc` command: `00` action, `01` read status, `02` read setting, `03` write setting. Answers have bit 6 set (`0x40`); only the low 4 bits carry the command.
- `pp` setting ID. `ss` payload size in 32-bit words. `ii` index.
- `ck` = (sum of bytes from `cc` to the last payload byte) & 0x7F.
- Error answer: `F0 00 20 63 0F 26 (cc|40) ee ck F7`, with `ee` 0x7A–0x7F (0x7E wrong checksum, 0x7F unknown command/parameter, 0x7C out of range).

### Data encoding

A 32-bit word becomes 5 bytes, least significant first:

```ts
out[0] =  v        & 0x0F;
out[1] = (v >>  4) & 0x7F;
out[2] = (v >> 11) & 0x7F;
out[3] = (v >> 18) & 0x7F;
out[4] = (v >> 25) & 0x7F;
```

Example: `0x12345678` → `08 67 0A 0D 09`. An Int16 becomes 3 bytes (bits 0–1, 2–8, 9–15).

### Port index (inputs and outputs alike)

| Index | Port |
|---|---|
| 0–15 | USB host ports 1–16 (U6MIDI Pro-1/2/3 = 0/1/2, OXI ONE MKII-1/2/3 = 3/4/5 in this rig) |
| 16–23 | USB-C virtual cables 1–8 (to/from the Mac) |
| 24–29 | MIDI (TRS) 1–6 |

CME's page calls indices 0–15 "USB-A host ports"; the H12MIDI Pro's sockets are USB-C, and HxMIDI Tools shows them as "USB-C Host Ins/Outs". The numbers depend on enumeration order unless reserved. Confirmed in HxMIDI Tools (2026-11-16): U6MIDI Pro-1/2/3 on host ports 1/2/3 and OXI ONE MKII-1/2/3 on 4/5/6, inputs and outputs alike, all reserved.

### Settings used

| ID | Setting | Index | Words | Scope |
|---|---|---|---|---|
| 0 | MIDI routing | input 0–29 | 1 | current preset |
| 2 | Message filter | 0–29 inputs, 30–59 outputs | 1 | current preset |
| 3 | Mapper | mapper 0–23 | 6 | current preset |
| 4 | Current preset | 0 | 1 | global |

- **Routing (0):** one word; bit n set = send this input to output n.
- **Current preset (4):** bits 0–4 = preset (0–5). Read it first and refuse to write unless it is 0 (preset 1).

### Mapper layout (6 words)

| Word | Bits | Field |
|---|---|---|
| 0 input values | 7–0 / 15–8 / 23–16 / 31–24 | value 2 min / value 2 max / value 1 min / value 1 max |
| 1 output values | same layout | |
| 2 messages, channels | 3–0 | input message: 0 Note On, 1 Note Off, 2 CC, 3 Program Change, 4 Pitch Bend, 5 Channel AT, 6 Key AT |
| | 7–4 / 11–8 | input channel min / max (0–15) |
| | 23–20 | output message (same codes; 7 = filter out) |
| | 27–24 | output channel (0–15) |
| | 28 | keep original (leave 0) |
| 3 options | 0 | follow channel (leave 0) |
| | 1 / 2 | follow value 1 / follow value 2 |
| | 26–24 | init flag: write 5 for a mapper in use |
| 4 USB host inputs | 31–0 | bit n = USB host port n+1 (leave 0) |
| 5 other inputs | 15–0 | USB-C virtual cables (leave 0) |
| | 31–16 | MIDI inputs: bit 16 = MIDI In 1 … bit 21 = MIDI In 6 |

### Mapper allocation

Use mappers 18–23 only, leaving 0–17 free for manual use.

| Mapper | Input | Match | Output |
|---|---|---|---|
| 18 | Launchkey (word 5 bit 18) | Note On, ch 1, all values | Note On, target channel, follow values 1 and 2 |
| 19 | Launchkey | Note Off, ch 1 | Note Off, target channel, follow 1 and 2 |
| 20 | Launchkey | CC, ch 1 | CC, target channel, follow 1 and 2 |
| 21 | Launchkey | Pitch Bend, ch 1 | Pitch Bend, target channel, follow 1 and 2 |
| 22 | Launchkey | Channel AT, ch 1 | Channel AT, target channel, follow 1 and 2 |
| 23 | Pedal (word 5 bit 17) | CC, ch 1, value 1 = 11 | CC, target channel, value 1 = target pedal CC (min = max), follow value 2 |

Value ranges for "all values": word 0 and word 1 = `0x7F007F00`.

## Constraints

- **Flash wear:** every write is saved to non-volatile memory. Only write on a target change, never in a loop, and skip writes whose value already matches.
- **One writer:** HxMIDI Tools must be closed while the tool writes. Detect and warn if possible.
- **SysEx port:** CME says to send to "its USB MIDI port". On start-up, send the status request `F0 00 20 63 0F 26 01 00 01 F7` (serial and firmware) to each H12 output port and use the one that answers. Check that this SysEx doesn't leak to synths on that lane; if it does, filter SysEx (message-filter bit 7) on the affected synth outputs, or ask before changing filters.
- **Firmware check:** read the firmware from that status answer and warn if it's not 4.7 or later.
- **No other changes:** only touch the routing of inputs 25 and 26, mappers 18–23, the sync bits (9, 12–15) of the output message filters listed under Sync mode, and the one-off change to input 24. Never touch channel filters, other inputs' routing, TRS type, preset names or USB reservations.

## Nice to have

- **Live status:** send action `0x06` (start reports) on connect and `0x07` on close. Show the current preset and connected USB devices, and re-read settings when a "reload" bit (bit 31 of setting 4) arrives.
- **Launchpad Pro row:** one pad per target, lit for the active target.
- **Dump and restore:** read all routing (indices 0–29), channel filters and message filters (0–59) and mappers (0–23) into JSON for version control, and restore from it.
- **Rule check on the dump:** clock only from MIDI In 1, channels 13–14 blocked on synth outputs, only channel 14 reaching the OXI.

## Acceptance tests

1. `setTarget("TB-3")`: Launchkey keys play only the TB-3; the pedal sends the TB-3's pedal CC on channel 2; no other synth receives anything from the keys or pedal.
2. Switching target while the OXI is playing doesn't interrupt the OXI or the clock.
3. `setTarget("OXI")`: the keys play the OXI's selected track (channel 14 reaches OXI ONE MKII-1).
4. Running `setTarget` twice with the same target performs no writes the second time.
5. A wrong checksum or unknown setting from the device is reported, not ignored.
6. Read-back after every write matches what was written.
7. TR-8S set to Own sequencer, everything else External: pressing play on the Nome II starts the TR-8S and the OXI only; the other synths keep tempo-synced effects but don't start.
8. A device set to Free gets neither clock nor transport (check with a MIDI monitor on that output).
9. Changing one device's sync mode leaves its channel filters (e.g. channels 13–14 blocked) and all other filter bits unchanged.
10. With the clock forwarder on, the Launchkey's arpeggiator follows the Nome II's tempo, and changing tempo on the Nome II changes the arpeggio rate.
11. Unplugging and replugging the Launchkey pauses and then resumes forwarding without restarting the app.

## Open questions

- ~~Which H12 port answers SysEx~~ Answered: `H12MIDI-Pro Port 1` (USB-C virtual cable 1). See apps/h12/README.md.
- ~~How to confirm the host port numbers~~ Answered: confirmed and reserved in HxMIDI Tools (status 0x02 is unusable on firmware 4.7; apps/h12/README.md).
- Whether a note held during a target switch hangs on the old synth; if so, send All Notes Off (CC 123) on the old target before switching.
- Pedal CC per target (fill in the TBDs).
