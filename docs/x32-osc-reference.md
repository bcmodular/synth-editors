<!-- Extracted 22 Nov 2026 from P.-G. Maillot's "Unofficial X32/M32 OSC Remote Protocol" v4.09-02 and his X32
emulator sources, and checked against the studio's X32 Rack (fw 4.15) where noted. Used by apps/x32 (addresses.ts,
enums.ts and the setup feature). -->

# X32 (FW 4.x) OSC addresses and enums: reference notes

## Sources

- **[DOC]**: P.-G. Maillot, *Unofficial X32/M32 OSC Remote Protocol*, **version 4.09-02 (Nov 30, 2025)**. It says it
  applies to FW 4.0 and later. It is 180 pages, linked from sites.google.com/site/patrickmaillot/x32 (Google Drive id
  `1Yt_S1mpPt3CAzeq3Dnpe_IqctQ-1GlTz`). Page numbers below are the **printed** page numbers; the PDF page is printed + 1.
- **[EMU]**: github.com/pmaillot/X32-Behringer, `X32.c` (X32 emulator), last commit touching it `5194fdaf`
  (2024-02-15), plus `X32Fx.h`. The emulator tables are **pre-FW4** in places: they have no UIN/UOUT routing values,
  and their FX type order differs from [DOC] (see §6). Use it for `/node` text formatting, and use [DOC] for FW4 enums.
- Anything marked **inferred** was not read in a source.

General float scaling ([DOC] p.14-15, [EMU] X32.c 1237-1281):
- `linf [min, max, step]`: value = min + f·(max−min)
- `logf [min, max, nsteps]`: value = min·(max/min)^f
- `level` (faders, sends; 1024 steps for faders, 161 for sends): a 4-segment curve ([DOC] p.131):
  - f≥0.5: dB = 40f−30
  - f≥0.25: dB = 80f−50
  - f≥0.0625: dB = 160f−70
  - otherwise dB = 480f−90 (f = 0 is −∞)
  - Inverse, for d < −60 / −30 / −10 / ≤ 10: f = (d+90)/480, (d+70)/160, (d+50)/80, (d+30)/40.
  - To round to a known fader value: f = int(f·1023.5)/1023.
- Enums can be sent as an int or as their string (`,s GATE`) ([DOC] p.13). `%int` is a bitmap; in `/node` text it is
  printed as `%` followed by bits, **MSB first**, so the rightmost character is bit 0 ([EMU] X32.c 1283-1292 `Sbitmp`).

---

## 1. Routing (FW4) ([DOC] p.22-23)

`/config/routing/routswitch`: 0 = REC (default; uses the `IN` blocks), 1 = PLAY (uses the `PLAY` blocks).

**Input blocks**: `/config/routing/IN/1-8`, `/9-16`, `/17-24`, `/25-32`, and `PLAY/...` the same. Int 0..23:

| v | src | v | src | v | src | v | src |
|---|---|---|---|---|---|---|---|
| 0 | AN1-8 | 6 | A17-24 | 12 | B17-24 | 18 | CARD17-24 |
| 1 | AN9-16 | 7 | A25-32 | 13 | B25-32 | 19 | CARD25-32 |
| 2 | AN17-24 | 8 | A33-40 | 14 | B33-40 | 20 | UIN1-8 |
| 3 | AN25-32 | 9 | A41-48 | 15 | B41-48 | 21 | UIN9-16 |
| 4 | A1-8 | 10 | B1-8 | 16 | CARD1-8 | 22 | UIN17-24 |
| 5 | A9-16 | 11 | B9-16 | 17 | CARD9-16 | 23 | UIN25-32 |

AN = local inputs, A/B = AES50 A/B, UIN = user-in slots. 20-23 are FW4 only; [EMU] stops at 19.

