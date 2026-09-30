/**
 * Region scanners. They mark spans that prose rules must never touch:
 * math, verbatim code, comments, citation keys and labels, URLs and LaTeX command names.
 * The scanners are linear and forgiving: unbalanced input never throws, it just ends the region at EOF.
 */
import type { FileType, Region, RegionType } from "./types";

const MATH_ENVS = new Set([
  "equation", "equation*", "align", "align*", "alignat", "alignat*", "gather", "gather*",
  "multline", "multline*", "flalign", "flalign*", "eqnarray", "eqnarray*", "math", "displaymath",
  "dmath", "dmath*", "split", "subequations",
]);
const VERB_ENVS = new Set([
  "verbatim", "verbatim*", "Verbatim", "lstlisting", "minted", "comment", "filecontents", "filecontents*",
  "alltt", "BVerbatim", "LVerbatim", "code", "tikzpicture", "forest",
]);
/** Commands whose first mandatory argument is a key, path or URL, never prose. */
const KEY_CMDS = new Set([
  "cite", "citep", "citet", "citealp", "citealt", "citeauthor", "citeyear", "citeyearpar", "parencite", "textcite",
  "autocite", "footcite", "fullcite", "nocite", "Cite", "Citep", "Citet", "supercite", "smartcite", "cites",
  "ref", "eqref", "pageref", "autoref", "cref", "Cref", "crefrange", "nameref", "vref", "label",
  "url", "href", "hyperref", "hypertarget", "hyperlink",
  "input", "include", "includeonly", "includegraphics", "includepdf", "import", "subimport",
  "usepackage", "RequirePackage", "documentclass", "bibliography", "bibliographystyle", "addbibresource",
  "usetikzlibrary", "graphicspath", "newcommand", "renewcommand", "providecommand", "newenvironment",
  "renewenvironment", "DeclareMathOperator", "def", "let", "setlength", "addtolength", "setcounter",
  "addtocounter", "hspace", "vspace", "color", "textcolor", "definecolor", "pagestyle", "thispagestyle",
  "pagenumbering", "newtheorem", "lstinputlisting", "inputminted", "glsadd", "gls", "Gls", "glspl", "acrshort",
  "acrlong", "acrfull", "ac", "acp", "Ac", "SI", "si", "num", "qty", "unit",
]);

function add(out: Region[], type: RegionType, start: number, end: number) {
  if (end > start) out.push({ type, start, end });
}

/** Find the index just past the matching close brace, starting at an open brace. */
function matchBrace(t: string, i: number, open = "{", close = "}"): number {
  let depth = 0;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (c === "\\") { j++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return j + 1; }
  }
  return t.length;
}

export function scanTex(t: string): Region[] {
  const out: Region[] = [];
  const n = t.length;
  let i = 0;
  while (i < n) {
    const c = t[i];
    if (c === "%") {
      const e = t.indexOf("\n", i);
      add(out, "comment", i, e < 0 ? n : e);
      i = e < 0 ? n : e;
      continue;
    }
    if (c === "$") {
      if (t[i + 1] === "$") {
        const e = t.indexOf("$$", i + 2);
        const end = e < 0 ? n : e + 2;
        add(out, "math", i, end);
        i = end;
        continue;
      }
      // inline math: ends at the next unescaped $, never crossing a blank line
      let j = i + 1;
      while (j < n && t[j] !== "$") {
        if (t[j] === "\\") j++;
        else if (t[j] === "\n" && t[j + 1] === "\n") break;
        j++;
      }
      if (j < n && t[j] === "$") { add(out, "math", i, j + 1); i = j + 1; }
      else i++;
      continue;
    }
    if (c !== "\\") { i++; continue; }

    const next = t[i + 1];
    if (next === "(" || next === "[") {
      const closer = next === "(" ? "\\)" : "\\]";
      const e = t.indexOf(closer, i + 2);
      const end = e < 0 ? n : e + 2;
      add(out, "math", i, end);
      i = end;
      continue;
    }
    if (next === undefined || !/[A-Za-z@]/.test(next)) { i += 2; continue; } // escaped char like \% or \$
    let j = i + 1;
    while (j < n && /[A-Za-z@]/.test(t[j])) j++;
    const name = t.slice(i + 1, j);
    add(out, "cmd", i, j);

    if (name === "verb" || name === "lstinline" || name === "mintinline") {
      let k = j;
      if (t[k] === "*") k++;
      if (name === "mintinline" && t[k] === "{") k = matchBrace(t, k);
      if (t[k] === "{") { const e = matchBrace(t, k); add(out, "verbatim", i, e); i = e; continue; }
      const delim = t[k];
      if (!delim || delim === "\n") { i = j; continue; }
      const e = t.indexOf(delim, k + 1);
      const end = e < 0 ? n : e + 1;
      add(out, "verbatim", i, end);
      i = end;
      continue;
    }
    if (name === "begin" && t[j] === "{") {
      const e = matchBrace(t, j);
      const env = t.slice(j + 1, e - 1);
      add(out, "keys", j, e);
      const endTag = `\\end{${env}}`;
      if (MATH_ENVS.has(env) || VERB_ENVS.has(env)) {
        const f = t.indexOf(endTag, e);
        const end = f < 0 ? n : f + endTag.length;
        add(out, MATH_ENVS.has(env) ? "math" : "verbatim", i, end);
        i = end;
        continue;
      }
      i = e;
      continue;
    }
    if (name === "end" && t[j] === "{") {
      const e = matchBrace(t, j);
      add(out, "keys", j, e);
      i = e;
      continue;
    }
    if (KEY_CMDS.has(name)) {
      let k = j;
      if (t[k] === "*") k++;
      // optional args may be prose (e.g. \cite[p.~4]{key}); skip them, protect the mandatory key
      while (k < n && /\s/.test(t[k]) && t[k] !== "\n") k++;
      while (t[k] === "[") { k = matchBrace(t, k, "[", "]"); while (k < n && t[k] === " ") k++; }
      if (t[k] === "{") {
        const e = matchBrace(t, k);
        add(out, "keys", k, e);
        // \href{url}{text}: second arg is prose, leave it
        i = e;
        continue;
      }
      i = k;
      continue;
    }
    i = j;
  }
  return out;
}

