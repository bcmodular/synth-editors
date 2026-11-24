// The H12 target switcher: the H12 check (docs/h12-spec.md, build order step 1), target switching (step 3, the only
// part that writes to the H12), a MIDI monitor and the clock forwarder for the Launchkey's arpeggiator.

import { ClockPanel } from "./clock/ClockPanel";
import { useClockForward } from "./clock/useClockForward";
import { HubStatus } from "./hub/HubStatus";
import { useHub } from "./hub/useHub";
import { useMidi } from "./midi/useMidi";
import { MonitorPanel } from "./monitor/MonitorPanel";
import { useMonitor } from "./monitor/useMonitor";
import { TargetsPanel } from "./targets/TargetsPanel";
import { useTargets } from "./targets/useTargets";

export function App() {
  const midi = useMidi();
  const { state, recheck } = useHub(midi);
  const monitor = useMonitor(midi);
  const targets = useTargets(state, monitor.note);
  const clock = useClockForward(midi);
  return (
    <main>
      <HubStatus state={state} recheck={recheck} />
      <TargetsPanel t={targets} />
      <MonitorPanel m={monitor} />
      <ClockPanel c={clock} />
    </main>
  );
}
