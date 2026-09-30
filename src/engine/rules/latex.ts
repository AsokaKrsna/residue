/** LaTeX safety: protection switches, Unicode that breaks pdfLaTeX, unescaped special characters. */
import type { Rule, RuleContext } from "../types";
import { DELETE, rule } from "./util";

const TEX = ["tex"] as const;

/** XeLaTeX and LuaLaTeX documents can typeset Unicode directly, so the Unicode checks stay quiet. */
const UNICODE_ENGINE = /\\usepackage(?:\[[^\]]*\])?\{[^}]*\b(?:fontspec|polyglossia|xeCJK|unicode-math|luatexja|ctex)\b[^}]*\}|\\setmainfont|%\s*!TEX\s+(?:TS-)?program\s*=\s*(?:xe|lua)(?:la)?tex/i;
const UNICODE_MATH = /\\usepackage(?:\[[^\]]*\])?\{[^}]*unicode-math/;

/** Whole-document facts, computed once per text instead of once per match. */
let docText: string | null = null;
let docUnicode = false;
let docUnicodeMath = false;
let envRanges: [number, number][] = [];
function docFacts(t: string) {
  if (t === docText) return;
  docText = t;
  docUnicode = UNICODE_ENGINE.test(t);
  docUnicodeMath = UNICODE_MATH.test(t);
  envRanges = [];
  const re = new RegExp(`\\\\(begin|end)\\{(${TABLE_ENVS.source})\\*?\\}`, "g");
  const stack: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m[1] === "begin") stack.push(m.index);
    else if (stack.length) envRanges.push([stack.pop()!, m.index]);
  }
  for (const s of stack) envRanges.push([s, t.length]);
}

/** XeLaTeX and LuaLaTeX documents can typeset Unicode directly, so the Unicode checks stay quiet. */
export function isUnicodeEngine(t: string): boolean {
  docFacts(t);
  return docUnicode;
}

function insideTable(t: string, pos: number): boolean {
  docFacts(t);
  return envRanges.some(([a, b]) => pos > a && pos < b);
}
const TABLE_ENVS = /tabular|tabularx|tabulary|tabu|longtable|array|matrix|pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|cases|align|alignat|eqnarray|split|tblr|longtblr|NiceTabular/;

