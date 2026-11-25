# X32 chat control — implementation plan

App: `apps/x32` in this repo. Its own Electron app, shaped like `apps/h12`. Repo conventions in CLAUDE.md
take precedence over anything here.

Type plain-language requests such as "route S-1 to the P-6 input" or "add a synced delay as an insert on the TD-3", and
the app makes the routing and effect changes on the Behringer X32 Rack over OSC. It is for setup and routing changes, so
there's no clicking through X32-Edit. Faders, mutes and live send moves stay in X32-Edit (on a laptop or iPad).

This plan replaces `x32-chat-control-spec.md` (the first draft). The main change: **the X32 is the source of truth for
what is there now.** Names, stereo links, sends, inserts, FX slots and output patches are all read from the desk, so a
rename in X32-Edit is picked up straight away.

The addendum `x32-chat-control-addendum.md` (22 Nov) adds two features, merged in below: **setting the desk up from a
rig file** (the desired state, diffed against the desk and applied like `terraform plan` / `apply`) and **tracing a
signal** through the desk. The two don't conflict: the rig file says how the desk *should* be set up and is only read
by the setup and drift features. Everything else, the chat included, still reads the desk, so a change made by hand
works at once and shows up as drift until it's applied or written back into the rig file.

## Context

- **Mixer:** Behringer X32 Rack, firmware 4.x (user routing), on the local network.
- **Other clients:** X32-Edit on a laptop or iPad runs at the same time. This app must work alongside it.
- **Rig:** `apps/x32/rig/studio.json` describes how the desk *should* be set up. The app reads how it *is* set up.
- **Tempo bridge:** not built yet. It's built in this app (phase 5), reading
  "Nome II Clock" itself. CoreMIDI lets the H12 app's Launchkey forwarder read the same port at the same time.
- **Reference:** Patrick-Gilles Maillot, "Unofficial X32/M32 OSC Remote Protocol", and his X32 emulator for testing
  without the desk. Every OSC address in this plan is a starting point, to check against that document and the real
  desk.

## Assumptions to prove first

Assumption 1's reads were proven on 22 Nov (`npm run test:x32`: X32RACK, firmware 4.15, every address answered in
under a second). Its write half and assumption 2 were proven by the first setup apply (phase 2), with X32-Edit open.

The whole idea rests on these. If either had failed, the work done against the fake would have been thrown away, which
was the accepted cost of starting before the desk arrived.

1. **Same calls as X32-Edit.** OSC over UDP port 10023: `/info` answers, `/ch/01/config/name` reads back, and a send
   level written from the app changes on the desk.
2. **Runs alongside X32-Edit.** With it connected, a send changed from the app shows up in X32-Edit, and a fader moved
   in X32-Edit reaches the app through `/xremote` notifications (renewed every 8 s; the desk drops a client after 10 s).

## One-off setup on the desk (manual, in X32-Edit)

The app finds the rig from names, so the desk needs names that follow one rule.

1. **Name every source channel after its device:** ch 1 "Volca Kick", ch 9 "TR-8S", aux 1 "P-6", aux 3 "S-1",
   aux 5 "TD-3-MO", aux 6 "King Rat", and so on (12 characters at most). Name both sides of a stereo pair the same.
2. **Name every bus that feeds one device after that device, exactly as its return channel is named:** bus 9
   "King Rat" to match ch 4. This is what lets the loop guard work without a list (below). A **shared bus** feeds one of
   several devices at a time: bus 11-12, the "Sampler" in the rig file, goes to the SP-404, Koala or P-6, whichever
   output it's patched to (the rig file's `targets`, the first being the default; the others' outputs are off). On the
   desk it's **named after the device it feeds now** (changed 22 Nov), so the mixer shows where it goes and guard 1
   works by name as for any device bus. Switching it rewrites its name with its outputs; "the Sampler" still finds it.
3. **Name the effect buses after their effect** (bus 1 "Reverb", bus 3 "Delay", bus 5 "FX 3", bus 7 "FX 4": buses 1-8
   feed FX 1-4). They have no same-named channel, so they're never mistaken for a device.
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

A plan that breaks one is rejected with a reason, not
just warned about. All are derived from the desk.

