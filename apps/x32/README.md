# X32 chat control

Plain-language routing and effect changes on the Behringer X32 Rack, over OSC. The plan and build order are in
[docs/x32-spec.md](../../docs/x32-spec.md).

**Status:** phase 1. The app connects to the desk, subscribes to its notifications (`/xremote`, renewed every 8 s),
reads `/info` and says when the desk isn't reachable. Each time the desk becomes reachable it reads every address the
app uses (names, links, sends, inserts, FX feeds and output patches) and shows the **Rig panel**: sources and their
sends, destinations and where they go, device returns (a bus and a channel with the same name), FX slots and their
roles, spare (unnamed) channels, and anything odd. Nothing is written to the desk yet.

## Running it

```bash
npm run dev:x32                                  # the app; type the desk's address into the X32 Rack panel
npm run fake:x32                                 # a fake desk on 127.0.0.1:10023, seeded with the studio rig
X32_HOST=127.0.0.1:10023 npm run dev:x32         # the app pointed at the fake
npm run test:e2e:x32                             # Playwright against the fake (never reaches the real desk)
X32_HOST=<desk IP> X32_CAPTURE=1 npm run test:x32  # read-only check on the real desk, keeping the traffic
```

`X32_CAPTURE=1` writes every OSC packet in and out to `captures/` in the app's data folder
(`~/Library/Application Support/X32 Chat Control/`), to compare the fake with the real desk on day one.

## Day-one answers

Not answered yet: see "Day-one questions" in the spec.
