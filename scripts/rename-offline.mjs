// Renames the single-file build to residue-offline.html so it is obvious what to keep.
import { renameSync, existsSync } from "node:fs";
const from = new URL("../dist-offline/index.html", import.meta.url);
const to = new URL("../dist-offline/residue-offline.html", import.meta.url);
if (existsSync(from)) renameSync(from, to);
console.log("offline build: dist-offline/residue-offline.html");
