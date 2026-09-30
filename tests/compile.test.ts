import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { it, expect } from "vitest";
import { cleanAll, defaultConfig, scan } from "../src/engine/engine";

// Writes the cleaned fixture so scripts/check-latex.sh can compile both versions with pdflatex.
it("cleans the chat-paste fixture", () => {
  const src = readFileSync(new URL("./fixtures/chat-paste.tex", import.meta.url), "utf8");
  const res = cleanAll(src, defaultConfig("tex"));
  mkdirSync(new URL("../LLM-Workspace/out/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../LLM-Workspace/out/chat-paste.clean.tex", import.meta.url), res.text);
  const left = scan(res.text, defaultConfig("tex")).findings;
  writeFileSync(new URL("../LLM-Workspace/out/chat-paste.review.txt", import.meta.url), left.map((f) => `${f.ruleId}\t${JSON.stringify(f.orig)}\t${f.suggestions.join(" | ")}`).join("\n"));
  expect(left.every((f) => f.kind === "review")).toBe(true);
  expect(res.passes.length).toBeGreaterThan(1);
});
