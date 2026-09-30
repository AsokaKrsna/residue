/**
 * Word (.docx) support. The document is shown as plain text in the editor; edits are written back into the
 * original XML text runs, so styles, images, tables, equations and comments stay exactly as they were.
 *
 * Mapping: every <w:t> run becomes an editable segment. Tabs, breaks and paragraph ends become fixed
 * separators that edits cannot remove, so a clean can never merge two paragraphs.
 */
import JSZip from "jszip";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export interface XmlEnv {
  parse(xml: string): Document;
  serialize(doc: Document): string;
}

export const browserXml: XmlEnv = {
  parse: (xml) => new DOMParser().parseFromString(xml, "application/xml"),
  serialize: (doc) => new XMLSerializer().serializeToString(doc),
};

interface Segment {
  start: number;
  end: number;
  node: Element | null; // null: a fixed separator
}

interface Part {
  path: string;
  doc: Document;
  touched: boolean;
}

export interface DocxModel {
  zip: JSZip;
  parts: Part[];
  segments: Segment[];
  text: string;
  /** text ranges formatted to be invisible: hidden, white or tiny */
  hidden: { start: number; end: number }[];
}

/** A run is hidden when Word hides it, colours it white, or sets it at 2 pt or smaller. */
function isHiddenRun(t: Element): boolean {
  const run = t.parentNode as Element | null;
  if (!run || run.localName !== "r") return false;
  const rPr = Array.from(run.childNodes).find((n) => (n as Element).localName === "rPr") as Element | undefined;
  if (!rPr) return false;
  for (const ch of Array.from(rPr.childNodes) as Element[]) {
    const val = ch.getAttributeNS?.(W, "val") ?? ch.getAttribute?.("w:val");
    if ((ch.localName === "vanish" || ch.localName === "specVanish") && val !== "0" && val !== "false") return true;
    if (ch.localName === "color" && val && /^(?:FFFFFF|white)$/i.test(val)) return true;
    if (ch.localName === "sz" && val && Number(val) <= 4) return true;
  }
  return false;
}

/** Rules that change line structure. In Word, paragraphs are XML elements, so these stay off. */
export const DOCX_DISABLED = ["ws.edges", "ws.blank", "sp.sep", "sp.crlf", "md.heading", "md.bold", "md.italic", "md.code", "md.fence", "md.link", "md.list", "md.rule", "md.table", "md.mathdelim", "pu.bullet", "plain.md", "plain.tex", "plain.math", "ws.unwrap"];

export interface TextChange {
  fromA: number;
  toA: number;
  insert: string;
}

const PART_ORDER = [/^word\/document\.xml$/, /^word\/footnotes\.xml$/, /^word\/endnotes\.xml$/, /^word\/comments\.xml$/, /^word\/header\d*\.xml$/, /^word\/footer\d*\.xml$/];

function closestParagraph(el: Element): Element | null {
  let p = el.parentNode as Element | null;
  while (p && !(p.namespaceURI === W && p.localName === "p")) p = p.parentNode as Element | null;
  return p;
}

export async function loadDocx(data: ArrayBuffer | Uint8Array, env: XmlEnv = browserXml): Promise<DocxModel> {
  const zip = await JSZip.loadAsync(data);
  const names = Object.keys(zip.files);
  const paths: string[] = [];
  for (const re of PART_ORDER) for (const n of names.filter((x) => re.test(x)).sort()) paths.push(n);
  if (!paths.includes("word/document.xml")) throw new Error("This file does not look like a Word document (no word/document.xml).");

  const parts: Part[] = [];
  for (const path of paths) parts.push({ path, doc: env.parse(await zip.file(path)!.async("string")), touched: false });
  const model: DocxModel = { zip, parts, segments: [], text: "", hidden: [] };
  reindex(model);
  return model;
}

