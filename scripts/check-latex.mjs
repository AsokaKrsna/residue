// Proves the LaTeX claims: the chat-paste fixture fails to compile, the cleaned version compiles.
// Needs pdflatex on PATH. Usage: npm run check:latex
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";

const out = "LLM-Workspace/out";
mkdirSync(out, { recursive: true });
execSync("npx vitest run tests/compile.test.ts", { stdio: "inherit" });
copyFileSync("tests/fixtures/chat-paste.tex", `${out}/dirty.tex`);
copyFileSync(`${out}/chat-paste.clean.tex`, `${out}/clean.tex`);
let ok = true;
for (const name of ["dirty", "clean"]) {
  const r = spawnSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", `${name}.tex`], { cwd: out, encoding: "utf8" });
  if (r.error) { console.log("pdflatex not found; skipped."); process.exit(0); }
  const first = (r.stdout.match(/^! .*$/m) || ["no errors"])[0];
  console.log(`${name}.tex: exit ${r.status}, ${first}`);
  if (name === "dirty" && r.status === 0) ok = false;
  if (name === "clean" && r.status !== 0) ok = false;
}
console.log(ok ? "LaTeX check passed: dirty fails, clean compiles." : "LaTeX check FAILED.");
process.exit(ok ? 0 : 1);
