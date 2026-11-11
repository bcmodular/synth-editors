# SP-404 MK2 editor — design

Agreed with the user over eight rounds of mockups (kept in [`docs/sp404-mockups/`](sp404-mockups/)):

1. [`1-layouts.html`](sp404-mockups/1-layouts.html): four desk layouts. **D · Signal flow, big FX** was chosen.
2. [`2-fx-designs.html`](sp404-mockups/2-fx-designs.html): one design per effect (all 46, every control
   live), plus a **Layout D** view that draws the whole 1920 × 1080 window with real modules and the
   final mixer. This file is the reference for the FX modules and the mixer; where it and `1-layouts.html`
   disagree, it wins.

The app replaces the SP-404 MK2 TouchOSC layout in `touchosc-controllers/sp404-mk2`. It lives in
`apps/sp404/` and follows the TB-3 app's stack and conventions (see [PLAN.md](../PLAN.md)).

## What it does

Two halves, each talking to the SP-404 over its own link:

| Half | Link | Direction |
|------|------|-----------|
| **FX**: the five effect buses (BUS 1–4 and INPUT FX) | USB MIDI | Send only (the SP-404 doesn't report FX changes) |
| **Pad mixer**: level, pan, routing, mute group and envelope for every loaded pad | USB serial (the SP-404's vendor CDC port) | Read and write |

Not in scope: patterns, sequencing, sample management (loading, trimming, naming), and bus/master/input
levels (the SP-404 has no MIDI or serial control for them). The BCR2000 is dropped.

### FX

- Five buses, each with one effect chosen from the effects that bus can load (46 in all; each bus group
  has its own list and its own CC 83 numbers).
- Every effect has its own module design (below) with an editable view, the six parameters, ON/OFF and
  the shared preset controls.
- **Presets**: 8 per effect per bus. Empty slot = store, stored slot = recall.
- **Exclude tuning**: per bus. When on, preset recall skips the effect's tuning parameters (Resonator
  ROOT and CHORD, Hyper-Reso NOTE and SCALE, and so on; marked in the effects table).
- **Defaults (DEF)**: a stored baseline per effect per bus. DEF recalls it; storing replaces it.
- **Recent values**: per bus, the app remembers the last parameter values of each effect used on it. Switching
  back to an effect brings its values back.
- **GRAB**: preview mode. Hold a stored preset (or scene) to hear it; letting go restores what was there.
- **LOCK**: protects a bus during a performance. While locked: preset recall, defaults recall, morph and ON/OFF
  still work; store, delete, clear and scene recall don't touch the bus. Scene store still captures it.
- **FX scenes**: 16 global snapshots of all five buses: effect, on/off, parameter values and sync.
- **Morph** (marked EXPERIMENTAL in the UI): blends a bus's live values towards a stored preset by an amount.
  Switch-type parameters snap at the halfway point; continuous ones interpolate. While morph is on, preset
  store and recall on that bus are disabled; turning morph off keeps the blended values.

These match the TouchOSC version's behaviour, including the lock rules.

### Pad mixer

- One strip per loaded pad. Empty pads are hidden. Strips are grouped by bank, each group ending in a
  **bank volume** fader.
- Per pad: sample name (read-only), level (0–127), pan (L50–R50), routing (DRY / BUS 1 / BUS 2), mute group
  (– or A–J), AHR envelope (Attack, Hold, Release), **MUTE** and the pad's MIDI note.
- **MUTE is app-side**: the SP-404 has no pad-mute parameter over serial, so MUTE sets the level to 0 and a
  second press restores the level it had. The strip shows the remembered level in brackets.
- **MIDI note** is shown so the pads can be sequenced from an OXI One. The SP-404 doesn't report its MIDI
  mode or note offset, so the app has a setting for both and works the notes out from it (`padNotes.ts`, from
  Roland's MIDI note map): Mode A = bank A–J on channels 1–10, notes 36–51 in every bank; Mode B = banks A–E on
  one channel and F–J on the next (Pad MIDI Channels), notes 12–91 plus Note offset. Pad 13 is each bank's
  lowest note.
- **Audition**: holding a strip's pad number (or Space / Enter on it) sends the pad's note on to the SP-404 over
  USB MIDI at velocity 100, and letting go sends the note off, so gated and looped pads stop as on the device. The
  note follows the pad MIDI settings above (`mixer/usePadAudition.ts`). Added 2026-11-11.
- **Mix scenes** (deferred, 2026-11-09: the SP-404 already keeps the mixer values in its projects; the model in
  `mixer.ts` stays for later): 16, stored per SP-404 project, in the spirit of a Yamaha 02R. A scene stores the mixer values
  of the pads loaded when it was stored. On recall:
  - pads in the scene that are loaded now get the scene's values;
  - pads loaded now that aren't in the scene are left alone;
  - pads in the scene that aren't loaded any more are skipped (nothing is sent).
- **Recall safe**: per value type (level, pan, routing, mute, mute group, AHR). A safe type is left alone by
  scene recall.
- **Status**: a strip's pad number flashes each time the pad plays, from the note-ons the SP-404 sends over USB
  MIDI. This needs **SEQ Note Out** (pattern playback) and **PAD Note Out** (hand hits) set to ON in the SP-404's
  system settings, MIDI tab; the user guide should say so. Without the SP-404's MIDI input the app falls back on the
  serial status (hand hits only). The pad selected on the device is shaded, from the serial status poll (every
  150 ms).
- **Project**: the app reads the project number and pad contents on connect and when the project changes.

### Controllers

- **Launchpad Pro Mk1**, as in the TouchOSC version: columns 1–5 = the 8 presets of buses 1–5 (the
  modules' preset columns match), columns 7–8 = the 16 FX scenes, top buttons = bus ON/OFF, left-side modifiers
  for grab, defaults, delete, morph and the effect chooser, bottom row = bus lock, pressure = morph amount.
- **Keyboard overlay** (Launchkey MK4): slides up over the mixer. It sets Resonator ROOT/CHORD, Hyper-Reso
  NOTE/SCALE and Vocoder NOTE/SCALE/CHORD, plays the vocoder on channel 11, and grabs a bus so the Launchkey
  encoders drive its six parameters. The FX modules have no keyboards of their own.
- **CC learn**: global, as in [PLAN.md](../PLAN.md) (relative / pickup / jump; no controller feedback).

## Layout (D · Signal flow, big FX)

One window drawn at **1920 × 1080** and scaled to fit with CSS `zoom`, as in the TB-3 app
(`useFitZoom`, drags divided by the zoom).

```
┌ SP-404 MK2 · MIDI ● · USB ● PROJECT 06 · LAUNCHPAD ──────────────── KEYBOARD · CC LEARN · SETTINGS ┐ 30
├ INPUT ──────┬ PAD BUSES · PARALLEL ──────┬─┬ MASTER · BUS 3 → BUS 4 ──────────┬ FX     ┤
│ module 358  │ module 358   module 358    │→│ module 358   module 358         │ SCENES │ ≈ 540
│             │                            │ │                                  │ 2 × 8  │
├ MIX SCENES ─┼ BANK A ────────────────────────────┬ BANK B ────────────┬────────────┬ USB ┤
│ 1–16        │ strips 84 px … bank master          │ strips … master    │  (scrolls) │ OUT │ ≈ 510
│ RECALL SAFE │                                     │                    │            │ L R │
│ PROJECT     │                                     │                    │            │     │
│ SHOW BANKS  │                                     │                    │            │     │
└─────────────┴─────────────────────────────────────┴────────────────────┴────────────┴─────┘
```

- **Top bar**: link status for MIDI, USB (with the project) and the Launchpad; KEYBOARD opens the overlay.
- **FX row** follows the device's signal path: INPUT FX, then BUS 1 and BUS 2 (labelled SERIAL or PARALLEL,
  as set on the SP-404 and shown read-only), an arrow, then BUS 3 → BUS 4 (master). Five modules at 358 px,
  then the FX scenes column (~107 px: two columns of 8 tall buttons, STORE and DEL).
- **Mixer**: mix scenes, recall safe, project and SHOW BANKS on the left; the desk; the USB output meter on the
  right. The desk shows the banks picked in SHOW BANKS (banks with no samples are greyed out). Two banks fit
  without scrolling; more scroll sideways.
- **Strip** (84 px), top to bottom: pad label in the bank colour and MIDI note · sample name (one line) · AHR
  thumbnail (click to edit) · MUTE GRP · routing DRY / 1 / 2 in the device colours (white / orange / green) · pan
  knob and value · MUTE · level fader in the bank colour (~260 px) and value.
- **Bank master** (76 px): BANK VOL fader in white.
- **Keyboard overlay**: covers the mixer, not the FX.

## FX modules

Every module is 358 × 520 px:

```
┌ [1] [ EFFECT NAME (LCD, click to choose) ] [ON] ┐
│ BUS 1                                           │
│ ┌ view ─────────────────────────────┐ PRESETS   │
│ │ editable drawing of the effect    │  1        │
│ │                                   │  …  8     │
│ └───────────────────────────────────┘           │
│ switches / button rows / drop-downs  │ DEF      │
│ knobs (one per continuous parameter) │ GRAB     │
│                                      │ LOCK     │
│ MORPH ━━━━━━━━━━━━━━━━━━━━━ EXP                 │
└─────────────────────────────────────────────────┘
```

- The accent colour is the bus's: BUS 1 orange, BUS 2 green, BUS 3/4 blue, INPUT lilac.
- The **side column** (50 px) holds the 8 presets top to bottom, matching a Launchpad column, then DEF, GRAB
  and LOCK, as in the TouchOSC layout.
- No CC or knob numbers on the controls.

### Control rules

- **Handles** (white dots and bars) in the views drag relative to where they're grabbed, Shift for fine,
  double-click to reset to the default. Wheel steps a knob. The same behaviour as the TB-3 EQ.
- Every parameter also has an ordinary control under the view, so nothing is reachable only by drawing. The
  one exception: where a value lives only on a handle (Equalizer gains), a readout takes the knob's place.
- **Discrete parameters**:
  - 2 values → a two-way switch;
  - up to 10 → a row of buttons (a row longer than 7 gets its own full-width line under its label);
  - 16–32 named values → a button grid;
  - note values → the **note-value matrix**: three rows (triplet, straight, dotted), every button labelled
    with its suffix (1/8T, 1/8, 1/8D), 22 px tall, full width;
  - long numeric lists → a drop-down or a stepped knob (ringed).
- **SYNC** swaps a rate or time knob for its note-value control in place.
- **Large latching buttons** for performance switches: DJFX Looper LOOP, Scatter SCATTER, Back Spin BACK,
  DJFX Delay LOOP, Auto Pitch AUTO PITCH.
- **App features** are drawn in blue (Isolator KILL).
- The drawings make settings readable; they are not measurements of the SP-404.

### Per effect

Availability: **1·2** = BUS 1/2, **3·4** = BUS 3/4, **IN** = INPUT FX, **all** = all three.

| Effect | On | View (what can be dragged) | Other controls |
|--------|----|----------------------------|----------------|
| **Filter & EQ** | | | |
| Filter + Drive | 1·2 3·4 | Filter curve: CUTOFF × RESO handle; low-shelf handle (LOW FREQ × LOW GAIN). Drive thickens the curve | TYPE HPF/LPF switch |
| Isolator | 1·2 3·4 | Three level columns (LOW / MID / HIGH, drag up/down) | KILL LOW/MID/HIGH (app: kill and restore) |
| SBF | 1·2 3·4 | Notch comb: INTERVAL × WIDTH handle | TYPE SBF1–6 row |
| Super Filter | 1·2 3·4 | Filter curve: CUTOFF × RESO handle; shaded band = LFO DEPTH | TYPE LPF/BPF/HPF; SYNC; RATE knob or note matrix |
| Wah | 1·2 3·4 | Peak: MANUAL × PEAK handle; shaded band = DEPTH | TYPE LPF/BPF; SYNC; RATE in bars |
| Equalizer | all | TB-3-style 3-band EQ: each handle frequency (stepped) × gain (±15 dB) | Frequency drop-downs; gain readouts |
| **Drive & character** | | | |
| WrmSaturator | all | Saturation curve (drag for DRIVE) over a tone panel with LOW and HIGH gain handles | |
| Lo-fi | all | Sine vs crushed copy; CUTOFF handle on the filter with TONE tilt | PRE FILTER and LOFI TYPE rows; CUTOFF drop-down |
| Ring Mod | 1·2 3·4 | Carrier inside the input envelope: FREQUENCY × SENS handle | POLARITY switch; EQ LOW/HIGH stepped knobs |
| Crusher | 1·2 3·4 | Staircase over a sine (drag for RATE); FILTER handle | |
| Overdrive, Distortion | 1·2 3·4 | Clipping curve (drag for DRIVE) over a tone tilt with a TONE handle | |
| Compressor | all | Transfer curve with THRESH (SUSTAIN) and RATIO handles; ATTACK strip below | |
| Gt Amp Sim | IN | Six large amp buttons with full names; tone-stack curve with BASS/MID/TREBLE handles | |
| **Vintage sim** | | | |
| 303 VinylSim | all | Record whose grooves wobble with WOW FLUT, crackle for NOISE; COMP bar rising with COMP | |
| 404 VinylSim | all | Band-limited response (FREQ handle); noise floor line (NOISE handle) wobbling with WOW FLUT | |
| Cassette Sim | all | Top: a sawtooth test signal (dashed) and the output (solid), identical with every control at zero. AGE (0 = new tape) rounds the edges off and lowers the level, HISS adds grain, WOW FLUT bends it, DRIVE squares it, CATCH adds dropouts; drag sideways for AGE, up/down for HISS. Bottom: response with a TONE handle; AGE drawn as the treble roll-off | |
| **Delay** | | | |
| Sync Delay | 1·2 3·4 | Taps on a beat grid: first tap LEVEL, second FEEDBACK; damping band with draggable edges | TIME note matrix; L/H DAMP drop-downs |
| Ko-Da-Ma | 1·2 3·4 | As Sync Delay; in PAN mode taps alternate left/right | MODE SINGLE/PAN |
| Zan-Zou | 1·2 3·4 | 2/3/4 taps alternating left/right | MODE row; HF DAMP drop-down; SYNC; TIME knob or matrix |
| Tape Echo | 1·2 3·4 | Tape loop whose length is TIME (handle on its end); click the S/M/L heads to set MODE; taps below; wow line | |
| TimeCtrlDly | all | As Sync Delay | SYNC; TIME in ms or matrix; damp drop-downs |
| SX Delay | 1·2 3·4 | Taps; second tap FEEDBACK (no level parameter) | TIME matrix |
| Cloud Delay | 1·2 3·4 | Grain cloud: WINDOW × PITCH handle, CLOUDY scatters it, feedback generations drift; LOFI snaps grains to chunky blocks | LOFI switch |
| **Reverb** | | | |
| Ha-Dou | 1·2 3·4 | Reverb envelope: front corner PRE-DELAY × LEVEL, tail TIME, modulation wobble; low/high cut band | Cut drop-downs |
| Reverb | all | As Ha-Dou | TYPE AMBI/ROOM/HALL1/HALL2; cut drop-downs |
| SX Reverb | 1·2 3·4 | Tail TIME; TONE band (no level or pre-delay parameter) | |
| **Modulation** | | | |
| To-Gu-Ro | 1·2 3·4 | One bar of filter and amp modulation; DEPTH handle | SYNC; RATE knob or 9-way row |
| Chorus | all | Two voices moving (drag: DEPTH up/down, RATE sideways); EQ with LOW and HIGH handles | |
| JUNO Chorus | all | Large chorus buttons with LEDs (JUNO I / II / I+II, JX-1 I / II) | |
| Flanger, Phaser | 1·2 3·4 | Notches: MANUAL × RESO handle; shaded band = DEPTH | SYNC; RATE in bars |
| Slicer | 1·2 3·4 | Compact 4 × 8 pattern pads; large SPEED pads (note matrix) with SYNC on, a wide SPEED bar with SYNC off | MODE LEGATO/SLASH; SYNC |
| Tremolo/Pan | 1·2 3·4 | The modulation wave; PAN swings around the centre line; drag for DEPTH | TYPE; WAVE 6-way; SYNC |
| **Pitch & harmonic** | | | |
| Resonator | 1·2 3·4 | Pitch ladder of the chord tones, named; bar length = FEEDBACK, brightness = BRIGHT; drag for ROOT | CHORD 2 × 8 grid. ROOT/CHORD also from the keyboard |
| Chromatic PS | all | XY pad, one dot per voice: pitch (−24…+12) × pan | |
| Hyper-Reso | 1·2 3·4 | Circle of the 12 notes, scale lit, key ringed (click a note; MAJ/MIN in the middle); dot = NOTE | NOTE stepped knob; SPREAD row. NOTE/SCALE also from the keyboard |
| Auto Pitch | IN | XY pad: FORMANT × PITCH | KEY drop-down; AUTO PITCH large button |
| Vocoder | IN | Note circle as Hyper-Reso | CHORD 5 × 2 grid; NOTE stepped knob. All three also from the keyboard |
| Harmony | IN | XY pad as Auto Pitch | KEY drop-down; HARMONY 5 × 2 grid |
| **DJ & performance** | | | |
| DJFX Looper | 1·2 3·4 | Waveform with the loop window: drag its edge for LENGTH, the bottom strip for SPEED | LOOP large button |
| Scatter | 1·2 3·4 | Compact TYPE row; DEPTH as ten large rising bars | SPEED SINGLE/DOUBLE; SCATTER large button |
| Downer | all | Pitch (solid) and filter (dashed) falling over RATE; DEPTH handle | RATE 7-way; PITCH switch |
| Stopper | 1·2 | Tape-stop curve over RATE; DEPTH handle; AMP MOD dashed | RATE 9-way |
| Back Spin | 1·2 | Platter: arc = LENGTH, lit while BACK is held; drag for SPEED | LENGTH row; BACK large button |
| DJFX Delay | 1·2 3·4 | Taps as the other delays | LOOP large button; SYNC; TIME ms or matrix |

### To check on the device

These pictures and names are guesses until checked: Zan-Zou tap pattern, SBF notch shape, Resonator chord
tones, Ring Mod polarity names (the table only has 0/1), compressor dB mapping, Gt Amp Sim full names (the
device shows JC, TWIN, BG, MATCH, MS, SLDN), and what each Scatter type and Slicer pattern does (shown as
numbers only).

## Protocols

### FX over MIDI

From the SP-404 MK2 MIDI implementation (firmware 5) and the TouchOSC tables:

- Channels 1–4 = BUS 1–4, channel 5 = INPUT FX.
- CC 16, 17, 18, 80, 81, 82 = the six FX knobs (Ctrl 1–6).
- CC 19 = FX on/off (< 64 off, ≥ 64 on).
- CC 83 = select effect. Each bus group (1/2, 3/4, input) has its own numbering. On BUS 1/2, CC 83 values 1–5
  are the device's five *Direct FX* slots, which the user can reassign on the SP-404; the app assumes the
  factory assignment and says so in Settings.
- Changing effect sends the whole block: CC 83, then CC 19, then the six knob values. A preset or scene
  recall that keeps the effect sends only the knobs that changed.
- All sends go through a rate-limited queue (as in the TB-3 app).
- The SP-404 sends nothing back, so the app's state is the truth. A **resend all** button pushes every bus to
  the device (after a power cycle, for example).

### Pad mixer over USB serial

The SP-404's vendor USB serial port isn't documented by Roland. The app follows the reverse-engineered
protocol notes from the [SparkyMK2](https://github.com/TuscanPL/SparkyMK2/tree/main/docs/re) project (GPL-3, credited in the README). **We
implement from their notes only and copy none of their code.**

- USB CDC-ACM device `0582:02E7`, 921600 baud 8N1, DTR and RTS raised.
- Frames (no checksum): short = 12 bytes (`12 60 E0 channel`, payload in 4–10, length in 11); long = 16-byte
  header (`13 60 E0 channel`, length u32 at 12–15) then the payload. Codec: `serialFrames.ts`, `serialMessages.ts`.
- Set a pad parameter: a long frame on channel 5 (`01 id 00 target:u16 value:i32`, little-endian). Parameter
  ids: level `69` (0–127), pan `78` (13–115, centre 64), mute group `6D` (0–10), routing `7A` (0–2),
  attack `7D`, hold `7E` (1–100), release `7F`.
- Bank volume: global target `FFFF`, id `35 + bank`, value `127 − volume`.
- Read a pad: `9E pad` returns a 327-byte block (name at 175–198; an empty pad has field 0 = 0).
- Status: poll `FE 66 00` every 500 ms. The reply gives the project, the selected bank and pad, and the frame
  count of the pad that's sounding (`FFFFFFFF` when none). The sounding pad is the selected one (hitting a pad
  selects it), so the strip light follows it; a pad still ringing after another is hit isn't reported.
- Phase 0 uses **Web Serial in the renderer** (Electron grants it and main picks the SP-404's port), which needs
  no native module. If it proves unreliable, move to Node serial in the main process behind a small IPC API.

## Scopes

Status: built 2026-11-10 (`apps/sp404/src/scope/`, `packages/audio/`); tested against Chromium's fake audio input,
not yet on the SP-404. A meter, waveform and spectrum of what the SP-404 plays, from its
USB audio, modelled on the TB-3's LIVE view ([tb3-live-waveform-design.md](tb3-live-waveform-design.md)).

### What the audio carries

Checked on this Mac on 2026-11-10 with the device connected:

- The SP-404 shows up as two Core Audio devices: **SP-404MKII-IN** (2 channels, SP-404 → Mac) and
  **SP-404MKII-OUT** (4 channels, Mac → SP-404). Both at 48 kHz; the input arrives as 32-bit float.
- The 2-channel input is the **master out, after BUS 3/4 and after the VOLUME knob**: turning VOLUME fully down
  gave digital silence on USB, and the level came back with it.
- So the scopes show only the master mix. There's no USB audio per bus, per pad or for the INPUT (mic/line), so
  **no per-pad, per-bank or per-bus meters**: those would need audio the SP-404 doesn't send. (A pad "activity"
  bar from note hits × level × envelope was considered and dropped: it would be a guess dressed as a meter.)
- Because the signal is after VOLUME, the readings drop when VOLUME is turned down. The meter shows the USB level,
  not the SP-404's internal headroom; the user guide should say so.
- The 4 return channels (Mac → SP-404) aren't used by the scopes.

### What it shows

- **Meter, always on**, in the USB OUT column at the desk's right (84 px): L and R bars.
  - Peak: as the TB-3 meter (−48 to 0 dBFS, instant rise, 24 dB/s fall, 1.5 s hold, amber above −6), and a
    latching clip light that shows the highest peak since it was last clicked.
  - **Loudness** (K-weighted, ITU-R BS.1770 / EBU R128) under the bars: **LUFS-S** (3 s window) as the main
    number, for mixing as you play, and **LUFS-I** (integrated, with the R128 gates) smaller below it, counting
    since the last click on it (click resets). No target marker: the SP-404 is played live, not mastered to a
    platform target; a target setting can come later if wanted.
  - Peaks are sample peaks (dBFS), not true peak (dBTP, which needs 4× oversampling). Fine for monitoring; true
    peak only if the meter is ever used for final masters.
- **SCOPE view**: DESK / SCOPE buttons at the top of the mixer's left column swap the desk for the scope view (the
  left column and the meter stay); the choice is remembered. In it:
  - **Spectrum**: 20 Hz–20 kHz on a log axis, −110 to −20 dB (the analyser reads a band-averaged full-scale tone
    at about −40), a 1/6-octave smoothed line with a fill below it and a peak line falling at 12 dB/s. Tilted
    +4.5 dB per octave about 1 kHz so a typical mix reads roughly flat (as mixing analysers do). L and R summed.
  - **Spectrogram** in place of the spectrum (SPECTRUM / SPECTROGRAM buttons, remembered): the same log frequency
    axis bottom to top, scrolling right to left over the waveform's span, so the beat lines (drawn over it too)
    line up with the lanes below. Level −100 to −30 dB (tilted as the spectrum) in the magma colour map. Added
    2026-11-11.
  - **Waveform**: separate **L and R lanes**, scrolling min/max bands as in the TB-3 (newest on the right).
  - **Span**: 4 S, 1 BAR, 2 BARS or 4 BARS (remembered). Bars use the clock's tempo, four beats a bar; without
    clock the span is 4 s. The waveform is rebuilt when the tempo moves the span by more than 2 %.
  - **Beat grid** on both lanes from MIDI clock: beat lines faint, bar lines brighter and numbered (numbers only
    once the clock has seen a Start, so they line up with the bar). The bar shows the tempo and the clock input;
    the tempo shown stays put until the reading moves by 0.3 BPM, so a steady clock doesn't flicker.
  - **Stereo correlation**: a −1 … +1 bar (amber below 0) and its value, averaged over 300 ms.
  - **HOLD** freezes the waveform, spectrum and spectrogram; the meter keeps running. Letting go starts the
    waveform and spectrogram afresh.
- The **KEYBOARD overlay** goes over the SCOPE view as it does over the desk (for now).

### Audio and clock inputs

- The audio input opens **at launch**: Settings › SCOPES › **AUDIO IN** (remembered by name; "First SP-404 input"
  by default, the first input whose name contains "SP-404"). macOS asks for microphone permission once.
- No input or permission refused: the meter column says why ("No SP-404 audio: choose one in Settings") and the
  rest of the app works as before. When the chosen input comes and goes (unplugging), it's closed and reopened.
- **CLOCK IN** (remembered by name; "The SP-404's USB MIDI" by default) is any MIDI input. Whether the SP-404
  passes clock to USB depends on its MIDI settings: **MIDI Sync Out** when the SP-404 makes the clock; **USB-MIDI
  Thru** passes what arrives on its MIDI IN to USB (Soft Through passes it to the MIDI OUT jack). In the studio the
  SP-404 is clocked from a Nome II on its MIDI IN with Soft Through on; the clock can also be sent to the computer
  through the H12MIDI-Pro (filtered with HxMIDI Tools) and chosen here.
- Nothing is played or stored: the app only listens.

### How it works

- `getUserMedia` stereo with echo cancellation, noise suppression and auto gain off. As in the TB-3, an
  `AudioContext` splits L and R into two `AnalyserNode`s and each animation frame reads the samples that arrived
  since the last one; a third analyser (FFT 8192 ≈ 5.9 Hz per bin at 48 kHz, smoothing 0.6) gives the spectrum,
  and a fourth (FFT 2048 ≈ 43 ms, no smoothing) the spectrogram: short enough that drum hits stay sharp, at the
  cost of blocky rows below about 100 Hz.
  An AudioWorklet was considered for gap-free loudness; the frame reads hold up to 32768 samples (0.68 s), so
  frames don't drop audio unless the window is hidden, and the worklet isn't needed.
- Each frame (`scope/scopeEngine.ts`): peak meters, loudness and correlation always; the waveform lanes and the
  spectrum (at most 30 times a second) or spectrogram only while the SCOPE view is on screen and HOLD is off.
- Spectrogram (`packages/audio/spectrogram.ts`): one level (0–255) per row in a ring of columns, one column per
  screen pixel. Columns are added by elapsed audio time (width ÷ span per second), not once per frame, so the
  scroll is steady and audio times map to columns as on the waveform lanes. Drawn through an offscreen canvas.
- Loudness (`packages/audio/loudness.ts`): two K-weighting biquads per channel, mean squares in 100 ms blocks;
  LUFS-S is the last 30 blocks, LUFS-I uses 400 ms blocks every 100 ms gated at −70 LUFS and then 10 LU below
  their mean, kept as a 0.1 LU histogram so memory doesn't grow.
- Beat grid (`packages/audio/beatClock.ts`): clock (F8, 24 per beat), Start (FA), Continue (FB) and Stop (FC),
  timestamped by Web MIDI and mapped onto the audio clock with `AudioContext.getOutputTimestamp()`. Tempo from a
  least-squares line through the last four beats' clock times (so USB MIDI jitter of a few ms moves it by under
  0.15 BPM), held on screen within 0.3 BPM; none after 0.5 s without clock.