export function scanMarkdown(t: string): Region[] {
  const out: Region[] = [];
  // YAML front matter
  const fm = /^---\n[\s\S]*?\n---\n/.exec(t);
  if (fm) add(out, "verbatim", 0, fm[0].length);
  const patterns: [RegExp, RegionType][] = [
    [/^(```|~~~)[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|(?![\s\S]))/gm, "verbatim"],
    [/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, "verbatim"],
    [/<!--[\s\S]*?-->/g, "comment"],
    [/\$\$[\s\S]+?\$\$/g, "math"],
    [/(?<![\\$\w])\$(?![\s$])(?:\\.|[^$\\\n])+?(?<!\s)\$(?!\w)/g, "math"],
    [/\\\([\s\S]+?\\\)/g, "math"],
    [/\\\[[\s\S]+?\\\]/g, "math"],
    [/\]\([^)\s]*(?:\s+"[^"]*")?\)/g, "keys"], // link targets
    [/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "keys"], // reference definitions
    [/<\/?[A-Za-z][^>\n]*>/g, "keys"], // inline HTML tags
  ];
  for (const [re, type] of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      add(out, type, m.index, m.index + m[0].length);
      if (!m[0].length) re.lastIndex++;
    }
  }
  return out;
}

export function scanBib(t: string): Region[] {
  const out: Region[] = [];
  const res: [RegExp, RegionType][] = [
    [/@[A-Za-z]+\s*[{(][^,\n]*,/g, "keys"], // entry type and citation key
    [/^\s*[A-Za-z_-]+\s*=/gm, "keys"], // field names
    [/\b(?:url|doi|eprint|file|isbn|issn|pdf|howpublished)\s*=\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*")/gi, "keys"],
    [/(?<!\\)%.*$/gm, "comment"],
  ];
  for (const [re, type] of res) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(t))) add(out, type, m.index, m.index + m[0].length);
  }
  // field values can still contain math
  for (const r of scanTex(t)) if (r.type === "math") out.push(r);
  return out;
}

export function scanUrls(t: string): Region[] {
  const out: Region[] = [];
  const re = /\b(?:https?:\/\/|www\.|doi:\s?10\.)[^\s<>"'`{}|\\^\]]+[^\s<>"'`{}|\\^\].,;:!?)]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) add(out, "url", m.index, m.index + m[0].length);
  const email = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
  while ((m = email.exec(t))) add(out, "url", m.index, m.index + m[0].length);
  return out;
}

export function scanRegions(t: string, fileType: FileType): Region[] {
  const r =
    fileType === "tex" ? scanTex(t) :
    fileType === "md" ? scanMarkdown(t) :
    fileType === "bib" ? scanBib(t) : [];
  return r.concat(scanUrls(t)).sort((a, b) => a.start - b.start || b.end - a.end);
}

/** Fast membership test over sorted, possibly overlapping regions. */
export class RegionIndex {
  private starts: number[];
  private maxEnd: number[];
  constructor(private regions: Region[]) {
    const s = [...regions].sort((a, b) => a.start - b.start);
    this.regions = s;
    this.starts = s.map((x) => x.start);
    this.maxEnd = [];
    let m = -1;
    for (const x of s) { m = Math.max(m, x.end); this.maxEnd.push(m); }
  }
  /** true if pos lies inside any region (start <= pos < end) */
  has(pos: number): boolean {
    let lo = 0, hi = this.starts.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.starts[mid] <= pos) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (idx < 0 || this.maxEnd[idx] <= pos) return false;
    for (let k = idx; k >= 0 && this.maxEnd[k] > pos; k--) if (this.regions[k].end > pos) return true;
    return false;
  }
}
