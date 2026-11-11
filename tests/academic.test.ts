import { describe, expect, it } from "vitest";
import { cleanAll, defaultConfig, scan } from "../src/engine/engine";
import { RegionIndex, scanMarkdown } from "../src/engine/regions";

// Original, hand-authored regression probes, not an authorship benchmark.
const hits = (text: string, id: string, ft: "txt" | "md" | "tex" = "txt") => {
  const cfg = defaultConfig(ft);
  cfg.enabled = Object.fromEntries(Object.keys(cfg.enabled).map((key) => [key, key === id || key.startsWith("guard.")]));
  return scan(text, cfg).findings.filter((f) => f.ruleId === id);
};
const filler = "The analysis compares measured outcomes across the study groups and reports the observed differences with their uncertainty. ";
const cluster = "In today's rapidly evolving world, this method plays a pivotal role in analysis. The possibilities are endless. " + filler.repeat(7);

describe("experimental academic review checks", () => {
  it("reports three pattern families with examples and no replacement", () => {
    const fs = hits(cluster, "sty.cluster");
    expect(fs).toHaveLength(1);
    expect(fs[0].note).toContain("3 pattern families");
    expect(fs[0].kind).toBe("review");
    expect(fs[0].suggestions).toEqual([]);
    expect(scan(cluster, defaultConfig("txt")).findings.some((f) => f.ruleId === "sty.cluster")).toBe(true);
  });
  it("does not escalate short text, punctuation or one repeated family", () => {
    for (const text of ["In today's rapidly evolving world, this plays a pivotal role. The possibilities are endless.",
      ("This plays a pivotal role in analysis. " + filler).repeat(8),
      ("We leverage robust estimates—these reflect uncertainty. " + filler).repeat(8)]) {
      expect(hits(text, "sty.cluster")).toEqual([]);
    }
  });
  it("does not merge evidence across paragraph boundaries", () => {
    const text = ["In today's rapidly evolving world. ", "This plays a pivotal role. ", "The possibilities are endless. "].map((s) => s + filler.repeat(7)).join("\n\n");
    expect(hits(text, "sty.cluster")).toEqual([]);
  });
  it.each(["Studies show improved outcomes.", "Research suggests a relationship.", "Experts agree on this approach."])("reviews unnamed sources: %s", (text) => {
    expect(hits(text, "sty.attribution")).toHaveLength(1);
  });
  it.each(["Studies show improved outcomes [12].", "Research suggests a relationship (Smith et al., 2024).", "Experts agree on this approach \\cite{smith}."])("respects recognized citations: %s", (text) => {
    expect(hits(text, "sty.attribution", "tex")).toEqual([]);
  });
  it("reports repeated full sentences, with whitespace normalization", () => {
    expect(hits(filler + "\n\n" + filler.replaceAll(" ", "  ") + "\n\n" + filler, "sty.duplicate")).toHaveLength(3);
    expect(hits(filler.repeat(2), "sty.duplicate")).toEqual([]);
  });
  it("excludes quoted rhetorical examples", () => {
    expect(hits('"' + cluster + '"', "sty.cluster")).toEqual([]);
    expect(hits('“Studies show better outcomes.”', "sty.attribution")).toEqual([]);
    expect(hits("> Studies show better outcomes.\n", "sty.attribution", "md")).toEqual([]);
  });
  it("does not automatically rewrite any new pattern", () => {
    const cfg = defaultConfig("txt");
    cfg.enabled = Object.fromEntries(Object.keys(cfg.enabled).map((id) => [id, ["sty.cluster", "sty.attribution", "sty.duplicate"].includes(id)]));
    expect(cleanAll(cluster + "\nStudies show an effect.\n" + filler.repeat(3), cfg).passes).toEqual([]);
  });
  it("bounds repeated-sentence decorations in large documents", () => {
    expect(hits(filler.repeat(1000), "sty.duplicate")).toHaveLength(20);
  });
  it("protects conventional reference sections but resumes at the next heading", () => {
    const text = "# References\nStudies show an effect.\n# Discussion\nStudies show another effect.\n";
    const fs = hits(text, "sty.attribution", "md");
    expect(fs).toHaveLength(1);
    expect(fs[0].start).toBe(text.lastIndexOf("Studies"));
  });
});

describe("CommonMark fence protection", () => {
  it.each([
    "   ````text\nStudies show something.\n```\nstill code\n`````\n",
    "  ~~~~text\nStudies show something.\n~~~~~\n",
    "```text\nStudies show something.\n",
    "```text\r\nStudies show something.\r\n```\r\n",
  ])("protects long, indented, unclosed and CRLF fences", (text) => {
    const idx = new RegionIndex(scanMarkdown(text).filter((r) => r.type === "verbatim"));
    expect(idx.has(text.indexOf("Studies"))).toBe(true);
    expect(hits(text, "sty.attribution", "md")).toEqual([]);
  });
  it("resumes scanning prose after a valid closer", () => {
    const text = "  ````text\ncode\n`````\nStudies show something.\n";
    expect(hits(text, "sty.attribution", "md")).toHaveLength(1);
  });
});
