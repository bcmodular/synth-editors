# X32 chat control

A desktop app for setting up and re-routing a Behringer X32 Rack in plain language, over OSC on the local network.
Type "route the S-1 to the sampler" or "an 80s gated reverb on the drum machine" and it works out the sends, inserts
and effects, checks them for feedback loops, asks before anything risky, writes them, and reads every value back.
Faders, mutes and live moves stay in X32-Edit on a laptop or iPad; this app is for the routing in between.

It also keeps the desk matching a **rig file**: a JSON description of how the desk should be set up (names, colours,
input routing, buses, outputs, FX feeds, the USB card). It lists what differs, and applies the difference after saving
a backup scene.

The rig file here, [rig/studio.json](rig/studio.json), is one studio's setup, left in as a worked example. To use the
app with your own desk, start with [Make it yours](#make-it-yours).

The design, the decisions behind it and the build order are in [docs/x32-spec.md](../../docs/x32-spec.md); OSC
addresses and value tables are in [docs/x32-osc-reference.md](../../docs/x32-osc-reference.md).

## What it does

The window has six panels:

- **Desk:** finds the X32 on the network by broadcast, connects, and shows the model, firmware and link state.
- **Chat:** requests in plain language. The model plans each one with the same tools as the panels below:
  - sends ("route S-1 to the P-6", "also send the TB-3 to the reverb at -6");
  - a channel insert ("put a delay on the TD-3") and effect settings ("give the reverb a 3 second tail");
  - presets from the desk's factory FX library, chosen by sound ("a warm slapback on the TD-3");
  - why something can't be heard, from the desk's settings ("I can't hear the S-1 on the sampler"): no input, mutes,
    mute groups, faders and DCAs, the send, the bus, and where the bus goes; and, while the source plays, from the
    desk's meters along the path ("trace the TB-3 to the reverb, it's playing");
  - whether the desk still matches the rig file ("is everything still set up right?");
  - scenes and snippets: recall one by name, or save the routing as a snippet ("save this as TR-8S into SP-404").

  Plans that only add a send, or save a new snippet, are applied at once. Anything that switches something off,
  changes an insert or an effect, loads a preset, or loads a scene or snippet waits for **Apply**. **Undo** reverses
  the last applied plan (not preset, scene or snippet loads).
- **Tempo:** the tempo of MIDI clock from a chosen input (a Nome II's "Nome II Clock" port by default), the delays it
  syncs and their times now. **Set delays to … BPM** sets every Stereo, 3-Tap and Rhythm Delay's Time to the tempo:
  an eighth for the Stereo Delay, a quarter for the multi-tap delays, with their Factors setting the note values. It
  writes only when pressed, because changing a delay's time while it plays is audible. Untick a delay to let it run
  free: the button leaves it alone, and the chat can set its time.
- **Sends:** the same send plans from drop-downs, without the model.
- **Set up from rig file:** *Check against rig file* reads the desk and lists every setting that differs from the rig
  file, by area, plus the steps only a person can do (phantom power, gain). *Apply* saves a dated backup scene, writes
  the ticked areas (routing first, names last), reads everything back, and saves a "Studio base" scene.
- **Rig:** what the app has worked out from the desk's names: sources and their sends, destinations and where they go,
  FX slots and their roles, spare channels, and anything that looks wrong.

### What it will and won't touch

- **Never:** phantom power, preamp gain, channel or main faders, the main and monitor sections, network or MIDI
  settings, scene safes. Every write is checked against an allowed list before anything is sent:
  - setup: `SETUP_ALLOWED` in [src/core/applier.ts](src/core/applier.ts);
  - chat and Sends: `chatAllowed` in [src/core/operator.ts](src/core/operator.ts).
- **Loop guards** ([src/core/guards.ts](src/core/guards.ts)), checked on the desk as the plan would leave it:
  - a device's return is never sent to its own feed;
  - an FX return is never sent back into its own effect;
  - a send effect in use keeps its type. A preset can only replace it with one of the same kind, so the Reverb stays
    a reverb.
- Setup always saves a backup scene first. To undo a setup, load that scene in X32-Edit.

## Requirements

- macOS. The API key is kept in the Keychain; the rest is Electron and would port.
- Node.js 22 or later, and `npm install` at the repo root.
- A Behringer X32 Rack on firmware 4.x (user routing), on the same network. It was built and checked on an X32 Rack
  with firmware 4.15. Other X32 and M32 models speak the same OSC, but the output counts in the code are the Rack's
  (see [Make it yours](#make-it-yours)).
- For the chat, an Anthropic API key. Usage is billed per token through the Claude Console; a Claude Pro or Max
  subscription doesn't cover it. Everything except the chat works without one.

## Getting started

```bash
npm install                 # at the repo root
npm run dev:x32             # the app; on first run it finds the desk by broadcast (or press Find desk)
```

If several desks answer, pick one from the list. You can also type an address (`192.168.1.50`, or `host:port`).

To use the chat, put an API key in the Keychain once, then press **New chat** in the app:

```bash
security add-generic-password -s "X32 Chat Control" -a anthropic-api-key -w
```

The key stays in the Electron main process: it never reaches the page, the config file or the chat log. The model is
`claude-haiku-5-5` unless `model` is set in `config.json` in the data folder
(`~/Library/Application Support/X32 Chat Control/`). The chat panel shows the session's tokens and cost.

Then, in order:

1. Edit the rig file for your desk.
2. Press *Check against rig file* and read the list.
3. Apply the areas you're happy with.

### No desk yet?

A fake desk stands in for the real one:

```bash
npm run fake:x32                            # a fake X32 on 127.0.0.1:10023
X32_HOST=127.0.0.1:10023 npm run dev:x32    # the app, pointed at it
```

## Make it yours

### 1. The rig file

[rig/studio.json](rig/studio.json) is the only file you need to change for the setup panel. It is written for people
("ch 5-6", "XLR 9-10", "aux out 1-2"); [src/core/rigFile.ts](src/core/rigFile.ts) parses it and reports any mistake
with where it is.

| Section | Each entry |
|---|---|
| `sources` | `strip` ("ch 7-8", "aux 3", "fxrtn 1-2"), `name` (12 characters at most), `colour` (OFF, RD, GN, YE, BL, MG, CY, WH), `icon` (a name from `ICONS` in [src/core/enums.ts](src/core/enums.ts)), `socket` ("XLR 11-12", "aux in 5", "card 1"), and optional `phantom` and `notes` |
| `unused` | `strips` to leave unnamed (aux strips are also muted), and a `colour` for them |
| `spare` | channels that keep a socket but no name |
| `buses` | `bus` ("1-2"), `name`, `colour`, `tap` ("pre" or "post"), `level` ("0 dB"), and either `output` ("aux out 6") or `targets` for a shared bus |
| `fx` | `slot` (1-4) and `source` ("bus 1-2"): which bus feeds each send effect |
| `card` | `outputs`: what each USB card output carries ("ch 1-20", "fxrtn 1-8", "main") |
| `manual` | steps only a person can do, shown with every check |

Two conventions the app relies on, because it works everything else out from the desk's names:

- **A bus that feeds one device has that device's name**, the same as the channel the device comes back on. The
  example's bus 9 "King Rat" feeds a pedal that returns on ch 4 "King Rat". That is how the loop guard knows not to
  send ch 4 to bus 9.
- **A shared bus** feeds one of several devices at a time. The example's "Sampler" bus goes to an SP-404, Koala or
  P-6. Its `targets` list each device and its output; the first is the default. On the desk the bus is named after
  the device it feeds now, so the mixer shows where it goes. In the chat or the Sends panel, sending to a target's
  name switches the bus to it and renames it; its role name ("Sampler") always finds it.

Name the effect buses after their effect ("Reverb", "Delay"). A slot fed by a bus with one of those names only takes
presets of that kind.

### 2. Files that mention the example studio

The planner, guards and tools read names from the desk, so they work with any rig. The files below mention the
example's gear or are tuned to it. A Claude Code session (or you) can work through them after the rig file changes.

| File | What to change |
|---|---|
| [src/core/systemPrompt.ts](src/core/systemPrompt.ts) | The model's instructions. They name the example's instruments (TB-3, S-1, P-6, TR-8S), the Sampler and its targets (SP-404 Mk2, Koala, P-6), and the effect buses (Reverb, Delay, FX 3, FX 4). Replace them with yours, or make them general. |
| [src/core/tools.ts](src/core/tools.ts) | Tool descriptions use the same names as examples (P-6, Koala, SP-404 Mk2, Reverb, Delay, the King Rat). |
| [src/chat/ChatPanel.tsx](src/chat/ChatPanel.tsx) | The example requests shown in an empty chat. |
| [src/core/promptCheck.live.test.ts](src/core/promptCheck.live.test.ts) | The prompt check: phrases and the plans they should produce, against the example rig. Rewrite them for yours before running it. |
| [src/core/presets.ts](src/core/presets.ts) | `NAMED_KINDS`: which bus names promise a kind of effect (reverb, delay). Add yours if your buses are named differently. |
| [rig/fx-presets.json](rig/fx-presets.json) | The catalogue of the desk's factory FX library: one description and tag list per preset, written by Claude from each preset's settings. Presets are matched to your desk's library by name, so the order doesn't matter. Add entries for presets you save yourself. |
| [src/core/enums.ts](src/core/enums.ts), [src/core/addresses.ts](src/core/addresses.ts) | The X32 Rack's counts: 8 XLR outs and 6 aux outs (`LOCAL_OUTPUTS`), and 32 channels, 8 aux ins, 8 FX returns and 16 buses (`STRIP_COUNT`). A full-size X32 or an M32 has more local outputs. |
| [src/core/cardRouting.ts](src/core/cardRouting.ts) | How card outputs 17-32 are routed through free outputs. It assumes the Rack's outputs and a 32-channel USB card. |
| [e2e/studio.ts](e2e/studio.ts) | The fake desk for the tests: set up from the rig file, plus one example send and the real desk's library order (`DESK_LIBRARY`). |
| [e2e/*.e2e.ts](e2e), `src/core/*.test.ts` | Tests that expect the example's names, channels and buses. Most read the rig file, so they follow it; the rest need their expectations updated. |
| [electron/main.cjs](electron/main.cjs) | The Keychain service and account names (`KEYCHAIN`), if you'd rather use your own. |

After changing these, run `npm test`, `npm run typecheck` and `npm run test:e2e:x32`. Then run
`npm run prompt-check:x32` if you changed the system prompt or tools.

## Running and testing

```bash
npm run dev:x32                                    # the app
npm run fake:x32                                   # a fake desk on 127.0.0.1:10023
npm test                                           # unit tests (Vitest), repo-wide
npm run typecheck
npm run test:e2e:x32                               # Playwright against the fake desk; never reaches a real one
X32_HOST=<desk address> npm run test:x32           # read-only checks on your real desk
npm run prompt-check:x32                           # a few phrases against the real model (about $0.01)
```

- **Tests never call the model.** They script its replies (`X32_FAKE_CLAUDE=1`). The prompt check is the only thing
  that costs money. It uses an in-memory desk, so nothing reaches the X32.
- **Packet capture:** `X32_CAPTURE=1` writes every OSC packet in and out to `captures/` in the data folder, for
  comparing the fake with a real desk.
- **Chat log:** every request is logged to one JSON Lines file per day in `logs/` in the data folder: what was typed,
  the tool calls, what happened to each plan, tokens and latency. The system prompt and key are never logged.

### Troubleshooting

**"Desk not reachable" though the desk was found.** If it says macOS refused the connection, Local Network access is
off for the terminal the app was started from (System Settings → Privacy & Security → Local Network). With iTerm2 it
can stay refused even when iTerm is ticked. Turn it off and on, quit iTerm, run `pkill -f iTermServer` (its helper
outlives it, and this closes every iTerm session), and start again.

## Findings on a real desk

Checked on an X32 Rack, firmware 4.15, in November 2026:

- Every address the app reads answers, and a full read takes under a second.
- Aux inputs have no insert point. FX 1-4 can be fed from buses (`/fx/N/source`); FX 5-8 are insert-only.
- The send tap point is per bus pair, at the odd bus (`/…/mix/01/type`, not `/mix/02/type`).
- From the factory every send is on at −∞, so a send only counts as active when it's on and raised.
- Output patch values: 4-19 = mix bus 1-16, 1-2 = main L/R. FX source n = mix bus n.
- Routing is at `/config/routing/…` (blocks) and `/config/userrout/in|out/NN` (user routing). `/node` reads work and
  answer on the address `node`.
- The desk can answer a read with the old value for a moment after a write, so read-back waits and asks again.
- **FX library loads:** `/load ,sii libfx <library number − 1> <slot − 1>`, answered `/load ,si libfx 1`.
  - Checked by loading library 027 into FX 8, which read back as the preset's type straight away.
  - The desk's library order isn't the catalogue's, so presets are matched by name.

- **Snippets** (checked 25 Nov, in slot 99, deleted afterwards): the filters (`/-show/showfile/snippet/NNN/eventtyp`,
  `channels`, `auxbuses`, `maingrps`) are writable and read back as written; `/save ,sis snippet 99 <name>` answers
  `/save ,si snippet 1` and the name and `hasdata` read back; `/load ,si snippet 99` answers `/load ,si snippet 1`;
  `/delete ,si snippet 99` empties the slot and clears its filters.
- **Meters** (checked 25 Nov): `/meters ,s /meters/N` streams `/meters/N ,b` every 50 ms; the blob is a little-endian
  count then floats, with 70 values in bank 0, 49 in bank 2 and 82 in bank 4, as Maillot lists. In bank 2, values
  25-48 (gain reduction) read 1.0 when nothing is compressed. With the TB-3 sent to the Sampler: ch 7-8 at bank 0
  [6-7], **pre-fader** (they read with ch 7's fader at -∞), bus 11-12 at bank 0 [58-59] and bank 2 [10-11], and XLR
  out 1-2 at bank 4 [40-41], as the trace expects. Switched to the P-6, aux out 1-2 read at bank 4 [72-73]. The
  switch itself (XLR out 1-2 off, aux out 1-2 on bus 11-12, both buses renamed "P-6") read back in full, and so did
  switching back. With ch 7-8 and the main fader up, the main mix read at bank 2 [22-23]. Every meter the trace uses
  is now confirmed.
- Every address the app reads (3,194 of them, the new ones included) answers. Once, the very first packets of a
  freshly launched app were refused by macOS's Local Network check; the next launches connected straight away.

More in the spec's "Day-one answers".
