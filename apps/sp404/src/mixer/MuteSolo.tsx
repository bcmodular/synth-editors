// MUTE and SOLO side by side, for a pad's strip or a bank's. SOLO silences everything not soloed (pads across the
// project, or the other banks).

export interface MuteSoloProps {
  name: string; // "A1", "BANK A"
  mute: boolean;
  solo: boolean;
  onMute: () => void;
  onSolo: () => void;
}

export function MuteSolo({ name, mute, solo, onMute, onSolo }: MuteSoloProps) {
  return (
    <div className="ms">
      <button className={`mute ${mute ? "on" : ""}`} aria-pressed={mute} aria-label={`Mute ${name}`} onClick={onMute}>
        MUTE
      </button>
      <button className={`solo ${solo ? "on" : ""}`} aria-pressed={solo} aria-label={`Solo ${name}`} onClick={onSolo}>
        SOLO
      </button>
    </div>
  );
}
