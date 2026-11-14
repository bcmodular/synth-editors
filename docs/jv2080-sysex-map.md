# JV-2080 SysEx Map — verified against the Roland manual

Source: Roland *JV-2080 Owner's Manual* (local scan, 206 pp.; PDF page numbers equal printed page
numbers). MIDI Implementation is "Model JV-2080, Date Oct. 30 1996, Version 1.00" (p.184).
All page citations below are printed page numbers. No other source was used.

Conventions: offsets are given as **hex (decimal)**. "Raw" = the 7-bit value on the wire.
"Display" = what the JV-2080 front panel shows.

---

## Key findings

Points that shape the editor's design. They were first written as corrections to an earlier
TouchOSC plan, so some mention "the plan"; [jv2080-design.md](jv2080-design.md) has taken them all in.

1. **Bank 81/3 is the GM bank, not "PR-D".** The patch bank-select table (p.184) lists
   `81/3 → GM`. The other entries are correct: USER 80/0, PR-A 81/0, PR-B 81/1, PR-C 81/2, PR-E 81/4,
   CARD 82/0. The manual doesn't label any bank "PR-D". The table also lists expansion banks
   `84/0…84/15` = XP-A…XP-H (even LSB = patches 1–128, program 0–127; odd LSB = patches 129–255,
   program 0–126). These are out of scope for v1 (no expansion boards).
2. **Addresses and sizes are 7-bit, so the tone block crosses an address byte.** The Patch Tone
   total size is printed as `00 00 01 01` (p.190). That is 129 bytes, but on the wire it is
   **`00 00 01 01`, not `00 00 00 81`** (0x81 is not a legal data byte). Tone offset 128 (Reverb Send
   Level) sits at address offset `01 00` (p.190). Tone 1 Reverb Send is therefore `03 00 11 00`,
   not `03 00 10 80`. The plan's flat decimal offsets 0–128 still work as indices into the 129-byte
   cache. The address builder has to carry into the third address byte: `a3 = base3 + (off >> 7)`,
   `a4 = off & 0x7F`. The RQ1 size for a tone is `00 00 01 01`. The RQ1 size for Common is
   `00 00 00 4A`.
3. **A whole tone can't go out in one DT1.** The manual says data larger than 128 bytes "should be
   divided into packets of 128 bytes or less", sent at least 20 ms apart (p.187, DT1 receive notes).
   The JV also sends large dumps in ≤128-byte packets at about 20 ms intervals (p.187, transmission).
   So:
   - Preset recall can't be "5 DT1 block writes". Each 129-byte tone needs at least 2 DT1s, for
     example 128 bytes at `…1n 00` plus 1 byte at `…1n+1 00`, or two halves. Space them ≥20 ms
     apart.
   - The receiver must expect a tone RQ1 to come back as **more than one DT1** and reassemble the
     pieces by address.
