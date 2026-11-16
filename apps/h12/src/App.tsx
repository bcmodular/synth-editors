// The H12 target switcher. So far: the read-only H12 check (docs/h12-spec.md, build order step 1) and the Launchkey
// clock test (step 2). Neither writes to the H12.

import { ClockTestPanel } from "./clock/ClockTestPanel";
import { useClockTest } from "./clock/useClockTest";
import { HubStatus } from "./hub/HubStatus";
import { useHub } from "./hub/useHub";
import { useMidi } from "./midi/useMidi";

export function App() {
  const midi = useMidi();
  const { state, recheck } = useHub(midi);
  const clock = useClockTest(midi);
  return (
    <main>
      <HubStatus state={state} recheck={recheck} />
      <ClockTestPanel test={clock} />
    </main>
  );
}