1. **A channel is never sent to a bus with the same name** (a device's own return to its own feed). This covers ch 4
   → bus 9 (King Rat) with one rule. For the shared Sampler bus, the device is the target its output is patched to
   (from the rig file), so while it goes to the SP-404, ch 15-16 are never sent to it; switching the target to a device
   whose return is already sent to the bus is refused too.
2. **An FX return is never sent to the bus that feeds its own FX slot.**
3. **A send effect slot is never retyped or used as an insert.** That keeps FX 1 (reverb) and FX 2 (delay) safe while
   they're fed by buses 1-2 and 3-4. To free one, stop its bus feed in X32-Edit.
4. **Never touched by the chat:** main bus, monitor section, preamp gains, phantom power, scene safes, network and
   MIDI settings, and user routing for anything but a spare channel.

Guards live in `core/guards.ts`, one pure function per rule, with tests. Only `core/applier.ts` writes to the desk, and
it refuses any address outside an allowed list, the way `switcher.ts` does on the H12. There are two lists:

- **Chat list:** sends, inserts, FX type/source/parameters, spare-channel routing.
- **Setup list** (set up from rig file only): also names, colours, icons, links, tap points, output patches, input
  and card routing, bus master faders, and scene save. Never phantom power, preamp gain, channel or main faders,
  network, the main and monitor sections, or scene safes. Bus masters were added on 22 Nov: they came from the factory
  at −∞, and FX inputs and bus outputs are taken after the master, so the reverb and every outboard feed were silent. Guards 1–3 apply to setup plans too.

## Plans, apply, read-back, undo

- Every intent tool returns a **plan**: a list of `{address, from, to}` plus a plain-English summary. Nothing is
  written while planning.
- **Applied straight away:** plans that only add or change sends.
- **Confirmed first:** plans that switch any send off, change an insert or an FX type, move user routing, or touch more
  than one destination. The chat shows the summary with Apply / Cancel.
- **Read-back:** after applying, read every written address back and compare. Report the first mismatch. Skip writes
  that already match.
- **Undo:** each applied plan goes on an undo stack with its `from` values. "Undo that" (or the Undo button) applies the
  reverse plan, also read back. If a value has changed since (someone moved it in X32-Edit), say so and ask before
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

1. Resolve "S-1" → ch 9 (9-10 linked); "P-6 input" → the Sampler, bus 11 (11-12 linked, pre-fader). It goes to the
   SP-404 (XLR out 1-2), so the plan also switches it to the P-6: XLR out 1-2 off, Aux out 1-2 ← bus 11-12.
2. Guard 1: ch 9 isn't the P-6's return, and the P-6's return (ch 11-12) isn't sent to the Sampler. OK.
3. "Route" means `replace`; "also send" means `add`. If it's unclear, ask.
4. Plan: `/auxin/03/mix/11/on` → 1, `/auxin/03/mix/11/level` → 0.75 (0 dB), the same for aux 4 unless the link mirrors
   it; then `/…/mix/11/on` → 0 for every other source with a send on bus 11.
5. Replace switches sends off, so confirm: "Send S-1 to the P-6 and stop sending TR-8S to it?"

### Worked example: "add a synced delay as an insert on the TD-3"

1. Resolve "TD-3" → ch 3 "TD-3-MO" (mono). Since the 22 Nov layout it's on a channel, so it has an insert point.
2. Pick a free slot that can hold a delay: FX 1-4 only, never a send effect. FX 4 is fed by its bus but nothing is sent
   there, so it's taken (highest first) and its feed switched off; it's fed again when the insert comes off.
3. `/fx/4/type` → Stereo Delay, `/fx/4/source/{l,r}` → off, both Factors 3/2 (dotted eighth), mix 30% (the whole signal
   passes through an insert), Time an eighth at 120 BPM until the tempo button sets it.
4. `/ch/03/insert/{sel,pos,on}` → FX 4L, post, on.
5. If it's unclear, ask first: "Insert (delay only on the TD-3, recorded on its own track) or send to the shared delay
   on FX 2 (recorded on the FX return track)?"

## Value scaling

- Faders and send levels: floats 0.0–1.0 on the X32 fader law (0.75 = 0 dB, 0.0 = −∞). `core/faderLaw.ts` converts dB
  both ways with Maillot's formula, with tests against his table.
- Effect parameters: 0.0–1.0 floats with a mapping per parameter per effect type. `core/effects.ts` holds a table per
  supported type (start with Stereo Delay, a reverb and one modulation effect). Refuse types not in the table.

## Tempo bridge

- **Source:** "Nome II Clock" through Web MIDI in the renderer (as the H12 app's clock test does). Count Timing Clock
  (`F8`, 24 per quarter), average over two beats.
- **When to send: only when asked, from a button in the UI** ("Set delays to 120 BPM"), never by itself. Changing a
  delay's time while it plays makes audible artifacts (heard 22 Nov with Tap in X32-Edit), so the app shows the clock's
  tempo and the delays' current time, and writes only on the press. The button is disabled while the tempo is still
  settling (moved by more than 0.5 BPM within the last beat). On Stop, keep the last tempo shown.
- **What it writes:** for every synced delay slot, **Time = one eighth note** (60,000 ÷ BPM ÷ 2 ms, clamped to the
  effect's range). The slot's **Factor** parameter on the desk sets the note value: 1 = eighth, 3/2 = dotted eighth,
  2 = quarter, 1/2 = sixteenth, 3 = dotted quarter. Factor is per side (L/R), so ping-pong patterns work too.
- **Synced = a delay type in the effect table.** No app state; change the Factor in X32-Edit or by chat and the bridge
  follows.
- Writes go through the applier, under the same allowed list, and are not put on the undo stack.

## Set up from the rig file

From the addendum. Configure the desk from the rig file in one go: names, routing, buses, outputs and effects. The rig
file is the desired state, the desk is the actual state, and the app applies the difference.

### The rig file

- `apps/x32/rig/studio.json`, in the repo (the device list isn't private), checked by a schema in `core/rigFile.ts`.
  It is the only description of the desired setup, and changes are reviewed as diffs.
- Per source (channel, aux in, FX return): name, colour, icon, stereo link, the socket that feeds it (input routing),
  and optional `phantom` and `gain` notes (shown as manual steps, never written).
- Per bus: name, colour, link, tap point (pre for the sampler feeds 7-12, post otherwise), and `notes` for the device
  it feeds (e.g. "P-6: input monitoring must be on to hear the input"), used by the signal trace.
- `outputs`: the source of each XLR out and aux out. `fx`: type and starting parameters for slots the file defines, and
  the source bus of send effects. `inserts`. `card`: what each USB card output carries and where card inputs come in.
- Anything the file doesn't mention is left alone.

### Flow

1. **Read** every setting in scope (the setup read list: the phase 1 list plus routing, card, colours, icons, FX
   parameters and scene names).
2. **Diff** against the rig file (`core/setupPlan.ts`, pure).
3. **Plan:** changes grouped by area (routing, names, buses, outputs, FX, card), each as current → new, plus manual
   steps (phantom power, gain). Nothing to do → say so and stop.
4. **Confirm:** apply everything, or only some areas (checkboxes in the Setup panel).
5. **Back up:** save the current desk to a scene slot named with the date, before the first write.
6. **Apply** in a safe order: input routing, links, buses and outputs, FX and inserts, card routing, then names,
   colours and icons. Writes go through the applier (setup list, skip-if-equal, guards).
7. **Read back** every written value and report the first mismatch.
8. **Save** the result as the "Studio base" scene, so it can be restored without the app.

The addendum asks to mute the main mix during routing changes. That conflicts with "never touch the main bus", so the
plan shows **"turn the monitor level down"** as a manual step instead when it changes the routing of anything feeding
the main mix. (Flagged; change it if muting by the app is wanted after all.)

**Drift check:** the same diff without applying: what on the desk differs from the rig file. It can be applied,
ignored, or written back into the rig file (a diff to review).

### Tools

| Tool | Does |
|---|---|
| `planFromRig(areas?)` | Read, diff and return the plan, with manual steps. Writes nothing |
| `applyPlan(planId, areas?)` | Back up, apply, read back and save "Studio base" |
| `checkDrift()` | List differences between desk and rig file in plain terms |

They're the Setup panel's buttons first; the chat gets them in the chat phase.

## Trace signal

From the addendum. Find why audio isn't getting from a source to a destination by following it through the desk.

- **Path** (from the desk's current state, with device notes from the rig file): socket → input routing → channel
  input (meter) → gate / dynamics → insert → mute, mute groups, DCA, fader (meter) → send on/level → bus mute and fader
  (meter) → output patch → output (meter). For the main mix it ends at the main LR assignment and main fader.
- **Static check (`checkPath`):** read every setting on the path and list anything that blocks the signal by itself:
  channel or bus muted, fader or send at −∞, send off, mute group or DCA muted, output patched elsewhere, insert on an
  empty or bypassed slot, not assigned to main LR, gate threshold above any likely level, input routing pointing at the
  wrong socket. Offer the fix as a plan (normal confirm, undo and guards).
- **Live check (`traceSignal`):** ask the user to play the source, subscribe to `/meters` for the stages on the path,
  sample for a few seconds, and report the first stage below about −60 dBFS with the settings there and just before.
- **Outside the desk:** no level at the channel input → the cable, the socket in the rig file, the source's volume (and
  any phantom or gain note). Level at the output but nothing heard → the destination's `notes` from the rig file.
- **Safety:** never raise gain, switch on phantom power or unmute the main mix as part of a fix without asking.

| Tool | Does |
|---|---|
| `checkPath(source, destination)` | Static check of the settings along the path. Writes nothing |
| `traceSignal(source, destination, seconds?)` | Live meter trace; the first silent stage and the likely cause |

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
  doesn't cover it. The key is kept in the macOS Keychain as a generic password, service "X32 Chat Control", account "anthropic-api-key". The main process
  reads it at start with `security find-generic-password -s "X32 Chat Control" -a anthropic-api-key -w` and passes it
  to `new Anthropic({ apiKey })`; it never reaches the renderer, the config file, the chat log or the repo. No key in
  the Keychain → the chat panel says how to add one and the rest of the app works without it.
- **Cost:** Haiku, the cached system prompt and tools, and `max_tokens` kept small. The chat log records tokens
  per request, and the chat panel shows the running total for the session.
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

0. **Scaffold and OSC core (done):** the `apps/x32` scaffold (copy of the H12 shell), the UDP relay, `core/osc.ts`,
   `client.ts`, `cache.ts`, `addresses.ts`, `faderLaw.ts`, and `e2e/fakeX32.ts` seeded with an early version of the studio rig.
   A capture switch in the relay (`X32_CAPTURE=1`, or a folder) that writes every OSC message in and out.
1. **Read path and Rig panel (done, checked on the desk 22 Nov):** connect, `/info`, `/xremote` renewal, read
   everything in the table above (about 2,270 addresses, under a second), `rig.ts`, and the **Rig panel**. Acceptance
   tests 7, 8 and 10 against the fake. Addresses the desk doesn't answer are listed, not treated as errors.
2. **Set up from the rig file (done 22 Nov: applied to the desk, which matches the rig file; backup in scene 1, Studio base in scene 3):** the rig file written and reviewed; `rigFile.ts`, the
   setup read list, `setupPlan.ts` (diff by area, manual steps), `applier.ts` (setup list, skip-if-equal, read-back),
   backup and "Studio base" scenes, and a **Setup panel** with the plan, area checkboxes and Apply; then the drift
   check. The first apply, with X32-Edit open, is also the coexistence test. Addendum tests 1–5.
3. **Sends without chat (done 22 Nov, against the fake):** `guards.ts` (checked on the desk as the plan would leave it;
   only new loops are refused), `planner.ts` (sendTo, removeSend, includeEffects, undoPlan; a shared bus's target
   name switches its outputs), `operator.ts` (apply or hold for Apply, chat allowed list, undo stack), and a **Sends
   panel**. Acceptance tests 2–4 and 6 without the model (`e2e/sends.e2e.ts`).
4. **Chat (built 22 Nov, against the fake and a scripted model):** the Claude relay (Keychain key, Haiku 5.5, effort
   low, automatic prompt caching), `agent.ts`, `tools.ts` (get_state, send_to, remove_send, include_effects, undo),
   `rigSummary.ts`, the chat panel with plan summaries, Apply / Cancel and Undo (told to the model with the next
   message), the running cost, and the chat log. Acceptance tests 1, 3, 4 and 6 by chat (`e2e/chat.e2e.ts`). The
   prompt check (`npm run prompt-check:x32`, 7 phrases, about $0.004 a run) passes on Haiku 5.5 after one prompt fix
   (22 Nov: a plain "send" means add, and a possible loop goes to the tool, so the guard explains it). The rig file
   check is a tool too since 24 Nov (`check_rig`: what differs, by area); applying stays in the Setup panel. The prompt
   check has 14 phrases now (about $0.016 a run), all passing on 24 Nov.
5. **Inserts and effects (built 22 Nov, against the fake and a scripted model):** `effects.ts` (type names for FX 1-4
   and 5-8; parameter tables for HALL, PLAT, DLY and CRS from docs/x32-osc-reference.md §6), `fxPlanner.ts` (insertFx,
   removeInsert, setFxParam, setFxType), guard 3 in `guards.ts`, the chat tools, and type names and parameters in the
   Rig panel and the model's view of the desk. Acceptance test 9, and test 5 without the tempo. Choices made:
   - Only effects with a dry/wet mix go in as inserts (DLY, CRS); a reverb is used by sending to its bus.
   - An insert takes a free FX 1-4 slot: one not fed from a bus first, then one fed by a bus nothing is sent to, highest
     first (so FX 4 before the Delay). Its feed is switched off, and put back from the rig file when the insert comes off.
   - A delay goes in at 30% mix, stereo, both factors 3/2 (dotted eighth), Time 250 ms (an eighth at 120 BPM) until
     the tempo button sets it. Its Time can't be set by chat (the bridge owns it).
   - The applier never puts two steps in one batch, so a type change is read back before its parameters are written
     (the desk resets them), and effect parameters read back within 0.02 (the desk rounds them).
   - Spare-channel user routing isn't needed: every source is on a channel since the 22 Nov layout, and ch 21-32
     are the Ableton returns, so there are no spare channels.
   - Parameter tables since added: 3TAP and 4TAP (22 Nov), and the reverbs AMBI, RPLT, ROOM, CHAM, VREV, VRM, GATE and
     RVRS (24 Nov), so the studio's Vintage Room can be tuned. Not yet: the modulation and dynamics types, and FX types
     in the rig file.
   - **FX presets (22 Nov):** the desk's FX library holds 54 presets (`/-libs/fx/001-054/name`). A catalogue of them
     (name, type code, slots, a description and tags, written by Claude from each preset's settings) is in
     `apps/x32/rig/fx-presets.json`: they're Behringer's standard presets. The fake desk's library holds them in the
     real desk's order (`e2e/studio.ts`).
     The chat finds presets by sound (`find_presets`) and loads one (`load_preset`) with `/load ,sii libfx <index>
     <slot 0-7>` (Maillot, printed p. 51), matched to the library by name (index = library number − 1), then reads the
     slot's type back until it's the preset's. Into a slot, the slot's bus feed is written again afterwards; onto a
     channel, the preset goes in as an insert in a free slot (FX 5-8 first for presets that fit there). Guard 3, in
     spirit: a send effect only takes a preset of the same kind (the Reverb stays a reverb), and a slot fed by a bus
     named for a kind ("Reverb", "Delay") keeps that kind even with nothing sent to it; FX 3 and FX 4 take anything. A preset load always waits
     for Apply and isn't on the undo stack (the app doesn't keep the slot's 64 parameters).
6. **Tempo bridge (built 22 Nov, against the fake with a test clock):** `tempo.ts` (tempo over two beats of MIDI clock,
   settled once it held within 0.5 BPM for a beat, the last tempo kept after Stop; the plan that sets every synced
   delay's Time), `useTempoBridge` (Web MIDI, "Nome II Clock" by default, the input remembered), and a **Tempo panel**
   with the delays, their times now and after, and the one button. Acceptance test 5's tempo part (`e2e/tempo.e2e.ts`).
   Choices made:
   - Synced delays are Stereo Delay (DLY), 3-Tap (3TAP) and Rhythm Delay (4TAP), from Maillot's tables. DLY's Time is
     an eighth note (Factor L/R set the note values, as above); 3TAP and 4TAP's Time is a quarter, because their base
     tap plays at Time itself and Factors A-C set the other taps.
   - The press writes at once (it is the confirmation) and isn't on the undo stack (the next press sets it again).
   - The chat can't set a synced delay's Time; it points to the button.
   - **A delay can run free (24 Nov):** each delay in the Tempo panel has a "follows the tempo" box, kept in the app's
     storage. The button leaves an unticked one alone, and the chat may set its Time.
   - Checked 22 Nov on this Mac: the panel finds "Nome II Clock" and reads 120.0 BPM. The writes haven't been tried on
     the desk yet. The e2e tests feed a test clock (`window.x32TestClock`), and Web MIDI is denied in the tests.
7. **Trace signal:** `checkPath` **built 24 Nov** (`pathCheck.ts`, the chat's `check_path`; against the fake): from the
   desk's settings, it follows a source to a bus, a shared bus's target or the main mix and lists what stops it: no
   socket routed to a channel, mutes and engaged mute groups, the fader and DCAs when the send is post-fader, the send,
   the bus's mute and master, and where the bus goes; with the target's notes from the rig file. It writes nothing; the
   model offers the fixes its tools can make. Addendum test 6. `traceSignal` **built 24 Nov** too (`meters.ts`,
   `trace.ts`, the chat's `trace_signal`; against the fake): it subscribes to the meter banks along the path, keeps the
   peaks for 1-8 s while the source plays, and names the first silent stage (below -60 dBFS), with the settings check's
   reasons. Tests 7-8 (no level at the channel; a silent bus). Checked 25 Nov: the banks stream as expected (70, 49, 82
   values), and with the TB-3 playing into the Sampler the channel (pre-fader), bus and XLR out positions are right.
   The aux outs too, with the Sampler switched to the P-6 (bank 4 [72-73]). Not yet checked: the main mix (bank 2 [22]). The desk tests are in `docs/x32-test-checklist.md`.
8. **Scenes and snippets (built 24 Nov, against the fake):** `show.ts` and the chat's `recall` and `save_snippet`.
   Recall a scene or snippet by name; save the routing (sends, output patches, names; optionally inserts and FX) as a
   snippet, by setting its filters (`/-show/showfile/snippet/NNN/eventtyp` and the strip bitmaps) and then
   `/save ,sis snippet <n> <name>`. Loads wait for Apply; none of these are undoable; the desk is re-read after a
   load. Checked on the desk 25 Nov (slot 99, deleted afterwards): the filters are writable and read back, and save,
   load and delete all answer 1.
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
- **The fake desk:** built from Maillot's document, seeded with an early version of the studio rig (names, links, sends, FX 1 and
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
- **Coexistence:** no exclusive lock; X32-Edit keeps working.
- **Secrets:** the API key comes from `ant auth login` or the Keychain, never from code, config files in the repo or
  the chat log (this repo is public). The model name is in the app's settings.
- **Latency:** a model round trip takes a second or two. Fine for setup, not for performance moves.

## Acceptance tests

1. With X32-Edit connected, "route S-1 to the P-6 input" changes the sends, and X32-Edit shows the
   change within a second.
2. "Route S-1 to the P-6" after "route TR-8S to the P-6" asks before switching off the TR-8S send, and afterwards only
   S-1 reaches the P-6.
3. "Also send the TB-3 to the P-6" keeps the S-1 send.
4. "Send the P-6 to the P-6" is refused with a reason (guard 1).
5. "Add a synced delay as an insert on the TD-3" leaves the TD-3 heard once, through the delay at about 25–30% mix, and
   after a tempo change on the Nome II, pressing the tempo button sets the delay time to match (nothing changes before
   the press).
6. "Undo that" restores every value the last plan changed, confirmed by read-back.
7. A fader moved in X32-Edit shows up in `getState` without a re-read.
8. Losing the network shows "desk not reachable" and sends nothing; reconnecting re-reads the state.
9. Asking to change the type of FX 1 or FX 2 is refused while buses 1-2 and 3-4 feed them (guard 3).
10. Renaming bus 11 in X32-Edit changes what the chat can resolve without restarting the app.

From the addendum (set up from rig file and trace signal):

11. `planFromRig()` on a desk reset to defaults lists every name, route, bus, output, FX and card setting in the rig
    file, plus manual steps for phantom power and gain.
12. Applying the plan, then running `planFromRig()` again, shows no changes and performs no writes.
13. A backup scene is saved before the first write, and "Studio base" after the last. Loading the backup scene restores
    the previous state.
14. Phantom power and preamp gain are never written, even if the rig file asks for them.
15. Renaming a channel in X32-Edit makes `checkDrift()` report it.
16. With the S-1's send to the P-6 bus muted, `checkPath("S-1", "P-6")` reports the muted send without needing audio.
17. With the S-1's channel unplugged, `traceSignal` reports no level at the channel input and points to the cable or
    source, not the desk.
18. With a DCA muted, `traceSignal` stops at the fader stage and names the DCA.
19. With the P-6's bus output patched to the wrong aux out, `traceSignal` stops at the output stage and names the
    patch.

## Day-one answers (22 Nov, X32 Rack firmware 4.15; also in apps/x32/README.md)

- **Aux inputs have no insert point.** So the TD-3 insert needs aux in 5 moved onto a spare channel with user routing.
- **Tap point:** one per bus pair, at `/…/mix/<odd bus>/type` (no `type` on even buses). Factory values seen: 2 and 4.
- **FX feeds:** only FX 1-4 have `/fx/N/source/{l,r}`; FX 5-8 are insert-only. Source value n = mix bus n (factory:
  FX 1-4 fed by buses 13-16).
- **Output patches:** `/outputs/{main,aux}/NN/src`, value 4-19 = mix bus 1-16, 1-2 = main L/R (factory: XLR outs 1-6
  carry buses 1-6, 7-8 the main mix; aux outs 0 = off).
- **Sends:** every send is on at −∞ from the factory, so the rig counts a send only when it's on *and* raised.
- **FX returns** are `fxrtn/01`…`08`, linked in pairs from the factory (FX returns 1-4 in stereo pairs).
- **Routing (fw 4):** block routing at `/config/routing/{IN,CARD,OUT,…}/<range>` and user routing at
  `/config/userrout/in/01-32` and `/out/01-48` (all 0 from the factory). Value meanings: from Maillot's document.
- **FX library loads:** `/load ,sii libfx <library number − 1> <slot − 1>`, answered `/load ,si libfx 1`; checked by
  loading library 027 into FX 8, which read back as the preset's type straight away.
- **`/node`** works; the reply comes back on the address `node`, as one string. Scene names are at
  `/-show/showfile/scene/NNN/name` (001 answers, 100 doesn't).
- Still open: Stereo Delay's Factor values, scene save over OSC, card routing values, whether a linked pair mirrors a
  send written to one side, and how many `/xremote` clients the desk takes.

## Open questions for later

- **Channel layout (decided 22 Nov, in the rig file):** the most played sources, the P-6, S-1, TD-3 and King Rat
  return included, are on ch 1-16 through user routing; Koala, Mic and Guitar on ch 17-20; Ableton 1-12 on ch 21-32
  (12 returns; XLR 15-16 have no channel). The aux strips are muted and unnamed, so
  nothing is heard twice. On channels, these sources get inserts and post-fader direct outs, which settles the TD-3
  insert and the card outputs (ch 1-20, FX returns 1-8 and the main mix: 30 of the 31 free internal outputs).
- **Buses (changed 22 Nov):** buses 1-8 feed FX 1-4 (Reverb, Delay, FX 3, FX 4), bus 9 the King Rat, bus 11-12 the
  Sampler; bus 10 and 13-16 are spare, unnamed and white like the aux strips. Synths are green, Ableton yellow.
- **Decided 24 Nov:** the chat creates snippets as well as recalling them (phase 8); a delay can opt out of the tempo
  bridge (phase 6); no Launchpad Pro pads for scene recall.
