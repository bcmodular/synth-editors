import { Editor } from "./editor/Editor";
import { useJvLink } from "./link/useJvLink";

export function App() {
  const link = useJvLink();
  return <Editor link={link} />;
}
