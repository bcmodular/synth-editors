// Remembered settings (ports, audio input, views) in the app's local storage. They're a convenience,
// so a storage failure just means nothing is remembered.

export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered this time.
  }
}