**Aux inputs**: `/config/routing/IN/AUX` (and `PLAY/AUX`). Int 0..15:
- 0 AUX1-4 (the doc's note says it is really Aux 1-6 locally, and the name stays for backward compatibility)
- 1 AN1-2, 2 AN1-4, 3 AN1-6
- 4 A1-2, 5 A1-4, 6 A1-6
- 7 B1-2, 8 B1-4, 9 B1-6
- 10 CARD1-2, 11 CARD1-4, 12 CARD1-6
- 13 UIN1-2, 14 UIN1-4, 15 UIN1-6

**Output blocks (8 wide)**: `/config/routing/AES50A/1-8 … /41-48`, `AES50B/...` the same, and `CARD/1-8`, `/9-16`,
`/17-24`, `/25-32`. Int 0..35:

| v | src | v | src | v | src | v | src |
|---|---|---|---|---|---|---|---|
| 0-3 | AN1-8, AN9-16, AN17-24, AN25-32 | 16-19 | CARD1-8 … CARD25-32 | 24 | AUX1-6/Mon | 26-31 | UOUT1-8, 9-16, 17-24, 25-32, 33-40, 41-48 |
| 4-9 | A1-8 … A41-48 | 20, 21 | OUT1-8, OUT9-16 | 25 | AuxIN1-6/TB | 32-35 | UIN1-8, 9-16, 17-24, 25-32 |
| 10-15 | B1-8 … B41-48 | 22, 23 | P16 1-8, P16 9-16 | | | | |

OUT = the output patch (`/outputs/main/01-16`), P16 = `/outputs/p16/01-16`, UOUT = user-out slots. 26-35 are FW4
only; [EMU] stops at 25.

**Local outputs (4 wide)**: `/config/routing/OUT/1-4` and `/9-12` take the "first half" list below; `/5-8` and
`/13-16` take the matching "second half" list (AN5-8, AN13-16, … OUT5-8, OUT13-16, P16 5-8, …). Int 0..35:
- 0-3 AN1-4, AN9-12, AN17-20, AN25-28
- 4-9 A1-4, A9-12, A17-20, A25-28, A33-36, A41-44
- 10-15 B (same pattern)
- 16-19 CARD1-4, 9-12, 17-20, 25-28
- 20 OUT1-4, 21 OUT9-12
- 22 P16 1-4, 23 P16 9-12
- 24 AUX/CR, 25 AUX/TB
- 26-31 UOUT1-4, 9-12, 17-20, 25-28, 33-36, 41-44
- 32-35 UIN1-4, 9-12, 17-20, 25-28

There is no `/config/routing/REC` address. The record path is `/outputs/rec/01-02` (§2). The `PLAY` blocks are the
playback-mode equivalent of `IN`.

**Check against the desk's factory values**: IN/1-8 = 0 (AN1-8), IN/17-24 = 4 (A1-8), CARD/1-8 = 0 (AN1-8),
CARD/9-16 = 1 (AN9-16), CARD/25-32 = 5 (A9-16), OUT/1-4 = 20 (OUT1-4), routswitch = 0 (REC). All are consistent.

**User routing (FW4)** ([DOC] p.22). A user slot is used by setting a routing block to a UIN/UOUT value above (e.g.
`IN/1-8 = 20` makes ch 1-8 read user-in slots 1-8; `CARD/1-8 = 26` makes card out 1-8 read user-out slots 1-8).
- `/config/userrout/in/01..32`: int 0..168.
- `/config/userrout/out/01..48`: int 0..208.

| v | source |
|---|---|
| 0 | OFF |
| 1-32 | Local In 1-32 |
| 33-80 | AES50-A 1-48 |
| 81-128 | AES50-B 1-48 |
| 129-160 | Card In 1-32 |
| 161-166 | Aux In 1-6 |
| 167 / 168 | TB Internal / TB External |
| 169-184 | Outputs 1-16 (*out only*) |
| 185-200 | P16 1-16 (*out only*) |
| 201-206 | AUX 1-6 (*out only*) |
| 207 / 208 | Monitor L / Monitor R (*out only*) |

The user-out list has **no channel direct outs and no buses**. Those reach a user-out slot only through Outputs 1-16,
P16 1-16 or AUX 1-6.

## 2. Output patching ([DOC] p.41-43)

Addresses: `/outputs/main/01-16/{src,pos,invert,delay/on,delay/time}`, `/outputs/aux/01-06/{src,pos,invert}`,
`/outputs/p16/01-16/{src,pos,invert,iQ/...}`, `/outputs/aes/01-02/{src,pos,invert}`, `/outputs/rec/01-02/{src,pos}`.

**src** (int 0..76; the same list for every output):
- 0 OFF, 1 Main L, 2 Main R, 3 M/C
- 4-19 MixBus 1-16
- 20-25 Matrix 1-6
- **26-57 DirectOut Ch 1-32** (ch N = 25+N)
- 58-65 DirectOut Aux 1-8
- 66-73 DirectOut FX 1L-4R
- 74 Monitor L, 75 Monitor R, 76 Talkback

**pos** (tap point, int 0..8):
- 0 IN/LC, 1 IN/LC+M
- 2 <-EQ, 3 <-EQ+M
- 4 EQ->, 5 EQ->+M
- 6 PRE, 7 PRE+M
- **8 POST**

"+M" means the tap follows the channel mute (inferred from the names).

**Check against the desk**: main/01-06 src 4-9 = MixBus 1-6; main/07,08 = 1,2 = Main L/R; aux src 0 = OFF;
pos 8 = POST. All are consistent.

## 3. Channel direct out to a card output (FW4)

This section is **inferred**, assembled from §1 and §2. There is no direct-out-to-card value in the routing enums. The
chain is:

1. Put the direct out on a logical output: `/outputs/main/NN/src = 25+ch` (or `/outputs/p16/NN/src`).
2. Set the tap with `/outputs/main/NN/pos = 8` (POST, post-fader) or 6 (PRE). The tap point is per output, not per
   channel.
3. Send that output to the card, by either:
   - (a) `/config/routing/CARD/1-8 = 20` (OUT1-8), `/9-16 = 21` (OUT9-16), `/17-24 = 22` (P16 1-8),
     `/25-32 = 23` (P16 9-16); or
   - (b) `CARD/x = 26..31` (UOUT block) with `/config/userrout/out/NN = 168+k` (Outputs k) or `184+k` (P16 k).

At most 32 channel direct outs are possible this way: Outputs 1-16 plus P16 1-16 (plus AUX 1-6 via user out). On a
Rack, using Outputs 1-6 also changes what the local XLR outs carry, if `OUT/1-4` and `OUT/5-8` point at OUT1-4/5-8.

## 4. Mix sends ([DOC] p.26-27; [EMU] X32.c 3978-3988)

- `/ch/NN/mix/MM/on` (enum) and `/ch/NN/mix/MM/level` (level, 161 steps) exist for all MM = 01-16.
- `/ch/NN/mix/MM/pan` (linf [−100, 100, 2]), `/ch/NN/mix/MM/type` and `/ch/NN/mix/MM/panFollow` (int 0/1, FW4) are
  documented **only for odd MM** (01, 03, …, 15). The doc gives no link condition. That they apply to the bus pair when
  the pair is linked is **inferred**.
- **type** (int 0..5): 0 IN/LC, 1 <-EQ, 2 EQ->, 3 PRE, 4 POST, 5 GRP. The values seen on the desk, 2 and 4, are
  EQ-> and POST.
- The same layout applies to `/auxin/NN/mix/MM` and `/fxrtn/NN/mix/MM`.

## 5. Inserts ([DOC] p.26, 43)

- `/ch/NN/insert/on`: OFF/ON.
- `/ch/NN/insert/pos`: 0 PRE, 1 POST.
- `/ch/NN/insert/sel` (int 0..22): 0 OFF, 1 FX1L, 2 FX1R, 3 FX2L, 4 FX2R, … 15 FX8L, 16 FX8R, 17-22 AUX1-6.
- Read-only reverse map: `/-insert/fx[1-8]L|R` and `/-insert/aux[1-6]` give the channel each FX or aux insert is used
  by. `/node ,s -insert` returns 22 values (fx1L … fx8R, aux1 … aux6).

## 6. FX

**/fx/1-4/type** (int 0..60) ([DOC] p.40 and the appendix on p.166, which agree):

| v | type | v | type | v | type | v | type |
|---|---|---|---|---|---|---|---|
| 0 | HALL Hall Reverb | 16 | DIMC Dimension-C | 32 | DES Stereo DeEsser | 48 | ENH2 Dual Enhancer |
| 1 | AMBI Ambiance | 17 | FILT Mood Filter | 33 | P1A Stereo Xtec EQ1 | 49 | ENH Stereo Enhancer |
| 2 | RPLT Rich Plate | 18 | ROTA Rotary Speaker | 34 | P1A2 Dual Xtec EQ1 | 50 | EXC2 Dual Exciter |
| 3 | ROOM Room | 19 | PAN Tremolo/Panner | 35 | PQ5 Stereo Xtec EQ5 | 51 | EXC Stereo Exciter |
| 4 | CHAM Chamber | 20 | SUB Suboctaver | 36 | PQ5S Dual Xtec EQ5 | 52 | IMG Stereo Imager |
| 5 | PLAT Plate Reverb | 21 | D/RV Delay+Chamber | 37 | WAVD Wave Designer | 53 | EDI Edison EX1 |
| 6 | VREV Vintage Reverb | 22 | CR/R Chorus+Chamber | 38 | LIM Precision Limiter | 54 | SON Sound Maxer |
| 7 | VRM Vintage Room | 23 | FL/R Flanger+Chamber | 39 | CMB Combinator | 55 | AMP2 Dual Guitar Amp |
| 8 | GATE Gated Reverb | 24 | D/CR Delay+Chorus | 40 | CMB2 Dual Combinator | 56 | AMP Stereo Guitar Amp |
| 9 | RVRS Reverse Reverb | 25 | D/FL Delay+Flanger | 41 | FAC Fair Comp | 57 | DRV2 Dual Tube Stage |
| 10 | **DLY Stereo Delay** | 26 | MODD Modulation Delay | 42 | FAC1M M/S Fair Comp | 58 | DRV Stereo Tube Stage |
| 11 | 3TAP 3-Tap Delay | 27 | GEQ2 Dual GEQ | 43 | FAC2 Dual Fair Comp | 59 | PIT2 Dual Pitch |
| 12 | 4TAP Rhythm Delay | 28 | GEQ Stereo GEQ | 44 | LEC Leisure Comp | 60 | PIT Stereo Pitch |
| 13 | CRS Stereo Chorus | 29 | TEQ2 Dual TrueEQ | 45 | LEC2 Dual Leisure Comp | | |
| 14 | FLNG Stereo Flanger | 30 | TEQ Stereo TrueEQ | 46 | ULC Ultimo Comp | | |
| 15 | PHAS Stereo Phaser | 31 | DES2 Dual DeEsser | 47 | ULC2 Dual Ultimo Comp | | |

**/fx/5-8/type** (int 0..33): 0 GEQ2, 1 GEQ, 2 TEQ2, 3 TEQ, 4 DES2, 5 DES, 6 P1A, 7 P1A2, 8 PQ5, 9 PQ5S, 10 WAVD,
11 LIM, 12 FAC, 13 FAC1M, 14 FAC2, 15 LEC, 16 LEC2, 17 ULC, 18 ULC2, 19 ENH2, 20 ENH, 21 EXC2, 22 EXC, 23 IMG, 24 EDI,
25 SON, 26 AMP2, 27 AMP, 28 DRV2, 29 DRV, 30 PHAS, 31 FILT, 32 PAN, 33 SUB.

**Discrepancy**: the [EMU] string tables (X32.c 355-379) order entries 27-44 differently (for example GEQ2, TEQ2,
GEQ, TEQ, and the dual variants before the stereo ones). Trust [DOC] and check one value on the desk (e.g. set
type 28 and read `/node ,s fx/1`).

**/fx/1-4/source/l** and **/source/r** (int 0..17): 0 INS, 1-16 MIX1-16, 17 M/C ([DOC] p.40). FX 5-8 have no
source; they are insert-only.

**Parameters**: `/fx/N/par/01..64` ([DOC] p.88-96). Floats are 0..1 and scale as described in Sources (linf/logf).
Enum parameters are **ints** (see the type-tag column). Ranges are given as min…max.

*Hall Reverb, HALL (type 0)*. Tags `ffffffffffff`, p.88.

| par | name | scaling | range |
|---|---|---|---|
| 01 | Pre Delay | linf | 0…200 ms |
| 02 | Decay | logf | 0.2…5 s |
| 03 | Size | linf | 2…100 |
| 04 | Damping | logf | 1k…20k Hz |
| 05 | Diffuse | linf | 1…30 |
| 06 | Level | linf | −12…+12 dB |
| 07 | Lo Cut | logf | 10…500 Hz |
| 08 | Hi Cut | logf | 200…20k Hz |
| 09 | Bass Multi | logf | 0.5…2 |
| 10 | Spread | linf | 0…50 |
| 11 | Shape | linf | 0…250 |
| 12 | Mod Speed | linf | 0…100 |

*Plate Reverb, PLAT (type 5)*. Tags `ffffffffffff`, p.89.

| par | name | scaling | range |
|---|---|---|---|
| 01 | Pre Delay | linf | 0…200 |
| 02 | Decay | logf | 0.5…10 |
| 03 | Size | linf | 2…100 |
| 04 | Damping | logf | 1k…20k |
| 05 | Diffuse | linf | 1…30 |
| 06 | Level | linf | −12…+12 |
| 07 | Lo Cut | logf | 10…500 |
| 08 | Hi Cut | logf | 200…20k |
| 09 | Bass Multi | logf | 0.5…2 |
| 10 | Xover | logf | 10…500 |
| 11 | Mod Depth | linf | 1…50 |
| 12 | Mod Speed | linf | 0…100 |

*Stereo Delay, DLY (type 10)*. Tags `ffiiifffffff`, p.94.

| par | name | type | range |
|---|---|---|---|
| 01 | Mix | linf | 0…100 % |
| 02 | **Time** | linf | **1…3000 ms** (ms = 1 + 2999·f; [EMU] X32.c 1528 uses min 1, span 2999) |
| 03 | Mode | int enum | 0 ST, 1 X, 2 M |
| 04 | **Factor L** | int enum | 0 1/4, 1 3/8, 2 1/2, 3 2/3, 4 1, 5 4/3, 6 3/2, 7 2, 8 3 |
| 05 | **Factor R** | int enum | same as Factor L |
| 06 | Offset L/R | linf | −100…+100 |
| 07 | Lo Cut | logf | 10…500 |
| 08 | Hi Cut | logf | 200…20k |
| 09 | Feed Lo Cut | logf | 10…500 |
| 10 | Feed Left | linf | 1…100 |
| 11 | Feed Right | linf | 1…100 |
| 12 | Feed Hi Cut | logf | 200…20k |

Notes on DLY:
- The doc gives no step count for Time.
- Mode order: [EMU] X32Fx.h:73 (`Smode`) gives ST, X, M, matching the doc. Its parser table `R24` (X32.c:467) lists
  only "M","ST", which looks like an emulator bug.
- Factor order: [EMU] X32Fx.h:71 agrees.
- That each tap's delay = Time × Factor is **inferred** (the doc does not state it).

*Stereo Chorus, CRS (type 13)*. Tags `fffffffffff`, p.96.

| par | name | scaling | range |
|---|---|---|---|
| 01 | Speed | logf | 0.05…5 Hz |
| 02 | Depth L | linf | 0…100 |
| 03 | Depth R | linf | 0…100 |
| 04 | Delay L | logf | 0.5…50 ms |
| 05 | Delay R | logf | 0.5…50 ms |
| 06 | Mix | linf | 0…100 |
| 07 | Lo Cut | logf | 10…500 |
| 08 | Hi Cut | logf | 200…20k |
| 09 | Phase | linf | 0…180 |
| 10 | Wave | linf | 0…100 |
| 11 | Spread | linf | 0…100 |

## 7. Channel config and links ([DOC] p.20, 25, 137)

- `/ch/NN/config/name`: string, up to 12 characters.
- `/ch/NN/config/color` (int 0..15): 0 OFF, 1 RD, 2 GN, 3 YE, 4 BL, 5 MG, 6 CY, 7 WH, then 8-15 OFFi, RDi, GNi, YEi,
  BLi, MGi, CYi, WHi (inverted).
- `/ch/NN/config/source` (int 0..64): 0 OFF, 1-32 In01-32, 33-38 Aux1-6, 39 USB L, 40 USB R, 41-48 Fx1L-4R,
  49-64 Bus01-16. The per-index numbering is inferred from the list order; the count adds up to 65.
- `/ch/NN/config/icon` (int 1..74) (p.137):

| # | icon | # | icon | # | icon | # | icon | # | icon |
|---|---|---|---|---|---|---|---|---|---|
| 1 | None | 16 | Vibraphone | 31 | Synthesizer 1 | 46 | Talk B | 61 | FX |
| 2 | Kick Back | 17 | Electric Bass | 32 | Synthesizer 2 | 47 | Large Diaphragm Mic | 62 | Computer |
| 3 | Kick Front | 18 | Acoustic Bass | 33 | Synthesizer 3 | 48 | Condenser Mic Left | 63 | Monitor Wedge |
| 4 | Snare Top | 19 | Contrabass | 34 | Keytar | 49 | Condenser Mic Right | 64 | Left Speaker |
| 5 | Snare Bottom | 20 | Les Paul Guitar | 35 | Trumpet | 50 | Handheld Mic | 65 | Right Speaker |
| 6 | High Tom | 21 | Ibanez Guitar | 36 | Trombone | 51 | Wireless Mic | 66 | Speaker Array |
| 7 | Mid Tom | 22 | Washburn Guitar | 37 | Saxophone | 52 | Podium Mic | 67 | Speaker on a Pole |
| 8 | Floor Tom | 23 | Acoustic Guitar | 38 | Clarinet | 53 | Headset Mic | 68 | Amp Rack |
| 9 | Hi-Hat | 24 | Bass Amp | 39 | Violin | 54 | XLR Jack | 69 | Controls |
| 10 | Ride | 25 | Guitar Amp | 40 | Cello | 55 | TRS Plug | 70 | Faders |
| 11 | Drum Kit | 26 | Amp Cabinet | 41 | Male Vocal | 56 | TRS Plug Left | 71 | MixBus |
| 12 | Cowbell | 27 | Piano | 42 | Female Vocal | 57 | TRS Plug Right | 72 | Matrix |
| 13 | Bongos | 28 | Organ | 43 | Choir | 58 | RCA Plug Left | 73 | Routing |
| 14 | Congas | 29 | Harpsichord | 44 | Hand Sign | 59 | RCA Plug Right | 74 | Smiley |
| 15 | Tambourine | 30 | Keyboard | 45 | Talk A | 60 | Reel to Reel | | |

**Links**: 0 OFF, 1 ON (p.20).
- `/config/chlink/1-2 … /31-32` (16 pairs)
- `/config/auxlink/1-2 … /7-8`
- `/config/fxlink/1-2 … /7-8`
- `/config/buslink/1-2 … /15-16`
- `/config/mtxlink/1-2, 3-4, 5-6`
- `/node ,s config/chlink` returns all 16 values on one line.

## 8. Scenes ([DOC] p.44-53, 70)

- Slots are 0..99, written `000`..`099` in addresses. Scene 0 always exists and can't have safes.
- **Save**: `/save ,siss scene <idx> <name> <note>`. The doc's example is `/save ,siss scene 45 test note`, and the
  reply is `/save ,si scene 1`, where 1 means OK. The status can come back before the save has finished.
- **Load**: `/load ,si scene <idx>` (reply `/load ,si scene 1`). The other way is `/-action/goscene ,i <0..99>`.
- **Rename**: `/rename ,sis scene <idx> <name>`.
- **Delete**: `/delete ,si scene <idx>`.
- **Copy**: `/copy ,sii scene <src> <dst>`.
- The same verbs take `snippet`, `libchan`, `libfx`, `librout`, `libmon`.
- **Read names**:
  - `/-show/showfile/scene/NNN/name` (string)
  - `/-show/showfile/scene/NNN/notes` (string)
  - `/-show/showfile/scene/NNN/safes` (%int)
  - `/-show/showfile/scene/NNN/hasdata` (0/1)
  - `/node ,s -show/showfile/scene/001` returns `/-show/showfile/scene/001 "AAA" "aaa" %110000000 1` (p.54), i.e.
    name, notes, safes, hasdata.
  - `/showdump` sends every cue, scene and snippet as node lines (heavy on UDP).
- **`/-show/prepos/current`** (int): the cue, scene or snippet line **highlighted** on the Scenes page. Which of the
  three it refers to depends on `/-prefs/show_control` (0 CUES, 1 SCENES, 2 SNIPPETS). The doc calls it the
  highlighted index, not "last loaded". Treating it as the current scene is **inferred** and only holds when
  show_control = 1.

## 9. Remote and X-Touch ([DOC] p.57)

- `/-prefs/remote/enable`: 0 OFF, 1 ON.
- `/-prefs/remote/protocol`: 0 MC (Mackie Control), 1 HUI, 2 CC (generic).
- `/-prefs/remote/port`: 0 MIDI (DIN), 1 CARD, 2 RTP (RTP-MIDI).
- `/-prefs/remote/ioenable` (%int bitmap):

| bit | function |
|---|---|
| 0 | MIDI In/Out |
| 1 | Card MIDI |
| 2 | RTP MIDI |
| 3 | Rx Prog change |
| 4 | Tx Prog change |
| 5 | Rx Fader CC |
| 6 | Tx Fader CC |
| 7 | Rx Ch Mute CC |
| 8 | Tx Ch Mute CC |
| 9 | Rx Ch Pan CC |
| 10 | Tx Ch Pan CC |
| 11 | OSC over MIDI SysEx |
| 12 | **XTouch over MIDI** |
| 13 | **XTouch over Ethernet** |

- Node line: `/-prefs/remote <enable> <protocol> <port> %<14 bits, MSB first>`. Your reading
  `OFF MC CARD %00000010101010` means: remote off, Mackie Control, card port, and bits 1, 3, 5, 7 set (Card MIDI,
  Rx ProgChange, Rx Fader CC, Rx Mute CC).
- **X-Touch over Ethernet**: set bit 13 (`ioenable |= 0x2000`, e.g. `/-prefs/remote/ioenable ,i <v>` or the node form
  `/ ,s "-prefs/remote/ioenable %10000010101010"`). Whether `remote/enable` must also be ON, or which protocol to
  choose, is **not stated** (inferred: probably irrelevant for XTouch-Ethernet; check on the desk).
- Read-only status: `/-stat/remote` (0/1).
- I found no source giving the network port or discovery that the X-Touch uses (the "XCTL" protocol).

## 10. Main mix, mutes, DCA, headamp and meters ([DOC] p.16-19, 21, 26-27, 43)

- `/ch/NN/mix/on`: 0 = **muted**, 1 = unmuted (it is the "ON" button).
- `/ch/NN/mix/st`: L/R assign, 0/1.
- `/ch/NN/mix/fader`: level, 1024 steps.
- `/ch/NN/mix/pan`: linf [−100, 100, 2].
- `/ch/NN/mix/mono`: M/C assign. `/ch/NN/mix/mlevel`: level, 161 steps.
- `/ch/NN/grp/dca`: %int 0..255, bit 0 = DCA 1 … bit 7 = DCA 8. The bit order is inferred from the bitmap convention;
  the doc only says "8 bits bitmap".
- `/ch/NN/grp/mute`: %int 0..63, bit 0 = mute group 1 … bit 5 = group 6 (bit order inferred, same as above).
- `/config/mute/1..6`: mute group 1..6 active (OFF/ON).
- `/headamp/000..127/gain`: linf [−12, +60, 0.5], so dB = −12 + 72·f (145 steps).
- `/headamp/000..127/phantom`: OFF/ON.
- Headamp index map: 000-031 local XLR, 032-079 AES50-A devices, 080-127 AES50-B devices. On the Rack, local XLR in
  k is headamp k−1, so XLR 1 = `/headamp/000` (inferred for the Rack's 16 inputs).
- `/-ha/00..39/index` (read-only) returns the headamp actually feeding ch1-32 and aux1-8; it is −1 for a non-preamp
  source such as the card.
- `/ch/NN/preamp/trim` (linf ±18, 0.25 step) applies to digital sources only.

**Meters** (p.16-19). Request: `/meters ,siii /meters/N <arg1> <arg2> [time_factor]`.
- Data stream every 50 ms × time_factor (1..99).
- Requests expire after **10 s**; renew before then (inferred: every ~9 s).
- Reply: the address is `/meters/N`, then `,b`. The blob is: int32 **big-endian** byte length, int32
  **little-endian** count, then count × float32 **little-endian**. Values are linear, 1.0 = 0 dBFS, up to 8.0 (+18 dB).

| bank | contents |
|---|---|
| 0 | 70 values: 32 ch, 8 aux, 8 fxrtn, 16 bus, 6 mtx (METERS page) |
| 1 | 96 values: 32 ch input, 32 gate GR, 32 dyn GR |
| 2 | 49 values: 16 bus, 6 mtx, LR (2), M/C, 16 bus dyn GR, 6 mtx dyn GR, LR GR, M/C GR |
| 3 | 22 values: 6 aux sends, 8 aux returns, 8 fx returns |
| 4 | 82 values: 32 ch, 8 aux, **16 outputs, 16 P16**, 6 aux sends, 2 AES, 2 monitor |
| 5 `<chn_id> <grp_id>` | 27 values, the surface meters: 16 channels (chn_id 0 = ch 1-16, 1 = ch 17-32, 2 = aux/fx, 3 = bus), 8 groups (grp_id 0 = DCA, 1 = bus 1-8, 2 = bus 9-16, 3 = mtx), LR, M/C |
| 6 `<id 0..71>` | 4 values for one strip: **pre-fade, gate, dyn GR, post-fade** (p.16 example) |
| 7 | 16 bus sends |
| 8 | 6 matrix sends |
| 9 | 32 values, FX send/return × 8 slots |
| 10, 14 | FX-specific |
| 11 | 5 values, monitor |
| 12 | 4 values, recorder |
| 13 | 48 values: 32 ch, 8 aux, 8 fx returns |
| 15 | RTA: 100 × int16 LE, dB = v/256 |
| 16 | 48 × 32-bit = gate and comp gains as int16 LE /32767, plus automix |

The doc does not say whether the per-channel values in banks 0, 1, 4 and 13 are pre- or post-fader. The only
documented post-fader per-channel value is bank 6, one strip per request.

## 11. `/node` text formats

Request: `/node ,s "<path without leading slash>"`. Reply: address `node` (no slash; not OSC compliant), `,s`, then
one string: `/<path> <values…>\n`. Values are space-separated, strings are quoted, enums are names, and floats are in
engineering units (fader dB as `+0.0` or `-oo`). Writing uses the same text: `/ ,s "<path> <values…>"`. Partial value
lists are accepted, and the desk echoes the line back ([DOC] p.80-81). Field orders below come from [DOC] parameter
order plus [EMU] X32.c 3904-4080, 4416-4425. Example values are **illustrative**.

| node | fields | example |
|---|---|---|
| `ch/01/config` | name, icon (int), color (name), source (int) | `/ch/01/config "Kick Drum" 3 YE 1` (DOC p.133) |
| `ch/01/mix` | on (ON/OFF), fader (dB), st (ON/OFF), pan (±int), mono (ON/OFF), mlevel (dB) | `/ch/01/mix ON +0.0 ON +0 OFF -oo` |
| `ch/01/mix/01` (odd bus) | on, level, pan, type (IN/LC, <-EQ, EQ->, PRE, POST, GRP), panFollow (int, FW4) | `/ch/01/mix/01 ON -oo +0 POST 0` |
| `ch/01/mix/02` (even bus) | on, level | `/ch/01/mix/02 ON -oo` |
| `ch/01/grp` | dca %8 bits, mute %6 bits (MSB first) | `/ch/01/grp %00000000 %000000` |
| `ch/01/insert` | on, pos (PRE/POST), sel (name) | `/ch/01/insert OFF POST OFF` |
| `fx/1` | type name | `/fx/1 HALL` |
| `fx/1/source` | l, r (INS, MIX1..16, M/C) | `/fx/1/source MIX13 MIX13` |
| `fx/1/par` | all parameters in par order, engineering units. Enum params are printed by name (e.g. DLY: `… ST 1 1 …`) | `/fx/1/par 20 1.57 60 5k74 …` |
| `outputs/main/01` | src (int), pos (name), invert (ON/OFF) | `/outputs/main/01 4 POST OFF` |
| `outputs/aux/01`, `aes/01` | src, pos, invert (inferred, from the doc's parameter list) | |
| `outputs/rec/01` | src, pos | |
| `config/routing/IN` | 4 block names, then AUX block name (inferred FW4 shape, from the [EMU] CROUTIN case: 4 × `Sroutin` + `Sroutax`) | `/config/routing/IN AN1-8 AN9-16 A1-8 A9-16 AUX1-4` |
| `config/routing/AES50A`, `AES50B`, `CARD` | 6 or 4 block names | |
| `config/routing/OUT` | 4 names: blocks 1-4, 9-12, 5-8, 13-16 (order per [EMU] CROUTOT) | |
| `config/routing/routswitch` | REC or PLAY (inferred) | |
| `config/userrout/in` | 32 ints (slot 1..32) | `/config/userrout/in 0 0 …` (matches what your desk returned) |
| `config/userrout/out` | 48 ints | |
| `headamp/000` | gain dB, phantom | `/headamp/124 +0.0 OFF` (DOC p.81) |
| `-prefs/remote` | enable, protocol, port, %ioenable | `OFF MC CARD %00000010101010` |
| `-show/showfile/scene/001` | "name" "notes" %safes hasdata | (DOC p.54) |

Caveats:
- Ordering and formatting is mostly inferred from the emulator, which predates FW4 in places. For the FW4 routing
  nodes, check the UIN/UOUT names on the desk; the [EMU] tables have no names for values ≥ 20 / ≥ 26.
- Some names are spelled oddly in [DOC]: "P161-8" means P16 1-8, and "P1613-16" means P16 13-16.
- `/ch/01/config ,siii …` (a typed multi-arg set on a node address) does **not** work on X32; use `/ ,s "…"`
  instead (DOC p.12, footnote 7).
