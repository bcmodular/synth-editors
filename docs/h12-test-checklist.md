# H12 target switcher: hardware test checklist

What's left to test on the hardware, as of 2026-11-24. Tick items as you go and note anything odd. The MIDI monitor
logs each change the app makes (**App** rows) between the notes, so a screenshot of it shows what happened.

## Setup

- [ ] Power on the Thru5 and every synth. **Close HxMIDI Tools.**
- [ ] `npm run dev:h12`. The H12 panel shows **Port 1 · 4.7 · Preset 1 (Main)**, and the Target panel shows no
      "Don't power off the H12 yet" warning.
- [ ] Tick **Copy to the Mac**. Play a key: **Launchkey** on ch 1 and **H12 → Mac** on the target's channel.

## Done already

- TB-3, JV-2080 (ch 6), TR-8S, S-1, P-6 pads play from the keys (2026-11-22).
- TD-3-MO plays on ch 5, with legato slides (MIDI IN channel set in SynthTribe; Multi Trigger off, Mode Slide).
- Volca Bass plays.
- The app reconnects on its own after an H12 power cycle (asks again for about 25 s).
- The pedal maps onto the JV-2080 (2026-11-24, once set right in DOREMIDI's tool).

## 1. Dump first (read-only)

Before anything writes: a record of how the H12 is set, to compare against later.

- [ ] **Dump and rule check › Read all** (a few seconds), then **Save JSON**. Keep the file: it's the H12's preset
      as HxMIDI Tools has it.
- [ ] Read the three rule checks. A ✗ isn't necessarily wrong: tell me which, and whether it's meant.

## 2. Sync modes (new: never run on the hardware)

Writes the output message filters, only their sync bits. The **Sync** panel reads each device's mode on start-up.

- [ ] What does it show before you click anything? Expected: every device **Own sequencer** (filters pass
      everything) and "The Nome II's input blocks Start/Stop". Screenshot it either way. If any row says **custom**,
      stop and tell me.
- [ ] **All External**: an **App** row "Set every device to External: wrote 7 settings". Play the Nome II: the
      synths keep tempo-synced effects and arpeggiators, nothing starts.
- [ ] **Let Start/Stop through**: the input row now says it lets Start/Stop through. Play the Nome II: still nothing
      starts (all External).
- [ ] **TR-8S › Own sequencer**, then play the Nome II: the TR-8S starts and stops with it, nothing else does
      (spec test 7). Same for the TB-3.
- [ ] **TR-8S › Free**: it ignores the Nome II's tempo and Start (spec test 8).
- [ ] **Read all** again and **Save JSON**: compared with step 1's file, only bits 9 and 12–15 of the message
      filters changed, and the channel filters (ch 13–14 blocked) are the same (spec test 9).
- [ ] If anything goes wrong: **Block Start/Stop again**, then **Put them back** under the Sync panel.

## 3. Power cycle

- [ ] Switch to any target, then power-cycle the H12. Wait for the app to reconnect without **Check again**.
- [ ] The same target is still lit, the keys still play it, the sync modes are as you left them, and your HxMIDI
      Tools settings survived.

## 4. Switching back

- [ ] TD-3-MO → Volca Bass → TD-3-MO. Each switch shows an **App** row "Switched to …", and the keys follow
      (ch 5, ch 8, ch 5). If one fails: screenshot the Target panel's message and the monitor.

## 5. Targets not yet working or not yet tried

| Target | Ch | Check |
|---|---|---|
| Volca Kick | 9 | |
| P-6 auto | 15 | replaces P-6 granular |
| SP-404 chromatic | 16 | |
| SP-404 pads ch 1 / ch 2 | 1 / 2 | SP-404 in MIDI mode B |
| SP-404 vocoder | 11 | not working last time: check the SP-404's vocoder setup and receive channel |
| JV-2080 ch 7–10 | 7–10 | each channel button; each part sounds |
| OXI | 14 | thru not working yet: which OXI USB port (host 4 = OXI ONE MKII-1) and which track listens on 14 |

For any that stay silent while **H12 → Mac** shows the right channel: check the synth's MIDI **in** channel (the
TD-3 has separate in and out channels; others may too), the cable goes into its MIDI IN, and its sound (decay,
volume).

## 6. Pedal

- [ ] **JV-2080 ch 6**, move the pedal: **Pedal** shows CC 11 on ch 1, **H12 → Mac** CC 11 on ch 6, and the JV's
      expression follows. Another JV channel (e.g. 8): CC 11 on ch 8.
- [ ] Any other target: **H12 → Mac** shows the pedal CC on the target's channel. Targets switched before
      2026-11-24 sent the pedal to the Mac only, so one may show unlit until you click it.
- [ ] Set the pedal CC to something else (e.g. 74), **Set**: an **App** row "Set the pedal to CC 74", and the next
      pedal move shows CC 74. Switch target: it stays 74.
- [ ] Note the CC you'd want on each target, in case one for all isn't enough.

## 7. Launchkey clock

- [ ] The **Launchkey clock** panel shows both ports and the Nome II's tempo, with no Start button to press.
- [ ] Arpeggiator on, hold a chord, start the Nome II: the arpeggio follows its tempo and restarts on Start.
- [ ] Unplug and replug the Launchkey: forwarding pauses and comes back without restarting the app (spec test 11).

## 8. Spec checks (docs/h12-spec.md)

- [ ] **Test 1:** on TB-3, only the TB-3 sounds from keys and pedal.
- [ ] **Test 4:** click the current target again: "Already on …: nothing written".
- [ ] **Test 2:** with the OXI playing, switch targets a few times: no stutter in the OXI or the clock.
- [ ] **Held note:** hold a note and switch target before letting go. Does it hang on the old synth? Which synths?
- [ ] **Clock:** the Nome II still drives the TC M300 and the synths behind the Thru5.

## Finish

- [ ] Untick **Copy to the Mac**; leave the target and sync modes you want.
- [ ] `npm run test:h12` with HxMIDI Tools closed (read-only): passes, no warnings.

## Bring back

- The two dump files and the rule check results.
- What the Sync panel showed at first, and whether each mode did what it says.
- Which targets work, and for those that don't, what the monitor showed.
- Whether settings survived the power cycle, and how switching back went.
- Whether notes hang when switching, and on which synths.
- Whether one pedal CC for every target is enough.
- Whether to put the Launchkey's drum pads on ch 1, so they follow the target like the keys.
- Whether the monitor's order now looks right (rows are sorted by arrival time since 2026-11-24).