- Canvas drawing outside React (`scope/scopePaint.ts`, `scope/scopeDraw.ts`); readouts are set as text on their
  elements, so React doesn't re-render each frame.
- Electron main allows audio-only `media` permission (as the TB-3's `main.cjs`). The Mac build will need a
  microphone usage description when the SP-404 app is packaged (Phase 6).

### Shared with the TB-3

- **`packages/audio`**: `levelMeter`, `waveColumns` and `liveDraw` moved from the TB-3 app with their tests, and
  the input code from its `tb3Audio.ts` (`audioInput.ts`: list, pick by name, open, permission errors, plus the
  spectrum analyser and the MIDI-to-audio clock mapping). The TB-3 imports them from there.
- New in the package: loudness, correlation, spectrum view (log columns, 1/6-octave smoothing, tilt, peak fall),
  spectrogram and beat clock, all pure and unit-tested.
- e2e (`apps/sp404/e2e/scope.e2e.ts`): Chromium's fake audio input and the fake SP-404's MIDI: the meter and
  loudness move, SCOPE draws the spectrum, SPECTROGRAM draws the fake input's beeps and is remembered, HOLD and
  the remembered view, and clock gives a tempo and beat lines.

### Open questions

- How far apart are MIDI clock and USB audio (driver buffering)? Measure with a click pattern and offset the grid.
- On the SP-404: does the meter read as expected against the device, and are the spectrum's and spectrogram's dB
  ranges right for real mixes?

Settled 2026-11-10: USB out always carries the master audio (no setting changes it); the clock settings above; the
KEYBOARD overlay goes over the SCOPE view; loudness is LUFS-S plus a resettable LUFS-I with no target marker; on
Windows the SP-404 needs Roland's driver for USB audio.

## Files

Same approach as the TB-3 app: JSON files with a version field, autosave, no `.tosc` import.

- **FX library**: presets, defaults, recent values and FX scenes for all buses, plus Exclude tuning per bus.
- **Mix scenes**: one file per SP-404 project, keyed by project number.
- **Settings**: ports, MIDI mode and note offset, Direct FX assumption, Launchpad brightness, CC learn assignments.

Lock state isn't saved (as in TouchOSC).

## Open risks

| Risk | Plan |
|------|------|
| The serial protocol is reverse-engineered and may change between firmware versions (notes are for 5.52) | Phase 0 spike on the user's device; check the firmware version on connect and warn if it differs |
| The serial port may clash with other software using it | Open it only while connected; clear error if busy |
| Direct FX slots on BUS 1/2 may not hold the factory effects | Setting plus a note (the user's device has the factory ones) |
| The old controller switched effects off with CC 83 = 0, not CC 19 | Done: both work; the app uses CC 19 |
| No serial pad mute | App-side mute (done) |
| MIDI mode and note offset can't be read | App setting |
| Effect pictures are approximations | Listed above; check by ear, adjust drawings |

## Phases

### Phase 0 — Spike (de-risk hardware)
`npm run dev:sp404` opens the spike (`apps/sp404/src/spike/`). Every serial chunk, MIDI message and note goes to
a capture file in `fixtures/local/sp404-captures/` (gitignored, as it holds sample names).

- Electron + Vite + React shell for `apps/sp404`, sharing `packages/midi`.
- Serial: open the port, read every pad block of the current project, print names; set one pad's level and pan;
  run the status poll.
- MIDI: select an effect on each bus group, switch it on and off (CC 19 and CC 83 = 0), move a knob.

**Findings so far** (first run, 2026-11-09; captured frames in `apps/sp404/src/core/serialCaptures.ts`):
- Web Serial finds the port (`cu.usbmodem…`, USB ids reported in decimal, 1410:743). Electron's serial service
  makes macOS ask for Bluetooth access; denying it is harmless.
- Short requests and long set-parameter frames as built by `serialFrames.ts` are accepted; set-parameter is echoed
  back unchanged. All 160 pad reads answered (36 loaded), about 1 ms each. Names are NUL-padded on loaded pads,
  space-padded on empty ones.
- USB split replies mid-header at least once; the frame splitter reassembled them.
- Replies' destination byte (2) varies (`00`, `01`, `03`, `91`, `CA`, `E0`) and bytes 4–11 are junk: ignore both.
- Status: byte 1 = project (0-based), 3 = selected bank, 5 = selected pad within the bank (0–15; hitting a pad
  selects it, and it stays selected after it stops), 8–11 = frames played by that pad while it sounds, 12 = `04`
  on a settings screen. Byte 7 is `01` for one poll after a set-parameter. Bytes 15–18 read `01 00 0B 33`
  throughout.
- Hitting pads often sends an unsolicited 147-byte `7D` project-settings frame too (113 in one session).
- While a pattern plays, status byte 12 reads `04` and the pads the pattern plays don't become selected: the frame
  count belongs to whatever plays, so the status can't say which pad sounds. The pad lights use MIDI note-ons
  instead (SEQ Note Out and PAD Note Out on). The SP-404 sends Note On only, no Note Off.
- Changing bank on the device sends, unasked, a set-parameter echo `01 01 00 FF FF 00 00 00 00` and a 147-byte
  `7D` project-settings frame.
- On the device: pad level and bank volume changed as sent. On BUS 1, CC 83 = 2 loaded Resonator and 5 loaded
  DJFX Looper (factory Direct FX). CC 19 = 0 and CC 83 = 0 both switch the effect off; the app uses CC 19. CC 16
  moved the first parameter.

### Phase 1 — Core (no UI, fully tested)
- Effects table: 46 effects with per-group CC 83 values, the six parameters (CC, name, tuning flag, display
  map, discrete value list and raw start values, sync link), ported from `controls_info.lua` and
  `control_mapper.lua`.
- Display functions (frequency, ms, dB, note values, bars, balance, pan, semitones, scales, chords) and raw ↔ index
  mapping for discrete lists, with tests against the Lua tables.
- MIDI builders: effect change block, on/off, knob changes; diff of two bus states → minimal message list.
- Preset, defaults, recent-values, scene and morph models, including Exclude tuning, lock and the morph rule.
- Serial codec: frame builders, pad block parser, status parser, tested against captured bytes from Phase 0.
- Mixer model: pad set from the device, app-side mute, mix-scene store and the recall rule (with recall safe),
  MIDI note calculation for Modes A and B.

### Phase 2 — Pad mixer
Built before the FX UI: the serial side is the riskier half, and the mixer is useful on its own while the
effects are still played from the device.
- **Shell**: Layout D window at 1920 × 1080 with fit zoom (as the TB-3 app's `useFitZoom`); top bar with MIDI,
  USB (and project) and Launchpad status; the FX row as a placeholder until Phase 3.
- **Serial connection**: Web Serial in the renderer, as in Phase 0 (Node serial in the main process only if it
  proves unreliable). Remembered port, reconnect after unplugging, a clear error if the port is busy, writes
  through a rate-limited queue, status poll every 500 ms.
- **Project**: on connect, read the project number and every pad block. Read them again when status byte 1
  changes or the device sends `1A`. Parse the `7D` project-settings frame for the bank volumes, so the bank
  masters start from the device's values.
- **Desk**: one strip per loaded pad, grouped by bank, SHOW BANKS; level, pan, routing, mute group, MUTE
  (app-side), AHR thumbnail and editor, MIDI note (Settings: mode, Pad MIDI Channels, Note offset); bank master
  with BANK VOL; status light for the sounding pad and shading for the selected one.
- **Edits made on the device**: find out whether the SP-404 reports them. If it doesn't, re-read the selected
  pad's block when the selection changes.
- **Mix scenes and recall safe**: deferred (the SP-404's projects keep the mixer values). The file store starts
  with the FX library in Phase 4 instead.
- **Settings**: MIDI mode, Pad MIDI Channels and Note offset, for the pad notes and lights.
- **Tests**: e2e against a fake SP-404 serial port (a Web Serial stub in the page, as `fakeTb3.ts` stands in for
  the TB-3), built from the Phase 0 captures.

### Phase 3 — FX UI
Status (2026-11-10): the FX row, modules, chooser, ON/OFF, every parameter's control (SYNC swaps rate and time
controls), RESEND and all 46 drawings are built (`apps/sp404/src/fx/`). The control kinds come from the mockup
through `scripts/gen-fx-layout.mjs`. FX state is kept in localStorage until the Phase 4 files. The preset column,
DEF, GRAB, LOCK, morph and FX scenes are drawn but wait for Phase 4. Not yet checked on the device.
- FX row with the five modules and FX scenes, in the Phase 2 shell.
- Module frame (header, side column, morph) and the shared controls (switch, button row, button grid,
  note-value matrix, drop-down, stepped knob, handles).
- The 46 effect views, in category order, each with an e2e test against a fake SP-404 MIDI port.

### Phase 4 — Library
- Presets, defaults, recent values, FX scenes, GRAB, LOCK, morph; files with autosave.

### Phase 5 — Controllers
- Launchpad Pro Mk1 mapping (via `packages/launchpad`); keyboard overlay with the Launchkey; CC learn.

### Phase 6 — Packaging
- Signed build, remembered ports with reconnect, settings window.
