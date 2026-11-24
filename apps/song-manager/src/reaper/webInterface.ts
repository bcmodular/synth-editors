// Reaper's web interface protocol: GET /_/cmd;cmd;… answers with lines of tab-separated tokens, and strings in
// them have newline, tab and backslash escaped as \n, \t and \\ (main.js in Reaper's reaper_www_root).

/** Undoes Reaper's escaping, left to right. main.js's own simple_unescape replaces \t and \n before \\, which
 *  corrupts JSON escapes such as \\n (an escaped backslash before an n), so it isn't copied here. */
export function unescapeValue(value: string): string {
  return value.replace(/\\([nt\\])/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : "\\"));
}

export function parseResponse(text: string): string[][] {
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));
}

/** The value of one EXTSTATE line in a response, or undefined when the key is unset (Reaper answers ""). */
export function extState(lines: string[][], section: string, key: string): string | undefined {
  const line = lines.find((l) => l[0] === "EXTSTATE" && l[1] === section && l[2] === key);
  const value = line ? unescapeValue(line.slice(3).join("\t")) : "";
  return value === "" ? undefined : value;
}

export function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const getExtState = (section: string, key: string) => `GET/EXTSTATE/${section}/${key}`;
export const setExtState = (section: string, key: string, value: string) =>
  `SET/EXTSTATE/${section}/${key}/${encodeURIComponent(value)}`;
