/** Odd spaces, line separators and layout whitespace. Paragraph breaks are never removed. */
import type { Rule } from "../types";
import { chipLabel } from "../unicode";
import { CJK, charAt, prevChar, rule } from "./util";

const ALL = { latex: true, markdown: true, plain: true, keep: true };
const chip = (s: string) => chipLabel(Array.from(s)[0]) || "SP";

export const spaceRules: Rule[] = [
  rule({
    id: "sp.nbsp",
    group: "sp",
    name: "No-break spaces",
    desc: "U+00A0. In LaTeX prose it can become a tie (~), which keeps the no-break meaning. Elsewhere it becomes a normal space.",
    scope: "all",
    presets: ALL,
    options: [
      { value: "~", label: "~ tie (LaTeX)" },
      { value: " ", label: "normal space" },
    ],
    optionDefaults: { latex: "~", markdown: " ", plain: " ", keep: " " },
    pattern: /\u00A0/g,
    fix: (m, c) => (c.output === "tex" && c.option === "~" && !c.isProtected(m.index) ? "~" : " "),
    chip,
  }),
  rule({
    id: "sp.odd",
    group: "sp",
    name: "Narrow, thin and other spaces",
    desc: "Narrow no-break (U+202F, seen in o3 and o4-mini output), thin, hair, figure, em, en and medium math spaces. The ideographic space is kept inside CJK text.",
    scope: "all",
    presets: ALL,
    pattern: /[\u202F\u2000-\u200A\u205F\u1680\u3000]/g,
    fix: (m, c) => {
      if (m[0] === "\u3000" && (CJK.test(prevChar(c.text, m.index)) || CJK.test(charAt(c.text, m.index + 1)))) return undefined;
      return " ";
    },
    chip,
  }),
  rule({
    id: "sp.sep",
    group: "sp",
    name: "Unicode line separators",
    desc: "LS, PS and NEL become real line breaks, so paragraphs survive in every program.",
    scope: "all",
    presets: ALL,
    pattern: /[\u2028\u2029\u0085]/g,
    fix: (m) => (m[0] === "\u2029" ? "\n\n" : "\n"),
    chip,
  }),
  rule({
    id: "sp.crlf",
    group: "sp",
    name: "Windows and old Mac line endings",
    desc: "CRLF and lone CR become LF.",
    scope: "all",
    presets: ALL,
    pattern: /\r\n?/g,
    fix: () => "\n",
    chip: (s) => (s === "\r\n" ? "CRLF" : "CR"),
  }),
];

function alignedColumn(t: string, s: number, e: number): boolean {
  const ls = t.lastIndexOf("\n", s - 1) + 1;
  const col = e - ls;
  const prevEnd = ls - 1;
  const nextStart = t.indexOf("\n", e) + 1;
  const lines: string[] = [];
  if (prevEnd > 0) lines.push(t.slice(t.lastIndexOf("\n", prevEnd - 1) + 1, prevEnd));
  if (nextStart > 0) lines.push(t.slice(nextStart, (t.indexOf("\n", nextStart) + 1 || t.length + 1) - 1));
  return lines.some((l) => l[col - 1] === " " && l[col - 2] === " " && /\S/.test(l[col] ?? ""));
}

/** Lines that start a new block and must never be joined to the line above. */
const BLOCK_START = /^[ \t]*(?:[-*+\u2022]\s|\d{1,3}[.)]\s|#{1,6}\s|>|\||```|~~~|\\(?:item|begin|end|section|subsection|chapter|paragraph)\b|[ \t]{4})/;