const MATH: Record<string, string> = {
  "\u00D7": "\\times", "\u00F7": "\\div", "\u00B1": "\\pm", "\u2213": "\\mp", "\u2212": "-", "\u00B7": "\\cdot", "\u22C5": "\\cdot", "\u2218": "\\circ",
  "\u2264": "\\leq", "\u2265": "\\geq", "\u2260": "\\neq", "\u2248": "\\approx", "\u2261": "\\equiv", "\u223C": "\\sim", "\u2243": "\\simeq", "\u2245": "\\cong",
  "\u221D": "\\propto", "\u226A": "\\ll", "\u226B": "\\gg", "\u227A": "\\prec", "\u227B": "\\succ", "\u2AAF": "\\preceq", "\u2AB0": "\\succeq",
  "\u221E": "\\infty", "\u2202": "\\partial", "\u2207": "\\nabla", "\u2211": "\\sum", "\u220F": "\\prod", "\u222B": "\\int", "\u222C": "\\iint", "\u222E": "\\oint", "\u221A": "\\sqrt",
  "\u2208": "\\in", "\u2209": "\\notin", "\u220B": "\\ni", "\u2282": "\\subset", "\u2283": "\\supset", "\u2286": "\\subseteq", "\u2287": "\\supseteq", "\u222A": "\\cup", "\u2229": "\\cap",
  "\u2205": "\\emptyset", "\u2216": "\\setminus", "\u2200": "\\forall", "\u2203": "\\exists", "\u2204": "\\nexists", "\u00AC": "\\neg", "\u2227": "\\wedge", "\u2228": "\\vee",
  "\u2192": "\\to", "\u2190": "\\leftarrow", "\u2194": "\\leftrightarrow", "\u21D2": "\\Rightarrow", "\u21D0": "\\Leftarrow", "\u21D4": "\\Leftrightarrow", "\u21A6": "\\mapsto", "\u27F6": "\\longrightarrow",
  "\u2026": "\\ldots", "\u22EF": "\\cdots", "\u22EE": "\\vdots", "\u22F1": "\\ddots", "\u2032": "'", "\u2033": "''", "\u2297": "\\otimes", "\u2295": "\\oplus", "\u2299": "\\odot",
  "\u2225": "\\parallel", "\u22A5": "\\perp", "\u2220": "\\angle", "\u2308": "\\lceil", "\u2309": "\\rceil", "\u230A": "\\lfloor", "\u230B": "\\rfloor", "\u27E8": "\\langle", "\u27E9": "\\rangle",
  "\u2016": "\\|", "\u2223": "\\mid", "\u2113": "\\ell", "\u210F": "\\hbar", "\u00B0": "^\\circ", "\u22A4": "\\top", "\u2020": "\\dagger",
  "\u03B1": "\\alpha", "\u03B2": "\\beta", "\u03B3": "\\gamma", "\u03B4": "\\delta", "\u03B5": "\\varepsilon", "\u03F5": "\\epsilon", "\u03B6": "\\zeta", "\u03B7": "\\eta",
  "\u03B8": "\\theta", "\u03D1": "\\vartheta", "\u03B9": "\\iota", "\u03BA": "\\kappa", "\u03BB": "\\lambda", "\u03BC": "\\mu", "\u00B5": "\\mu", "\u03BD": "\\nu", "\u03BE": "\\xi",
  "\u03BF": "o", "\u03C0": "\\pi", "\u03D6": "\\varpi", "\u03C1": "\\rho", "\u03F1": "\\varrho", "\u03C3": "\\sigma", "\u03C2": "\\varsigma", "\u03C4": "\\tau", "\u03C5": "\\upsilon",
  "\u03C6": "\\varphi", "\u03D5": "\\phi", "\u03C7": "\\chi", "\u03C8": "\\psi", "\u03C9": "\\omega",
  "\u0393": "\\Gamma", "\u0394": "\\Delta", "\u0398": "\\Theta", "\u039B": "\\Lambda", "\u039E": "\\Xi", "\u03A0": "\\Pi", "\u03A3": "\\Sigma", "\u03A5": "\\Upsilon", "\u03A6": "\\Phi",
  "\u03A8": "\\Psi", "\u03A9": "\\Omega",
};
const SUP: Record<string, string> = { "\u2070": "0", "\u00B9": "1", "\u00B2": "2", "\u00B3": "3", "\u2074": "4", "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9", "\u207A": "+", "\u207B": "-", "\u207C": "=", "\u207D": "(", "\u207E": ")", "\u207F": "n", "\u2071": "i" };
const SUB: Record<string, string> = { "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3", "\u2084": "4", "\u2085": "5", "\u2086": "6", "\u2087": "7", "\u2088": "8", "\u2089": "9", "\u208A": "+", "\u208B": "-", "\u208C": "=", "\u208D": "(", "\u208E": ")", "\u2090": "a", "\u2091": "e", "\u2092": "o", "\u2093": "x", "\u2095": "h", "\u2096": "k", "\u2097": "l", "\u2098": "m", "\u2099": "n", "\u209A": "p", "\u209B": "s", "\u209C": "t" };
const SUP_RE = `[${Object.keys(SUP).join("")}]+`;
const SUB_RE = `[${Object.keys(SUB).join("")}]+`;
const MATH_RE = new RegExp(`${SUP_RE}|${SUB_RE}|[${Object.keys(MATH).join("")}]`, "g");

function mathMacro(s: string): string {
  if (SUP[s[0]]) return "^{" + [...s].map((c) => SUP[c]).join("") + "}";
  if (SUB[s[0]]) return "_{" + [...s].map((c) => SUB[c]).join("") + "}";
  const m = MATH[s];
  // a letter macro followed directly by a letter would merge: \alphax. The engine adds a space when needed.
  return m;
}

