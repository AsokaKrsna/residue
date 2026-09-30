/** Dashes, quotes, ellipses, bullets, arrows and symbols in running text. */
import type { Rule, RuleContext } from "../types";
import { prevChar, rule } from "./util";

const NOT_KEEP = { latex: true, markdown: true, plain: true, keep: false };
const REVIEW = "review";

/** Is the quote at pos opening (follows start, space or an opening bracket) or closing? */
function isOpening(c: RuleContext, pos: number): boolean {
  const p = prevChar(c.text, pos);
  return p === "" || /[\s(\[{<~\-\u2013\u2014/]/.test(p) || /[\u201C\u2018`]/.test(p);
}

const EM_OPTS = [
  { value: "---", label: "--- (LaTeX em dash)" },
  { value: " -- ", label: "spaced --" },
  { value: " - ", label: "spaced hyphen" },
  { value: ", ", label: "comma" },
  { value: REVIEW, label: "ask me each time" },
];

export const punctuationRules: Rule[] = [
  rule({
    id: "pu.em",
    group: "pu",
    name: "Em dashes",
    desc: "The most recognised LLM habit. Spaces around the dash, including hair and thin spaces, are absorbed. Choose \"ask me each time\" to pick comma, colon or dash per sentence.",
    scope: "text",
    presets: NOT_KEEP,
    options: EM_OPTS,
    optionDefaults: { latex: "---", markdown: " - ", plain: " - ", keep: " - " },
    pattern: /[ \u00A0\u2009\u200A\u202F]*[\u2014\u2015\u2E3A\u2E3B][ \u00A0\u2009\u200A\u202F]*/g,
    fix: (m, c) => {
      if (c.option === REVIEW) return null;
      const o = c.option ?? " - ";
      if (o === "---" && c.output !== "tex") return " - ";
      // a dash at the start of a line (dialogue, list) keeps its line position
      if (/^\s*$/.test(c.text.slice(c.text.lastIndexOf("\n", m.index - 1) + 1, m.index))) return o.trimStart();
      return o;
    },
    suggest: (_m, c) => (c.output === "tex" ? ["---", ", ", ": ", "; ", " (", " -- "] : [", ", ": ", "; ", " - ", " ("]),
  }),
  rule({
    id: "pu.en",
    group: "pu",
    name: "En dashes",
    desc: "Used for ranges such as 10\u201320. LaTeX writes them as --.",
    scope: "text",
    presets: NOT_KEEP,
    pattern: /\u2013/g,
    fix: (_m, c) => (c.output === "tex" ? "--" : "-"),
  }),
  rule({
    id: "pu.hyphen",
    group: "pu",
    name: "Unicode hyphens and minus",
    desc: "U+2010 hyphen, U+2011 non-breaking hyphen (frequent in GPT output), U+2012 figure dash, U+2043 and the minus sign in prose. They break search and hyphenation.",
    scope: "text",
    presets: { latex: true, markdown: true, plain: true, keep: true },
    pattern: /[\u2010\u2011\u2012\u2043\u2212\uFE58\uFE63]/g,
    fix: (m, c) => (m[0] === "\u2212" && c.output === "tex" && /\d/.test(c.text[m.index + 1] || "") ? "$-$" : "-"),
  }),
  rule({
    id: "pu.dq",
    group: "pu",
    name: "Curly double quotes",
    desc: "In LaTeX they become `` and '' based on position. Elsewhere they become straight quotes.",
    scope: "text",
    presets: NOT_KEEP,
    pattern: /[\u201C\u201D\u201E\u201F\u2033\u301D\u301E]/g,
    fix: (m, c) => {
      if (m[0] === "\u2033" && /\d/.test(prevChar(c.text, m.index))) return undefined; // 5″ is inches
      if (c.output !== "tex") return "\"";
      return isOpening(c, m.index) ? "``" : "''";
    },
  }),
  rule({
    id: "pu.sq",
    group: "pu",
    name: "Curly single quotes and apostrophes",
    desc: "Apostrophes become '. In LaTeX, opening single quotes become `.",
    scope: "text",
    presets: NOT_KEEP,
    pattern: /[\u2018\u2019\u201A\u201B\u02BC\u2032](?=.?)/g,
    fix: (m, c) => {
      const p = prevChar(c.text, m.index);
      if ((m[0] === "\u2032" || m[0] === "\u02BC") && !/[A-Za-z]/.test(p)) return undefined; // primes, modifier letters in other scripts
      if (c.output !== "tex") return "'";
      return /[A-Za-z0-9]/.test(p) ? "'" : isOpening(c, m.index) ? "`" : "'";
    },
  }),
  rule({
    id: "pu.texquotes",
    texOutput: true,
    group: "pu",
    name: "Straight double quotes in LaTeX",
    desc: "\"text\" prints with two closing quotes in LaTeX. Becomes ``text''.",
    scope: "text",
    presets: { latex: true },
    fileTypes: ["tex"],
    pattern: /"(?=\S)([^"\n]{1,300}?)(?<=\S)"/g,
    fix: (m, c) => (c.isProtected(m.index + m[0].length - 1) ? undefined : "``" + m[1] + "''"),
  }),
  rule({
    id: "pu.ellipsis",
    group: "pu",
    name: "Ellipsis character",
    desc: "U+2026 becomes \\ldots{} in LaTeX or three full stops elsewhere.",
    scope: "text",
    presets: NOT_KEEP,
    pattern: /\u2026/g,
    fix: (_m, c) => (c.output === "tex" ? "\\ldots{}" : "..."),
  }),
  rule({
    id: "pu.bullet",
    group: "pu",
    name: "Bullet symbols",
    desc: "Lines starting with \u2022 \u25E6 \u25AA \u27A2 \u2713 and similar become \"- \" items. In LaTeX a later pass wraps them in itemize.",
    scope: "text",
    presets: { latex: true, markdown: true, plain: true, keep: true },
    pattern: /^([ \t]*)[\u2022\u2023\u2043\u25E6\u25AA\u25AB\u25CF\u25CB\u25A0\u25A1\u25BA\u25B8\u27A2\u27A4\u2219\u2713\u2714\u2717\u2718\u00B7\u2B24\u2756\u2767\u27A1]\uFE0F?[ \t]*/gm,
    fix: (m) => m[1] + "- ",
  }),
  rule({
    id: "pu.arrow",
    group: "pu",
    name: "Arrows in prose",
    desc: "\u2192 \u2190 \u2194 \u21D2 and friends. LLMs use them as shorthand. LaTeX gets math arrows, plain text gets -> and =>.",
    scope: "text",
    presets: { latex: true, plain: true },
    pattern: /[\u2192\u2190\u2194\u21D2\u21D0\u21D4\u2191\u2193\u27F6\u27F9\u279C\u2794]/g,
    fix: (m, c) => {
      const tex: Record<string, string> = { "\u2192": "$\\rightarrow$", "\u2190": "$\\leftarrow$", "\u2194": "$\\leftrightarrow$", "\u21D2": "$\\Rightarrow$", "\u21D0": "$\\Leftarrow$", "\u21D4": "$\\Leftrightarrow$", "\u2191": "$\\uparrow$", "\u2193": "$\\downarrow$", "\u27F6": "$\\longrightarrow$", "\u27F9": "$\\Longrightarrow$", "\u279C": "$\\rightarrow$", "\u2794": "$\\rightarrow$" };
      const txt: Record<string, string> = { "\u2192": "->", "\u2190": "<-", "\u2194": "<->", "\u21D2": "=>", "\u21D0": "<=", "\u21D4": "<=>", "\u27F6": "->", "\u27F9": "=>", "\u279C": "->", "\u2794": "->" };
      if (c.output === "tex") return tex[m[0]];
      return txt[m[0]] ?? null;
    },
    suggest: () => ["(delete)"],
  }),
  rule({
    id: "pu.symbol",
    group: "pu",
    name: "Math and legal symbols in prose",
    desc: "\u2264 \u2265 \u2260 \u2248 \u00B1 \u00D7 \u00F7 \u00B0 \u2122 \u00AE \u00A9 \u00A7 \u00B5 \u221E outside math. pdfLaTeX stops with an error on several of these.",
    scope: "text",
    presets: { latex: true, plain: true },
    pattern: /[\u2264\u2265\u2260\u2248\u00B1\u00D7\u00F7\u00B0\u2122\u00AE\u00A9\u00A7\u00B6\u2030\u221E\u00B5\u2261\u223C\u2243\u2245\u221A\u2211\u220F\u2202\u2207\u2208\u2209\u2200\u2203\u2205\u2229\u222A\u2282\u2283\u2286\u2287\u00AC\u2227\u2228]/g,
    fix: (m, c) => {
      const tex: Record<string, string> = {
        "\u2264": "$\\leq$", "\u2265": "$\\geq$", "\u2260": "$\\neq$", "\u2248": "$\\approx$", "\u00B1": "$\\pm$", "\u00D7": "$\\times$", "\u00F7": "$\\div$",
        "\u00B0": "$^\\circ$", "\u2122": "\\texttrademark{}", "\u00AE": "\\textregistered{}", "\u00A9": "\\textcopyright{}", "\u00A7": "\\S{}", "\u00B6": "\\P{}",
        "\u2030": "\\textperthousand{}", "\u221E": "$\\infty$", "\u00B5": "$\\mu$", "\u2261": "$\\equiv$", "\u223C": "$\\sim$", "\u2243": "$\\simeq$", "\u2245": "$\\cong$",
        "\u221A": "$\\sqrt{}$", "\u2211": "$\\sum$", "\u220F": "$\\prod$", "\u2202": "$\\partial$", "\u2207": "$\\nabla$", "\u2208": "$\\in$", "\u2209": "$\\notin$",
        "\u2200": "$\\forall$", "\u2203": "$\\exists$", "\u2205": "$\\emptyset$", "\u2229": "$\\cap$", "\u222A": "$\\cup$", "\u2282": "$\\subset$", "\u2283": "$\\supset$",
        "\u2286": "$\\subseteq$", "\u2287": "$\\supseteq$", "\u00AC": "$\\neg$", "\u2227": "$\\wedge$", "\u2228": "$\\vee$",
      };
      const txt: Record<string, string> = { "\u2264": "<=", "\u2265": ">=", "\u2260": "!=", "\u2248": "~", "\u00B1": "+/-", "\u00D7": "x", "\u00F7": "/", "\u2122": "(TM)", "\u00AE": "(R)", "\u00A9": "(C)" };
      if (c.output === "tex") return tex[m[0]] ?? null;
      if (c.output === "md") return undefined;
      return txt[m[0]] ?? undefined;
    },
    suggest: () => ["(delete)"],
  }),
];
