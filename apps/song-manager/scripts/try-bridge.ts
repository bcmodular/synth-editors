// Try the Reaper bridge from a terminal. See apps/song-manager/README.md.
//
//   node apps/song-manager/scripts/try-bridge.ts check
//   node apps/song-manager/scripts/try-bridge.ts ports
//   node apps/song-manager/scripts/try-bridge.ts watch
//   node apps/song-manager/scripts/try-bridge.ts demo --in "H12MIDI-Pro Port 3" --out "H12MIDI-Pro Port 2" --channel 6
//   node apps/song-manager/scripts/try-bridge.ts cleanup
//   node apps/song-manager/scripts/try-bridge.ts send '{"type":"add-marker","bar":5,"name":"Chorus"}'
//
// Options: --url http://localhost:8080 (or REAPER_URL), --auth user:password (or REAPER_AUTH), --notes 36,38

import { parseArgs } from "node:util";
import { ReaperBridge } from "../src/reaper/bridgeClient.ts";
import { checkBridge, cleanUp, describeState, listPorts, runDemo } from "../src/reaper/tryout.ts";
import type { Command } from "../src/reaper/types.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string", default: process.env.REAPER_URL ?? "http://localhost:8080" },
    auth: { type: "string", default: process.env.REAPER_AUTH },
    in: { type: "string" },
    out: { type: "string" },
    channel: { type: "string", default: "1" },
    notes: { type: "string" },
  },
});

const bridge = new ReaperBridge({ url: values.url, auth: values.auth });
const log = (line: string) => console.log(line);

async function watch(): Promise<void> {
  log(`Watching ${values.url} (Ctrl-C to stop). Arm, mute or solo something in Reaper.`);
  let last = "";
  bridge.watch(
    (snapshot) => {
      const time = new Date().toLocaleTimeString();
      const text = describeState(snapshot.state).join("\n");
      if (text !== last) log(`\n[${time}] state ${snapshot.seq}\n${text}`);
      last = text;
    },
    150,
    (error) => log(`! ${error instanceof Error ? error.message : String(error)}`),
  );
  await new Promise(() => {});
}

async function ports(): Promise<void> {
  const snapshot = await bridge.snapshot();
  if (!snapshot) throw new Error("the bridge hasn't published any state yet");
  listPorts(snapshot.state, log);
}

async function demo(): Promise<void> {
  const notes = values.notes?.split(",").map(Number);
  await runDemo(bridge, { input: values.in, output: values.out, channel: Number(values.channel), notes }, log);
  log('Done. The test track is left armed; "cleanup" deletes it.');
}

async function send(arg: string | undefined): Promise<void> {
  if (!arg) throw new Error("send needs a command as JSON");
  log(JSON.stringify(await bridge.send(JSON.parse(arg) as Command), null, 2));
}

const commands: Record<string, (arg: string | undefined) => Promise<boolean | void>> = {
  check: () => checkBridge(bridge, log),
  ports,
  watch,
  demo,
  cleanup: async () => void (await cleanUp(bridge, log)),
  send,
};

async function main(): Promise<number> {
  const [command = "check", arg] = positionals;
  const run = commands[command];
  if (!run) {
    log(`Unknown command "${command}". Use ${Object.keys(commands).join(", ")}.`);
    return 2;
  }
  return (await run(arg)) === false ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const hint = /fetch failed|ECONNREFUSED/.test(message + String((error as { cause?: unknown })?.cause))
      ? `\nNothing answered at ${values.url}. Is Reaper's web interface on (Preferences › Control/OSC/web)?`
      : "";
    console.error(`✗ ${message}${hint}`);
    process.exit(1);
  },
);
