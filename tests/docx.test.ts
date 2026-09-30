import { readFileSync } from "node:fs";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { DOCX_DISABLED, applyPasses, applyToDocx, loadDocx, saveDocx, type XmlEnv } from "../src/formats/docx";
import { cleanAll, defaultConfig } from "../src/engine/engine";

const env: XmlEnv = {
  parse: (xml) => new DOMParser().parseFromString(xml, "application/xml") as unknown as Document,
  serialize: (doc) => new XMLSerializer().serializeToString(doc as never),
};
const bytes = () => readFileSync(new URL("./fixtures/chat-paste.docx", import.meta.url));

describe("docx", () => {
  it("extracts text with paragraphs and cells as separate lines", async () => {
    const m = await loadDocx(bytes(), env);
    expect(m.text).toContain("Results\n");
    expect(m.text).toContain("Cell with\u200B junk\nClean cell");
    expect(m.text).toContain("\u201Chorizon gap\u201D");
  });

  it("round-trips a clean through the XML and keeps formatting and paragraphs", async () => {
    const m = await loadDocx(bytes(), env);
    const cfg = defaultConfig("txt");
    for (const id of DOCX_DISABLED) cfg.enabled[id] = false;
    const res = cleanAll(m.text, cfg);
    const cleaned = res.text;
    const refused = applyPasses(m, res.passes.map((p) => p.map((c) => ({ fromA: c.from, toA: c.to, insert: c.insert }))));
    const out = await saveDocx(m, env);
    const again = await loadDocx(out, env);
    // with structural rules off, every fix lands exactly
    expect(refused).toBe(0);
    expect(again.text).toBe(cleaned);
    expect(again.text).not.toMatch(/[\u200B\u202F\u2011\u0430]|oaicite/);
    expect(again.text).toContain('"horizon gap"');
    expect(again.text.split("\n").length).toBe(m.text.split("\n").length);
    expect(refused).toBeGreaterThanOrEqual(0);
    // the bold run is still bold, the italic run still italic
    const xml = await (await import("jszip")).default.loadAsync(out).then((z) => z.file("word/document.xml")!.async("string"));
    expect(xml).toMatch(/<w:b\/>[\s\S]*?"horizon gap"/);
    expect(xml).toMatch(/<w:i\/>[\s\S]*?<w:t>a<\/w:t>/);
  });

  it("never removes a paragraph break", async () => {
    const m = await loadDocx(bytes(), env);
    const nl = m.text.indexOf("\n");
    const refused = applyToDocx(m, [{ fromA: nl - 1, toA: nl + 1, insert: "X" }]);
    expect(refused).toBe(1);
    const again = await loadDocx(await saveDocx(m, env), env);
    expect(again.text.split("\n").length).toBe(m.text.split("\n").length);
  });
});
