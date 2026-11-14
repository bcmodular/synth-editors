# JV-2080 editor — design (draft)

Status: **draft, nothing built**. It started as a TouchOSC plan in `touchosc-controllers` and moved here on
2026-11-14 so it follows the TB-3 and SP-404 apps' stack and conventions (see [PLAN.md](../PLAN.md)).

- SysEx reference, checked against Roland's owner's manual: [jv2080-sysex-map.md](jv2080-sysex-map.md). It is the
  source of truth for the parameter table.
- Mockup: [jv2080-mockups/1-layout.html](jv2080-mockups/1-layout.html).

## What it does

A simple patch editor and librarian for the Roland JV-2080: store and recall patches, and edit the core parameters
of the four tones plus the effects. It is deliberately shallow; it isn't a full editor.

| In scope | Out of scope (v1) |
|---|---|
| Patch mode: the temporary patch (Common + Tones 1–4) | Performance mode |
| Read the patch from the JV (RQ1) and send edits (DT1) | Writing to the JV's USER memory |
| Patch library of `.syx` files, 16-slot sets, audition, GRAB / DELETE | Expansion boards (none installed) |
| EFX (40 types), chorus, reverb | Controller matrix, velocity curves and ranges, keyfollow, FXM, tone delay, structure / booster |
| Browse the JV's banks (bank select + program change), then sync the patch in | Rhythm sets |
| CC learn (`packages/cc-learn`) | BCR2000 |

## Decisions

