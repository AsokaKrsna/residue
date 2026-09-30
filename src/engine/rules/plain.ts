/**
 * "Convert to plain text": strip Markdown and LaTeX markup but keep the structure a reader needs:
 * paragraphs, headings as their own lines, list items as "- " or "1. ", table rows as aligned columns.
 * All rules here are off by default. While any of them is on, every other rule writes plain text too.
 */
import type { Match, Rule, RuleContext } from "../types";
import { rule } from "./util";
import { RegionIndex, scanRegions } from "../regions";

const OFF = {};

/** Index just past the brace group that opens at i (t[i] === "{"). */
function braceEnd(t: string, i: number): number {
  let depth = 0;
  for (let j = i; j < t.length; j++) {
    const ch = t[j];
    if (ch === "\\") { j++; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (!depth) return j + 1; }
  }
  return -1;
}
function optEnd(t: string, i: number): number {
  let depth = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === "[") depth++;
    else if (t[j] === "]") { depth--; if (!depth) return j + 1; }
    else if (t[j] === "\n" && t[j + 1] === "\n") return -1;
  }
  return -1;
}

/** Parse "\name*[opt]{a}{b}" at i. Returns arguments and the end index, or null. */
function parseCommand(t: string, i: number, nArgs: number) {
  const m = /^\\([A-Za-z@]+)\*?/.exec(t.slice(i, i + 60));
  if (!m) return null;
  let k = i + m[0].length;
  const opts: string[] = [];
  while (t[k] === "[") {
    const e = optEnd(t, k);
    if (e < 0) break;
    opts.push(t.slice(k + 1, e - 1));
    k = e;
  }
  const args: string[] = [];
  for (let a = 0; a < nArgs; a++) {
    while (t[k] === " " || (t[k] === "\n" && t[k + 1] !== "\n")) k++;
    if (t[k] !== "{") return null;
    const e = braceEnd(t, k);
    if (e < 0) return null;
    args.push(t.slice(k + 1, e - 1));
    k = e;
  }
  return { name: m[1], opts, args, end: k };
}

/* ---------- math to readable text ---------- */

