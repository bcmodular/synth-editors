// Package the app with electron-builder (config: "build" in package.json), as the TB-3 app does. Installers go to
// release/, or to SP404_RELEASE_DIR when set: on a Mac whose Documents folder syncs with iCloud, signing fails inside
// it ("resource fork, Finder information, or similar detritus not allowed"), so point it elsewhere, e.g.
// SP404_RELEASE_DIR=/tmp/sp404-release. Extra arguments go to electron-builder (e.g. --win for the Windows installer).
import { spawnSync } from "node:child_process";

const out = process.env.SP404_RELEASE_DIR ?? "release";
const args = ["electron-builder", "--publish", "never", `-c.directories.output=${out}`, ...process.argv.slice(2)];
const r = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
