import { render } from "preact";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/bricolage-grotesque";
import "./ui/styles.css";
import { App } from "./ui/App";
import { applyTheme, restoreSession } from "./ui/store";

applyTheme();
render(<App />, document.getElementById("app")!);
void restoreSession();