const GREEK: Record<string, string> = {
  alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", delta: "\u03B4", epsilon: "\u03F5", varepsilon: "\u03B5", zeta: "\u03B6", eta: "\u03B7",
  theta: "\u03B8", vartheta: "\u03D1", iota: "\u03B9", kappa: "\u03BA", lambda: "\u03BB", mu: "\u03BC", nu: "\u03BD", xi: "\u03BE", pi: "\u03C0",
  rho: "\u03C1", sigma: "\u03C3", tau: "\u03C4", upsilon: "\u03C5", phi: "\u03D5", varphi: "\u03C6", chi: "\u03C7", psi: "\u03C8", omega: "\u03C9",
  Gamma: "\u0393", Delta: "\u0394", Theta: "\u0398", Lambda: "\u039B", Xi: "\u039E", Pi: "\u03A0", Sigma: "\u03A3", Upsilon: "\u03A5",
  Phi: "\u03A6", Psi: "\u03A8", Omega: "\u03A9",
  times: "\u00D7", cdot: "\u00B7", div: "\u00F7", pm: "\u00B1", mp: "\u2213", leq: "\u2264", le: "\u2264", geq: "\u2265", ge: "\u2265",
  neq: "\u2260", ne: "\u2260", approx: "\u2248", equiv: "\u2261", sim: "\u223C", simeq: "\u2243", cong: "\u2245", propto: "\u221D",
  ll: "\u226A", gg: "\u226B", infty: "\u221E", partial: "\u2202", nabla: "\u2207", sum: "\u2211", prod: "\u220F", int: "\u222B",
  in: "\u2208", notin: "\u2209", subset: "\u2282", subseteq: "\u2286", supset: "\u2283", supseteq: "\u2287", cup: "\u222A", cap: "\u2229",
  emptyset: "\u2205", varnothing: "\u2205", forall: "\u2200", exists: "\u2203", neg: "\u00AC", land: "\u2227", wedge: "\u2227", lor: "\u2228", vee: "\u2228",
  to: "\u2192", rightarrow: "\u2192", leftarrow: "\u2190", leftrightarrow: "\u2194", Rightarrow: "\u21D2", Leftarrow: "\u21D0",
  Leftrightarrow: "\u21D4", mapsto: "\u21A6", implies: "\u21D2", iff: "\u21D4", ldots: "...", cdots: "...", dots: "...",
  circ: "\u2218", ast: "*", star: "\u22C6", prime: "\u2032", ell: "\u2113", hbar: "\u210F", langle: "\u27E8", rangle: "\u27E9",
  lfloor: "\u230A", rfloor: "\u230B", lceil: "\u2308", rceil: "\u2309", mid: "|", vert: "|", Vert: "\u2016", parallel: "\u2225",
  perp: "\u22A5", angle: "\u2220", otimes: "\u2297", oplus: "\u2295", setminus: "\\", top: "\u22A4", dagger: "\u2020",
  log: "log", ln: "ln", exp: "exp", sin: "sin", cos: "cos", tan: "tan", max: "max", min: "min", arg: "arg", lim: "lim", det: "det",
  sup: "sup", inf: "inf", Pr: "Pr", argmax: "argmax", argmin: "argmin",
};
const BB: Record<string, string> = { R: "\u211D", N: "\u2115", Z: "\u2124", Q: "\u211A", C: "\u2102", P: "\u2119", E: "\u{1D53C}" };
const SUP: Record<string, string> = { "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079", "+": "\u207A", "-": "\u207B", "=": "\u207C", "(": "\u207D", ")": "\u207E", n: "\u207F", i: "\u2071", T: "\u1D40" };
const SUB: Record<string, string> = { "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083", "4": "\u2084", "5": "\u2085", "6": "\u2086", "7": "\u2087", "8": "\u2088", "9": "\u2089", "+": "\u208A", "-": "\u208B", "=": "\u208C", "(": "\u208D", ")": "\u208E", a: "\u2090", e: "\u2091", o: "\u2092", x: "\u2093", i: "\u1D62", j: "\u2C7C", k: "\u2096", n: "\u2099", t: "\u209C", m: "\u2098", p: "\u209A", s: "\u209B" };

function script(s: string, table: Record<string, string>, mark: string): string {
  const chars = [...s];
  if (chars.length && chars.every((ch) => table[ch])) return chars.map((ch) => table[ch]).join("");
  return chars.length === 1 ? mark + s : `${mark}(${s})`;
}

/** A single symbol group needs no parentheses: x, 12, xᵢ, α². */
const atom = (s: string) => /^[\p{L}\p{N}\u00B2\u00B3\u00B9\u1D62-\u1D6A\u2070-\u209F\u2C7C]+$/u.test(s.trim());