/** Rebuild the text and segment map from the (possibly edited) XML. */
export function reindex(model: DocxModel): void {
  const segments: Segment[] = [];
  const hidden: { start: number; end: number }[] = [];
  let text = "";
  const sep = (s: string) => { segments.push({ start: text.length, end: text.length + s.length, node: null }); text += s; };

  for (const { doc } of model.parts) {
    if (text.length) sep("\n\n");
    const paras = Array.from(doc.getElementsByTagNameNS(W, "p"));
    paras.forEach((p, pi) => {
      if (pi > 0) sep("\n");
      const walker: Element[] = [];
      const collect = (el: Element) => {
        for (const ch of Array.from(el.childNodes)) {
          if (ch.nodeType !== 1) continue;
          const e = ch as Element;
          if (e.namespaceURI === W && e.localName === "p") continue; // nested paragraph (text box): visited on its own
          if (e.namespaceURI === W && (e.localName === "t" || e.localName === "tab" || e.localName === "br" || e.localName === "cr")) walker.push(e);
          else if (!(e.namespaceURI === W && (e.localName === "delText" || e.localName === "instrText"))) collect(e);
        }
      };
      collect(p);
      for (const e of walker) {
        if (closestParagraph(e) !== p) continue;
        if (e.localName === "t") {
          const t = e.textContent ?? "";
          segments.push({ start: text.length, end: text.length + t.length, node: e });
          if (t && isHiddenRun(e)) hidden.push({ start: text.length, end: text.length + t.length });
          text += t;
        } else sep(e.localName === "tab" ? "\t" : "\n");
      }
    });
  }
  model.segments = segments;
  // merge touching hidden runs into one range
  model.hidden = hidden.reduce<{ start: number; end: number }[]>((acc, h) => {
    const last = acc[acc.length - 1];
    if (last && h.start - last.end <= 1) last.end = h.end;
    else acc.push({ ...h });
    return acc;
  }, []);
  model.text = text;
}

/** Apply several rounds of changes, each relative to the text after the previous round. */
export function applyPasses(model: DocxModel, passes: TextChange[][]): number {
  let refused = 0;
  for (const pass of passes) {
    refused += applyToDocx(model, pass);
    reindex(model);
  }
  return refused;
}

/**
 * Apply text changes (positions relative to model.text) to the XML runs.
 * Returns how many changes could not be applied because they tried to remove a paragraph break or tab.
 */
export function applyToDocx(model: DocxModel, changes: TextChange[]): number {
  let refused = 0;
  const partOf = (el: Element) => model.parts.find((p) => p.doc === el.ownerDocument);
  // descending order keeps earlier offsets valid while nodes change
  for (const raw of [...changes].sort((a, b) => b.fromA - a.fromA)) {
    // a line break inside a text run is not a paragraph in Word; drop it
    const ch = { ...raw, insert: raw.insert.replace(/\n/g, "") };
    if (ch.insert !== raw.insert) refused++;
    const hit = model.segments.filter((s) => s.node && s.start < ch.toA && s.end > ch.fromA);
    const fixedHit = model.segments.some((s) => !s.node && s.start < ch.toA && s.end > ch.fromA);
    if (fixedHit) refused++;
    if (!hit.length) {
      if (!ch.insert) continue;
      // pure insertion: attach to the run that ends here, or the run that starts here
      const host = model.segments.find((s) => s.node && s.end === ch.fromA) ?? model.segments.find((s) => s.node && s.start === ch.fromA);
      if (!host) { refused++; continue; }
      const t = host.node!.textContent ?? "";
      const at = ch.fromA - host.start;
      setText(host.node!, t.slice(0, at) + ch.insert + t.slice(at));
      const part = partOf(host.node!); if (part) part.touched = true;
      continue;
    }
    hit.forEach((s, i) => {
      const t = s.node!.textContent ?? "";
      const a = Math.max(ch.fromA, s.start) - s.start;
      const b = Math.min(ch.toA, s.end) - s.start;
      setText(s.node!, t.slice(0, a) + (i === 0 ? ch.insert : "") + t.slice(b));
      const part = partOf(s.node!); if (part) part.touched = true;
    });
  }
  return refused;
}

function setText(el: Element, value: string) {
  el.textContent = value;
  if (/^\s|\s$/.test(value)) el.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
}

export async function saveDocx(model: DocxModel, env: XmlEnv = browserXml): Promise<Uint8Array> {
  for (const p of model.parts) if (p.touched) model.zip.file(p.path, env.serialize(p.doc));
  return model.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
