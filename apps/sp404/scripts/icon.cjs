// Render build/icon.svg to the icon files: build/icon.png (1024 px, which electron-builder turns into the Windows
// .ico), build/icon.icns (macOS, via iconutil) and public/icon.png (the window icon on Windows and Linux, and the Dock
// icon in development). Runs in Electron, which draws the SVG offscreen. Run after editing the SVG:
//   npx electron apps/sp404/scripts/icon.cjs
const { app, BrowserWindow } = require("electron");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const build = path.join(root, "build");
const SIZE = 1024;

function writeIcns(png) {
  const set = path.join(os.tmpdir(), "sp40more.iconset");
  fs.rmSync(set, { recursive: true, force: true });
  fs.mkdirSync(set);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const [scale, suffix] of [[1, ""], [2, "@2x"]]) {
      const px = String(size * scale);
      execFileSync("sips", ["-z", px, px, png, "--out", path.join(set, `icon_${size}x${size}${suffix}.png`)], { stdio: "ignore" });
    }
  }
  execFileSync("iconutil", ["-c", "icns", set, "-o", path.join(build, "icon.icns")]);
  fs.rmSync(set, { recursive: true });
}

app.dock?.hide();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE, height: SIZE, show: false, transparent: true, frame: false, useContentSize: true,
    webPreferences: { offscreen: true },
  });
  win.webContents.setFrameRate(1);
  const svg = fs.readFileSync(path.join(build, "icon.svg"), "utf8");
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`;
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
  await new Promise((r) => setTimeout(r, 300));
  const image = (await win.webContents.capturePage()).resize({ width: SIZE, height: SIZE, quality: "best" });
  const png = path.join(build, "icon.png");
  fs.writeFileSync(png, image.toPNG());
  if (process.platform === "darwin") writeIcns(png);
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.copyFileSync(png, path.join(root, "public", "icon.png"));
  console.log("Wrote build/icon.png, build/icon.icns and public/icon.png");
  app.quit();
});
