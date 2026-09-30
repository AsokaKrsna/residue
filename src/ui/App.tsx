import { useEffect, useState } from "preact/hooks";
import { EditorPane } from "./EditorPane";
import { Inspector } from "./Inspector";
import { RulesPanel } from "./RulesPanel";
import { StatusBar, Toast, TopBar } from "./Chrome";
import { openDropped, showRules } from "./store";
import { SupportPanel, ThanksNudge } from "./Support";

export function App() {
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; setDropping(true); };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDropping(false); };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDropping(false);
      if (e.dataTransfer?.files.length) void openDropped(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return (
    <div class={`app${dropping ? " dropping" : ""}`}>
      <TopBar />
      <main class={`main${showRules.value ? "" : " no-rules"}`}>
        {showRules.value ? <RulesPanel /> : <div />}
        <EditorPane />
        <Inspector />
      </main>
      <StatusBar />
      <Toast />
      <ThanksNudge />
      <SupportPanel />
    </div>
  );
}
