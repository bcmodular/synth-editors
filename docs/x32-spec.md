# X32 chat control — implementation plan

App: `apps/x32` in this repo (not started). Its own Electron app, shaped like `apps/h12`. Repo conventions in CLAUDE.md
take precedence over anything here.

Type plain-language requests such as "route S-1 to the P-6 input" or "add a synced delay as an insert on the TD-3", and
the app makes the routing and effect changes on the Behringer X32 Rack over OSC. It is for setup and routing changes, so
there's no clicking through X32-Edit. Faders, mutes and live send moves stay on the X-Touch.

This plan replaces `x32-chat-control-spec.md` (the first draft). The main change: **the X32 is the source of truth.**
There is no rig file. Names, stereo links, sends, inserts, FX slots and output patches are all read from the desk, so a
rename in X32-Edit is picked up straight away.

## Context

- **Mixer:** Behringer X32 Rack, firmware 4.x (user routing), on the home network. Expected Monday 23 November 2026;
  30-day return window from Thomann, so the two assumptions below must be proven in the first week.
- **Other clients:** X32-Edit on the Mac and the X-Touch (XCTL over Ethernet) run at the same time. This app must work
  alongside both.
- **Rig and routing:** the Claude Doc "Studio routing plan: X32 Rack and X-Touch"
  (https://claude.ai/artifact/9EFM4yoc6BZSYW3f4NXwNq). It describes how the desk *should* be set up. The app reads how
  it *is* set up.
- **Tempo bridge:** not built yet (open item in the routing plan). It's built in this app (phase 5), reading
  "Nome II Clock" itself. CoreMIDI lets the H12 app's Launchkey forwarder read the same port at the same time.
- **Reference:** Patrick-Gilles Maillot, "Unofficial X32/M32 OSC Remote Protocol", and his X32 emulator for testing
  without the desk. Every OSC address in this plan is a starting point, to check against that document and the real
  desk.

## Assumptions to prove first

The whole idea rests on these. Prove them on day one (phase 6) before building anything more. If either fails, stop
and report: the work done against the fake is then thrown away, which is the accepted cost of starting before the desk
arrives (and the desk goes back within the return window).

1. **Same calls as X32-Edit.** OSC over UDP port 10023: `/info` answers, `/ch/01/config/name` reads back, and a send
   level written from the app changes on the desk.
2. **Runs alongside X32-Edit and the X-Touch.** With both connected, a send changed from the app shows up in both, and
   a fader moved on the X-Touch reaches the app through `/xremote` notifications (renewed every 8 s; the desk drops a
   client after 10 s).

## One-off setup on the desk (manual, in X32-Edit)

The app finds the rig from names, so the desk needs names that follow one rule.

1. **Name every source channel after its device:** ch 1 "Volca Kick", ch 9 "TR-8S", aux 1 "P-6", aux 3 "S-1",
   aux 5 "TD-3-MO", aux 6 "King Rat", and so on (12 characters at most). Name both sides of a stereo pair the same.
2. **Name every bus that feeds a device after that device, exactly as its return channel is named:** bus 7 "SP-404 Mk2"
   to match ch 7, bus 9 "Koala" to match ch 5, bus 11 "P-6" to match aux 1, bus 1 "King Rat" to match aux 6. This is
   what lets the loop guard work without a list (below).
3. **Name the effect buses after their effect** (bus 3 "Reverb", bus 5 "Delay", bus 13 "FX 3"). They have no same-named
   channel, so they're never mistaken for a device.
4. **Pick sensible icons:** the model reads them as hints ("drums" → the channel with the drum icon).
5. Leave spare channels (ch 15–16) **unnamed**: an unnamed channel is what the app treats as spare.

Phase 1's rig panel shows what the app has worked out from the names, so mistakes are easy to spot.

## What the app reads from the desk

On connect it reads everything below (by `/node` batch reads if they're faster), then keeps it current from `/xremote`
notifications. The cache is the only state.

| What | OSC (to check) | Used for |
|---|---|---|
| Channel, aux in, FX return, bus config | `/ch/NN/config/{name,icon,color,source}`, same under `/auxin`, `/fxrtn`, `/bus` | Names the model sees; matching buses to return channels |
| Stereo pairs | `/config/chlink`, `/config/auxlink`, `/config/buslink`, `/config/fxlink` | Writing one or both sides; mono/stereo in plans |
| Sends | `/ch/NN/mix/MM/{on,level,pan,type}` and the same under `/auxin`, `/fxrtn` | Current routing; tap point (pre/post) |
| Inserts | `/ch/NN/insert/{on,pos,sel}` | Which FX slots are in use as inserts |
| FX slots | `/fx/N/type`, `/fx/N/source/{l,r}`, `/fx/N/par/NN` | Effect type, which bus feeds it, parameters, delay Factor |
| Physical outputs | `/outputs/main/NN/src`, `/outputs/aux/NN/src` | Showing where a bus goes ("XLR out 1-2") |
| User routing (fw 4) | `/config/userrout/…` | Moving an aux input onto a spare channel |
| Scenes, snippets | `/-show/showfile/scene/NNN/name`, `…/snippet/NNN/name` | Recall by name |

### The rig, derived

`core/rig.ts` turns the cache into a `Rig` with no file involved:

- **Sources:** every named channel, aux in and FX return, with its icon, colour and stereo link.
- **Destinations:** every named bus, with its link, tap point, the output it's patched to, and the FX slot it feeds
  (from `/fx/N/source`).
- **Device returns:** a bus and a channel with the same name (case-insensitive, whitespace trimmed) are one device: the
  bus feeds it, the channel is where it comes back.
- **FX slots:** a slot is a **send effect** if its source bus has any send switched on to it, and an **insert** if any
  channel's insert points at it. Otherwise it's **free**.
- **Spare channels:** unnamed input channels.
- **Synced delays:** every slot whose type is a delay in the effect table (below).

Aliases aren't stored anywhere. The model gets the names and icons in its tool results and resolves "drums" or "the
404" itself. When it isn't sure, it asks.

## Loop guards (enforced in code)

From the routing plan's "One-time settings and loop guards". A plan that breaks one is rejected with a reason, not
just warned about. All are derived from the desk.

1. **A channel is never sent to a bus with the same name** (a device's own return to its own feed). This covers ch 7-8
   → bus 7-8, ch 5-6 → bus 9-10, aux 1-2 → bus 11-12 and aux 6 → bus 1 with one rule.
2. **An FX return is never sent to the bus that feeds its own FX slot.**
3. **A send effect slot is never retyped or used as an insert.** That keeps FX 1 (reverb) and FX 2 (delay) safe while
   they're fed by buses 3-4 and 5-6. To free one, stop its bus feed in X32-Edit.
4. **Never touched:** main bus, monitor section, preamp gains, scene safes, network and MIDI settings, and user routing
   for anything but a spare channel.

Guards live in `core/guards.ts`, one pure function per rule, with tests. Only `core/applier.ts` writes to the desk, and
it refuses any address outside an allowed list (sends, inserts, FX type/source/parameters, spare-channel routing), the
way `switcher.ts` does on the H12.

## Plans, apply, read-back, undo

- Every intent tool returns a **plan**: a list of `{address, from, to}` plus a plain-English summary. Nothing is
  written while planning.
- **Applied straight away:** plans that only add or change sends.
- **Confirmed first:** plans that switch any send off, change an insert or an FX type, move user routing, or touch more
  than one destination. The chat shows the summary with Apply / Cancel.
- **Read-back:** after applying, read every written address back and compare. Report the first mismatch. Skip writes
  that already match.
- **Undo:** each applied plan goes on an undo stack with its `from` values. "Undo that" (or the Undo button) applies the
  reverse plan, also read back. If a value has changed since (someone moved it on the X-Touch), say so and ask before
  overwriting.
- **No writes while disconnected.** Queue nothing; say the desk isn't reachable.

## Intent tools

All take names as the desk shows them, never channel numbers. All return a plan or state.

| Tool | Does |
|---|---|
| `getState(names?)` | Sends, inserts and FX settings for the named sources or destinations, in plain terms, plus the rig summary |
| `sendTo(source, destination, mode, levelDb?)` | Switch a send on. `mode`: `replace` (switch off every other source on that bus) or `add`. Default 0 dB |
| `removeSend(source, destination)` | Switch a send off |
| `includeEffects(destination, on)` | Also send the effect returns and the King Rat return to a sampler's bus, for sampling with effects |
| `insertFx(source, effectType, params?)` | Put an effect on a source as an insert, using a free slot (moving an aux input to a spare channel first if aux channels have no insert point) |
| `removeInsert(source)` | Switch the insert off and free the slot |
| `setFxParam(destinationOrSlot, param, value)` | Change one effect parameter. Refuses the delay time of a synced slot (the bridge owns it) |
| `recall(kind, name)` | Recall a scene or snippet by name |
| `undo()` | Reverse the last applied plan |

`setSync` from the first draft is gone: a delay's note value lives on the desk (see Tempo bridge).

### Worked example: "route S-1 to the P-6 input"

1. Resolve "S-1" → aux 3 (aux 3-4 linked); "P-6 input" → bus 11 (11-12 linked, pre-fader, Aux out 1-2).
2. Guard 1: aux 3 isn't named "P-6". OK.
3. "Route" means `replace`; "also send" means `add`. If it's unclear, ask.
4. Plan: `/auxin/03/mix/11/on` → 1, `/auxin/03/mix/11/level` → 0.75 (0 dB), the same for aux 4 unless the link mirrors
   it; then `/…/mix/11/on` → 0 for every other source with a send on bus 11.
5. Replace switches sends off, so confirm: "Send S-1 to the P-6 and stop sending TR-8S to it?"

### Worked example: "add a synced delay as an insert on the TD-3"

1. Resolve "TD-3" → aux 5 (mono).
2. If aux channels have no insert point (day-one check): plan to route aux in 5 onto the first spare channel (ch 15)
   with user routing, switch aux 5's main and bus sends off so it isn't heard twice, and name ch 15 "TD-3-MO". Naming it
   is the rig change, so nothing else needs updating. It also gives the TD-3 a direct out for Ableton.
3. Pick a free slot that can hold a delay (expected: FX 1–4 only; FX 4 is free when nothing sends to bus 15-16).
4. `/fx/4/type` → Stereo Delay, `/fx/4/source/{l,r}` → off, Factor → dotted eighth, mix about 25–30% (the whole signal
   passes through an insert).
5. `/ch/15/insert/{sel,pos,on}` → FX 4L, post, on.
6. If it's unclear, ask first: "Insert (delay only on the TD-3, recorded on its own track) or send to the shared delay
   on FX 2 (recorded on the FX return track)?"

## Value scaling

- Faders and send levels: floats 0.0–1.0 on the X32 fader law (0.75 = 0 dB, 0.0 = −∞). `core/faderLaw.ts` converts dB
  both ways with Maillot's formula, with tests against his table.
- Effect parameters: 0.0–1.0 floats with a mapping per parameter per effect type. `core/effects.ts` holds a table per
  supported type (start with Stereo Delay, a reverb and one modulation effect). Refuse types not in the table.

## Tempo bridge

- **Source:** "Nome II Clock" through Web MIDI in the renderer (as the H12 app's clock test does). Count Timing Clock
  (`F8`, 24 per quarter), average over two beats.
- **When to send:** only when the tempo has moved by more than 0.5 BPM and held for a beat (avoids pitch wobble and
  bursts during a ramp). On Stop, keep the last time.
- **What it writes:** for every synced delay slot, **Time = one eighth note** (60,000 ÷ BPM ÷ 2 ms, clamped to the
  effect's range). The slot's **Factor** parameter on the desk sets the note value: 1 = eighth, 3/2 = dotted eighth,
  2 = quarter, 1/2 = sixteenth, 3 = dotted quarter. Factor is per side (L/R), so ping-pong patterns work too.
- **Synced = a delay type in the effect table.** No app state; change the Factor in X32-Edit or by chat and the bridge
  follows.
- Writes go through the applier, under the same allowed list, and are not put on the undo stack.

## Architecture

```
Renderer (React, TS)                              Main process (main.cjs, thin)
  chat/      ChatPanel, useChat (agent loop) ─┐     udp relay: one dgram socket ⇄ IPC
  desk/      useDesk (connection, cache)      ├──►  claude relay: holds the API key, calls messages.create
  rig/       RigPanel (what the app worked out)│    config: desk IP, model (app settings, not code)
                                               │    chat log: appends JSON lines to the data folder
  tempo/     useTempoBridge (Web MIDI clock)   │
  core/      pure logic + vitest ─────────────┘
```

As in the H12 app, the logic is in the renderer and in TypeScript, so it can be unit-tested and scored. The main
process only does what a renderer can't:

- **UDP relay:** a `dgram` socket. `x32:send(bytes)` and `x32:message(bytes)` over IPC. OSC encoding stays in
  `core/osc.ts`.
- **Claude relay:** `claude:create(request)` → `client.messages.create(...)` with `@anthropic-ai/sdk`, so the API key
  never reaches the renderer. The key and model come from the app's config file.

### Core modules (`src/core/`, each with tests beside it)

| Module | Does |
|---|---|
| `osc.ts` | Encode and decode OSC messages and bundles (strings, ints, floats, blobs); `/node` text parsing |
| `client.ts` | Request/answer matching, timeouts, `/xremote` renewal, change events. Talks through an injected transport |
| `cache.ts` | Address → value, filled by reads and notifications |
| `addresses.ts` | Typed address builders (`send(src, bus).level`), so no hand-built strings elsewhere |
| `faderLaw.ts`, `effects.ts` | Value scaling |
| `rig.ts` | Cache → `Rig` (above) |
| `guards.ts` | The loop guards |
| `planner.ts` | Intent → plan (one function per tool) |
| `applier.ts` | The only writer: allowed list, skip-if-equal, write, read back, undo stack |
| `tools.ts` | Tool definitions for the model (JSON schemas, `strict: true`) and dispatch to the planner |
| `agent.ts` | The tool-use loop, against an injected `create()` so tests can script the model |
| `tempo.ts` | Clock → BPM smoothing, send decisions, Time from BPM |

### Agent loop

- Messages API with a manual tool-use loop in `core/agent.ts` (not Managed Agents: the tools have to run here, on the
  LAN, next to the desk). Loop while `stop_reason === "tool_use"`, run each tool, return every `tool_result` in one
  user message, mark failures `is_error`. Check for `refusal` before reading content.
- **Model:** from config, default `claude-haiku-5-5` (about $0.001–0.004 a request, mostly cached). If the prompt check
  shows it misreading the harder requests (inserts, ambiguous names), switch the setting to `claude-sonnet-5-5` or
  `claude-opus-5-5`. On Opus, set `output_config.effort: "low"` so replies come back in a second or two, and turn on
  server-side `fallbacks: "default"` (it needs a beta flag). `tool_choice: auto` on all of them.
- **Billing and key:** API usage is billed per token through the Claude Console; a Claude Pro or Max subscription
  doesn't cover it. The main process creates the client with no arguments, so it finds the login from `ant auth login`
  (in `~/.config/anthropic/`). The alternative is a key typed into the app's settings and kept in the macOS Keychain
  with Electron's `safeStorage`. Either way, nothing is in the repo.
- **Other providers:** not planned. `agent.ts` calls an injected `create()`, so another provider could be added behind
  it later without touching the tools, guards or applier.
- **System prompt:** fixed and cached. It covers what the app is for, "ask, don't guess", that names come from the desk,
  and that plans needing confirmation are shown to the user, not applied. The current rig summary goes in the first
  user turn of each conversation, and `getState` refreshes it, so the cached prefix doesn't change when the desk does.
- **Confirmation** is in code, not left to the model: the applier holds a plan that needs it until the user presses
  Apply.
- **Chat history:** one conversation per app run. "New chat" clears it.

### Chat log

Every request is logged, so the common ones can later become buttons and panels (built here in Claude Code), and so
the prompt check has real phrases to test.

- **Where:** one JSON Lines file per day in the app's data folder
  (`~/Library/Application Support/X32 Chat Control/logs/2026-11-21.jsonl`), never in the repo, which is public. The
  README gives the path so Claude Code can read it.
- **One line per request:** time, what you typed, the model and its tool calls (name and arguments), the plan (summary
  and addresses, `from` → `to`), what happened to it (applied straight away, confirmed, cancelled, refused by a guard,
  undone later), the read-back result, errors, round trips, tokens and latency. Undo links back to the request it
  undid.
- **Not logged:** the API key, the system prompt and tool definitions (they're in the code), and the full desk state.
  A short hash of the rig is logged instead, so a change of names shows up.
- **Signals worth looking for later:** phrases that come back often (→ a button), cancels and undos straight after a
  plan (→ the model misread the request, or the confirmation is in the wrong place), and requests that needed a
  follow-up question (→ an ambiguous name on the desk).
- `core/chatLog.ts` builds the entries (pure, tested). The main process only appends lines to the file, behind one IPC
  call.

## Build order

Each phase leaves the app runnable and ends with its tests passing, like the H12 build order.

Everything that doesn't depend on a hardware fact is built before the desk arrives, against `e2e/fakeX32.ts`. The
facts that are still unknown (the day-one questions below) are kept in two places only, so day one changes little:
OSC addresses in `core/addresses.ts`, and desk behaviour as switches on the fake (see "The fake desk" under Testing).
Code that depends on an unknown handles both answers, and the e2e tests run it under both.

**Before the desk (19–22 Nov, against the fake):**

0. **Scaffold and OSC core:** the `apps/x32` scaffold (copy of the H12 shell), the UDP relay, `core/osc.ts`,
   `client.ts`, `cache.ts`, `addresses.ts`, `faderLaw.ts`, and `e2e/fakeX32.ts` seeded with the routing plan's rig.
   A capture switch in the relay (`X32_CAPTURE=1`) that writes every OSC message in and out to the data folder. Check
   the codec against Maillot's emulator as a second fake.
1. **Read path and Rig panel:** connect, `/info` (show model and firmware, warn if not 4.x), `/xremote` renewal, read
   everything in the table above, `rig.ts`, and the **Rig panel**: sources, destinations, device pairs, FX slots and
   their roles, spare channels, and anything odd (a bus with no matching channel, a name used twice). Acceptance tests
   7, 8 and 10 against the fake.
2. **Sends without chat:** `guards.ts`, `planner.ts` (sendTo, removeSend, includeEffects), `applier.ts` with
   read-back and undo, driven from a small form in the Rig panel. Acceptance tests 2–4 and 6 without the model.
3. **Chat:** the Claude relay, `agent.ts`, `tools.ts`, the chat panel with plan summaries, Apply / Cancel and Undo, and
   the chat log. Uses the real model against the fake, so the system prompt and tools can be tuned, and the prompt
   check run, before day one. Acceptance tests 1–4 and 6 by chat (1 without X32-Edit).
4. **Inserts and effects:** `effects.ts` tables from Maillot's document, insertFx, removeInsert, setFxParam, and
   spare-channel user routing. Built for both answers to "do aux channels have inserts?". Acceptance test 9, and test 5
   without the tempo.
5. **Tempo bridge:** `tempo.ts`, `useTempoBridge`, Factor handling. The Nome II is here already, so this runs with the
   real clock writing to the fake. Acceptance test 5 on the fake.

**Day one (from 23 Nov, on the desk):**

6. **Proof:** `npm run test:x32` (read-only check) with capture on. Answer the day-one questions from the capture and
   the Rig panel, write them into `apps/x32/README.md`, then fix `addresses.ts`, set the fake's switches to match, and
   run `npm run check:x32-fake` (the fake's replies compared with the capture) and the e2e tests again. Then the
   coexistence test: one hand-picked send write with read-back, from a debug control (not chat), watching X32-Edit and
   the X-Touch follow, and an X-Touch fader move reaching the cache. **Stop here and report if either assumption
   fails.**
7. **Acceptance on the desk:** tests 1–10 by chat with X32-Edit and the X-Touch connected, and the prompt check
   against the real rig names.

**Later:**

8. **Scenes and snippets:** recall by name. Creating them only if the open question below says so. (Can also be built
   against the fake, once scene names are in it.)
9. **UI from the log (after a few weeks of use):** in Claude Code, read the logs, group the requests by intent, and
   build controls for the common ones, such as a sampler matrix (sources × SP-404 / Koala / P-6, one click per send)
   or one-click inserts. They call the same planner and applier as the chat, so the guards, confirmation and undo
   come for free. Frequent phrases that still go to chat can get a parser that runs before the model (free and
   instant), with the model handling the rest.

## Testing

- **Unit (vitest):** every `core/` module. The agent loop runs against a scripted `create()` that returns fixed tool
  calls, so no API calls in `npm test`.
- **E2E (Playwright, `npm run test:e2e:x32`):** `e2e/fakeX32.ts` is a UDP server in the test process holding a desk
  state (seeded from this rig), answering reads, applying writes and sending `/xremote` notifications. The app is
  pointed at it with `X32_HOST=127.0.0.1:<port>`, and `X32_FAKE_CLAUDE=1` swaps the Claude relay for scripted replies.
  As in the H12 app, tests run hidden and can never reach the real desk.
- **The fake desk:** built from Maillot's document, seeded with the routing plan's rig (names, links, sends, FX 1 and
  2 fed by buses 3-4 and 5-6, ch 15–16 unnamed). Every day-one unknown is a switch on it: aux channels with or without
  inserts, whether a send written to one side of a linked pair mirrors to the other, tap point per send or per bus
  pair, FX return numbering, which slots take delays, and how many `/xremote` clients it takes. Tests that depend on
  a switch run under each setting. The fake can also be started on its own (`npm run fake:x32`) so the dev app can
  point at it for trying the chat by hand.
- **Fake fidelity (day one):** `npm run check:x32-fake` replays the reads in a capture from the real desk against the
  fake and lists every reply that differs. Captures stay in the data folder, not the repo.
- **Chat log from the fake:** entries record `desk: "fake"` or `"real"`, so testing before day one doesn't count as use
  when the log is mined for buttons later.
- **Hardware (`npm run test:x32`):** the read-only check against the real desk, plus a send round trip that restores
  the value afterwards.
- **Prompt check (on demand, costs money):** a short list of phrases ("route S-1 to the P-6", "also send the TB-3",
  "send the P-6 to the P-6", "put a delay on the TD-3") against the real model and the fake desk, checking which tools
  it calls and what plan comes out. Run when the system prompt, the tools or the model change, not in `npm test`.
  Once the chat log has some history, add real phrases from it, using plans that were applied and not undone as the
  expected answers.

## Constraints

- **Only the allowed addresses** (applier list). No main mix, monitor, preamps, scene safes, network or MIDI settings.
- **No loops:** guards on every plan, including undo and the tempo bridge.
- **Coexistence:** no exclusive lock; X32-Edit and the X-Touch keep working.
- **Secrets:** the API key comes from `ant auth login` or the Keychain, never from code, config files in the repo or
  the chat log (this repo is public). The model name is in the app's settings.
- **Latency:** a model round trip takes a second or two. Fine for setup, not for performance moves.

## Acceptance tests

1. With X32-Edit and the X-Touch connected, "route S-1 to the P-6 input" changes the sends, and X32-Edit shows the
   change within a second.
2. "Route S-1 to the P-6" after "route TR-8S to the P-6" asks before switching off the TR-8S send, and afterwards only
   S-1 reaches the P-6.
3. "Also send the TB-3 to the P-6" keeps the S-1 send.
4. "Send the P-6 to the P-6" is refused with a reason (guard 1).
5. "Add a synced delay as an insert on the TD-3" leaves the TD-3 heard once, through the delay at about 25–30% mix, and
   the delay time follows a tempo change on the Nome II.
6. "Undo that" restores every value the last plan changed, confirmed by read-back.
7. A fader moved on the X-Touch shows up in `getState` without a re-read.
8. Losing the network shows "desk not reachable" and sends nothing; reconnecting re-reads the state.
9. Asking to change the type of FX 1 or FX 2 is refused while buses 3-4 and 5-6 feed them (guard 3).
10. Renaming bus 11 in X32-Edit changes what the chat can resolve without restarting the app.

## Day-one questions (answer in phase 6, record in apps/x32/README.md)

Each one is a switch on the fake (or an address in `addresses.ts`) until it's answered.

- Do aux input channels have an insert point? If not, the user-routing address for moving aux in 5 onto ch 15.
- Exact addresses on firmware 4.x for user routing, FX source selection, insert selection and output patching.
- Does writing a send on one side of a linked pair update both sides? Is the pan of a linked bus pair at
  `/mix/11/pan`?
- FX return numbering (`fxrtn/01`…`08` as stereo pairs; the routing plan says "FX return channels 1-4") and which slots
  can hold delays (expected 1–4).
- Stereo Delay's Factor values and parameter index; whether Factor 3/2 with Time = eighth gives a dotted eighth.
- Where the send tap point lives (per send or per bus pair).
- How many `/xremote` clients the desk takes, and whether the X-Touch counts as one.

## Open questions for later

- Should the app create snippets ("save this as TR-8S into SP-404"), or only recall them?
- Should a delay be able to opt out of the tempo bridge (e.g. a free-running delay on FX 3)? Today every delay in the
  table follows the tempo.
- Launchpad Pro pads for scene recall (routing plan) — in this app, or left to a later controller app?
