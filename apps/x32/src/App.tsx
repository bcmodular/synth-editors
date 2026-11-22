// X32 chat control (docs/x32-spec.md): the connection to the desk, the chat, sends, setting the desk up from the rig
// file, and the rig the app works out from the desk.

import { ChatPanel } from "./chat/ChatPanel";
import { useChat } from "./chat/useChat";
import { DeskPanel } from "./desk/DeskPanel";
import { useDesk } from "./desk/useDesk";
import { useOperator } from "./plans/useOperator";
import { RigPanel } from "./rig/RigPanel";
import { useRig } from "./rig/useRig";
import { SetupPanel } from "./setup/SetupPanel";
import { useSetup } from "./setup/useSetup";
import { SendsPanel } from "./sends/SendsPanel";

export function App() {
  const desk = useDesk();
  const rig = useRig(desk.cache);
  const setup = useSetup(desk);
  const plans = useOperator(desk);
  const chat = useChat(desk, plans);
  const connected = desk.link === "connected";
  return (
    <main>
      <DeskPanel desk={desk} />
      <ChatPanel chat={chat} connected={connected} />
      <SendsPanel rig={rig} plans={plans} connected={connected} />
      <SetupPanel desk={desk} setup={setup} />
      <RigPanel rig={rig} />
    </main>
  );
}
