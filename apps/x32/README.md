# X32 chat control

Plain-language routing and effect changes on the Behringer X32 Rack, over OSC. The plan and build order are in
[docs/x32-spec.md](../../docs/x32-spec.md).

**Status:** phase 5, effects and inserts by chat. The app connects to the desk, reads it, and shows four panels:

- **Chat:** type a request ("route S-1 to the P-6", "also send the TB-3 to the reverb at -6"). The model plans it
  through the same tools as the Sends panel; plans that switch anything off, or switch the Sampler to another device,
  wait for Apply. It can also put a delay or chorus on a channel as an insert, take it off, change an effect's
  parameters ("give the reverb a 3 second tail"), and retype a slot that isn't a send effect in use. It knows the
  desk's FX library by sound ("an 80s gated reverb on the TR-8S") when there's a preset catalogue: put it at
  `fixtures/local/x32-fx-presets.json` or `fx-presets.json` in the data folder (it stays out of the repo). The header shows the model and the session's tokens and cost. Every request is logged (below).
- **Sends:** pick a source and a destination by name and Send, Send only this (switches the others off) or Stop
  sending. Sending to SP-404 Mk2, Koala or P-6 switches the shared Sampler bus to that device. Undo reverses the last
  applied plan. Plans that would loop a device's return into its own feed are refused (`src/core/guards.ts`).

- **Set up from rig file:** *Check against rig file* reads the desk and lists every setting that differs from
  [rig/studio.json](rig/studio.json), grouped by area, with the steps only you can do (phantom power, gains). It writes
  nothing. *Apply* writes the ticked areas: it saves the desk to a dated backup scene first, writes routing first and
  names last, reads every value back, stops at the first mismatch, and saves "Studio base" when everything read back.
  Running *Check* again afterwards should say the desk matches. Run it any time to see drift.
- **Rig:** what the app works out from the desk's names: sources and sends, destinations and outputs, device returns,
  FX slots, spare channels, and anything odd.

The chat and the Sends panel write only sends, channel inserts, effect types, parameters and FX feeds (never a send
effect's type), and the Sampler's output patches (`src/core/operator.ts`,
`chatAllowed`).

To undo a setup, load the backup scene on the desk (X32-Edit, Scenes). The app never touches phantom power, preamp
gain, sends, faders, the main and monitor sections, network or MIDI settings, scene safes or effect types
(`src/core/applier.ts`, `SETUP_ALLOWED`).

## Running it

```bash
npm run dev:x32                                  # the app; it finds the desk on first run (or: Find desk)
npm run fake:x32                                 # a fake desk on 127.0.0.1:10023, seeded with the studio rig
X32_HOST=127.0.0.1:10023 npm run dev:x32         # the app pointed at the fake
npm run test:e2e:x32                             # Playwright against the fake (never reaches the real desk)
X32_HOST=192.168.0.138 X32_CAPTURE=1 npm run test:x32  # read-only checks on the real desk, keeping the traffic
```

The chat needs an Anthropic API key in the macOS Keychain (the main process reads it; it never reaches the page, the
config or the log). Add it once, then press New chat:

```bash
security add-generic-password -s "X32 Chat Control" -a anthropic-api-key -w
```

The model is `claude-haiku-5-5` unless `model` is set in `config.json` in the data folder. The chat log is one JSON
Lines file per day in `~/Library/Application Support/X32 Chat Control/logs/`: what was typed, the tool calls, what
happened to each plan, tokens and latency. Tests never call the model: they script it (`X32_FAKE_CLAUDE=1`). `npm run prompt-check:x32` runs a few phrases against the
real model and an in-memory desk (about $0.004; nothing reaches the X32).

`X32_CAPTURE=1` writes every OSC packet in and out to `captures/` in the app's data folder
(`~/Library/Application Support/X32 Chat Control/`), to compare the fake with the real desk on day one.

If the desk is found but "Desk not reachable" says macOS refused the connection, Local Network access is off for
the terminal the app was started from. With iTerm2 it can stay refused even when iTerm is ticked in System Settings →
Privacy & Security → Local Network: turn it off and on, quit iTerm, run `pkill -f iTermServer` (its helper outlives
it; this closes every iTerm session), and start again.

## Findings on the real desk

X32 Rack at 192.168.0.138 on the home network, firmware 4.15, checked 22 Nov 2026 (`npm run test:x32`, read-only):

- Every address the app reads answers; a full read takes under a second.
- Aux inputs have no insert point. FX 1-4 can be fed from buses (`/fx/N/source`); FX 5-8 are insert-only.
- The send tap point is per bus pair, at the odd bus (`/…/mix/01/type`, not `/mix/02/type`).
- From the factory every send is on at −∞, so a send only counts as active when it's on and raised.
- Output patch values: 4-19 = mix bus 1-16, 1-2 = main L/R. FX source n = mix bus n.
- Routing is at `/config/routing/…` (blocks) and `/config/userrout/in|out/NN` (user routing); `/node` reads work and
  answer on the address `node`.

More in the spec's "Day-one answers".
