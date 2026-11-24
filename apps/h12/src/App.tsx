// The H12 target switcher (docs/h12-spec.md): the H12 check, target switching and sync modes (the only parts that
// write to the H12), a MIDI monitor, the clock forwarder for the Launchkey's arpeggiator, and a read-only dump.

import { ClockPanel } from "./clock/ClockPanel";
import { useClockForward } from "./clock/useClockForward";
import { DumpPanel } from "./dump/DumpPanel";
import { useDump } from "./dump/useDump";
import { HubStatus } from "./hub/HubStatus";
import { useHub } from "./hub/useHub";
import { useMidi } from "./midi/useMidi";
import { MonitorPanel } from "./monitor/MonitorPanel";
import { useMonitor } from "./monitor/useMonitor";
import { SyncPanel } from "./sync/SyncPanel";
import { useSync } from "./sync/useSync";
import { TargetsPanel } from "./targets/TargetsPanel";
import { useTargets } from "./targets/useTargets";

export function App() {
  const midi = useMidi();
  const { state, recheck } = useHub(midi);
  const monitor = useMonitor(midi);
  const targets = useTargets(state, monitor.note);
  const sync = useSync(state, monitor.note);
  const dump = useDump(state);
  const clock = useClockForward(midi);
  return (
    <main>
      <HubStatus state={state} recheck={recheck} />
      <TargetsPanel t={targets} />
      <SyncPanel s={sync} />
      <MonitorPanel m={monitor} />
      <ClockPanel c={clock} />
      <DumpPanel d={dump} />
    </main>
  );
}
