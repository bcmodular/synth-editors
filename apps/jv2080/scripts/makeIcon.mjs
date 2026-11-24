// Renders build/icon.svg to build/icon.png (1024 × 1024, transparent corners) in headless Chrome, with the editor's
// Archivo font. electron-builder makes the Mac and Windows icons from the PNG; the dev window uses it too.
// Run from the repo root: node apps/jv2080/scripts/makeIcon.mjs
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const dir = fileURLToPath(new URL("../build/", import.meta.url));
const fontFile = require.resolve("@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2");
const font = `data:font/woff2;base64,${(await readFile(fontFile)).toString("base64")}`; // a blank page can't load file:
const svg = await readFile(`${dir}icon.svg`, "utf8");
const html = `<!doctype html><style>
  @font-face { font-family: "Archivo"; src: url("${font}") format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
  html, body { margin: 0; background: transparent; }
</style>${svg}`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(html);
await page.evaluate(async () => {
  await document.fonts.load('800 290px "Archivo"');
  await document.fonts.ready;
});
await page.screenshot({ path: `${dir}icon.png`, omitBackground: true });
await browser.close();
console.log(`wrote ${dir}icon.png`);
