// Small drawings of the JV's LFO waveforms, for icon buttons: TRI, SIN, SAW, SQR, TRP (trapezoid), S&H, RND (random,
// smoothed) and CHS (chaos), in a 20 × 12 box.

const PATHS: Record<string, string> = {
  TRI: "M1 6 L5.5 1 L14.5 11 L19 6",
  SIN: "M1 6 Q5.5 -4 10 6 T19 6",
  SAW: "M1 11 L10 1 V11 L19 1 V11",
  SQR: "M1 11 V1 H10 V11 H19 V1",
  TRP: "M1 11 L4 1 H8 L12 11 H16 L19 1",
  "S&H": "M1 8 H5 V2 H9 V10 H13 V4 H17 V7 H19",
  RND: "M1 7 C4 1 6 1 8 6 S12 11 14 5 S18 3 19 6",
  CHS: "M1 6 L3 2 L5 9 L7 3 L9 11 L11 5 L13 1 L15 8 L17 4 L19 10",
};

export function WaveIcon({ shape }: { shape: string }) {
  return (
    <svg className="wave-icon" width={20} height={12} viewBox="0 0 20 12" aria-hidden>
      <path d={PATHS[shape] ?? ""} />
    </svg>
  );
}
