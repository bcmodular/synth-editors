# JV-2080 editor — patch features not in the editor yet

An inventory, made 2026-11-15, of every patch parameter the editor can't yet set. Taken from the SysEx map
([jv2080-sysex-map.md](jv2080-sysex-map.md) §4–5) against `apps/jv2080/src/core/params.ts` and the UI. The editor
reads and sends whole patches, so the missing parameters are kept as they are, but nothing in the app changes them.
Offsets are within Patch Common or Patch Tone; manual pages are the JV-2080 Owner's Manual.

Out of scope by decision (see [jv2080-design.md](jv2080-design.md)): writing to USER memory, performances, rhythm
sets, the GM system and system settings, and expansion boards.

## Summary

| Area | Missing | In the editor |
|---|---|---|
| Patch Common (74 bytes) | 22 parameters, plus editing the name | 39 (the 12 EFX parameters among them) |
| Patch Tone (129 bytes, × 4) | 78 parameters | 50 |

The biggest groups:
- **Tone controllers:** 24 bytes. Each tone's routing of the three patch control sources to its parameters.
- **Velocity and keyfollow:** 21 bytes. How playing strength and key position shape the envelopes, filter, level
  and pan.
- **LFO extras:** 12 bytes. Each LFO's delay, fade, offset, key trigger and clock sync.
- **Structure and boosters:** 4 bytes. How tones 1&2 and 3&4 combine, with ring modulation and boosters.

## Patch Common

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 00–0B | Patch Name | 12 characters | The patch's name. Shown in the top strip, but not editable. | Click the name in the top strip to edit it. |
| 49 | Patch Category | 0–38 named | The patch's category, used by the JV's patch search and phrase preview (p. 20, 72). | Beside the name. |
| 1D–20 | EFX Control Source 1–2, Depth 1–2 | OFF, SYS-CTRL1/2, MOD, BREATH, FOOT, VOLUME, PAN, EXPRESSION, BEND, AFTERTOUCH; −63…+63 | Two MIDI controllers that move the EFX's realtime (#) parameter (p. 104). | An EFX "control" row, or the EFX help copy. |
| 3C | EFX Control Hold/Peak | OFF, HOLD, PEAK | Whether a pedal holds the EFX control value (p. 73). | With the EFX control. |
| 3A–3B | Patch Control Source 2–3 | OFF … VELOCITY, KEYFOLLOW, PLAYMATE | What the patch's controllers 2 and 3 respond to; controller 1 is the mod lever (p. 73, 106). | A patch "controllers" panel, with the tones' destinations. |
| 3D–3F | Control 1–3 Hold/Peak | OFF, HOLD, PEAK | Whether pedals hold each controller's value. | Same panel. |
| 30 | Analog Feel | 0–127 | Slow 1/f pitch drift across the patch, like an analogue synth's instability (p. 72). | PATCH section. |
| 36 | Portamento Mode | NORMAL, LEGATO | Glide always, or only between overlapping notes (p. 74). | PATCH, beside PORTA. |
| 37 | Portamento Type | RATE, TIME | Glide time depends on the interval, or is fixed. | PATCH. |
| 38 | Portamento Start | PITCH, NOTE | A new glide starts from where the pitch is, or from where it was heading. | PATCH. |
| 40 | Velocity Range Switch | OFF, ON | Turns the tones' velocity ranges (below) on (p. 76). | A key and velocity range panel. |
| 42 | Stretch Tune Depth | OFF, 1–3 | Piano-style stretched tuning, flat in the bass and sharp in the treble (p. 72). | PATCH. |
| 43 | Voice Priority | LAST, LOUDEST | Which notes the JV keeps when it runs out of voices (p. 73). | PATCH. |
| 44 / 46 | Structure Type 1&2, 3&4 | 1–10 | How each pair of tones combines: separately, or with stacked filters, a booster or a ring modulator (p. 74–76). | A structure picker between each pair of tone columns, with a diagram (the help flows could draw it). |
| 45 / 47 | Booster 1&2, 3&4 | 0, +6, +12, +18 dB | How hard the booster distorts, in structures 3 and 4. | With the structure picker. |

## Patch Tone (each of the four)

### Wave

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 05 | Wave Gain | −6, 0, +6, +12 dB | The wave's level into the tone; +12 drives the booster harder (p. 80). | WG row under the wave title. |
| 06–08 | FXM Switch, Color, Depth | OFF/ON; 1–4; 1–16 | Frequency cross-modulation: a harsher, metallic edge from a second waveform (p. 80). | Same WG row. |
| 09–0A | Tone Delay Mode, Time | NORMAL, HOLD, PLAYMATE, CLOCK-SYNC, KEY-OFF-N, KEY-OFF-D, TEMPO-SYNC; 0–127 | Delays when the tone starts, for strums, echoes and back-beats (p. 80–82). | Tone header or a TONE DELAY row. |

