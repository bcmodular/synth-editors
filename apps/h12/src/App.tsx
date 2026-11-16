// The H12 target switcher. For now only the read-only check (docs/h12-spec.md, build order step 1): it never writes
// to the H12.

import { HubStatus } from "./hub/HubStatus";
import { useHub } from "./hub/useHub";

export function App() {
  const { state, recheck } = useHub();
  return (
    <main>
      <HubStatus state={state} recheck={recheck} />
    </main>
  );
}
