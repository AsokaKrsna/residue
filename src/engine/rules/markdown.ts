/** Markdown that leaks into LaTeX or plain text when you paste from a chat window. */
import type { Match, Rule } from "../types";
import { rule } from "./util";

const NON_MD = ["tex", "txt", "bib"] as const;
const PASTE = { latex: true, plain: true, keep: true };

export function texEscape(s: string): string {
  return s.replace(/[\\{}_%&#$~^]/g, (c) =>
    c === "\\" ? "\\textbackslash{}" : c === "~" ? "\\textasciitilde{}" : c === "^" ? "\\textasciicircum{}" : "\\" + c,
  );
}

const SECTION = ["", "section", "subsection", "subsubsection", "paragraph", "subparagraph", "subparagraph"];

let headText: string | null = null;
let headTop = 1;
function topHeadingLevel(t: string): number {
  if (t !== headText) {
    headText = t;
    const levels = [...t.matchAll(/^(#{1,6})[ \t]+\S/gm)].map((m) => m[1].length);
    // an existing \section means the pasted headings sit below it
    const hasSection = /\\section\*?\{/.test(t);
    headTop = levels.length ? Math.min(...levels) - (hasSection ? 1 : 0) : 1;
  }
  return headTop;
}

export const markdownRules: Rule[] = [
  rule({
    id: "md.heading",
    group: "md",
    name: "Markdown headings",
    desc: "# to ###### at the start of a line. LaTeX gets \\section, \\subsection and so on. Plain text keeps the words.",
    scope: "text",
    presets: PASTE,
    fileTypes: [...NON_MD],
    pattern: /^(#{1,6})[ \t]+(.+?)[ \t#]*$/gm,
    fix: (m, c) => {
      const title = m[2].replace(/\*\*|__/g, "");
      if (c.output !== "tex") return title;
      // chats often start at ## or ###; the highest level present becomes \section
      const level = m[1].length - topHeadingLevel(c.text) + 1;
      return `\\${SECTION[Math.min(Math.max(level, 1), 6)]}{${title}}`;
    },
  }),
  rule({
    id: "md.bold",
    group: "md",
    name: "Bold markers",
    desc: "**text** and __text__ become \\textbf{text} in LaTeX or plain words elsewhere.",
    scope: "text",
    presets: PASTE,
    fileTypes: [...NON_MD],
    pattern: /\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*|(?<![\w\\])__(?=\S)([^_\n]+?)(?<=\S)__(?!\w)/g,
    fix: (m, c) => {
      const t = m[1] ?? m[2];
      return c.output === "tex" ? `\\textbf{${t}}` : t;
    },
  }),
  rule({
    id: "md.italic",
    group: "md",
    name: "Italic markers",
    desc: "*text* becomes \\emph{text} in LaTeX or plain words elsewhere. Asterisks used for multiplication are left alone.",
    scope: "text",
    presets: PASTE,
    fileTypes: [...NON_MD],
    pattern: /(?<![*\w\\])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![*\w])/g,
    fix: (m, c) => (/^\d/.test(m[1]) && /\d$/.test(m[1]) ? undefined : c.output === "tex" ? `\\emph{${m[1]}}` : m[1]),
  }),
  rule({
    id: "md.code",
    group: "md",
    name: "Inline code",
    desc: "`code` becomes \\texttt{} with special characters escaped, or plain text.",
    scope: "text",
    presets: PASTE,
    fileTypes: [...NON_MD],
    pattern: /(?<!`)`([^`\n]+)`(?!`)/g,
    fix: (m, c) => (c.output === "tex" ? `\\texttt{${texEscape(m[1])}}` : m[1]),
  }),
  rule({
    id: "md.fence",
    group: "md",
    name: "Code fences",
    desc: "```lang blocks become a verbatim environment in LaTeX. Plain text keeps just the code.",
    scope: "all",
    presets: PASTE,
    fileTypes: [...NON_MD],
    pattern: /^[ \t]*(```|~~~)[ \t]*([\w+-]*)[^\n]*\n([\s\S]*?)\n[ \t]*\1[ \t]*$/gm,
    fix: (m, c) => {
      if (c.inRegion(m.index, "verbatim") || c.inRegion(m.index, "comment")) return undefined;
      return c.output === "tex" ? `\\begin{verbatim}\n${m[3]}\n\\end{verbatim}` : m[3];
    },
  }),
  rule({
    id: "md.link",
    group: "md",
    name: "Markdown links",
    desc: "[text](url) becomes \\href{url}{text} in LaTeX or \"text (url)\" in plain text.",
    scope: "all",
    presets: PASTE,
    fileTypes: [...NON_MD],
    pattern: /(?<!!)\[([^\]\n]+)\]\((\S+?)(?:\s+"[^"]*")?\)/g,
    fix: (m, c) => {
      if (c.inRegion(m.index, "comment") || c.inRegion(m.index, "verbatim")) return undefined;
      return c.output === "tex" ? `\\href{${m[2]}}{${m[1]}}` : `${m[1]} (${m[2]})`;
    },
  }),
  rule({
    id: "md.list",
    texOutput: true,
    group: "md",
    name: "Markdown lists in LaTeX",
    desc: "Runs of \"- item\" or \"1. item\" lines become itemize or enumerate environments.",
    scope: "text",
    presets: { latex: true },
    fileTypes: ["tex"],
    detect: function* (c): Iterable<Match> {
      const re = /(?:^[ \t]*(?:[-*+]|\d{1,2}[.)])[ \t]+\S.*(?:\n|$)){2,}/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c.text))) {
        if (c.isProtected(m.index)) continue;
        const block = m[0].replace(/\n$/, "");
        const lines = block.split("\n");
        const numbered = /^[ \t]*\d/.test(lines[0]);
        const env = numbered ? "enumerate" : "itemize";
        const items = lines.map((l) => "  \\item " + l.replace(/^[ \t]*(?:[-*+]|\d{1,2}[.)])[ \t]+/, "")).join("\n");
        yield { start: m.index, end: m.index + block.length, repl: `\\begin{${env}}\n${items}\n\\end{${env}}` };
      }
    },
  }),
  rule({
    id: "md.rule",
    group: "md",
    name: "Horizontal rules",
    desc: "Lines made of *** or ___ (and --- outside LaTeX, where --- is a dash).",
    scope: "text",
    presets: PASTE,
    fileTypes: [...NON_MD],
    pattern: /^[ \t]*(?:\*[ \t]*){3,}$|^[ \t]*(?:_[ \t]*){3,}$|^[ \t]*(?:-[ \t]*){3,}$/gm,
    fix: (m, c) => (c.fileType === "tex" && m[0].includes("-") ? undefined : ""),
  }),
  rule({
    id: "md.table",
    texOutput: true,
    group: "md",
    name: "Markdown tables",
    desc: "Pipe tables pasted into LaTeX. Suggests a tabular environment you can accept.",
    scope: "text",
    presets: { latex: true },
    fileTypes: ["tex"],
    detect: function* (c): Iterable<Match> {
      const re = /(?:^[ \t]*\|.*\|[ \t]*(?:\n|$)){2,}/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c.text))) {
        if (c.isProtected(m.index)) continue;
        const block = m[0].replace(/\n$/, "");
        const rows = block.split("\n").filter((l) => !/^[ \t]*\|?[ \t]*:?-{2,}/.test(l));
        const cells = rows.map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((x) => texEscape(x.trim().replace(/\*\*/g, ""))));
        const cols = Math.max(...cells.map((r) => r.length));
        const body = cells.map((r, i) => "  " + r.join(" & ") + " \\\\" + (i === 0 ? " \\hline" : "")).join("\n");
        const tab = `\\begin{tabular}{${"l".repeat(cols)}}\n  \\hline\n${body}\n  \\hline\n\\end{tabular}`;
        yield { start: m.index, end: m.index + block.length, repl: null, suggestions: [tab], note: `${rows.length} rows, ${cols} columns.` };
      }
    },
  }),
  rule({
    id: "md.mathdelim",
    group: "md",
    name: "\\( \\) and \\[ \\] math delimiters",
    desc: "ChatGPT writes math with \\( \\) and \\[ \\]. Many Markdown renderers only understand $ and $$.",
    scope: "all",
    presets: { markdown: true },
    fileTypes: ["md"],
    pattern: /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g,
    fix: (m) => (m[1] !== undefined ? `$${m[1].trim()}$` : `$$${m[2]}$$`),
  }),
];
