// Start the Vite dev server, then launch Electron pointed at it.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const server = await createServer({ configFile: new URL("../vite.config.ts", import.meta.url).pathname });
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("Vite dev server has no local URL");

const electron = spawn(require("electron"), ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});
electron.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