| Topic | Decision |
|---|---|
| Where | `apps/jv2080`, a third app next to `apps/tb3` and `apps/sp404`; same stack (TS + React + Vite, Electron, Web MIDI) |
| Platform | Mac, mouse + keyboard. Fixed design size zoomed to fit, as the TB-3 (`useFitZoom`) |
| Tones | All four tones side by side, as columns |
| Hardware sync | Read (RQ1) as well as send (DT1), like the TB-3 |
| Patch files | `.syx`: the 5 blocks as DT1s to the temporary patch, in packets of ≤ 128 bytes (9 messages, 590 data bytes) |
| Sets | 16 self-contained slots in a JSON set file (`.jvset`), as `core/patchSet.ts` does for the TB-3 |
| Look | The TB-3's: dark panels, section-coloured headers, Archivo at 75% width, 11px minimum, bar faders with the value on the right, visual editors where they help |
| Controllers | CC learn from day one (it's a package). Launchpad slots later, if wanted |

## Protocol summary

The detail, with page references, is in [jv2080-sysex-map.md](jv2080-sysex-map.md).

- Roland DT1 / RQ1, model ID `6A`, device ID 17 = `10`. Same checksum as the TB-3.
- Temporary patch: Common `03 00 00 00` (74 bytes), Tones `03 00 10 00` / `12 00` / `14 00` / `16 00` (129 bytes
  each). Two-byte values (Wave Number, Patch Tempo) are nibble-split, high first.
- **Addresses are 7 bits per byte.** Tone offset 128 is at sub-address `01 00`, so the address builder carries
  into the next byte. The TB-3's `core/sysex.ts` doesn't need this; the JV's does.
- **DT1 data ≤ 128 bytes, ≥ 20 ms apart** for bulk sends. A tone is two packets, so a whole patch is 9 messages
  and takes about 200 ms. The JV also answers a tone RQ1 in more than one DT1: the parser places each packet by
  address (the TB-3's block parser assumes one message per block).
- The JV-2080 is DIN-only (behind the H12MIDI-Pro). DIN's 31.25 kbaud spaces single edits by itself; a pacer in
  the style of `editor/pacer.ts` adds the 20 ms bulk gap.
- Banks: USER 80/0, PR-A 81/0, PR-B 81/1, PR-C 81/2, GM 81/3, PR-E 81/4 (CC 0 / CC 32), program 1–128.

## Layout

One window, everything on screen, ~1952 px wide like the TB-3.

**Sidebar** (left, the TB-3's, unchanged in behaviour): PATCH (name large, slot, SAVE AS…), SET (DELETE, GRAB,
the 8 × 2 slots, NEW / SAVE / SAVE AS…), LIBRARY (tree of `.syx` and `.jvset` files, search, ▶ audition).
Morph is left out of v1; see Open questions.

**Top strip**: JV-2080, UNDO / REDO, CC, MIDI · SYNC FROM JV / SYNC TO JV · JV BANK browser (bank + number,
‹ ›, LOAD = program change then RQ1).

**Common row**:
- **PATCH COMMON**: level, pan, octave, bend up / down, POLY / SOLO, LEGATO, PORTA + time.
- **EFX · <type>** with ON-style output assign (MIX / DIR1 / DIR2) in the header: a type chooser (40 types is too
  many for the TB-3's button row; a grouped popover, eg. EQ / DRIVE / MOD / DELAY / PITCH / REVERB / COMBO), the
  type's parameters as bar faders labelled from the type table (2–10 of them), and the three sends.
- **CHORUS**: level, rate, depth, pre-delay, feedback, output (MIX / REV / MIX+REV).
- **REVERB**: type (segmented, 8), level, time, HF damp, delay feedback.

**Tone columns** (four, ~380 px each), each headed **TONE n** with ON in the header:
- **WAVE**: INT-A / INT-B segmented, the wave name with ‹ › and a searchable list (448 waves).
- **PITCH**: coarse, fine; pitch envelope graph with depth.
- **FILTER**: type (LPF / BPF / HPF / PKG / OFF), cutoff, resonance, env depth; filter envelope graph.
- **AMP**: level, pan; amp envelope graph.
- **LFO 1 / LFO 2**: waveform, rate, and depths to pitch / filter / amp.
- **OUT**: output assign (MIX / EFX / DIR1 / DIR2), EFX / chorus / reverb sends.

### Envelopes

Roland envelopes are four times and four levels (amp: three levels, Level 4 is always 0), not ADSR. They are drawn
as a graph with five points like the TB-3's `ui/EnvelopeEditor.tsx`: each point drags T*n* (x) and L*n* (y), with a
row of small fields under it for the exact values. This shows the whole envelope without a wall of controls, so
nothing has to be hidden to fit the four columns. Pitch and filter levels are bipolar (–63…+63): the graph gets a
centre line.

## Code

Follows the TB-3's split:

- `src/core/`: pure, with vitest tests.
  - `params.ts` — one row per parameter: block (`common` / `tone`), offset, bits (7 / nibble-16), range, display
    formatter, enum labels. Generated by hand from the SysEx map.
  - `efx.ts` — the 40 types: names, parameters 1–12, display formatters.
  - `waves.ts` — INT-A and INT-B names.
  - `sysex.ts` — DT1 / RQ1 with base-128 address arithmetic, packet splitting (≤ 128), reassembly by address.
  - `patch.ts` — `Patch` = Common + 4 tones as byte arrays; get / set raw, diff (send only changed runs),
    `.syx` encode / decode.
  - `patchSet.ts` — `.jvset`.
- `src/editor/`: session (slots, active patch, audition, undo) and the sections.
- `src/ui/`: faders, segmented, envelope editor.

### Reuse

- **Packages, as they are**: `midi`, `cc-learn` (and `launchpad` if slots go on the Launchpad).
- **From the TB-3 app**: `checksum` / `rq1` / `dt1`, the pacer, `Fader`, `controls.tsx`, `useValueDrag`,
  `useFitZoom`, the session / undo hooks, `LibraryBrowser`, `PatchesBlock` and the Electron file IPC.
- PLAN.md's rule is "small libraries only where there is real reuse". A third app makes the library sidebar, the
  set format and the generic controls real reuse, so this is the moment to decide between copying them again (the
  SP-404 already has its own `ui/`) and extracting the `ui` and `bank-files` packages PLAN.md lists. See Open
  questions.

## Phases

0. **Map** ✅ — [jv2080-sysex-map.md](jv2080-sysex-map.md).
1. **Spike on hardware** — app shell, MIDI port picker, RQ1 the five blocks and show them decoded, send one DT1.
   Answer the hardware questions below. *Built (`npm run dev:jv2080`), not yet run against the JV.* It reads the
   patch and logs packets and timings per block, shows the raw Wave Group IDs, sends PC then reads after a set
   delay, sends single DT1s (Tone 1 Reverb Send tests the address carry), sends the whole patch back, and saves it
   as `.syx` (save JV dumps under `fixtures/local/` for Phase 2's tests).
2. **Core** — params, EFX and wave tables, SysEx with address carry and packets, patch encode / decode, diff;
   tests against `.syx` dumps captured from the JV.
3. **Editor** — common row, four tone columns, envelope editor, sync from / to the JV, bank browser.
4. **Library** — sidebar: patch files, sets, audition, GRAB / DELETE.
5. **Controllers and packaging** — CC learn, Launchpad (optional), packaged build.

## Open questions

Need the JV-2080 on the bench:

- The raw Wave Group ID values for INT-A and INT-B.
- Raw → display for the EFX parameters shown in ms, Hz, dB, degrees, notes and balance (marked ⚑ in the map), and
  that each type's list order is EFX Parameter 1–12.
- How the JV splits a tone RQ1 reply.
- ~~How long after a program change before an RQ1 is answered.~~ Answered on the bench (2026-11-14): no wait is
  needed. An RQ1 sent straight after bank select + program change (0 ms) returns the new patch, so the JV handles
  incoming MIDI in order. The bank browser's LOAD can send the PC and the RQ1s back to back.

To decide:

- Copy the TB-3's library sidebar and controls, or extract `packages/ui` and `packages/bank-files` first.
- Morph: the TB-3's preset morph would work byte-wise here too. In v1 or later?
- Importing third-party JV-1080 / JV-2080 banks (bulk dumps to USER addresses, `11 nn …`; JV-1080 Common is 72
  bytes, not 74). Later.
