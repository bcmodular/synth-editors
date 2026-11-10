// A repeatable pseudo-random number in 0–1 for each k, so textures (crackle, hiss, grains) don't flicker.
export function noise(k: number): number {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
