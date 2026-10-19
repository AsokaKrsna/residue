import { describe, expect, it } from "vitest";
import { EditorState, type Transaction } from "@codemirror/state";
import { history, isolateHistory, undo, redo } from "@codemirror/commands";
import { cleanAll, defaultConfig, scan, RULES } from "../src/engine/engine";
import { moderateSelection, selectedRules } from "../src/engine/bulk";
import { RegionIndex } from "../src/engine/regions";
import { journal, appliedRulesField, setAppliedRules } from "../src/ui/journal";
import { editingPrompt } from "../src/ui/handoff";
import corpus from "./fixtures/selective-corpus.json";

const wording = selectedRules(["sty.concise"], true);
describe("selected cleanup", () => {
  it("Moderate leaves prose suggestions and broad conversions untouched", () => {
    const s = "# Heading\n\nIn order to evaluate, we delve into results. I hope this helps!\n";
    expect(cleanAll(s, defaultConfig("txt")).text).toBe(s);
    expect(moderateSelection().includeWording).toBe(false);
  });
  it("never enables unrelated or disabled rules, across every pass", () => {
    const cfg = defaultConfig("txt");
    const t = "a\u200Bb\u00A0c  d\n";
    const res = cleanAll(t, cfg, [], selectedRules(["inv.zw"]));
    expect(res.text).toBe("ab\u00A0c  d\n");
    expect(Object.keys(res.applied)).toEqual(["inv.zw"]);
    cfg.enabled["inv.zw"] = false;
    expect(cleanAll(t, cfg, [], selectedRules(["inv.zw"])).text).toBe(t);
  });
  it("tracks ignored fixes after positions shift in subsequent passes", () => {
    const text = "a\u200Bb\u00A0c\n";
    expect(cleanAll(text, defaultConfig("txt"), [{ ruleId: "sp.nbsp", start: 3 }]).text).toBe("ab\u00A0c\n");
  });
  it("requires explicit wording opt-in and respects casing", () => {
    const t = "In order to test, act due to the fact that it works. AT THIS POINT IN TIME, stop in the event that it fails.\n";
    expect(cleanAll(t, defaultConfig("txt"), [], selectedRules(["sty.concise"])).text).toBe(t);
    expect(cleanAll(t, defaultConfig("txt"), [], wording).text).toBe("To test, act because it works. NOW, stop if it fails.\n");
  });
  it("keeps wording inside quotes, citations, math, links, and code", () => {
    const t = '"in order to" and “due to the fact that” [in order to](https://example.org) $\\text{in order to}$ `in order to` (In order to, 2024).\n';
    expect(cleanAll(t, defaultConfig("md"), [], wording).text).toBe(t);
  });
  it("does not change partial words, certainty, negation, or numeric claims", () => {
    const t = "Within order toad habitat, X may not reduce risk by 3.14 mg at 25 C [12].\n";
    expect(cleanAll(t, defaultConfig("txt"), [], wording).text).toBe(t);
  });
  it("protects multiline and block quotations and reference-style links", () => {
    const t = '"We act\nin order to test."\n\n> In order to quote.\n\n[In order to link][source]\n';
    expect(cleanAll(t, defaultConfig("md"), [], wording).text).toBe(t);
  });
  it("rejects prose spans crossing a protected region", () => {
    const t = "not only the $x$ result but also the baseline.\n";
    expect(scan(t, defaultConfig("tex")).findings.filter((f) => f.ruleId === "sty.negpar")).toHaveLength(0);
  });
  it("checks half-open overlaps including fully contained protected regions", () => {
    const idx = new RegionIndex([{ type: "math", start: 5, end: 10 }]);
    for (const span of [[0, 6], [8, 12], [0, 15], [6, 7], [5, 5]]) expect(idx.intersects(...span as [number, number])).toBe(true);
    expect(idx.intersects(0, 5)).toBe(false);
    expect(idx.intersects(10, 12)).toBe(false);
  });
  it("does not edit code-block prose during default technical cleanup", () => {
    const t = '```\nx = “value”\n```\n';
    expect(cleanAll(t, defaultConfig("tex")).text).toBe(t);
  });
  it("keeps technical Unicode math repairs working", () => {
    expect(cleanAll("$x ≤ y$\n", defaultConfig("tex")).text).toContain("\\leq");
  });
  it("is stable after applying allowed wording", () => {
    const cfg = defaultConfig("txt");
    const once = cleanAll("In order to test, act.\n", cfg, [], wording);
    expect(cleanAll(once.text, cfg, [], wording).passes).toHaveLength(0);
  });
  it("supports an application-level refusal guard", () => {
    const res = cleanAll("In order to test.\n", defaultConfig("txt"), [], wording, () => false);
    expect(res.passes).toHaveLength(0);
    expect(res.refused).toBe(1);
  });
  it("counts a refused wording edit only once across technical passes", () => {
    const result = cleanAll("a\u200Bb\u00A0c In order to test.\n", defaultConfig("txt"), [],
      selectedRules([...moderateSelection().ruleIds, "sty.concise"], true), (f) => f.ruleId !== "sty.concise");
    expect(result.refused).toBe(1);
    expect(result.text).toBe("ab c In order to test.\n");
  });
  it("never bulk-applies unrelated review-only suggestions", () => {
    const cfg = defaultConfig("txt");
    const text = "We delve into robust results.\n";
    expect(cleanAll(text, cfg, [], selectedRules(RULES.map((r) => r.id), true)).text).toBe(text);
  });
});

describe("undo-aware rule journal", () => {
  it("restores the complete cleanup and its rule counts in one undo/redo", () => {
    let state = EditorState.create({ doc: "In order to test.\n", extensions: [history(), journal] });
    const target = { get state() { return state; }, dispatch: (tr: Transaction) => { state = tr.state; } };
    state = state.update({ changes: { from: 0, to: 11, insert: "To" }, effects: setAppliedRules.of({ "sty.concise": 1 }), annotations: isolateHistory.of("full") }).state;
    expect(state.doc.toString()).toBe("To test.\n");
    undo(target);
    expect(state.doc.toString()).toBe("In order to test.\n");
    expect(state.field(appliedRulesField)).toEqual({});
    redo(target);
    expect(state.field(appliedRulesField)).toEqual({ "sty.concise": 1 });
  });
  it("handoff is a plain string containing the selected passage and preservation instructions", () => {
    const prompt = editingPrompt("Risk may not rise [12].");
    expect(prompt).toContain("negation, uncertainty");
    expect(prompt).toContain("Risk may not rise [12].");
    expect(prompt).not.toContain("http");
  });
});

describe("public/synthetic evaluation corpus", () => {
  it("contains 60 labeled samples and validates controls and deterministic cleanup", () => {
    expect(corpus.cases).toHaveLength(60);
    for (const c of corpus.cases) {
      const cfg = defaultConfig("txt");
      const res = cleanAll(c.input, cfg);
      if (c.expected !== null) expect(res.text, c.id).toBe(c.expected);
      expect(cleanAll(res.text, cfg).text, c.id).toBe(res.text);
    }
  });
});
