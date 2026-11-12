// LED brightness profiles, cycled from a button (as on the TouchOSC panels): how bright idle pads, lit pads and
// pressed pads are, as a fraction of full colour.
import type { Rgb } from "./index";

export interface Brightness {
  idle: number; // a pad that is there but not selected
  on: number; // a selected pad (active slot, held button)
  press: number; // a pad while it's held
  emptyPress: number; // an empty pad while it's held (grey)
}

export const BRIGHTNESS_PROFILES = {
  "very dim": { idle: 0.08, on: 1, press: 0.88, emptyPress: 0.2 },
  night: { idle: 0.18, on: 1, press: 0.88, emptyPress: 0.35 },
  normal: { idle: 0.3, on: 1, press: 0.88, emptyPress: 0.45 },
  day: { idle: 0.45, on: 1, press: 0.88, emptyPress: 0.55 },
} as const satisfies Record<string, Brightness>;

export type ProfileName = keyof typeof BRIGHTNESS_PROFILES;
export const PROFILE_ORDER = Object.keys(BRIGHTNESS_PROFILES) as ProfileName[];
export const DEFAULT_PROFILE: ProfileName = "night";

export const profileNamed = (name: string | null): ProfileName =>
  PROFILE_ORDER.includes(name as ProfileName) ? (name as ProfileName) : DEFAULT_PROFILE;

export function nextProfile(name: ProfileName): ProfileName {
  return PROFILE_ORDER[(PROFILE_ORDER.indexOf(name) + 1) % PROFILE_ORDER.length]!;
}

// A full colour (0–63 a side) at a brightness.
export const scaleRgb = ([r, g, b]: Rgb, k: number): Rgb => [r * k, g * k, b * k];
