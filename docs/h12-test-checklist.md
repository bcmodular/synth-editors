# H12 target switcher: hardware test checklist

What's left to test on the hardware, as of 2026-11-22. Tick items as you go and note anything odd. The MIDI monitor
logs each target switch (**App** rows) between the notes, so a screenshot of it shows what happened.

## Setup

- [ ] Power on the Thru5 and every synth. **Close HxMIDI Tools.**
- [ ] `npm run dev:h12`. The H12 panel shows **Port 1 · 4.7 · Preset 1 (Main)**, and the Target panel shows no
      "Don't power off the H12 yet" warning.
- [ ] Tick **Copy to the Mac**. Play a key: **Launchkey** on ch 1 and **H12 → Mac** on the target's channel.

## Done already (2026-11-22)

- TB-3, JV-2080 (ch 6), TR-8S, S-1, P-6 pads play from the keys.
- TD-3-MO plays on ch 5, with legato slides (MIDI IN channel set in SynthTribe; Multi Trigger off, Mode Slide).
- Volca Bass plays.
- The app reconnects on its own after an H12 power cycle (asks again for about 25 s).

## 1. Power cycle

- [ ] Switch to any target, then power-cycle the H12. Wait for the app to reconnect without **Check again**.
- [ ] The same target is still lit, and the keys still play it. Your HxMIDI Tools settings survived.

## 2. Switching back

- [ ] TD-3-MO → Volca Bass → TD-3-MO. Each switch shows an **App** row "Switched to …", and the keys follow
      (ch 5, ch 8, ch 5). If one fails: screenshot the Target panel's message and the monitor.

## 3. Targets not yet working or not yet tried

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

## 4. Pedal

- [ ] **JV-2080 ch 6**, move the pedal: **Pedal** shows CC 11 on ch 1, **H12 → Mac** CC 11 on ch 6, and the JV's
      expression follows.
- [ ] Another JV channel (e.g. 8): **H12 → Mac** shows CC 11 on ch 8.
- [ ] Any other target: **H12 → Mac** shows only raw CC 11 on ch 1, and no synth reacts.
- [ ] Note the CC you want the pedal to send on each other target (cutoff etc.).

## 5. Spec checks (docs/h12-spec.md)

- [ ] **Test 1:** on TB-3, only the TB-3 sounds from keys and pedal.
- [ ] **Test 4:** click the current target again: "Already on …: nothing written".
- [ ] **Test 2:** with the OXI playing, switch targets a few times: no stutter in the OXI or the clock.
- [ ] **Held note:** hold a note and switch target before letting go. Does it hang on the old synth? Which synths?
- [ ] **Clock:** the Nome II still drives the TC M300 and the synths behind the Thru5.

## Finish

- [ ] Untick **Copy to the Mac**; leave the target you want.
- [ ] `npm run test:h12` with HxMIDI Tools closed (read-only): passes, no warnings.

## Bring back

- Which targets work, and for those that don't, what the monitor showed.
- Whether settings survived the power cycle, and how switching back went.
- Whether notes hang when switching, and on which synths.
- The pedal CC for each target.
- Whether to put the Launchkey's drum pads on ch 1, so they follow the target like the keys.
- Whether the monitor should sort by time (rows from different sources can come out of order by a few ms).
