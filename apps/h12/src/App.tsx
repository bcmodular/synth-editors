// The H12 target switcher: the H12 check (docs/h12-spec.md, build order step 1), target switching (step 3, the only
// part that writes to the H12) and the Launchkey clock test (step 2).

import { ClockTestPanel } from "./clock/ClockTestPanel";
import { useClockTest } from "./clock/useClockTest";
import { HubStatus } from "./hub/HubStatus";
import { useHub } from "./hub/useHub";
import { useMidi } from "./midi/useMidi";
import { TargetsPanel } from "./targets/TargetsPanel";
import { useTargets } from "./targets/useTargets";

export function App() {
  const midi = useMidi();
  const { state, recheck } = useHub(midi);
  const targets = useTargets(state);
  const clock = useClockTest(midi);
  return (
    <main>
      <HubStatus state={state} recheck={recheck} />
      <TargetsPanel t={targets} />
      <ClockTestPanel test={clock} />
    </main>
  );
}