function macroFits(c: RuleContext, end: number, macro: string): string {
  return /^\\[A-Za-z]+$/.test(macro) && /[A-Za-z]/.test(c.text[end] || "") ? macro + " " : macro;
}

export const latexRules: Rule[] = [
  rule({
    id: "tex.pmath",
    group: "tex",
    name: "Protect math",
    desc: "$...$, $$...$$, \\( \\), \\[ \\], equation, align, gather, multline and friends. Prose rules never touch math.",
    scope: "all",
    presets: { latex: true, markdown: true, plain: true, keep: true },
    guard: ["math"],
  }),
  rule({
    id: "tex.pverb",
    group: "tex",
    name: "Protect comments and code",
    desc: "% comments, verbatim, lstlisting, minted, \\verb, TikZ pictures and Markdown code blocks.",
    scope: "all",
    presets: { latex: true, markdown: true, plain: true, keep: true },
    guard: ["verbatim", "comment"],
  }),
  rule({
    id: "tex.pkeys",
    group: "tex",
    name: "Protect keys, links and commands",
    desc: "Arguments of \\cite, \\ref, \\label, \\url, \\usepackage and similar, LaTeX command names, URLs and email addresses.",
    scope: "all",
    presets: { latex: true, markdown: true, plain: true, keep: true },
    guard: ["keys", "cmd", "url"],
  }),
  rule({
    id: "tex.mathsym",
    texOutput: true,
    group: "tex",
    name: "Unicode symbols in math",
    desc: "\u00D7 \u2264 \u03B1 \u2208 x\u00B2 and 150 more become \\times, \\leq, \\alpha, \\in, x^{2}. pdfLaTeX fails on them. Skipped when unicode-math is loaded.",
    scope: "math",
    presets: { latex: true },
    fileTypes: [...TEX],
    options: [
      { value: "auto", label: "fix automatically" },
      { value: "review", label: "ask me each time" },
    ],
    optionDefaults: { latex: "auto" },
    pattern: MATH_RE,
    fix: (m, c) => {
      docFacts(c.text);
      if (docUnicodeMath) return undefined;
      const mac = macroFits(c, m.index + m[0].length, mathMacro(m[0]));
      return c.option === "review" ? null : mac;
    },
    suggest: (m, c) => [macroFits(c, m.index + m[0].length, mathMacro(m[0]))],
  }),
  rule({
    id: "tex.unicode",
    texOutput: true,
    group: "tex",
    name: "Characters pdfLaTeX cannot print",
    desc: "Anything outside Latin letters and common accents, such as Greek letters, emoji, superscript digits or CJK in prose. Skipped for XeLaTeX and LuaLaTeX documents.",
    scope: "text",
    presets: { latex: true },
    fileTypes: [...TEX],
    pattern: /[^\x00-\x7F\u00A0-\u017F\u2010-\u2027\u2030-\u205F\uFB00-\uFB06\uE000-\uF8FF\uFE00-\uFE0F\uFFFD\u{E0000}-\u{E0FFF}\u2190-\u21FF\u2200-\u22FF\u2400-\u27BF\u{1D400}-\u{1D7FF}\u2100-\u214F\u02BC\u0300-\u036F]/gu,
    fix: (_m, c) => (isUnicodeEngine(c.text) ? undefined : null),
    suggest: (m) => {
      const ch = m[0];
      if (MATH[ch] && /[\u0370-\u03FF\u00B5]/.test(ch)) return [`$${MATH[ch]}$`];
      if (SUP[ch]) return [`\\textsuperscript{${SUP[ch]}}`];
      if (SUB[ch]) return [`\\textsubscript{${SUB[ch]}}`];
      if (/\p{Extended_Pictographic}/u.test(ch)) return [DELETE];
      return [];
    },
    note: (m) => (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bengali}\p{Script=Devanagari}\p{Script=Arabic}]/u.test(m[0]) ? "Needs XeLaTeX or LuaLaTeX with a font that has this script." : "pdfLaTeX stops with \"Unicode character not set up for use with LaTeX\"."),
  }),
  rule({
    id: "tex.special",
    texOutput: true,
    group: "tex",
    name: "Unescaped special characters",
    desc: "50% starts a comment, R&D breaks outside tables, file_name needs math mode. Suggests \\%, \\& and \\_.",
    scope: "all",
    presets: { latex: true },
    fileTypes: [...TEX],
    detect: function* (c) {
      const t = c.text;
      let m: RegExpExecArray | null;
      const pct = /(?<=\d)(?<!\\)%/g;
      while ((m = pct.exec(t))) {
        if (c.inRegion(m.index - 1, "comment") || c.inRegion(m.index, "verbatim") || c.inRegion(m.index, "keys") || c.inRegion(m.index, "url")) continue;
        yield { start: m.index, end: m.index + 1, repl: null, suggestions: ["\\%"], note: "LaTeX reads % as the start of a comment. Everything after it on this line disappears." };
      }
      // TeX treats "50% of cases" as a comment, but the rest of that line is prose the author meant to print
      const pctComment = (p: number) => c.regions.some((r) => r.type === "comment" && r.start <= p && p < r.end && /\d/.test(t[r.start - 1] || ""));
      const guarded = (p: number) =>
        c.isProtected(p) && !(pctComment(p) && !c.inMath(p) && !c.inRegion(p, "verbatim") && !c.inRegion(p, "keys") && !c.inRegion(p, "url") && !c.inRegion(p, "cmd"));
      const amp = /(?<=[A-Za-z0-9.)] ?)(?<!\\)&(?= ?[A-Za-z0-9(])/g;
      while ((m = amp.exec(t))) {
        if (guarded(m.index) || insideTable(t, m.index)) continue;
        yield { start: m.index, end: m.index + 1, repl: null, suggestions: ["\\&"], note: "Outside a table, & stops the build with \"Misplaced alignment tab character\"." };
      }
      const us = /(?<=[A-Za-z0-9])(?<!\\)_(?=[A-Za-z0-9])/g;
      while ((m = us.exec(t))) {
        if (guarded(m.index)) continue;
        yield { start: m.index, end: m.index + 1, repl: null, suggestions: ["\\_"], note: "_ outside math stops the build with \"Missing $ inserted\"." };
      }
      const hash = /(?<!\\)#(?=\S)/g;
      while ((m = hash.exec(t))) {
        if (c.isProtected(m.index) || /\\(?:re)?newcommand|\\def|\\NewDocumentCommand|\\newenvironment/.test(t.slice(t.lastIndexOf("\n", m.index) + 1, m.index))) continue;
        if (/^#{1,6}[ \t]/.test(t.slice(m.index))) continue; // a Markdown heading, handled elsewhere
        yield { start: m.index, end: m.index + 1, repl: null, suggestions: ["\\#"], note: "# is reserved for macro parameters." };
      }
    },
  }),
  rule({
    id: "tex.dollars",
    texOutput: true,
    group: "tex",
    name: "$$ display math",
    desc: "$$...$$ is plain TeX and spaces badly in LaTeX. Suggests \\[...\\].",
    scope: "all",
    presets: { latex: true },
    fileTypes: [...TEX],
    pattern: /\$\$([\s\S]+?)\$\$/g,
    fix: (m, c) => (c.inRegion(m.index, "verbatim") || c.inRegion(m.index, "comment") ? undefined : null),
    suggest: (m) => [`\\[${m[1]}\\]`],
  }),
  rule({
    id: "tex.tie",
    texOutput: true,
    group: "tex",
    name: "Missing ties before references",
    desc: "Figure \\ref{...}, Table \\ref, et al. \\cite and similar should use ~ so the number never starts a new line. Off by default.",
    scope: "text",
    presets: {},
    fileTypes: [...TEX],
    pattern: /(?<=\b(?:Figure|Fig\.|Table|Tab\.|Section|Sec\.|Chapter|Eq\.|Equation|Appendix|Algorithm|Theorem|Lemma|al\.|[a-z]))[ \t]+(?=\\(?:ref|eqref|cref|autoref|cite[a-z]*)\b)/g,
    fix: () => null,
    suggest: () => ["~"],
  }),
];