export const whitespaceRules: Rule[] = [
  rule({
    id: "ws.unwrap",
    group: "ws",
    name: "Join hard-wrapped lines",
    desc: "Text copied from PDFs and emails breaks every line. This joins lines inside a paragraph. Blank lines, lists, headings, quotes, tables and code stay as they are. Off by default.",
    scope: "text",
    presets: {},
    fileTypes: ["txt", "md"],
    detect: function* (c) {
      const t = c.text;
      const re = /([^\n])\n(?=([^\n]))/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const nl = m.index + 1;
        if (c.isProtected(nl)) continue;
        const prevLine = t.slice(t.lastIndexOf("\n", nl - 1) + 1, nl);
        const nextLine = t.slice(nl + 1, (t.indexOf("\n", nl + 1) + 1 || t.length + 1) - 1);
        if (!prevLine.trim() || !nextLine.trim()) continue;
        if (BLOCK_START.test(nextLine) || /^[ \t]*(?:#{1,6}\s|\||```|~~~)/.test(prevLine) || / {2}$|\\$/.test(prevLine)) continue;
        // a word split across lines: "trans-\nformer" could be one word or a real hyphen
        if (/[A-Za-z]-$/.test(prevLine) && /^[a-z]/.test(nextLine)) {
          yield { start: nl - 1, end: nl + 1, repl: null, suggestions: ["(delete)", "-"], note: "A word may be split across the line break. Pick joined or hyphenated." };
          continue;
        }
        yield { start: nl, end: nl + 1, repl: " " };
      }
    },
    chip: () => "\u23CE",
  }),
  rule({
    id: "ws.trailing",
    group: "ws",
    name: "Trailing spaces",
    desc: "Spaces and tabs at the end of a line, including ones hidden behind invisible characters.",
    scope: "all",
    presets: ALL,
    pattern: /[ \t]+(?=[\p{Cf}\u00AD\u2800\u3164]*$)/gmu,
    fix: (m, c) => (c.inRegion(m.index, "verbatim") ? undefined : ""),
    chip: (s) => `SP\u00D7${s.length}`,
  }),
  rule({
    id: "ws.multi",
    group: "ws",
    name: "Repeated spaces",
    desc: "Two or more spaces between words become one. Indentation is left alone.",
    scope: "text",
    presets: ALL,
    pattern: /(?<=[^\s]) {2,}(?=[^\s\p{Cf}\u00AD])/gu,
    // spaces that line up a column with the line above or below are layout, not a typo
    fix: (m, c) => (alignedColumn(c.text, m.index, m.index + m[0].length) ? undefined : " "),
    chip: (s) => `SP\u00D7${s.length}`,
  }),
  rule({
    id: "ws.punct",
    group: "ws",
    name: "Space before punctuation",
    desc: "Removes a space before a comma, full stop, semicolon or closing bracket. Colons, question and exclamation marks are left for French-style text.",
    scope: "text",
    presets: { latex: true, markdown: true, plain: true, keep: false },
    pattern: /(?<=[\p{L}\p{N}\)\]'"])[ \t]+(?=[,.;)\]](?:\s|$))/gmu,
    fix: (m, c) => (c.inRegion(m.index + m[0].length, "cmd") ? undefined : ""),
    chip: (s) => `SP\u00D7${s.length}`,
  }),
  rule({
    id: "ws.blank",
    group: "ws",
    name: "Extra blank lines",
    desc: "Two or more blank lines become one. A single blank line, the paragraph break, is never touched.",
    scope: "all",
    presets: ALL,
    pattern: /\n(?:[ \t]*\n){2,}/g,
    fix: (m, c) => (c.inRegion(m.index + 1, "verbatim") ? undefined : "\n\n"),
    chip: (s) => `\u00B6\u00D7${(s.match(/\n/g) || []).length - 1}`,
  }),
  rule({
    id: "ws.edges",
    group: "ws",
    name: "Blank lines at start and end",
    desc: "Removes empty lines at the top of the file and leaves exactly one line break at the end.",
    scope: "all",
    presets: ALL,
    detect: function* (c) {
      const t = c.text;
      const lead = /^(?:[ \t]*\n)+/.exec(t);
      if (lead) yield { start: 0, end: lead[0].length, repl: "" };
      const trail = /\n(?:[ \t]*\n)+[ \t]*$|(?<=\S)[ \t]*$/.exec(t);
      if (t.length && trail && trail[0] !== "\n") {
        const start = trail.index;
        if (!(lead && start < lead[0].length)) yield { start, end: t.length, repl: "\n" };
      }
    },
    chip: () => "EOF",
  }),
];
