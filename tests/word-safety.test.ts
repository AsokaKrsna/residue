import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { loadDocx, wordingSpans, applyToDocx, saveDocx, type XmlEnv } from "../src/formats/docx";

const env: XmlEnv = {
  parse: (s) => new DOMParser().parseFromString(s, "application/xml") as unknown as Document,
  serialize: (d) => new XMLSerializer().serializeToString(d as never),
};
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const para = (inside: string) => `<w:p>${inside}</w:p>`;
const run = (text: string) => `<w:r><w:t>${text}</w:t></w:r>`;
async function fixture() {
  const z = new JSZip();
  z.file("word/document.xml", `<w:document xmlns:w="${W}" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${[
    para(run("In order to test.")),
    para('<w:r><w:rPr><w:b/></w:rPr><w:t>In order </w:t></w:r>' + run("to test.")),
    para('<w:hyperlink w:anchor="target">' + run("In order to link.") + '</w:hyperlink>'),
    para('<w:fldSimple w:instr="REF target">' + run("In order to reference.") + '</w:fldSimple>'),
    para('<w:ins w:id="1" w:author="Test">' + run("In order to revise.") + '</w:ins>'),
    para('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>REF target</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + run("In order to show a field.") + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'),
    '<w:tbl><w:tr><w:tc>' + para(run("Table cell.")) + '</w:tc></w:tr></w:tbl>',
    para('<m:oMath><m:r><m:t>x=2</m:t></m:r></m:oMath>' + run(" Equation unchanged.")),
  ].join("")}</w:body></w:document>`);
  for (const [part, root] of [["header1", "hdr"], ["footer1", "ftr"], ["footnotes", "footnotes"], ["comments", "comments"]])
    z.file(`word/${part}.xml`, `<w:${root} xmlns:w="${W}">${para(run("Preserved note."))}</w:${root}>`);
  z.file("word/media/unchanged.bin", new Uint8Array([0, 1, 255, 42]));
  return loadDocx(await z.generateAsync({ type: "uint8array" }), env);
}

describe("Word structural safety", () => {
  it("allows only wording wholly inside an ordinary run", async () => {
    const m = await fixture();
    const spans = wordingSpans(m);
    const occurrences = [...m.text.matchAll(/In order to/g)].map((x) => x.index);
    expect(occurrences).toHaveLength(6);
    expect(occurrences.map((at) => spans.some((s) => s.start <= at && s.end >= at + 11))).toEqual([true, false, false, false, false, false]);
  });
  it("rejects an entire edit across separators, rather than partially applying it", async () => {
    const m = await fixture();
    const before = m.text;
    const pos = m.text.indexOf("\n");
    expect(applyToDocx(m, [{ fromA: pos - 1, toA: pos + 2, insert: "X" }])).toBe(1);
    expect((await loadDocx(await saveDocx(m, env), env)).text).toBe(before);
  });
  it("rejects insertion of new line structure", async () => {
    const m = await fixture();
    expect(applyToDocx(m, [{ fromA: 0, toA: 0, insert: "new\nparagraph" }])).toBe(1);
    expect((await loadDocx(await saveDocx(m, env), env)).text).toBe(m.text);
  });
  it("round-trips supported edits and retains notes, fields, tables, equations, and untouched parts", async () => {
    const m = await fixture();
    expect(applyToDocx(m, [{ fromA: 0, toA: 11, insert: "To" }])).toBe(0);
    const out = await saveDocx(m, env);
    expect((await loadDocx(out, env)).text.startsWith("To test.")).toBe(true);
    const z = await JSZip.loadAsync(out);
    expect(Array.from(await z.file("word/media/unchanged.bin")!.async("uint8array"))).toEqual([0, 1, 255, 42]);
    const xml = await z.file("word/document.xml")!.async("string");
    for (const tag of ["<w:hyperlink", "<w:fldSimple", "<w:fldChar", "<w:ins", "<w:tbl", "<m:oMath"]) expect(xml).toContain(tag);
    for (const part of ["header1", "footer1", "footnotes", "comments"]) expect(await z.file(`word/${part}.xml`)!.async("string")).toContain("Preserved note.");
  });
});
