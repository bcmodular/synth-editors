// X32 chat control (docs/x32-spec.md): the connection to the desk, setting it up from the rig file, and the rig the
// app works out from the desk. Sends and chat come next.

import { DeskPanel } from "./desk/DeskPanel";
import { useDesk } from "./desk/useDesk";
import { RigPanel } from "./rig/RigPanel";
import { useRig } from "./rig/useRig";
import { SetupPanel } from "./setup/SetupPanel";
import { useSetup } from "./setup/useSetup";

export function App() {
  const desk = useDesk();
  const rig = useRig(desk.cache);
  const setup = useSetup(desk);
  return (
    <main>
      <DeskPanel desk={desk} />
      <SetupPanel desk={desk} setup={setup} />
      <RigPanel rig={rig} />
    </main>
  );
}