### Ranges

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 0E–0F | Key Range Lower, Upper | C-1…G9 | The keys the tone plays on: splits (p. 76). | A key and velocity range panel for all four tones, as on the JV's Palette page. |
| 0C–0D | Velocity Range Lower, Upper | 1–127 | How hard you must play for the tone to sound: velocity layers. | Same panel. |
| 0B | Velocity Cross-Fade | 0–127 | How gradually the tone fades in and out at the edges of its velocity range. | Same panel. |

### MIDI reception and controllers

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 10–14 | Redamper, Volume, Hold-1, Pitch Bend, Pan control switches | OFF/ON (Pan: OFF, CONTINUOUS, KEY-ON) | Whether the tone responds to those MIDI messages (p. 88–89). | A tone "MIDI" row, or the controllers panel. |
| 15–2C | Controller 1–3 Destination 1–4, Depth 1–4 | a tone parameter; −63…+63 | What each of the three patch controllers moves in this tone, and how far: up to four destinations each (p. 106). | The controllers panel: a 3 × 4 matrix per tone. |

### LFOs (each of LFO1 and LFO2)

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 2E / 36 | Key Trigger | OFF, ON | Restart the LFO at each note (p. 86). | LFO row, as a button. |
| 30 / 38 | Offset | −100, −50, 0, +50, +100 | Shifts the LFO's swing up or down rather than either side of the centre (p. 87). | LFO row. |
| 31 / 39 | Delay Time | 0–127 | How long after the note (or the release) the LFO starts. | An LFO detail popup, or the LFO help copy. |
| 32 / 3A | Fade Mode | ON-IN, ON-OUT, OFF-IN, OFF-OUT | Whether the LFO fades in or out, from note-on or note-off. | Same. |
| 33 / 3B | Fade Time | 0–127 | How long the fade takes. | Same. |
| 34 / 3C | External Sync | OFF, CLOCK | Lock the rate to the clock, as a note value (p. 87, 110). | LFO row, as a button. |
| 7B–7C | Pan LFO1, LFO2 Depth | L63…63R | How much each LFO moves the tone's pan: auto-pan (p. 88). | AMP part, as a fourth knob pair. |

### Pitch

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 3F | Random Pitch Depth | 0–1200 cents | A random pitch offset at each note (p. 82). | PITCH knobs. |
| 40 | Pitch Keyfollow | −100…+200 % | How far the pitch moves per octave played; 0 plays the same pitch on every key. | PITCH knobs. |
| 42 | Pitch Env Velocity Sens | −100…+150 | Playing harder deepens (or lessens) the pitch envelope (p. 83). | An envelope "velocity / keyfollow" popup from each graph. |
| 43–45 | Pitch Env Velocity Time 1, Time 4, Time Keyfollow | −100…+100 | Playing harder or releasing faster shortens times; higher keys shorten times. | Same popup. |

### Filter

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 52 | Cutoff Keyfollow | −100…+200 % | Opens the filter higher up the keyboard (p. 84). | FILTER knobs. |
| 54 | Resonance Velocity Sens | −100…+150 | Playing harder adds (or takes away) resonance. | FILTER knobs. |
| 56–57 | Filter Env Velocity Curve, Sens | 1–7; −100…+150 | How playing strength deepens the filter envelope: the bright-when-hard response. | Envelope popup. |
| 58–5A | Filter Env Velocity Time 1, Time 4, Time Keyfollow | −100…+100 | As for pitch. | Envelope popup. |

### Amp and pan

| Off | Parameter | Range | What it does | Where it could go |
|---|---|---|---|---|
| 69–6A | Level Env Velocity Curve, Sens | 1–7; −100…+150 | How playing strength sets the tone's level: velocity sensitivity (p. 86). | Envelope popup; Sens is worth a knob in AMP. |
| 6B–6D | Level Env Velocity Time 1, Time 4, Time Keyfollow | −100…+100 | As for pitch. | Envelope popup. |
| 66–68 | Bias Direction, Position, Level | LOWER, UPPER, LOW&UP, ALL; a key; −100…+100 | Level changes across the keyboard, as in acoustic instruments (p. 85). | AMP, or the range panel. |
| 78 | Pan Keyfollow | −100…+100 | Pans higher notes further right (or left) (p. 85). | The mixer strip, or AMP. |
| 79 | Random Pan Depth | 0–63 | A random pan at each note. | Same. |
| 7A | Alternate Pan Depth | L63…63R | Alternates notes left and right. | Same. |

## Suggested order

1. **Velocity sensitivity.** Level and filter envelope Sens are what most patches lean on for feel; a knob each in
   AMP and FILTER.
2. **Key and velocity ranges, and Structure and Booster.** Splits, layers, and the JV's ring modulation and
   distortion: a panel for all four tones.
3. **LFO extras.** Delay and fade (vibrato that creeps in), key trigger, external sync.
4. **Patch name and category**, since the editor already reads them.
5. **The controller matrix** (patch control sources and each tone's destinations) and the EFX controls.
6. The rest: keyfollows, random and alternate pan, Analog Feel, stretch tuning, voice priority, wave gain, FXM,
   tone delay, MIDI receive switches, portamento mode, type and start.