4. **The internal waves are two groups, INT-A and INT-B, not one "INT" table.** The Wave Group
   display values are `INT-A, INT-B, XP-A–XP-H` (p.161; p.79 says "INT-A—B: waveforms stored in
   internal memory"). The waveform list (pp.182–183) has **INT-A = 255 waves** and **INT-B = 193
   waves**, **448 internal waves** in total. "Wave Group 1–2 (fixed INT in v1)" is not enough: the
   editor must set Wave Group Type (offset 1) **and** Wave Group ID (offset 2) to pick A or B.
   It needs two name tables.
   - **Not verifiable from the manual:** the raw Group ID values for INT-A and INT-B. The MIDI
     implementation only gives `Wave Group Type 0–2 = INT, <PCM>, EXP` and `Wave Group ID 0–127`
     (p.190). Read a known preset on hardware to find the IDs. Check an INT-A tone and an INT-B tone.
   - `<PCM>` is in angle brackets. Per p.188, values in `< >` are for JV-1080/XP-80 and are ignored
     by the JV-2080. So Group Type is effectively 0 = INT, 2 = EXP.
5. **Wave Number range is per group.** It is raw 0–254 (display 001–255) (p.190). INT-B only uses
   raw 0–192 (001–193). The open question "exact internal wave count" is answered by point 4.
6. **EFX Output Assign has no "EFX" option.** EFX Output Assign (Common 0x19 = 25) is
   `0–2 = MIX, DIR1, DIR2` (p.189, p.163). Tone Output Assign (Tone 0x7D = 125) is
   `0–3 = MIX, EFX, DIR1, DIR2` (p.190). The two enums differ. the plan doesn't list either.
7. **The EFX parameter value encoding is not in the manual.** EFX Parameter 1–12 are raw `0–127`
   in the MIDI implementation (p.189). The per-type lists (pp.168–172) only give *display* ranges
   such as `-15—+15 dB`, `0.0—100.0 ms` and `0.05—10.00 Hz`. The manual never says how raw maps to
   display, or how many raw steps each parameter has. It also never says outright that the
   per-type list order is the order of EFX Parameter 1–12. That order is inferred from the list
   order and from the p.33 screen shot (TRIPLE-TAP-DELAY shows params in the same order as p.170).
   **Every non-0–127 EFX parameter is flagged** in the EFX section and needs hardware measurement:
   sweep each raw value and read the panel.
8. **TVA Envelope Level 4 is not a parameter.** It is confirmed absent: the MIDI implementation has
   only Level Envelope Level 1–3 (0x72–0x74) (p.190), and the TVA Envelope page lists
   "Level 1—3" (p.162). The p.86 envelope diagram shows the level returning to the baseline after
   Time 4, so it is fixed at 0. This matches the plan's expectation.
9. **Checksum edge case.** Per p.193 the checksum is `128 − (sum % 128)`, which gives 128 when the
   sum is a multiple of 128. The plan's `(128 − sum%128) % 128` gives the correct wire value (0).
   No change needed. This is noted only because a literal transcription of the manual's formula
   would be wrong.

Everything else in The plan's "SysEx protocol" and "Parameter scope (v1)" sections **checks out**.
The detail is below. Every Patch Common and Patch Tone offset listed in the plan matches the manual.

---

## 1. Message format (pp.187, 193–194)

| Item | Manual | the plan |
|---|---|---|
| Manufacturer ID | `41H` (Roland) | ✓ |
| Device ID | `dev` = `10H–1FH`; examples use device ID 17 → `10` on the wire (p.193 ex.2) | ✓ |
| Model ID | `6AH` ("JV-2080 (Model ID=6AH)", p.188) | ✓ |
| DT1 | `F0 41 dev 6A 12 aa bb cc dd <data…> sum F7` | ✓ |
| RQ1 | `F0 41 dev 6A 11 aa bb cc dd ss tt uu vv sum F7` (size is 4 bytes, 7-bit) | ✓ (size must be 7-bit encoded, see Discrepancy 2) |
| Checksum | `sum(address..data or size) % 128`, checksum = `128 − remainder` (p.193) | ✓ |
| Nibbled params | "#"-marked addresses: data split into 2 bytes, e.g. `ABH` → `0AH 0BH` (p.188); value = `a×16 + b` (p.192) | ✓ high nibble first |
| Packet limit | Receive: >128 bytes must be split into ≤128-byte packets, ≥20 ms apart. Transmit: same, about 20 ms (p.187) | ✗ not in plan (Discrepancy 3) |
| Not received | RQ1/DT1 ignored if Rx.Sys.Excl (MIDI Param 1 page) is OFF, and in GM mode (p.187) | — |

Worked example from the manual (p.193 ex.1): `F0 41 10 6A 12 01 00 00 28 06 51 F7` sets Temporary
Performance Common Reverb Type to DELAY.

Nibbled (#) parameters in the patch blocks: **Patch Common Tempo** `0x2C–0x2D` (44–45) and
**Tone Wave Number** `0x03–0x04` (3–4). There are no others in Patch Common or Patch Tone
(pp.189–190). ✓ matches the plan.

## 2. Address map (pp.188–189, 192)

| Start address | Block |
|---|---|
| `00 00 00 00` | System |
| `01 00 00 00` | Temporary Performance |
| `02 00 00 00` … `02 0F 00 00` | Performance Mode Temporary Patch (part 1–16; part 10 = `02 09 00 00` is the Temporary Rhythm Setup) |
| **`03 00 00 00`** | **Patch Mode Temporary Patch** |
| `10 00 00 00` … `10 1F 00 00` | User Performance 01–32 |
| `10 40 00 00`, `10 41 00 00` | User Rhythm Setup 1–2 |
| `11 00 00 00` … `11 7F 00 00` | User Patch 001–128 |

Patch sub-blocks (p.189 "1-3. Patch"):

| Block | Offset | Patch-mode temp address | Size (7-bit) | Bytes |
|---|---|---|---|---|
| Patch Common | `00 00` | `03 00 00 00` | `00 00 00 4A` | 74 ✓ |
| Patch Tone 1 | `10 00` | `03 00 10 00` | `00 00 01 01` | 129 ✓ |
| Patch Tone 2 | `12 00` | `03 00 12 00` | `00 00 01 01` | 129 ✓ |
| Patch Tone 3 | `14 00` | `03 00 14 00` | `00 00 01 01` | 129 ✓ |
| Patch Tone 4 | `16 00` | `03 00 16 00` | `00 00 01 01` | 129 ✓ |

Full patch = 74 + 4×129 = **590 bytes** ✓.

## 3. Bank select / program change (p.184)

CC0 = MSB, CC32 = LSB, then Program Change (raw 0–127 = patch 1–128). Not received if Rx Bank
Select / Rx Program Change are OFF (p.184, p.186). **Bank values are decimal.**

| MSB | LSB | Program | Group | Patch No. |
|---|---|---|---|---|
| 80 | 0 | 0–127 | User | 1–128 |
| 81 | 0 | 0–127 | PR-A | 1–128 |
| 81 | 1 | 0–127 | PR-B | 1–128 |
| 81 | 2 | 0–127 | PR-C | 1–128 |
| 81 | 3 | 0–127 | **GM** | 1–128 |
| 81 | 4 | 0–127 | PR-E | 1–128 |
| 82 | 0 | 0–127 | CARD | 1–128 |
| 84 | 2n | 0–127 | XP-(A+n) | 1–128 |
| 84 | 2n+1 | 0–126 | XP-(A+n) | 129–255 |

## 4. Patch Common (p.189–190, block size 0x4A)

★ = in the plan v1 scope. Every ★ offset matches the plan.

| Off hex | Dec | Parameter | Raw | Display / enum | |
|---|---|---|---|---|---|
| 00–0B | 0–11 | Patch Name 1–12 | 32–125 | ASCII | ★ |
| 0C | 12 | EFX Type | 0–39 | 1–40 (see §7) | ★ |
| 0D–18 | 13–24 | EFX Parameter 1–12 | 0–127 | per type (§7) | ★ |
| 19 | 25 | EFX Output Assign | 0–2 | MIX, DIR1, DIR2 | ★ |
| 1A | 26 | EFX Mix Out Send Level | 0–127 | 0–127 | ★ |
| 1B | 27 | EFX Chorus Send Level | 0–127 | 0–127 | ★ |
| 1C | 28 | EFX Reverb Send Level | 0–127 | 0–127 | ★ |
| 1D | 29 | EFX Control Source 1 | 0–10 | OFF, SYS-CTRL1, SYS-CTRL2, MODULATION, BREATH, FOOT, VOLUME, PAN, EXPRESSION, PITCH BEND, AFTERTOUCH | |
| 1E | 30 | EFX Control Depth 1 | 0–126 | −63…+63 | |
| 1F | 31 | EFX Control Source 2 | 0–10 | as above | |
| 20 | 32 | EFX Control Depth 2 | 0–126 | −63…+63 | |
| 21 | 33 | Chorus Level | 0–127 | 0–127 | ★ |
| 22 | 34 | Chorus Rate | 0–127 | 0–127 | ★ |
| 23 | 35 | Chorus Depth | 0–127 | 0–127 | ★ |
| 24 | 36 | Chorus Pre-Delay | 0–127 | 0–127 | ★ |
| 25 | 37 | Chorus Feedback | 0–127 | 0–127 | ★ |
| 26 | 38 | Chorus Output | 0–2 | MIX, REVERB, MIX+REV (panel: MIX, REV, M+R, p.163) | ★ |
| 27 | 39 | Reverb Type | 0–7 | ROOM1, ROOM2, STAGE1, STAGE2, HALL1, HALL2, DELAY, PAN-DLY | ★ |
| 28 | 40 | Reverb Level | 0–127 | 0–127 | ★ |
| 29 | 41 | Reverb Time | 0–127 | 0–127 | ★ |
| 2A | 42 | Reverb HF Damp | 0–17 | 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000 Hz, BYPASS | ★ |
| 2B | 43 | Delay Feedback | 0–127 | 0–127 | ★ |
| 2C–2D # | 44–45 | Patch Tempo | 20–250 (nibbled) | 20–250 | (plan: protocol note) |
| 2E | 46 | Patch Level | 0–127 | 0–127 | ★ |
| 2F | 47 | Patch Pan | 0–127 | L64…63R (64 = centre) | ★ |
| 30 | 48 | Analog Feel | 0–127 | 0–127 | |
| 31 | 49 | Bend Range Up | 0–12 | 0…+12 | ★ |
| 32 | 50 | Bend Range Down | 0–48 | 0…−48 (raw n → −n) | ★ |
| 33 | 51 | Key Assign Mode | 0–1 | POLY, SOLO | ★ |
| 34 | 52 | Solo Legato | 0–1 | OFF, ON | ★ |
| 35 | 53 | Portamento Switch | 0–1 | OFF, ON | ★ |
| 36 | 54 | Portamento Mode | 0–1 | NORMAL, LEGATO | |
| 37 | 55 | Portamento Type | 0–1 | RATE, TIME | |
| 38 | 56 | Portamento Start | 0–1 | PITCH, NOTE | |
| 39 | 57 | Portamento Time | 0–127 | 0–127 | ★ |
| 3A | 58 | Patch Control Source 2 | 0–15 | OFF, SYS-CTRL1, SYS-CTRL2, MODULATION, BREATH, FOOT, VOLUME, PAN, EXPRESSION, PITCH BEND, AFTERTOUCH, LFO1, LFO2, VELOCITY, KEYFOLLOW, PLAYMATE | |
| 3B | 59 | Patch Control Source 3 | 0–15 | as above | |
| 3C | 60 | EFX Control Hold/Peak | 0–2 | OFF, HOLD, PEAK | |
| 3D–3F | 61–63 | Control 1–3 Hold/Peak | 0–2 | OFF, HOLD, PEAK | |
| 40 | 64 | Velocity Range Switch | 0–1 | OFF, ON | |
| 41 | 65 | Octave Shift | 0–6 | −3…+3 (raw 3 = 0) | ★ |
| 42 | 66 | Stretch Tune Depth | 0–3 | OFF, 1–3 | |
| 43 | 67 | Voice Priority | 0–1 | LAST, LOUDEST | |
| 44 | 68 | Structure Type 1&2 | 0–9 | 1–10 | |
| 45 | 69 | Booster 1&2 | 0–3 | 0, +6, +12, +18 | |
| 46 | 70 | Structure Type 3&4 | 0–9 | 1–10 | |
| 47 | 71 | Booster 3&4 | 0–3 | 0, +6, +12, +18 | |
| 48 | 72 | Clock Source | 0–1 | PATCH, SYSTEM | |
| 49 | 73 | Patch Category | 0–127 | 0–38 named (p.190 *12) | |

Total size `00 00 00 4A` ✓.

## 5. Patch Tone (p.190, block size `00 00 01 01` = 129 bytes)

★ = in the plan v1 scope. Every ★ offset matches the plan.

| Off hex | Dec | Parameter | Raw | Display / enum | |
|---|---|---|---|---|---|
| 00 | 0 | Tone Switch | 0–1 | OFF, ON | ★ |
| 01 | 1 | Wave Group Type | 0–2 | INT, \<PCM\>, EXP (PCM ignored by JV-2080) | ★ |
| 02 | 2 | Wave Group ID | 0–127 | INT-A / INT-B / XP-A…H — **raw IDs not in manual** | ★ |
| 03–04 # | 3–4 | Wave Number | 0–254 (nibbled) | 001–255 (§8) | ★ |
| 05 | 5 | Wave Gain | 0–3 | −6, 0, +6, +12 dB | |
| 06 | 6 | FXM Switch | 0–1 | OFF, ON | |
| 07 | 7 | FXM Color | 0–3 | 1–4 | |
| 08 | 8 | FXM Depth | 0–15 | 1–16 | |
| 09 | 9 | Tone Delay Mode | 0–7 | NORMAL, HOLD, PLAYMATE, CLOCK-SYNC, \<TAP-SYNC\>, KEY-OFF-N, KEY-OFF-D, TEMPO-SYNC | |
| 0A | 10 | Tone Delay Time | 0–127 | | |
| 0B–0F | 11–15 | Vel X-Fade, Vel Range Lo/Hi, Key Range Lo/Hi | | | |
| 10–14 | 16–20 | Redamper / Volume / Hold-1 / Pitch Bend / Pan control switches | | | |
| 15–2C | 21–44 | Controller 1–3 Destination/Depth 1–4 | | | |
| 2D | 45 | LFO1 Waveform | 0–7 | TRI, SIN, SAW, SQR, TRP, S&H, RND, CHS | ★ |
| 2E | 46 | LFO1 Key Trigger | 0–1 | OFF, ON | |
| 2F | 47 | LFO1 Rate | 0–127 | 0–127 | ★ |
| 30 | 48 | LFO1 Offset | 0–4 | −100, −50, 0, +50, +100 | |
| 31 | 49 | LFO1 Delay Time | 0–127 | | |
| 32 | 50 | LFO1 Fade Mode | 0–3 | ON-IN, ON-OUT, OFF-IN, OFF-OUT | |
| 33 | 51 | LFO1 Fade Time | 0–127 | | |
| 34 | 52 | LFO1 External Sync | 0–2 | OFF, CLOCK, \<TAP\> | |
| 35 | 53 | LFO2 Waveform | 0–7 | as LFO1 | ★ |
| 36 | 54 | LFO2 Key Trigger | 0–1 | OFF, ON | |
| 37 | 55 | LFO2 Rate | 0–127 | 0–127 | ★ |
| 38–3C | 56–60 | LFO2 Offset / Delay / Fade Mode / Fade Time / Ext Sync | | | |
| 3D | 61 | Coarse Tune | 0–96 | −48…+48 | ★ |
| 3E | 62 | Fine Tune | 0–100 | −50…+50 | ★ |
| 3F | 63 | Random Pitch Depth | 0–30 | 0,1,…,10,20,…,100,200,…,1200 | |
| 40 | 64 | Pitch Keyfollow | 0–15 | −100, −70, −50, −30, −10, 0, +10, +20, +30, +40, +50, +70, +100, +120, +150, +200 | |
| 41 | 65 | Pitch Envelope Depth | 0–24 | −12…+12 | ★ |
| 42 | 66 | Pitch Env Velocity Sens | 0–125 | −100…+150 | |
| 43–45 | 67–69 | Pitch Env Vel Time1 / Vel Time4 / Time Keyfollow | 0–14 | −100, −70, −50, −40, −30, −20, −10, 0, +10, +20, +30, +40, +50, +70, +100 | |
| 46–49 | 70–73 | Pitch Envelope Time 1–4 | 0–127 | 0–127 | ★ |
| 4A–4D | 74–77 | Pitch Envelope Level 1–4 | 0–126 | −63…+63 | ★ |
| 4E | 78 | Pitch LFO1 Depth | 0–126 | −63…+63 | ★ |
| 4F | 79 | Pitch LFO2 Depth | 0–126 | −63…+63 | ★ |
| 50 | 80 | Filter Type | 0–4 | OFF, LPF, BPF, HPF, PKG | ★ |
| 51 | 81 | Cutoff Frequency | 0–127 | 0–127 | ★ |
| 52 | 82 | Cutoff Keyfollow | 0–15 | as Pitch Keyfollow | |
| 53 | 83 | Resonance | 0–127 | 0–127 | ★ |
| 54 | 84 | Resonance Velocity Sens | 0–125 | −100…+150 | |
| 55 | 85 | Filter Envelope Depth | 0–126 | −63…+63 | ★ |
| 56 | 86 | Filter Env Velocity Curve | 0–6 | 1–7 | |
| 57 | 87 | Filter Env Velocity Sens | 0–125 | −100…+150 | |
| 58–5A | 88–90 | Filter Env Vel Time1 / Vel Time4 / Time Keyfollow | 0–14 | as 67–69 | |
| 5B–5E | 91–94 | Filter Envelope Time 1–4 | 0–127 | 0–127 | ★ |
| 5F–62 | 95–98 | Filter Envelope Level 1–4 | 0–127 | 0–127 | ★ |
| 63 | 99 | Filter LFO1 Depth | 0–126 | −63…+63 | ★ |
| 64 | 100 | Filter LFO2 Depth | 0–126 | −63…+63 | ★ |
| 65 | 101 | Tone Level | 0–127 | 0–127 | ★ |
| 66 | 102 | Bias Direction | 0–3 | LOWER, UPPER, LOW&UP, ALL | |
| 67 | 103 | Bias Position | 0–127 | C-1…G9 | |
| 68 | 104 | Bias Level | 0–14 | as 67–69 | |
| 69 | 105 | Level Env Velocity Curve | 0–6 | 1–7 | |
| 6A | 106 | Level Env Velocity Sens | 0–125 | −100…+150 | |
| 6B–6D | 107–109 | Level Env Vel Time1 / Vel Time4 / Time Keyfollow | 0–14 | as 67–69 | |
| 6E–71 | 110–113 | Level (TVA) Envelope Time 1–4 | 0–127 | 0–127 | ★ |
| 72–74 | 114–116 | Level (TVA) Envelope Level 1–3 | 0–127 | 0–127 (**no Level 4**) | ★ |
| 75 | 117 | Level LFO1 Depth | 0–126 | −63…+63 | ★ |
| 76 | 118 | Level LFO2 Depth | 0–126 | −63…+63 | ★ |
| 77 | 119 | Tone Pan | 0–127 | L64…63R | ★ |
| 78 | 120 | Pan Keyfollow | 0–14 | as 67–69 | |
| 79 | 121 | Random Pan Depth | 0–63 | 0–63 | |
| 7A | 122 | Alternate Pan Depth | 1–127 | L63…63R | |
| 7B | 123 | Pan LFO1 Depth | 0–126 | L63…63R | |
| 7C | 124 | Pan LFO2 Depth | 0–126 | L63…63R | |
| 7D | 125 | Output Assign | 0–3 | MIX, EFX, DIR1, DIR2 | ★ |
| 7E | 126 | Mix/EFX Send Level | 0–127 | 0–127 | ★ |
| 7F | 127 | Chorus Send Level | 0–127 | 0–127 | ★ |
| **01 00** | 128 | Reverb Send Level | 0–127 | 0–127 (address carries, see Discrepancy 2) | ★ |

## 6. Enum labels (summary)

| Param | Raw → label | Source |
|---|---|---|
| Filter Type (Tone 80) | 0 OFF, 1 LPF, 2 BPF, 3 HPF, 4 PKG | p.190 *18, p.161 |
| LFO Waveform (Tone 45/53) | 0 TRI, 1 SIN, 2 SAW, 3 SQR, 4 TRP (trapezoid), 5 S&H, 6 RND, 7 CHS (chaos) | p.190 *10, p.86 |
| Reverb Type (Common 39) | 0 ROOM1, 1 ROOM2, 2 STAGE1, 3 STAGE2, 4 HALL1, 5 HALL2, 6 DELAY, 7 PAN-DLY | p.189 *4, p.163 |
| Reverb HF Damp (Common 42) | 0 200 … 16 8000 Hz, 17 BYPASS (see §4) | p.190 *5 |
| Chorus Output (Common 38) | 0 MIX, 1 REVERB, 2 MIX+REV | p.190 *3 |
| EFX Output Assign (Common 25) | 0 MIX, 1 DIR1, 2 DIR2 | p.190 *1 |
| Tone Output Assign (Tone 125) | 0 MIX, 1 EFX, 2 DIR1, 3 DIR2 | p.190 *20 |
| Key Assign (Common 51) | 0 POLY, 1 SOLO | p.189 |
| Solo Legato / Portamento Sw | 0 OFF, 1 ON | p.189–190 |
| Wave Group Type (Tone 1) | 0 INT, 1 \<PCM\> (ignored), 2 EXP | p.190 *1 |

## 7. EFX types — per-type parameters (pp.33, 168–172; descriptions pp.34–53)

EFX Type is raw 0–39 at Common 0x0C (12). The display is 1–40. EFX Parameter *n* is Common offset
`12 + n` (13–24), raw 0–127 (p.189).

**Read this before using the tables:**
- The manual lists each type's parameters in panel order (pp.168–172). That order is **assumed** to
  be EFX Parameter 1…N. The manual never states this. It is consistent with the p.33 TRIPLE-TAP-DELAY
  screen shot.
- The manual gives **display ranges only**. It never says how raw 0–127 maps to them.
  Rows marked ⚑ need hardware measurement. Rows marked "raw = display" are 0–127 on the panel and
  are almost certainly 1:1. Steps for enum rows are counted from the manual's own list, and the
  "probably raw 0–(n−1)" note is an inference. Continuous non-0–127 ranges (dB, ms, Hz, %, degree,
  semitone, cent, balance) are marked "mapping unknown". Many are certainly non-linear tables
  (e.g. 0.0–500.0 ms can't fit 128 linear steps at 0.1 ms resolution).
- "note" in a range (TRIPLE/QUADRUPLE-TAP-DELAY delay times, STEP-FLANGER Step Rate) means the
  value also offers tempo-synced note lengths (cf. p.161 note-value list). Where those sit in the
  raw range is unknown.
- Shared lists: **F17** = 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150,
  4000, 5000, 6300, 8000 Hz. **F18** = F17 + BYPASS.
- Pan "L64…0…63R" and balances ("DRY100:0WET…DRY0:100WET", "D100:0W…D0:100W",
  "A100:0B…A0:100B") are probably 0–127 with a centre at 64, but the manual doesn't confirm this.
- Effects chapter p.33: params marked "#" in pp.34–53 can be modulated in real time via EFX
  Control Source 1/2. Those markers are not transcribed here.

#### 01 STEREO-EQ — raw EFX Type 0 (p.168; description p.34)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Low Freq | Low frequency | 200, 400 Hz | ⚑ enum, 2 values, probably raw 0–1 |
| 2 | 14 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 3 | 15 | P1 Freq | Peaking 1 frequency | *F17* (17 freqs) | ⚑ enum, 17 values, probably raw 0–16 |
| 4 | 16 | P1 Gain | Peaking 1 gain | -15…+15 dB | ⚑ mapping unknown |
| 5 | 17 | P1 Q | Peaking 1 Q | 0.5, 1.0, 2.0, 4.0, 8.0 | ⚑ enum, 5 values, probably raw 0–4 |
| 6 | 18 | High Freq | High frequency | 4000, 8000 Hz | ⚑ enum, 2 values, probably raw 0–1 |
| 7 | 19 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 8 | 20 | P2 Freq | Peaking 2 frequency | *F17* (17 freqs) | ⚑ enum, 17 values, probably raw 0–16 |
| 9 | 21 | P2 Gain | Peaking 2 gain | -15…+15 dB | ⚑ mapping unknown |
| 10 | 22 | P2 Q | Peaking 2 Q | 0.5, 1.0, 2.0, 4.0, 8.0 | ⚑ enum, 5 values, probably raw 0–4 |
| 11 | 23 | Level | Output level | 0–127 | raw = display |

Manual lists 11 params; param 12 presumably unused.

#### 02 OVERDRIVE — raw EFX Type 1 (p.168; description p.34)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Drive | Drive | 0–127 | raw = display |
| 2 | 14 | Amp Type | Amp simulator type | SMALL, BUILT-IN, 2-STACK, 3-STACK | ⚑ enum, 4 values, probably raw 0–3 |
| 3 | 15 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 4 | 16 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 5 | 17 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 6 | 18 | Level | Output level | 0–127 | raw = display |

Manual lists 6 params; params 7–12 presumably unused.

#### 03 DISTORTION — raw EFX Type 2 (p.168; description p.35)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Drive | Drive | 0–127 | raw = display |
| 2 | 14 | Amp Type | Amp simulator type | SMALL, BUILT-IN, 2-STACK, 3-STACK | ⚑ enum, 4 values, probably raw 0–3 |
| 3 | 15 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 4 | 16 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 5 | 17 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 6 | 18 | Level | Output level | 0–127 | raw = display |

Manual lists 6 params; params 7–12 presumably unused.

#### 04 PHASER — raw EFX Type 3 (p.168; description p.35)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Manual | Manual | 100–8000 Hz | ⚑ mapping unknown |
| 2 | 14 | Rate | Phaser rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Depth | Phaser depth | 0–127 | raw = display |
| 4 | 16 | Resonance | Resonance | 0–127 | raw = display |
| 5 | 17 | Mix | Mix level | 0–127 | raw = display |
| 6 | 18 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 05 SPECTRUM — raw EFX Type 4 (p.168; description p.35)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Band1 | Band1 gain | -15…+15 dB | ⚑ mapping unknown |
| 2 | 14 | Band2 | Band2 gain | -15…+15 dB | ⚑ mapping unknown |
| 3 | 15 | Band3 | Band3 gain | -15…+15 dB | ⚑ mapping unknown |
| 4 | 16 | Band4 | Band4 gain | -15…+15 dB | ⚑ mapping unknown |
| 5 | 17 | Band5 | Band5 gain | -15…+15 dB | ⚑ mapping unknown |
| 6 | 18 | Band6 | Band6 gain | -15…+15 dB | ⚑ mapping unknown |
| 7 | 19 | Band7 | Band7 gain | -15…+15 dB | ⚑ mapping unknown |
| 8 | 20 | Band8 | Band8 gain | -15…+15 dB | ⚑ mapping unknown |
| 9 | 21 | Q | Q | 0.5, 1.0, 2.0, 4.0, 8.0 | ⚑ enum, 5 values, probably raw 0–4 |
| 10 | 22 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 11 | 23 | Level | Output level | 0–127 | raw = display |

Manual lists 11 params; param 12 presumably unused.

#### 06 ENHANCER — raw EFX Type 5 (p.168; description p.36)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Sens | Sensitivity | 0–127 | raw = display |
| 2 | 14 | Mix | Mix level | 0–127 | raw = display |
| 3 | 15 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 4 | 16 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 5 | 17 | Level | Output level | 0–127 | raw = display |

Manual lists 5 params; params 6–12 presumably unused.

#### 07 AUTO-WAH — raw EFX Type 6 (p.168; description p.36)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Filter Type | Filter type | LPF, BPF | ⚑ enum, 2 values, probably raw 0–1 |
| 2 | 14 | Sens | Sensitivity | 0–127 | raw = display |
| 3 | 15 | Manual | Manual | 0–127 | raw = display |
| 4 | 16 | Peak | Peak | 0–127 | raw = display |
| 5 | 17 | Rate | LFO rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 6 | 18 | Depth | LFO depth | 0–127 | raw = display |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 08 ROTARY — raw EFX Type 7 (p.168; description p.37)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Low Slow Rate | Low frequency slow rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 2 | 14 | Low Fast Rate | Low frequency fast rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Low Acceleration | Low frequency acceleration | 0–15 | ⚑ likely raw = display (unconfirmed) |
| 4 | 16 | Low Level | Low frequency level | 0–127 | raw = display |
| 5 | 17 | Speed | Speed | SLOW, FAST | ⚑ enum, 2 values, probably raw 0–1 |
| 6 | 18 | High Slow Rate | High frequency slow rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 7 | 19 | High Fast Rate | High frequency fast rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 8 | 20 | High Acceleration | High frequency acceleration | 0–15 | ⚑ likely raw = display (unconfirmed) |
| 9 | 21 | High Level | High frequency level | 0–127 | raw = display |
| 10 | 22 | Separation | Separation | 0–127 | raw = display |
| 11 | 23 | Level | Output level | 0–127 | raw = display |

Manual lists 11 params; param 12 presumably unused.

#### 09 COMPRESSOR — raw EFX Type 8 (p.168; description p.37)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Attack | Attack time | 0–127 | raw = display |
| 2 | 14 | Sustain | Sustain | 0–127 | raw = display |
| 3 | 15 | Post Gain | Post gain | 0, +6, +12, +18 dB | ⚑ enum, 4 values, probably raw 0–3 |
| 4 | 16 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 5 | 17 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 6 | 18 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 10 LIMITER — raw EFX Type 9 (p.169; description p.38)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Threshold | Threshold level | 0–127 | raw = display |
| 2 | 14 | Ratio | Compression ratio | 1.5:1, 2:1, 4:1, 100:1 | ⚑ enum, 4 values, probably raw 0–3 |
| 3 | 15 | Release | Release time | 0–127 | raw = display |
| 4 | 16 | Post Gain | Post gain | 0, +6, +12, +18 dB | ⚑ enum, 4 values, probably raw 0–3 |
| 5 | 17 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 6 | 18 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 7 | 19 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 11 HEXA-CHORUS — raw EFX Type 10 (p.169; description p.38)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Pre Delay Deviation | Pre delay deviation | 0–20 | ⚑ likely raw = display (unconfirmed) |
| 5 | 17 | Depth Deviation | Depth deviation | -20…+20 | ⚑ mapping unknown |
| 6 | 18 | Pan Deviation | Pan deviation | 0–20 | ⚑ likely raw = display (unconfirmed) |
| 7 | 19 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 12 TREMOLO-CHORUS — raw EFX Type 11 (p.169; description p.39)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Tremolo Phase | Tremolo phase | 0–180 degree | ⚑ mapping unknown |
| 5 | 17 | Tremolo Rate | Tremolo rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 6 | 18 | Tremolo Separation | Tremolo separation | 0–127 | raw = display |
| 7 | 19 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 13 SPACE-D — raw EFX Type 12 (p.169; description p.39)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Phase | Phase | 0–180 degree | ⚑ mapping unknown |
| 5 | 17 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 6 | 18 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 7 | 19 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 14 STEREO-CHORUS — raw EFX Type 13 (p.169; description p.40)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Phase | Phase | 0–180 degree | ⚑ mapping unknown |
| 5 | 17 | Filter Type | Filter type | OFF, LPF, HPF | ⚑ enum, 3 values, probably raw 0–2 |
| 6 | 18 | Cutoff Freq | Cutoff frequency | *F17* (17 freqs) | ⚑ enum, 17 values, probably raw 0–16 |
| 7 | 19 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 8 | 20 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 9 | 21 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 10 | 22 | Level | Output level | 0–127 | raw = display |

Manual lists 10 params; params 11–12 presumably unused.

#### 15 STEREO-FLANGER — raw EFX Type 14 (p.169; description p.40)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Rate | LFO rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Depth | LFO depth | 0–127 | raw = display |
| 4 | 16 | Feedback | Feedback | -98…+98 % | ⚑ mapping unknown |
| 5 | 17 | Phase | Phase | 0–180 degree | ⚑ mapping unknown |
| 6 | 18 | Filter Type | Filter type | OFF, LPF, HPF | ⚑ enum, 3 values, probably raw 0–2 |
| 7 | 19 | Cutoff Freq | Cutoff frequency | *F17* (17 freqs) | ⚑ enum, 17 values, probably raw 0–16 |
| 8 | 20 | Low Gain | Low gain | -15…+15 dB (manual prints "15—+15 dB", assumed typo) | ⚑ mapping unknown |
| 9 | 21 | High Gain | High gain | -15…+15 dB (manual prints "15—+15 dB", assumed typo) | ⚑ mapping unknown |
| 10 | 22 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 11 | 23 | Level | Output level | 0–127 | raw = display |

Manual lists 11 params; param 12 presumably unused.

#### 16 STEP-FLANGER — raw EFX Type 15 (p.169; description p.41)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Rate | LFO rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Depth | LFO depth | 0–127 | raw = display |
| 4 | 16 | Feedback | Feedback | -98…+98 % | ⚑ mapping unknown |
| 5 | 17 | Phase | Phase | 0–180 degree | ⚑ mapping unknown |
| 6 | 18 | Step Rate | Step rate | 0.10–20.00 Hz, note | ⚑ range + note values: mapping unknown |
| 7 | 19 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 8 | 20 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 9 | 21 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 10 | 22 | Level | Output level | 0–127 | raw = display |

Manual lists 10 params; params 11–12 presumably unused.

#### 17 STEREO-DELAY — raw EFX Type 16 (p.169; description p.42)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Delay Left | Delay time left | 0.0–500.0 ms | ⚑ mapping unknown |
| 2 | 14 | Delay Right | Delay time right | 0.0–500.0 ms | ⚑ mapping unknown |
| 3 | 15 | Phase Left | Phase left | NORMAL, INVERT | ⚑ enum, 2 values, probably raw 0–1 |
| 4 | 16 | Phase Right | Phase right | NORMAL, INVERT | ⚑ enum, 2 values, probably raw 0–1 |
| 5 | 17 | Feedback | Feedback | -98…+98 % | ⚑ mapping unknown |
| 6 | 18 | Feedback Mode | Feedback mode | NORMAL, CROSS | ⚑ enum, 2 values, probably raw 0–1 |
| 7 | 19 | HF Damp | HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 8 | 20 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 9 | 21 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 10 | 22 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 11 | 23 | Level | Output level | 0–127 | raw = display |

Manual lists 11 params; param 12 presumably unused.

#### 18 MODULATION-DELAY — raw EFX Type 17 (p.169; description p.42)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Delay Left | Delay time left | 0.0–500.0 ms | ⚑ mapping unknown |
| 2 | 14 | Delay Right | Delay time right | 0.0–500.0 ms | ⚑ mapping unknown |
| 3 | 15 | Feedback | Feedback | -98…+98 % | ⚑ mapping unknown |
| 4 | 16 | Feedback Mode | Feedback mode | NORMAL, CROSS | ⚑ enum, 2 values, probably raw 0–1 |
| 5 | 17 | Rate | Modulation rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 6 | 18 | Depth | Modulation depth | 0–127 | raw = display |
| 7 | 19 | Phase | Phase | 0–180 degree | ⚑ mapping unknown |
| 8 | 20 | HF Damp | HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 9 | 21 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 10 | 22 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 11 | 23 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 12 | 24 | Level | Output level | 0–127 | raw = display |

#### 19 TRIPLE-TAP-DELAY — raw EFX Type 18 (p.170; description p.43)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Delay Center | Delay time center | 200–1000 ms, note | ⚑ range + note values: mapping unknown |
| 2 | 14 | Delay Left | Delay time left | 200–1000 ms, note | ⚑ range + note values: mapping unknown |
| 3 | 15 | Delay Right | Delay time right | 200–1000 ms, note | ⚑ range + note values: mapping unknown |
| 4 | 16 | Center Level | Center level | 0–127 | raw = display |
| 5 | 17 | Left Level | Left level | 0–127 | raw = display |
| 6 | 18 | Right Level | Right level | 0–127 | raw = display |
| 7 | 19 | Feedback | Feedback | -98…+98 % | ⚑ mapping unknown |
| 8 | 20 | HF Damp | HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 9 | 21 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 10 | 22 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 11 | 23 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 12 | 24 | Level | Output level | 0–127 | raw = display |

#### 20 QUADRUPLE-TAP-DELAY — raw EFX Type 19 (p.170; description p.44)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Delay 1 | Delay time1 | 200–1000 ms, note | ⚑ range + note values: mapping unknown |
| 2 | 14 | Delay 2 | Delay time2 | 200–1000 ms, note | ⚑ range + note values: mapping unknown |
| 3 | 15 | Delay 3 | Delay time3 | 200–1000 ms, note | ⚑ range + note values: mapping unknown |
| 4 | 16 | Delay 4 | Delay time4 | 200–1000 ms, note | ⚑ range + note values: mapping unknown |
| 5 | 17 | Feedback | Feedback level | -98…+98 % | ⚑ mapping unknown |
| 6 | 18 | HF Damp | HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 7 | 19 | Level 1 | Level1 | 0–127 | raw = display |
| 8 | 20 | Level 2 | Level2 | 0–127 | raw = display |
| 9 | 21 | Level 3 | Level3 | 0–127 | raw = display |
| 10 | 22 | Level 4 | Level4 | 0–127 | raw = display |
| 11 | 23 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 12 | 24 | Level | Output level | 0–127 | raw = display |

#### 21 TIME-CONTROL-DELAY — raw EFX Type 20 (p.170; description p.45)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Delay | Delay time | 200–1000 ms | ⚑ mapping unknown |
| 2 | 14 | Acceleration | Acceleration | 0–15 | ⚑ likely raw = display (unconfirmed) |
| 3 | 15 | Feedback | Feedback | -98…+98 % | ⚑ mapping unknown |
| 4 | 16 | HF Damp | HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 5 | 17 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 6 | 18 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 7 | 19 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 8 | 20 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 9 | 21 | Level | Output level | 0–127 | raw = display |

Manual lists 9 params; params 10–12 presumably unused.

#### 22 2VOICE-PITCH-SHIFTER — raw EFX Type 21 (p.170; description p.46)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Coarse A | Coarse pitch A | -24…+12 semitone | ⚑ mapping unknown |
| 2 | 14 | Fine A | Fine pitch A | -100…+100 cent | ⚑ mapping unknown |
| 3 | 15 | Pan A | Output pan A | L64…0…63R | ⚑ mapping unknown |
| 4 | 16 | Pre Delay A | Pre delay time A | 0.0–500.0 ms | ⚑ mapping unknown |
| 5 | 17 | Level Balance | Level balance | A100:0B…A0:100B | ⚑ mapping unknown |
| 6 | 18 | Mode | Pitch shifter mode | 1, 2, 3, 4, 5 | ⚑ enum, 5 values, probably raw 0–4 |
| 7 | 19 | Coarse B | Coarse pitch B | -24…+12 semitone | ⚑ mapping unknown |
| 8 | 20 | Fine B | Fine pitch B | -100…+100 cent | ⚑ mapping unknown |
| 9 | 21 | Pan B | Output pan B | L64…0…63R | ⚑ mapping unknown |
| 10 | 22 | Pre Delay B | Pre delay time B | 0.0–500 ms | ⚑ mapping unknown |
| 11 | 23 | Balance | Effect balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 12 | 24 | Level | Output level | 0–127 | raw = display |

#### 23 FBK-PITCH-SHIFTER — raw EFX Type 22 (p.170; description p.46)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Coarse | Coarse pitch | -24…+12 semitone | ⚑ mapping unknown |
| 2 | 14 | Fine | Fine pitch | -100…+100 cent | ⚑ mapping unknown |
| 3 | 15 | Pan | Output pan | L64…0…63R | ⚑ mapping unknown |
| 4 | 16 | Pre Delay | Pre delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 5 | 17 | Mode | Pitch shifter mode | 1, 2, 3, 4, 5 | ⚑ enum, 5 values, probably raw 0–4 |
| 6 | 18 | Feedback | Feedback | -98…+98 % | ⚑ mapping unknown |
| 7 | 19 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 8 | 20 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 9 | 21 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 10 | 22 | Level | Output level | 0–127 | raw = display |

Manual lists 10 params; params 11–12 presumably unused.

#### 24 REVERB — raw EFX Type 23 (p.170; description p.47)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Type | Reverb type | ROOM1, ROOM2, STAGE1, STAGE2, HALL1, HALL2 | ⚑ enum, 6 values, probably raw 0–5 |
| 2 | 14 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 3 | 15 | Time | Reverb time | 0–127 | raw = display |
| 4 | 16 | HF Damp | HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 5 | 17 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 6 | 18 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 7 | 19 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 25 GATE-REVERB — raw EFX Type 24 (p.170; description p.47)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Type | Reverb type | NORMAL, REVERSE, SWEEP1, SWEEP2 | ⚑ enum, 4 values, probably raw 0–3 |
| 2 | 14 | Pre Delay | Pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 3 | 15 | Gate Time | Gate time | 5–500 ms | ⚑ mapping unknown |
| 4 | 16 | Low Gain | Low gain | -15…+15 dB | ⚑ mapping unknown |
| 5 | 17 | High Gain | High gain | -15…+15 dB | ⚑ mapping unknown |
| 6 | 18 | Balance | Effect balance | DRY100:0WET…DRY0:100WET | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 26 OVERDRIVE→CHORUS — raw EFX Type 25 (p.170; description p.48)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | OD Drive | Drive | 0–127 | raw = display |
| 2 | 14 | OD Pan | Over drive pan | L64…0…63R | ⚑ mapping unknown |
| 3 | 15 | Chorus Pre Delay | Chorus pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 4 | 16 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 5 | 17 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 6 | 18 | Chorus Balance | Chorus balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 27 OVERDRIVE→FLANGER — raw EFX Type 26 (p.170; description p.48)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | OD Drive | Drive | 0–127 | raw = display |
| 2 | 14 | OD Pan | Over drive pan | L64…0…63R | ⚑ mapping unknown |
| 3 | 15 | FLNG Pre Delay | Flanger pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 4 | 16 | FLNG Rate | Flanger rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 5 | 17 | FLNG Depth | Flanger depth | 0–127 | raw = display |
| 6 | 18 | FLNG Feedback | Flanger feedback | -98…+98 % | ⚑ mapping unknown |
| 7 | 19 | FLNG Balance | Flanger balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 28 OVERDRIVE→DELAY — raw EFX Type 27 (p.171; description p.49)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | OD Drive | Drive | 0–127 | raw = display |
| 2 | 14 | OD Pan | Over drive pan | L64…0…63R | ⚑ mapping unknown |
| 3 | 15 | Delay Time | Delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 4 | 16 | Delay Feedback | Delay feedback | -98…+98 % | ⚑ mapping unknown |
| 5 | 17 | Delay HF Damp | Delay HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 6 | 18 | Delay Balance | Delay balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 29 DISTORTION→CHORUS — raw EFX Type 28 (p.171; description p.49)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | DIST Drive | Drive | 0–127 | raw = display |
| 2 | 14 | DIST Pan | Distortion pan | L64…0…63R | ⚑ mapping unknown |
| 3 | 15 | Chorus Pre Delay | Chorus pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 4 | 16 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 5 | 17 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 6 | 18 | Chorus Balance | Chorus balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 30 DISTORTION→FLANGER — raw EFX Type 29 (p.171; description p.49)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | DIST Drive | Drive | 0–127 | raw = display |
| 2 | 14 | DIST Pan | Distortion pan | L64…0…63R | ⚑ mapping unknown |
| 3 | 15 | FLNG Pre Delay | Flanger pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 4 | 16 | FLNG Rate | Flanger rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 5 | 17 | FLNG Depth | Flanger depth | 0–127 | raw = display |
| 6 | 18 | FLNG Feedback | Flanger feedback | -98…+98 % | ⚑ mapping unknown |
| 7 | 19 | FLNG Balance | Flanger balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 31 DISTORTION→DELAY — raw EFX Type 30 (p.171; description p.50)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | DIST Drive | Drive | 0–127 | raw = display |
| 2 | 14 | DIST Pan | Distortion pan | L64…0…63R | ⚑ mapping unknown |
| 3 | 15 | Delay Time | Delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 4 | 16 | Delay Feedback | Delay feedback | -98…+98 % | ⚑ mapping unknown |
| 5 | 17 | Delay HF Damp | Delay HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 6 | 18 | Delay Balance | Delay balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 32 ENHANCER→CHORUS — raw EFX Type 31 (p.171; description p.50)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Enhancer Sens | Enhancer sensitivity | 0–127 | raw = display |
| 2 | 14 | Enhancer Mix | Enhancer mix level | 0–127 | raw = display |
| 3 | 15 | Chorus Pre Delay | Chorus pre delay time | 0.0–100 ms | ⚑ mapping unknown |
| 4 | 16 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 5 | 17 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 6 | 18 | Chorus Balance | Chorus balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 33 ENHANCER→FLANGER — raw EFX Type 32 (p.171; description p.50)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Enhancer Sens | Enhancer sensitivity | 0–127 | raw = display |
| 2 | 14 | Enhancer Mix | Enhancer mix level | 0–127 | raw = display |
| 3 | 15 | FLNG Pre Delay | Flanger pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 4 | 16 | FLNG Rate | Flanger rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 5 | 17 | FLNG Depth | Flanger depth | 0–127 | raw = display |
| 6 | 18 | FLNG Feedback | Flanger feedback | -98…+98 % | ⚑ mapping unknown |
| 7 | 19 | FLNG Balance | Flanger balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 8 | 20 | Level | Output level | 0–127 | raw = display |

Manual lists 8 params; params 9–12 presumably unused.

#### 34 ENHANCER→DELAY — raw EFX Type 33 (p.171; description p.51)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Enhancer Sens | Enhancer sensitivity | 0–127 | raw = display |
| 2 | 14 | Enhancer Mix | Enhancer mix level | 0–127 | raw = display |
| 3 | 15 | Delay Time | Delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 4 | 16 | Delay Feedback | Delay feedback | -98…+98 % | ⚑ mapping unknown |
| 5 | 17 | Delay HF Damp | Delay HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 6 | 18 | Delay Balance | Delay balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 7 | 19 | Level | Output level | 0–127 | raw = display |

Manual lists 7 params; params 8–12 presumably unused.

#### 35 CHORUS→DELAY — raw EFX Type 34 (p.171; description p.51)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Chorus Pre Delay | Chorus pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Chorus Balance | Chorus balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 5 | 17 | Delay Time | Delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 6 | 18 | Delay Feedback | Delay feedback | -98…+98 % | ⚑ mapping unknown |
| 7 | 19 | Delay HF Damp | Delay HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 8 | 20 | Delay Balance | Delay balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 9 | 21 | Level | Output level | 0–127 | raw = display |

Manual lists 9 params; params 10–12 presumably unused.

#### 36 FLANGER→DELAY — raw EFX Type 35 (p.171; description p.52)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | FLNG Pre Delay | Flanger pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | FLNG Rate | Flanger rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | FLNG Depth | Flanger depth | 0–127 | raw = display |
| 4 | 16 | FLNG Feedback | Flanger feedback | -98…+98 % | ⚑ mapping unknown |
| 5 | 17 | FLNG Balance | Flanger balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 6 | 18 | Delay Time | Delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 7 | 19 | Delay Feedback | Delay feedback | -98…+98 % | ⚑ mapping unknown |
| 8 | 20 | Delay HF Damp | Delay HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 9 | 21 | Delay Balance | Delay balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 10 | 22 | Level | Output level | 0–127 | raw = display |

Manual lists 10 params; params 11–12 presumably unused.

#### 37 CHORUS→FLANGER — raw EFX Type 36 (p.172; description p.52)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Chorus Pre Delay | Chorus pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Chorus Balance | Chorus balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 5 | 17 | FLNG Pre Delay | Flanger pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 6 | 18 | FLNG Rate | Flanger rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 7 | 19 | FLNG Depth | Flanger depth | 0–127 | raw = display |
| 8 | 20 | FLNG Feedback | Flanger feedback | -98…+98 % | ⚑ mapping unknown |
| 9 | 21 | FLNG Balance | Flanger balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 10 | 22 | Level | Output level | 0–127 | raw = display |

Manual lists 10 params; params 11–12 presumably unused.

#### 38 CHORUS/DELAY — raw EFX Type 37 (p.172; description p.53)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Chorus Pre Delay | Chorus pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Chorus Balance | Chorus balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 5 | 17 | Delay Time | Delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 6 | 18 | Delay Feedback | Delay feedback | -98…+98 % | ⚑ mapping unknown |
| 7 | 19 | Delay HF Damp | Delay HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 8 | 20 | Delay Balance | Delay balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 9 | 21 | Level | Output level | 0–127 | raw = display |

Manual lists 9 params; params 10–12 presumably unused.

#### 39 FLANGER/DELAY — raw EFX Type 38 (p.172; description p.53)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | FLNG Pre Delay | Flanger pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | FLNG Rate | Flanger rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | FLNG Depth | Flanger depth | 0–127 | raw = display |
| 4 | 16 | FLNG Feedback | Flanger feedback | -98…+98 % | ⚑ mapping unknown |
| 5 | 17 | FLNG Balance | Flanger balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 6 | 18 | Delay Time | Delay time | 0.0–500.0 ms | ⚑ mapping unknown |
| 7 | 19 | Delay Feedback | Delay feedback | -98…+98 % | ⚑ mapping unknown |
| 8 | 20 | Delay HF Damp | Delay HF damp | *F18* (17 freqs + BYPASS) | ⚑ enum, 18 values, probably raw 0–17 |
| 9 | 21 | Delay Balance | Delay balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 10 | 22 | Level | Output level | 0–127 | raw = display |

Manual lists 10 params; params 11–12 presumably unused.

#### 40 CHORUS/FLANGER — raw EFX Type 39 (p.172; description p.53)

| # | Common off | Param | Full name | Display range | Raw→display |
|---|---|---|---|---|---|
| 1 | 13 | Chorus Pre Delay | Chorus pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 2 | 14 | Chorus Rate | Chorus rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 3 | 15 | Chorus Depth | Chorus depth | 0–127 | raw = display |
| 4 | 16 | Chorus Balance | Chorus balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 5 | 17 | FLNG Pre Delay | Flanger pre delay time | 0.0–100.0 ms | ⚑ mapping unknown |
| 6 | 18 | FLNG Rate | Flanger rate | 0.05–10.00 Hz | ⚑ mapping unknown |
| 7 | 19 | FLNG Depth | Flanger depth | 0–127 | raw = display |
| 8 | 20 | FLNG Feedback | Flanger feedback | -98…+98 % | ⚑ mapping unknown |
| 9 | 21 | FLNG Balance | Flanger balance | D100:0W…D0:100W | ⚑ mapping unknown |
| 10 | 22 | Level | Output level | 0–127 | raw = display |

Manual lists 10 params; params 11–12 presumably unused.

## 8. Internal waveform list (pp.182–183)

Wave Group: **INT-A** (255 waves) and **INT-B** (193 waves), **448 internal waves in total**.
"No." is the panel display. "SysEx" is the raw Wave Number (Tone offsets 3–4, nibbled:
`[(n >> 4) & 0x0F, n & 0x0F]`). `*` = one-shot (non-sustaining) waveform, per the manual's key on
p.182. Names are transcribed as printed, including oddities such as "REV PhillHit",
"REV Clve" and "REV SN  Roll".

**Unverified:** the raw Wave Group Type/ID that selects INT-A vs INT-B. Type is presumably 0 (INT).
The ID values are not in the manual. See Discrepancy 4.

#### INT-A (manual p.182) (255 waves)

| No. | SysEx | Name | | No. | SysEx | Name | | No. | SysEx | Name |
|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 0 | Ac Piano1 A | | 086 | 85 | Stratus C | | 171 | 170 | Alto Sax 1A |
| 002 | 1 | Ac Piano1 B | | 087 | 86 | OD Gtr A | | 172 | 171 | Alto Sax 1B |
| 003 | 2 | Ac Piano1 C | | 088 | 87 | OD Gtr B | | 173 | 172 | Alto Sax 1C |
| 004 | 3 | Ac Piano2 pA | | 089 | 88 | OD Gtr C | | 174 | 173 | Tenor Sax A |
| 005 | 4 | Ac Piano2 pB | | 090 | 89 | OD Gtr A+ | | 175 | 174 | Tenor Sax B |
| 006 | 5 | Ac Piano2 pC | | 091 | 90 | Heavy Gtr A | | 176 | 175 | Tenor Sax C |
| 007 | 6 | Ac Piano2 fA \* | | 092 | 91 | Heavy Gtr B | | 177 | 176 | Bari.Sax f A |
| 008 | 7 | Ac Piano2 fB \* | | 093 | 92 | Heavy Gtr C | | 178 | 177 | Bari.Sax f B |
| 009 | 8 | Ac Piano2 fC \* | | 094 | 93 | Heavy Gtr A+ | | 179 | 178 | Bari.Sax f C |
| 010 | 9 | Piano Thump \* | | 095 | 94 | Heavy Gtr B+ | | 180 | 179 | Harmonica A |
| 011 | 10 | Piano Up TH \* | | 096 | 95 | Heavy Gtr C+ | | 181 | 180 | Harmonica B |
| 012 | 11 | MKS-20 P3 A | | 097 | 96 | PowerChord A | | 182 | 181 | Harmonica C |
| 013 | 12 | MKS-20 P3 B | | 098 | 97 | PowerChord B | | 183 | 182 | Chanter |
| 014 | 13 | MKS-20 P3 C | | 099 | 98 | PowerChord C | | 184 | 183 | Tpt Sect. A |
| 015 | 14 | SA Rhodes 1A | | 100 | 99 | EG Harm | | 185 | 184 | Tpt Sect. B |
| 016 | 15 | SA Rhodes 1B | | 101 | 100 | Gt.FretNoise \* | | 186 | 185 | Tpt Sect. C |
| 017 | 16 | SA Rhodes 1C | | 102 | 101 | Syn Gtr A | | 187 | 186 | Trumpet 1A |
| 018 | 17 | SA Rhodes 2A | | 103 | 102 | Syn Gtr B | | 188 | 187 | Trumpet 1B |
| 019 | 18 | SA Rhodes 2B | | 104 | 103 | Syn Gtr C | | 189 | 188 | Trumpet 1C |
| 020 | 19 | SA Rhodes 2C | | 105 | 104 | Harp 1A | | 190 | 189 | Trumpet 2A |
| 021 | 20 | E.Piano 1A | | 106 | 105 | Harp 1B | | 191 | 190 | Trumpet 2B |
| 022 | 21 | E.Piano 1B | | 107 | 106 | Harp 1C | | 192 | 191 | Trumpet 2C |
| 023 | 22 | E.Piano 1C | | 108 | 107 | Banjo A | | 193 | 192 | HarmonMute1A |
| 024 | 23 | E.Piano 2A | | 109 | 108 | Banjo B | | 194 | 193 | HarmonMute1B |
| 025 | 24 | E.Piano 2B | | 110 | 109 | Banjo C | | 195 | 194 | HarmonMute1C |
| 026 | 25 | E.Piano 2C | | 111 | 110 | Sitar A | | 196 | 195 | Trombone 1 |
| 027 | 26 | E.Piano 3A | | 112 | 111 | Sitar B | | 197 | 196 | French 1A |
| 028 | 27 | E.Piano 3B | | 113 | 112 | Sitar C | | 198 | 197 | French 1C |
| 029 | 28 | E.Piano 3C | | 114 | 113 | Dulcimer A | | 199 | 198 | F.Horns A |
| 030 | 29 | MK-80 EP A | | 115 | 114 | Dulcimer B | | 200 | 199 | F.Horns B |
| 031 | 30 | MK-80 EP B | | 116 | 115 | Dulcimer C | | 201 | 200 | F.Horns C |
| 032 | 31 | MK-80 EP C | | 117 | 116 | Shamisen A | | 202 | 201 | Violin A |
| 033 | 32 | D-50 EP A | | 118 | 117 | Shamisen B | | 203 | 202 | Violin B |
| 034 | 33 | D-50 EP B | | 119 | 118 | Shamisen C | | 204 | 203 | Violin C |
| 035 | 34 | D-50 EP C | | 120 | 119 | Koto A | | 205 | 204 | Cello A |
| 036 | 35 | Celesta | | 121 | 120 | Koto B | | 206 | 205 | Cello B |
| 037 | 36 | Music Box | | 122 | 121 | Koto C | | 207 | 206 | Cello C |
| 038 | 37 | Clav 1A | | 123 | 122 | Pick Bass A | | 208 | 207 | ST.Strings-R |
| 039 | 38 | Clav 1B | | 124 | 123 | Pick Bass B | | 209 | 208 | ST.Strings-L |
| 040 | 39 | Clav 1C | | 125 | 124 | Pick Bass C | | 210 | 209 | MonoStringsA |
| 041 | 40 | Organ 1 | | 126 | 125 | Fingerd Bs A | | 211 | 210 | MonoStringsC |
| 042 | 41 | Jazz Organ 1 | | 127 | 126 | Fingerd Bs B | | 212 | 211 | Pizz \* |
| 043 | 42 | Jazz Organ 2 | | 128 | 127 | Fingerd Bs C | | 213 | 212 | JP Strings1A |
| 044 | 43 | Organ 2 | | 129 | 128 | E.Bass | | 214 | 213 | JP Strings1B |
| 045 | 44 | Organ 3 | | 130 | 129 | Fretless A | | 215 | 214 | JP Strings1C |
| 046 | 45 | Organ 4 | | 131 | 130 | Fretless B | | 216 | 215 | JP Strings2A |
| 047 | 46 | Rock Organ | | 132 | 131 | Fretless C | | 217 | 216 | JP Strings2B |
| 048 | 47 | Dist. Organ | | 133 | 132 | UprightBs 1 | | 218 | 217 | JP Strings2C |
| 049 | 48 | Rot.Org Slw | | 134 | 133 | UprightBs 2A | | 219 | 218 | Soft Pad A |
| 050 | 49 | Rot.Org Fst | | 135 | 134 | UprightBs 2B | | 220 | 219 | Soft Pad B |
| 051 | 50 | Pipe Organ | | 136 | 135 | UprightBs 2C | | 221 | 220 | Soft Pad C |
| 052 | 51 | Nylon Gtr A | | 137 | 136 | Slap Bass 1 | | 222 | 221 | Fantasynth A |
| 053 | 52 | Nylon Gtr B | | 138 | 137 | Slap & Pop | | 223 | 222 | Fantasynth B |
| 054 | 53 | Nylon Gtr C | | 139 | 138 | Slap Bass 2 | | 224 | 223 | Fantasynth C |
| 055 | 54 | 6-Str Gtr A | | 140 | 139 | Slap Bass 3 | | 225 | 224 | D-50 HeavenA |
| 056 | 55 | 6-Str Gtr B | | 141 | 140 | Jz.Bs Thumb | | 226 | 225 | D-50 HeavenB |
| 057 | 56 | 6-Str Gtr C | | 142 | 141 | Jz.Bs Slap 1 | | 227 | 226 | D-50 HeavenC |
| 058 | 57 | Gtr Harm A | | 143 | 142 | Jz.Bs Slap 2 | | 228 | 227 | Fine Wine |
| 059 | 58 | Gtr Harm B | | 144 | 143 | Jz.Bs Slap 3 | | 229 | 228 | D-50 Brass A |
| 060 | 59 | Gtr Harm C | | 145 | 144 | Jz.Bs Pop | | 230 | 229 | D-50 Brass B |
| 061 | 60 | Comp Gtr A | | 146 | 145 | Syn Bass A | | 231 | 230 | D-50 Brass C |
| 062 | 61 | Comp Gtr B | | 147 | 146 | Syn Bass C | | 232 | 231 | D-50 BrassA+ |
| 063 | 62 | Comp Gtr C | | 148 | 147 | Mini Bs 1A | | 233 | 232 | DualSquare A |
| 064 | 63 | Comp Gtr A+ | | 149 | 148 | Mini Bs 1B | | 234 | 233 | DualSquare C |
| 065 | 64 | Mute Gtr 1 | | 150 | 149 | Mini Bs 1C | | 235 | 234 | DualSquareA+ |
| 066 | 65 | Mute Gtr 2A | | 151 | 150 | Mini Bs 2 | | 236 | 235 | Pop Voice |
| 067 | 66 | Mute Gtr 2B | | 152 | 151 | Mini Bs 2+ | | 237 | 236 | Syn Vox 1 |
| 068 | 67 | Mute Gtr 2C | | 153 | 152 | MC-202 Bs A | | 238 | 237 | Syn Vox 2 |
| 069 | 68 | Pop Strat A | | 154 | 153 | MC-202 Bs B | | 239 | 238 | Voice Aahs A |
| 070 | 69 | Pop Strat B | | 155 | 154 | MC-202 Bs C | | 240 | 239 | Voice Aahs B |
| 071 | 70 | Pop Strat C | | 156 | 155 | Flute 1A | | 241 | 240 | Voice Aahs C |
| 072 | 71 | Jazz Gtr A | | 157 | 156 | Flute 1B | | 242 | 241 | Voice Oohs1A |
| 073 | 72 | Jazz Gtr B | | 158 | 157 | Flute 1C | | 243 | 242 | Voice Oohs1B |
| 074 | 73 | Jazz Gtr C | | 159 | 158 | Blow Pipe | | 244 | 243 | Voice Oohs1C |
| 075 | 74 | JC Strat A | | 160 | 159 | Bottle | | 245 | 244 | Voice Oohs2A |
| 076 | 75 | JC Strat B | | 161 | 160 | Shakuhachi | | 246 | 245 | Voice Oohs2B |
| 077 | 76 | JC Strat C | | 162 | 161 | Clarinet A | | 247 | 246 | Voice Oohs2C |
| 078 | 77 | JC Strat A+ | | 163 | 162 | Clarinet B | | 248 | 247 | Voice Breath |
| 079 | 78 | JC Strat B+ | | 164 | 163 | Clarinet C | | 249 | 248 | Male Ooh A |
| 080 | 79 | JC Strat C+ | | 165 | 164 | Oboe mf A | | 250 | 249 | Male Ooh B |
| 081 | 80 | Clean Gtr A | | 166 | 165 | Oboe mf B | | 251 | 250 | Male Ooh C |
| 082 | 81 | Clean Gtr B | | 167 | 166 | Oboe mf C | | 252 | 251 | Org Vox A |
| 083 | 82 | Clean Gtr C | | 168 | 167 | Sop.Sax mf A | | 253 | 252 | Org Vox B |
| 084 | 83 | Stratus A | | 169 | 168 | Sop.Sax mf B | | 254 | 253 | Org Vox C |
| 085 | 84 | Stratus B | | 170 | 169 | Sop.Sax mf C | | 255 | 254 | Vox Noise |

#### INT-B (manual p.183) (193 waves)

| No. | SysEx | Name | | No. | SysEx | Name | | No. | SysEx | Name |
|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 0 | Kalimba | | 066 | 65 | Scratch 3 \* | | 131 | 130 | REV NatrlSN1 \* |
| 002 | 1 | Marimba Wave | | 067 | 66 | Natural SN1 \* | | 132 | 131 | REV NatrlSN2 \* |
| 003 | 2 | Log Drum | | 068 | 67 | Natural SN2 \* | | 133 | 132 | REV PiccloSN \* |
| 004 | 3 | Vibes | | 069 | 68 | Piccolo SN \* | | 134 | 133 | REV BalladSN \* |
| 005 | 4 | Bottle Hit | | 070 | 69 | Ballad SN \* | | 135 | 134 | REV Side Stk \* |
| 006 | 5 | Glockenspiel | | 071 | 70 | SN Roll \* | | 136 | 135 | REV SN  Roll \* |
| 007 | 6 | Tubular | | 072 | 71 | 808 SN \* | | 137 | 136 | REV Brush 1 \* |
| 008 | 7 | Steel Drums | | 073 | 72 | Brush Slap \* | | 138 | 137 | REV Brush 2 \* |
| 009 | 8 | Fanta Bell A | | 074 | 73 | Brush Swish \* | | 139 | 138 | REV Brush 3 |
| 010 | 9 | Fanta Bell B | | 075 | 74 | Brush Roll | | 140 | 139 | REV LiteKick \* |
| 011 | 10 | Fanta Bell C | | 076 | 75 | Dry Stick \* | | 141 | 140 | REV HybridK1 \* |
| 012 | 11 | FantaBell A+ | | 077 | 76 | Side Stick \* | | 142 | 141 | REV HybridK2 \* |
| 013 | 12 | Org Bell | | 078 | 77 | Lite Kick \* | | 143 | 142 | REV Old Kick \* |
| 014 | 13 | Agogo | | 079 | 78 | Hybrid Kick1 \* | | 144 | 143 | REV Timpani \* |
| 015 | 14 | DIGI Bell 1 | | 080 | 79 | Hybrid Kick2 \* | | 145 | 144 | REV VerbTomH \* |
| 016 | 15 | DIGI Bell 1+ | | 081 | 80 | Old Kick \* | | 146 | 145 | REV VerbTomL \* |
| 017 | 16 | DIGI Chime | | 082 | 81 | Verb Kick \* | | 147 | 146 | REV DryTom H |
| 018 | 17 | Wave Scan | | 083 | 82 | Round Kick \* | | 148 | 147 | REV DryTom M |
| 019 | 18 | Wire String | | 084 | 83 | 808 Kick | | 149 | 148 | REV ClHiHat1 \* |
| 020 | 19 | 2.2 Bellwave | | 085 | 84 | Verb Tom Hi \* | | 150 | 149 | REV ClHiHat2 \* |
| 021 | 20 | 2.2 Vibwave | | 086 | 85 | Verb Tom Lo \* | | 151 | 150 | REV Op HiHat \* |
| 022 | 21 | Spark VOX | | 087 | 86 | Dry Tom Hi | | 152 | 151 | REV Pedal HH \* |
| 023 | 22 | MMM VOX | | 088 | 87 | Dry Tom Lo | | 153 | 152 | REV 606HH Cl \* |
| 024 | 23 | Lead Wave | | 089 | 88 | Cl HiHat 1 \* | | 154 | 153 | REV 606HH Op \* |
| 025 | 24 | Synth Reed | | 090 | 89 | Cl HiHat 2 \* | | 155 | 154 | REV Ride |
| 026 | 25 | Synth Saw 1 | | 091 | 90 | Op HiHat | | 156 | 155 | REV Cup |
| 027 | 26 | Synth Saw 2 | | 092 | 91 | Pedal HiHat \* | | 157 | 156 | REV Crash 1 \* |
| 028 | 27 | Syn Saw 2inv | | 093 | 92 | 606 HiHat Cl \* | | 158 | 157 | REV China \* |
| 029 | 28 | Synth Saw 3 | | 094 | 93 | 606 HiHat Op | | 159 | 158 | REV DrySick \* |
| 030 | 29 | JP-8 Saw A | | 095 | 94 | 808 Claps \* | | 160 | 159 | REV RealCLP \* |
| 031 | 30 | JP-8 Saw B | | 096 | 95 | Hand Claps \* | | 161 | 160 | REV FingSnap \* |
| 032 | 31 | JP-8 Saw C | | 097 | 96 | Finger Snaps \* | | 162 | 161 | REV Cowbell \* |
| 033 | 32 | P5 Saw A | | 098 | 97 | Ride 1 | | 163 | 162 | REV WoodBlck \* |
| 034 | 33 | P5 Saw B | | 099 | 98 | Ride 2 | | 164 | 163 | REV Clve \* |
| 035 | 34 | P5 Saw C | | 100 | 99 | Ride Bell 1 | | 165 | 164 | REV Conga \* |
| 036 | 35 | D-50 Saw A | | 101 | 100 | Crash 1 | | 166 | 165 | REV Tamb \* |
| 037 | 36 | D-50 Saw B | | 102 | 101 | China Cym | | 167 | 166 | REV Maracas \* |
| 038 | 37 | D-50 Saw C | | 103 | 102 | Cowbell 1 \* | | 168 | 167 | REV Guiro \* |
| 039 | 38 | Synth Square | | 104 | 103 | Wood Block \* | | 169 | 168 | REV Cuica \* |
| 040 | 39 | JP-8 SquareA | | 105 | 104 | Claves \* | | 170 | 169 | REV Metro \* |
| 041 | 40 | JP-8 SquareB | | 106 | 105 | Bongo Hi \* | | 171 | 170 | Loop 1 |
| 042 | 41 | JP-8 SquareC | | 107 | 106 | Bongo Lo \* | | 172 | 171 | Loop 2 |
| 043 | 42 | Synth Pulse1 | | 108 | 107 | Cga Open Hi \* | | 173 | 172 | Loop 3 |
| 044 | 43 | Synth Pulse2 | | 109 | 108 | Cga Open Lo \* | | 174 | 173 | Loop 4 |
| 045 | 44 | Triangle | | 110 | 109 | Cga Mute Hi \* | | 175 | 174 | Loop 5 |
| 046 | 45 | Sine | | 111 | 110 | Cga Mute Lo \* | | 176 | 175 | Loop 6 |
| 047 | 46 | Org Click \* | | 112 | 111 | Cga Slap \* | | 177 | 176 | Loop 7 |
| 048 | 47 | White Noise | | 113 | 112 | Timbale \* | | 178 | 177 | R8 Click \* |
| 049 | 48 | Pink Noise | | 114 | 113 | Cabasa Up \* | | 179 | 178 | Metronome 1 |
| 050 | 49 | Metal Wind | | 115 | 114 | Cabasa Down \* | | 180 | 179 | Metronome 2 \* |
| 051 | 50 | Wind Agogo | | 116 | 115 | Cabasa Cut \* | | 181 | 180 | MC500 Beep 1 \* |
| 052 | 51 | Feedbackwave | | 117 | 116 | Maracas \* | | 182 | 181 | MC500 Beep 2 \* |
| 053 | 52 | Spectrum | | 118 | 117 | Long Guiro \* | | 183 | 182 | Low Saw |
| 054 | 53 | BreathNoise \* | | 119 | 118 | Tambourine \* | | 184 | 183 | Low Saw inv |
| 055 | 54 | Rattles | | 120 | 119 | Open Triangl | | 185 | 184 | Low P5 Saw |
| 056 | 55 | Ice Rain | | 121 | 120 | Cuica \* | | 186 | 185 | Low Pulse 1 |
| 057 | 56 | Tin Wave | | 122 | 121 | Vibraslap | | 187 | 186 | Low Pulse 2 |
| 058 | 57 | Anklungs | | 123 | 122 | Timpani | | 188 | 187 | Low Square |
| 059 | 58 | Wind Chimes | | 124 | 123 | Applause | | 189 | 188 | Low Sine |
| 060 | 59 | Orch. Hit \* | | 125 | 124 | REV Orch.Hit \* | | 190 | 189 | Low Triangle |
| 061 | 60 | Tekno Hit \* | | 126 | 125 | REV TeknoHit \* | | 191 | 190 | Low White NZ |
| 062 | 61 | Back Hit \* | | 127 | 126 | REV Back Hit \* | | 192 | 191 | Low Pink NZ |
| 063 | 62 | Philly Hit \* | | 128 | 127 | REV PhillHit \* | | 193 | 192 | DC |
| 064 | 63 | Scratch 1 \* | | 129 | 128 | REV Steel DR | |  |  |  |
| 065 | 64 | Scratch 2 | | 130 | 129 | REV Tin Wave | |  |  |  |

---

## Not found / not verifiable in the manual

- Raw Wave Group ID values for INT-A and INT-B (only `Type 0–2`, `ID 0–127` are given, p.190).
- How EFX parameter raw values map to display values, and the raw step count, for every
  non-0–127 EFX parameter (§7).
- Explicit confirmation that the per-type list order equals EFX Parameter 1–12.
- How the JV splits a 129-byte tone when it answers an RQ1. p.187 only says packets are ≤128 bytes,
  sent about 20 ms apart. Check on hardware.
- Safe DT1 pacing for single-parameter edits. The manual only gives ≥20 ms between *packets* of a
  split bulk transfer.
