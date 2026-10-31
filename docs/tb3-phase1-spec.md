# TB-3 Phase 1 — Core patch model (implementation spec)

Goal: a pure TypeScript core (no React, no Web MIDI) in `apps/tb3/src/core/` that decodes a TB-3
patch into named values, encodes edits back to DT1 messages, diffs patches and morphs between
them. Fully unit-tested. No UI changes in this phase beyond what's needed to keep the spike
compiling.

Sources to port (in `../touchosc-controllers/tb-3/`):

| Source | What to take |
|--------|--------------|
| `lua/param_defs.lua` | Every synthesis parameter row (addr, bits, signed, bipolar, center, semitoneRange, max, sw/btn, id, name). Ignore `path`, `bcr`, `nrpn`, `par`, `encSp`. |
| `lua/shared/efx_defs.lua` | EFX types 0–8 (shared) and 9/10 (EFX1: PITCH SHIFT, EQ; EFX2: REVERB): swOff, slots, buttons, defaults, disabledBy. Keep slot/button positions (nil holes = layout positions). |
| `lua/efx_section.lua` lines ~100–262 | Display functions and lookup tables (BPM divisions, HPF/LPF/EQ freq, ratios, etc.). |
| `lua/root.lua` `GLOBAL_TUNING_DISPLAY` | CC 104 → display string table. |
| `tools/decode_patch.py` | `DIST_TYPES` names; cross-check of block layouts. |

## Files

```
apps/tb3/src/core/
  sysex.ts          (exists) DT1/RQ1, checksum, PATCH_BLOCKS
  params.ts         synthesis parameter table + types
  efx.ts            EFX type table, display fns
  display.ts        shared formatters (signed, bipolar, semitone, dB…), lookup tables
  patch.ts          Patch model: from/to SysEx, get/set, diff, morph
  *.test.ts
```

## Data model

```ts
type BlockKey = string;                    // addrKey(), e.g. "10000A00"
interface Patch { blocks: Record<BlockKey, number[]> }  // raw data bytes per block, all 11 present
```

- `Patch` is immutable; setters return a new Patch.
- `patchFromSysex(messages: number[][]): Patch` — matches blocks **by address**, never by
  position (real `.syx` files store them in size order). Throws if a block is missing, the size
  is wrong or a checksum fails.
- `patchToSysex(p: Patch): number[][]` — 11 DT1 messages in `PATCH_BLOCKS` order.
- `defaultPatch()` is not needed yet.

## Parameter table (`params.ts`)

One entry per parameter, keyed by a stable string id (snake_case, e.g. `vcf_cutoff`,
`vco_saw_level`, `vco_saw_sw`, `lfo_bpm_sync`). Shape:

```ts
interface ParamDef {
  id: string;
  name: string;              // from Lua `name` (e.g. "VCF CUTOFF")
  block: BlockKey;
  offset: number;            // addr[3] — byte offset in block data
  encoding: "u7" | "u16";    // u16 = nibble-packed over offset, offset+1
  max: number;               // raw full scale (default 127 / 255)
  kind: "continuous" | "switch" | "enum";
  display: (raw: number) => string;
  assignId?: number;         // Lua `id` — TB-3 param-assign ID
}
```

- `sw=true` / `btn=true` rows → `kind: "switch"`, max 1, display "ON"/"OFF".
- `dist_type` (max 24) → `kind: "enum"` with `DIST_TYPES` names.
- `porta_mode` (14 02) → `enum` ["LEGATO", "ALWAYS"].
- Assign slots (14 04/06/08/0A, u16) → `enum` whose display resolves the stored value back to a
  parameter name via `assignId` (synthesis params) — EFX assign IDs can show as `#<id>` for now.
- Display rules, ported from `patch_manager.lua`:
  - signed (s7): `raw − 64`, with explicit `+`.
  - bipolar: `raw − (center ?? floor(max/2))`, explicit `+`.
  - semitoneRange: `±(raw+1) st`.
  - otherwise the raw integer.
- **Tuning (10 00 02 00)**: keep `param_defs.lua` values (u16, max 151, center 127, and its
  deliberate SAW@00 / SQR@02 labelling — the comment says hardware is reversed vs. the spec).
  `decode_patch.py` uses centre 128; record the disagreement in a code comment, don't resolve it.
- **Global tuning** (CC 104) is *not* in the patch. Export `GLOBAL_TUNING_DISPLAY` and a
  `globalTuningCc(value)` builder (`B0+ch, 104, value`) only; the channel is a parameter
  (the user's TB-3 is on MIDI channel 2).

## EFX table (`efx.ts`)

- `EFX_BLOCK = { 1: "10001000", 2: "10001200" }`; type index is data byte 0.
- `efxTypes(efxNum: 1 | 2)` → array indexed by type 0–10 (EFX2 has no 10). Each type:
  `{ name, swOffset?, slots: (EfxSlot | null)[], buttons: (EfxButton | null)[] }` keeping null
  holes.
- `EfxSlot { offset, name, max, default (0..1), disabledBy: number[], display }`.
- `EfxButton { offset, name, action: "set" | "toggle", value? }`.
- Port every display function and lookup table exactly (including the "approximate" ones).

## Patch API (`patch.ts`)

```ts
getRaw(p, def): number                 // u16 = msb*16 + lsb
setRaw(p, def, raw): Patch             // clamps 0..max
encodeParam(def, raw): number[]        // DT1 for one param (dt1 or dt1Nibble16)
getEfxType / setEfxType, getEfxRaw / setEfxRaw (efxNum, offset)
diffBlocks(a, b): BlockKey[]           // blocks whose bytes differ
blocksToSysex(p, keys): number[][]     // DT1s for just those blocks (recall sends only changes)
morph(base, target, t): Patch          // t in 0..1
```

### Morph rules

The TouchOSC version interpolated every byte, which can produce invalid values for switches
and enums. New rules:

- **Continuous synthesis params**: linear interpolation of the raw value, rounded. u16 pairs
  interpolate as one value (never per nibble).
- **Switches, enums, assign slots, EFX type bytes, EFX switch (swOffset) and button bytes**:
  take `base` while `t < 0.5`, `target` from `t ≥ 0.5`.
- **EFX slot bytes** (every slot offset of every type in that EFX block): interpolate linearly,
  since each type's params live at their own offsets.
- **Bytes not described by any table** (unmapped offsets): snap at 0.5 like switches.
- `morph(a, b, 0)` equals `a` and `morph(a, b, 1)` equals `b`, byte for byte.

## Tests

- Table sanity: every param's offset (+1 for u16) is inside its block's size; no two params
  overlap a byte; EFX slot offsets are inside the EFX block size; ids are unique.
- Display: spot-check each formatter (e.g. dispRatio(13) = "1:INF", dispPitchSt(24) = "+0 st",
  bender range raw 23 = "±24 st", signed raw 64 = "+0").
- `patchFromSysex` / `patchToSysex` round-trip byte-for-byte on every local fixture
  (`fixtures/local/tb3/*.syx`, skipped when absent) and on a synthetic patch built in the test.
- Decoding: committed tests use a synthetic patch only. Don't commit snapshots of fixture
  decodes — a full decode is effectively the third-party patch. For fixtures, check that every
  param decodes to a value within 0..max, and hand-check a few values against
  `python3 tools/decode_patch.py` output (note which in the commit message).
- Morph: endpoints exact; midpoint of a u16 param; switch snaps at 0.5; EFX type snaps.
- `diffBlocks` / `blocksToSysex`: changing one param touches exactly one block.

## Out of scope

UI, Launchpad, CC learn, bank files, the parameter-assign *mode* interaction (Phase 2).