/** Turn LaTeX math into something a person can read in plain text. */
export function mathToText(src: string): string {
  let s = src.replace(/\\(?:label|nonumber|notag|tag\*?)\s*(?:\{[^{}]*\})?/g, "");
  for (let round = 0; round < 12; round++) {
    const before = s;
    s = s
      .replace(/\\(?:left|right|big|Big|bigg|Bigg)[lr]?\s*([()[\]|.]|\\[{}|])/g, (_m, d) => (d === "." ? "" : d.replace("\\", "")))
      .replace(/\\mathbb\s*\{([A-Z])\}/g, (_m, a) => BB[a] ?? a)
      .replace(/\\(?:mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathfrak|boldsymbol|bm|text|textrm|textbf|textit|operatorname|mbox|hat|bar|tilde|vec|dot|overline|underline|widehat|widetilde)\s*\{([^{}]*)\}/g, "$1")
      // scripts first, so x_i inside a root or fraction is already x\u1D62
      .replace(/\^\s*\{([^{}\\]*)\}/g, (_m, a) => script(a, SUP, "^"))
      .replace(/_\s*\{([^{}\\]*)\}/g, (_m, a) => script(a, SUB, "_"))
      .replace(/\^\s*([A-Za-z0-9+-])/g, (_m, a) => script(a, SUP, "^"))
      .replace(/_\s*([A-Za-z0-9])/g, (_m, a) => script(a, SUB, "_"))
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, a, b) => `${atom(a) ? a : `(${a})`}/${atom(b) ? b : `(${b})`}`)
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, a) => (atom(a) ? `\u221A${a}` : `\u221A(${a})`));
    if (s === before) break;
  }
  return s
    .replace(/\\([A-Za-z]+)/g, (m, name) => GREEK[name] ?? (name === "quad" || name === "qquad" ? "  " : m))
    .replace(/\\[,;:!> ]/g, " ")
    .replace(/\\\\/g, "\n")
    .replace(/&/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/* ---------- LaTeX accents ---------- */

const ACCENT: Record<string, string> = { "'": "\u0301", "`": "\u0300", "^": "\u0302", '"': "\u0308", "~": "\u0303", "=": "\u0304", ".": "\u0307", c: "\u0327", v: "\u030C", u: "\u0306", H: "\u030B", r: "\u030A", k: "\u0328" };

/* ---------- rules ---------- */

const LIST_ENVS = /^(itemize|enumerate|description)$/;
const DROP_CMDS = new Set([
  "label", "maketitle", "tableofcontents", "listoffigures", "listoftables", "newpage", "clearpage", "cleardoublepage", "pagebreak",
  "linebreak", "noindent", "indent", "centering", "raggedright", "raggedleft", "includegraphics", "bibliographystyle", "bibliography",
  "addbibresource", "printbibliography", "vspace", "hspace", "vfill", "hfill", "medskip", "smallskip", "bigskip", "usepackage",
  "setlength", "setcounter", "addtocounter", "newcommand", "renewcommand", "providecommand", "DeclareMathOperator", "documentclass",
  "pagestyle", "thispagestyle", "graphicspath", "appendix", "frontmatter", "mainmatter", "backmatter", "protect", "phantom", "hphantom",
  "vphantom", "nocite", "index", "glossary", "selectlanguage",
]);
const ARG_CMDS = new Set([
  "textbf", "textit", "emph", "underline", "texttt", "textsc", "textsf", "textrm", "textup", "textsl", "textmd", "textnormal", "mbox",
  "text", "uline", "hl", "caption", "title", "author", "date", "subtitle", "enquote", "mathrm", "mathbf", "textsuperscript",
  "textsubscript", "ul", "sout", "st", "chapter", "part", "section", "subsection", "subsubsection", "paragraph", "subparagraph",
]);
const HEADING_CMDS = new Set(["part", "chapter", "section", "subsection", "subsubsection", "paragraph", "subparagraph", "title"]);
const REF_CMDS = /^(?:ref|eqref|cref|Cref|autoref|pageref|nameref|vref)$/;
const CITE_CMDS = /^(?:cite[a-zA-Z]*|parencite|textcite|autocite|footcite|supercite|nocite)$/;

function* texToPlain(c: RuleContext): Iterable<Match> {
  const t = c.text;
  const lineOf = (i: number) => [t.lastIndexOf("\n", i - 1) + 1, (t.indexOf("\n", i) + 1 || t.length + 1) - 1];
  const onlyOnLine = (s: number, e: number) => {
    const [ls, le] = lineOf(s);
    return t.slice(ls, s).trim() === "" && t.slice(e, le).trim() === "";
  };
  // a whole-line removal also removes its line break, so no blank lines pile up
  const dropLine = (s: number, e: number): Match => {
    const [ls, le] = lineOf(s);
    if (onlyOnLine(s, e)) return { start: ls, end: Math.min(le + 1, t.length), repl: "" };
    return { start: s, end: e, repl: "" };
  };

  // preamble and document wrapper
  const bd = t.indexOf("\\begin{document}");
  if (bd >= 0) yield { start: 0, end: bd + "\\begin{document}".length + (t[bd + 16] === "\n" ? 1 : 0), repl: "" };
  const ed = t.indexOf("\\end{document}");
  if (ed >= 0) yield { start: ed, end: t.length, repl: "\n" };

  // comments: a comment-only line disappears with its line break
  const com = /(?<!\\)%.*$/gm;
  let m: RegExpExecArray | null;
  while ((m = com.exec(t))) {
    if (c.inRegion(m.index, "verbatim") && !c.inRegion(m.index, "comment")) continue;
    yield onlyOnLine(m.index, m.index + m[0].length) ? dropLine(m.index, m.index + m[0].length) : { start: m.index, end: m.index + m[0].length, repl: "" };
  }

  // innermost environments
  const env = /\\begin\{([A-Za-z*]+)\}((?:\[[^\]\n]*\])*(?:\{[^{}\n]*\})*)([\s\S]*?)\\end\{\1\}/g;
  while ((m = env.exec(t))) {
    const [all, name, , body] = m;
    if (/\\begin\{/.test(body)) { env.lastIndex = m.index + 7; continue; } // not innermost yet
    if (name === "document") continue;
    // an environment nested inside math waits for the math conversion; one that *is* the math converts here
    const at = m.index;
    if (c.regions.some((r) => r.type === "math" && r.start < at && at < r.end) && !/^(aligned|cases|pmatrix|bmatrix|matrix)$/.test(name)) continue;
    const s = m.index, e = m.index + all.length;
    let out: string;
    if (LIST_ENVS.test(name)) {
      let n = 0;
      out = body
        .split(/\\item\b/)
        .slice(1)
        .map((it) => {
          const term = /^\s*\[([^\]]*)\]/.exec(it);
          const text = (term ? it.slice(term[0].length) : it).trim().replace(/\s*\n\s*/g, " ");
          if (name === "description" && term) return `${term[1]}: ${text}`;
          return name === "enumerate" ? `${++n}. ${text}` : `- ${text}`;
        })
        .join("\n");
    } else if (/^(tabular\*?|tabularx|longtable|array|tblr)$/.test(name)) {
      const rows = body
        .replace(/^\s*\{[^}]*\}/, "")
        .replace(/\\(?:hline|toprule|midrule|bottomrule|cline\{[^}]*\}|cmidrule(?:\([^)]*\))?\{[^}]*\})/g, "")
        .split(/\\\\/)
        .map((r) => r.split(/(?<!\\)&/).map((x) => x.trim()))
        .filter((r) => r.some((x) => x));
      const w = rows.reduce<number[]>((acc, r) => r.map((x, i) => Math.max(acc[i] ?? 0, x.length)), []);
      out = rows.map((r) => r.map((x, i) => (i < r.length - 1 ? x.padEnd(w[i]) : x)).join("  ").trimEnd()).join("\n");
    } else if (/^(verbatim\*?|lstlisting|minted|Verbatim)$/.test(name)) {
      out = body.replace(/^\s*(?:\[[^\]]*\])?(?:\{[^}]*\})?\n/, "").replace(/\n$/, "");
    } else if (/^(equation|align|gather|multline|flalign|eqnarray|displaymath|math)\*?$/.test(name)) {
      out = "    " + mathToText(body).replace(/\n/g, "\n    ");
    } else if (/^(figure|table)\*?$/.test(name)) {
      const cap = /\\caption(?:\[[^\]]*\])?\{/.exec(body);
      out = cap ? body.slice(cap.index + cap[0].length, braceEnd(body, cap.index + cap[0].length - 1) - 1) : "";
    } else {
      out = body.replace(/^\s*\n/, "").replace(/\n\s*$/, "");
    }
    yield { start: s, end: e, repl: out.trim() ? out : "" };
  }

  // commands
  const cmd = /\\([A-Za-z@]+)\*?/g;
  while ((m = cmd.exec(t))) {
    const s = m.index;
    if (c.inMath(s) || c.inRegion(s, "verbatim") || c.inRegion(s, "comment")) continue;
    const name = m[1];
    if (name === "begin" || name === "end" || name === "item") continue;
    if (DROP_CMDS.has(name)) {
      const p = parseCommand(t, s, 0);
      let end = p ? p.end : s + m[0].length;
      while (t[end] === "{") { const e2 = braceEnd(t, end); if (e2 < 0) break; end = e2; }
      yield dropLine(s, end);
      continue;
    }
    if (name === "footnote") {
      const p = parseCommand(t, s, 1);
      if (p) yield { start: s, end: p.end, repl: ` (${p.args[0]})` };
      continue;
    }
    if (name === "url" || name === "nolinkurl") {
      const p = parseCommand(t, s, 1);
      if (p) yield { start: s, end: p.end, repl: p.args[0] };
      continue;
    }
    if (name === "href") {
      const p = parseCommand(t, s, 2);
      if (p) yield { start: s, end: p.end, repl: p.args[1] === p.args[0] ? p.args[0] : `${p.args[1]} (${p.args[0]})` };
      continue;
    }
    if (CITE_CMDS.test(name)) {
      const p = parseCommand(t, s, 1);
      if (p) yield { start: s, end: p.end, repl: `[${p.args[0].split(",").map((k) => k.trim()).join(", ")}${p.opts.length ? ", " + p.opts[p.opts.length - 1] : ""}]` };
      continue;
    }
    if (REF_CMDS.test(name)) {
      const p = parseCommand(t, s, 1);
      if (p) yield { start: s, end: p.end, repl: p.args[0] };
      continue;
    }
    if (ARG_CMDS.has(name)) {
      const p = parseCommand(t, s, 1);
      if (!p) continue;
      if (HEADING_CMDS.has(name) && onlyOnLine(s, p.end)) {
        // a heading stays on its own line with a blank line after it
        const [, le] = lineOf(s);
        const nextBlank = t.slice(le + 1).startsWith("\n") || le >= t.length;
        yield { start: s, end: p.end, repl: p.args[0] + (nextBlank ? "" : "\n") };
      } else yield { start: s, end: p.end, repl: p.args[0] };
      continue;
    }
    // accents: \'e \'{e} \"{u}
    const acc = /^\\(['`^"~=.]|[cvuHrk](?=\{))\{?([A-Za-z])\}?/.exec(t.slice(s, s + 8));
    if (acc && ACCENT[acc[1]]) { yield { start: s, end: s + acc[0].length, repl: (acc[2] + ACCENT[acc[1]]).normalize("NFC") }; continue; }
    const simple: Record<string, string> = {
      ldots: "...", dots: "...", textellipsis: "...", LaTeX: "LaTeX", TeX: "TeX", textbackslash: "\\", S: "\u00A7", P: "\u00B6",
      textendash: "-", textemdash: " - ", textquoteleft: "'", textquoteright: "'", textquotedblleft: '"', textquotedblright: '"',
      newline: "\n", quad: " ", qquad: "  ", ss: "\u00DF", aa: "\u00E5", AA: "\u00C5", o: "\u00F8", O: "\u00D8", ae: "\u00E6", AE: "\u00C6",
      par: "\n\n", textregistered: "(R)", texttrademark: "(TM)", textcopyright: "(C)", textdegree: "\u00B0", today: "",
    };
    if (name in simple) yield { start: s, end: s + m[0].length + (t[s + m[0].length] === "{" && t[s + m[0].length + 1] === "}" ? 2 : 0), repl: simple[name] };
  }

  // old-style font switches {\bf text}
  const sw = /\{\\(?:bf|it|em|tt|sc|sf|rm|sl|small|footnotesize|large|Large|scriptsize|tiny|normalsize|bfseries|itshape|ttfamily)\s+([^{}]*)\}/g;
  while ((m = sw.exec(t))) if (!c.inMath(m.index)) yield { start: m.index, end: m.index + m[0].length, repl: m[1] };
}

/** Escapes, ties, quotes, dashes and line breaks. Runs once, last: after it, % is a percent sign, not a comment. */
function* texSymbols(c: RuleContext): Iterable<Match> {
  const t = c.text;
  const sym = /\\([%&_#${}])|\\\\(?:\[[^\]]*\])?|``|''|(?<!\\)~|---?|\\[,;:!@ ]|\\\//g;
  let m: RegExpExecArray | null;
  while ((m = sym.exec(t))) {
    const s = m.index;
    if (c.inRegion(s, "verbatim") || c.inRegion(s, "url")) continue;
    const v = m[0];
    const repl = m[1] ? m[1] : v.startsWith("\\\\") ? "\n" : v === "``" || v === "''" ? '"' : v === "~" ? " " : v === "---" ? " - " : v === "--" ? "-" : v === "\\/" || v === "\\@" ? "" : " ";
    yield { start: s, end: s + v.length, repl };
  }
}

/** Commands no rule knows: keep the last argument's text, drop the command. */
function* texLeftovers(c: RuleContext): Iterable<Match> {
  const t = c.text;
  const re = /\\([A-Za-z@]+)\*?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (c.inRegion(m.index, "verbatim")) continue;
    let k = m.index + m[0].length;
    while (t[k] === "[") { const e = optEnd(t, k); if (e < 0) break; k = e; }
    let lastArg: string | null = null;
    while (t[k] === "{") { const e = braceEnd(t, k); if (e < 0) break; lastArg = t.slice(k + 1, e - 1); k = e; }
    yield { start: m.index, end: k, repl: lastArg ?? (t[k] === " " && /\w/.test(t[m.index - 1] || "") ? "" : "") };
  }
  // bare braces left from groups
  const br = /(?<!\\)\{([^{}]*)\}/g;
  while ((m = br.exec(t))) if (!c.inRegion(m.index, "verbatim")) yield { start: m.index, end: m.index + m[0].length, repl: m[1] };
}

function contextFor(t: string): RuleContext {
  const regions = scanRegions(t, "tex");
  const idx = (type: string) => new RegionIndex(regions.filter((r) => r.type === type));
  const math = idx("math"), verb = idx("verbatim"), com = idx("comment"), url = idx("url"), keys = idx("keys"), cmd = idx("cmd");
  const by: Record<string, RegionIndex> = { math, verbatim: verb, comment: com, url, keys, cmd, hidden: idx("hidden") };
  return {
    text: t, fileType: "tex", output: "txt", preset: "plain", option: undefined, regions,
    isProtected: () => false, inMath: (p) => math.has(p), inRegion: (p, type) => by[type].has(p),
  };
}

/** Apply non-overlapping matches: earliest first, longer wins a tie. */
function applyMatches(t: string, ms: Match[]): string {
  ms.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  let out = "", pos = 0;
  for (const x of ms) {
    if (x.start < pos || x.repl === null) continue;
    out += t.slice(pos, x.start) + x.repl;
    pos = x.end;
  }
  return out + t.slice(pos);
}

function runStage(t: string, gen: (c: RuleContext) => Iterable<Match>, max: number): string {
  for (let i = 0; i < max; i++) {
    const ms = [...gen(contextFor(t))];
    if (!ms.length) break;
    const next = applyMatches(t, ms);
    if (next === t) break;
    t = next;
  }
  return t;
}

/**
 * Whole-document LaTeX to plain text, in a fixed order so no stage can misread another's output:
 * structure and commands, then inline math, then escapes, then unknown leftovers.
 */
export function texToPlainText(src: string): string {
  let t = runStage(src, (c) => texToPlain(c), 40);
  t = runStage(t, (c) => mathToPlain({ ...c, fileType: "md" }), 1);
  t = runStage(t, texSymbols, 1);
  t = runStage(t, texLeftovers, 10);
  return t.replace(/\n{3,}/g, "\n\n");
}

function* mdToPlain(c: RuleContext): Iterable<Match> {
  const t = c.text;
  let m: RegExpExecArray | null;
  // indented lines are code in Markdown, and converted code blocks are indented, so both stay untouched
  const indented = (p: number) => /^(?: {4}|\t)/.test(t.slice(t.lastIndexOf("\n", p - 1) + 1));
  const code = (p: number) => (c.fileType === "md" && c.inRegion(p, "verbatim")) || indented(p);
  const each = function* (re: RegExp, fn: (m: RegExpExecArray) => string | null, allowInCode = false): Iterable<Match> {
    re.lastIndex = 0;
    while ((m = re.exec(t))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      if (!allowInCode && code(m.index)) continue;
      if (c.fileType === "tex" && (c.inMath(m.index) || c.inRegion(m.index, "comment"))) continue;
      const r = fn(m);
      if (r !== null) yield { start: m.index, end: m.index + m[0].length, repl: r };
    }
  };
  // fenced code: keep the code, drop the fences
  yield* each(/^[ \t]*(```|~~~)[^\n]*\n([\s\S]*?)\n?[ \t]*\1[ \t]*$/gm, (x) => x[2].split("\n").map((l) => (l ? "    " + l : l)).join("\n"), true);
  // YAML front matter
  yield* each(/^---\n[\s\S]*?\n---\n/g, () => "", true);
  yield* each(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t#]*$/gm, (x) => x[1]);
  yield* each(/^(?=[^\n]*\S)([^\n]+)\n(?:=+|-+)[ \t]*$/gm, (x) => (/^\s*([-*+]|\d+\.)\s|^\s*\|/.test(x[1]) ? null : x[1]));
  yield* each(/!\[([^\]\n]*)\]\([^)\n]*\)/g, (x) => x[1]);
  yield* each(/(?<!!)\[([^\]\n]+)\]\((\S+?)(?:\s+"[^"]*")?\)/g, (x) => (x[1] === x[2] ? x[2] : `${x[1]} (${x[2]})`));
  yield* each(/\[([^\]\n]+)\]\[[^\]\n]*\]/g, (x) => x[1]);
  yield* each(/<((?:https?|mailto):[^>\s]+)>/g, (x) => x[1]);
  yield* each(/\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*|(?<![\w\\])__(?=\S)([^_\n]+?)(?<=\S)__(?!\w)/g, (x) => x[1] ?? x[2]);
  yield* each(/(?<![*\w\\])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![*\w])|(?<![\w\\])_(?=[^\s_])([^_\n]+?)(?<=[^\s_])_(?!\w)/g, (x) => x[1] ?? x[2]);
  yield* each(/~~(?=\S)([^~\n]+?)(?<=\S)~~/g, (x) => x[1]);
  yield* each(/(?<!`)`([^`\n]+)`(?!`)/g, (x) => x[1], true);
  yield* each(/^([ \t]*)>[ \t]?/gm, (x) => x[1]);
  yield* each(/^([ \t]*)[*+](?=[ \t]+\S)/gm, (x) => `${x[1]}-`);
  yield* each(/^([ \t]*[-*+][ \t]+)\[[ xX]\][ \t]+/gm, (x) => x[1]);
  yield* each(/^[ \t]*(?:\*[ \t]*){3,}$|^[ \t]*(?:_[ \t]*){3,}$/gm, () => "");
  // a --- line after a blank line is a horizontal rule (after text it is a setext heading, handled above)
  yield* each(/(?<=(?:^|\n)[ \t]*\n)[ \t]*-{3,}[ \t]*$/gm, () => (c.fileType === "tex" ? null : ""));
  yield* each(/<br\s*\/?>/gi, () => "\n");
  yield* each(/<\/?(?:span|div|p|em|strong|b|i|u|sup|sub|small|font|mark|a|kbd|code|center|details|summary)\b[^>\n]*>/gi, () => "");
  yield* each(/\\([\\`*_{}[\]()#+\-.!|>~])/g, (x) => (c.fileType === "tex" ? null : x[1]));
  // pipe tables become aligned columns
  const tbl = /(?:^[ \t]*\|.*\|[ \t]*(?:\n|$)){2,}/gm;
  while ((m = tbl.exec(t))) {
    if (code(m.index)) continue;
    const block = m[0].replace(/\n$/, "");
    const rows = block.split("\n").filter((l) => !/^[ \t]*\|?[ \t]*:?-{2,}/.test(l)).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim()));
    const w = rows.reduce<number[]>((acc, r) => r.map((x, i) => Math.max(acc[i] ?? 0, x.length)), []);
    yield { start: m.index, end: m.index + block.length, repl: rows.map((r) => r.map((x, i) => (i < r.length - 1 ? x.padEnd(w[i]) : x)).join("  ").trimEnd()).join("\n") };
  }
}

function* mathToPlain(c: RuleContext): Iterable<Match> {
  for (const r of c.regions) {
    if (r.type !== "math") continue;
    const src = c.text.slice(r.start, r.end);
    // environments are handled with their surroundings by the LaTeX rule
    if (/^\\begin\{/.test(src)) {
      if (c.fileType === "tex") continue;
      const inner = src.replace(/^\\begin\{[^}]*\}/, "").replace(/\\end\{[^}]*\}$/, "");
      yield { start: r.start, end: r.end, repl: "    " + mathToText(inner) };
      continue;
    }
    const display = /^(\$\$|\\\[)/.test(src);
    const inner = src.replace(/^(\$\$|\$|\\\(|\\\[)/, "").replace(/(\$\$|\$|\\\)|\\\])$/, "");
    const txt = mathToText(inner);
    yield { start: r.start, end: r.end, repl: display ? `\n    ${txt.replace(/\n/g, "\n    ")}\n` : txt };
  }
}

export const plainRules: Rule[] = [
  rule({
    id: "plain.md",
    group: "plain",
    name: "Markdown to plain text",
    desc: "Removes #, **, *, `, >, links and tables syntax. Headings and list items stay on their own lines, tables become aligned columns, code keeps its lines.",
    scope: "all",
    presets: OFF,
    detect: mdToPlain,
  }),
  rule({
    id: "plain.tex",
    late: true,
    group: "plain",
    name: "LaTeX to plain text",
    desc: "Removes the preamble, comments and commands. Sections become lines, itemize and enumerate become - and 1. lists, tables become columns, \\cite{key} becomes [key].",
    scope: "all",
    presets: OFF,
    fileTypes: ["tex"],
    detect: function* (c) {
      // only while the text is still LaTeX; the converted output must never be read as LaTeX again
      if (!/\\[A-Za-z]/.test(c.text)) return;
      const out = texToPlainText(c.text);
      if (out !== c.text) yield { start: 0, end: c.text.length, repl: out, note: "The whole document is converted in one step, so Undo restores it in one step too." };
    },
  }),
  rule({
    id: "plain.math",
    group: "plain",
    name: "Math to readable text",
    desc: "$x^2 \\leq \\alpha$ becomes x\u00B2 \u2264 \u03B1. Fractions become a/b, display equations get their own indented line.",
    scope: "all",
    presets: OFF,
    detect: mathToPlain,
  }),
];
