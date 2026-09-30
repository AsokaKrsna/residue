/** Lookalike letters, compatibility forms and styled Unicode letters. */
import type { Match, Rule } from "../types";
import { CJK, charAt, prevChar, rule } from "./util";

const ALL = { latex: true, markdown: true, plain: true, keep: true };

/** Letters from Cyrillic, Greek and Armenian that render like Latin letters (subset of Unicode TR39 confusables). */
export const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  "\u0430": "a", "\u0435": "e", "\u0456": "i", "\u0458": "j", "\u043E": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x",
  "\u0455": "s", "\u0501": "d", "\u051B": "q", "\u051D": "w", "\u04BB": "h", "\u04CF": "l", "\u0457": "i", "\u04AF": "y", "\u0261": "g",
  "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041A": "K", "\u041C": "M", "\u041D": "H", "\u041E": "O", "\u0420": "P", "\u0421": "C",
  "\u0422": "T", "\u0425": "X", "\u0406": "I", "\u0408": "J", "\u0405": "S", "\u04AE": "Y", "\u051A": "Q", "\u051C": "W", "\u04C0": "I", "\u0417": "3",
  // Greek
  "\u03BF": "o", "\u03B1": "a", "\u03BD": "v", "\u03C1": "p", "\u03B9": "i", "\u03BA": "k", "\u03C5": "u", "\u03C7": "x", "\u03F2": "c", "\u03F3": "j",
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z", "\u0397": "H", "\u0399": "I", "\u039A": "K", "\u039C": "M", "\u039D": "N", "\u039F": "O",
  "\u03A1": "P", "\u03A4": "T", "\u03A5": "Y", "\u03A7": "X",
  // Armenian
  "\u0585": "o", "\u057D": "u", "\u0570": "h", "\u0578": "n", "\u0566": "q", "\u0561": "w",
};
const FOREIGN = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}]/u;

export const formRules: Rule[] = [
  rule({
    id: "uf.homoglyph",
    group: "uf",
    name: "Lookalike letters",
    desc: "Cyrillic, Greek or Armenian letters hidden in Latin words, such as a Cyrillic \u0430 in \"d\u0430ta\". Real Russian or Greek words and Greek in math are left alone.",
    scope: "text",
    presets: ALL,
    detect: function* (c): Iterable<Match> {
      const re = /[\p{L}\p{M}]+/gu;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c.text))) {
        const w = m[0];
        if (!FOREIGN.test(w) || c.isProtected(m.index)) continue;
        const hasLatin = /[A-Za-z]/.test(w);
        const chars = Array.from(w);
        const allConfusable = chars.every((ch) => HOMOGLYPHS[ch] !== undefined || /[A-Za-z]/.test(ch));
        if (!hasLatin) {
          // a whole word spelled with lookalikes, inside a Latin line
          if (!allConfusable || chars.length < 2) continue;
          const line = c.text.slice(c.text.lastIndexOf("\n", m.index) + 1, (c.text.indexOf("\n", m.index) + 1 || c.text.length + 1) - 1);
          const latin = (line.match(/[A-Za-z]/g) || []).length;
          const other = (line.match(/[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}]/gu) || []).length;
          if (latin < other * 4) continue;
          yield { start: m.index, end: m.index + w.length, repl: null, suggestions: [chars.map((ch) => HOMOGLYPHS[ch] ?? ch).join("")], note: "Every letter here is a lookalike from another alphabet." };
          continue;
        }
        let off = m.index;
        for (const ch of chars) {
          if (FOREIGN.test(ch)) {
            const to = HOMOGLYPHS[ch];
            yield to !== undefined
              ? { start: off, end: off + ch.length, repl: to, note: `Inside the word "${w}".` }
              : { start: off, end: off + ch.length, repl: null, suggestions: ["(delete)"], note: `Foreign letter inside the Latin word "${w}".` };
          }
          off += ch.length;
        }
      }
    },
  }),
  rule({
    id: "uf.compat",
    group: "uf",
    name: "Ligatures and full-width forms",
    desc: "\uFB01 \uFB02 \uFB03 ligatures (common in text copied from PDFs), full-width \uFF21\uFF22\uFF23, Roman numeral symbols and small forms. Kept inside CJK text.",
    scope: "text",
    presets: ALL,
    pattern: /[\uFB00-\uFB06\uFF01-\uFF5E\u2024\u2025\u2160-\u217F\uFE50-\uFE6B\u01C4-\u01CC\u01F1-\u01F3\u0132\u0133\u013F\u0140\u0149]/g,
    fix: (m, c) => {
      const cp = m[0].codePointAt(0)!;
      if (cp >= 0xff01 && cp <= 0xff5e && (CJK.test(prevChar(c.text, m.index)) || CJK.test(charAt(c.text, m.index + 1)))) return undefined;
      const n = m[0].normalize("NFKC");
      return n === m[0] ? undefined : n;
    },
  }),
  rule({
    id: "uf.styled",
    group: "uf",
    name: "Styled Unicode letters",
    desc: "Bold, italic, script and double-struck letters from the math blocks, like \u{1D41B}\u{1D428}\u{1D425}\u{1D41D}. Screen readers spell them out and search misses them. Inside math they get \\mathbf, \\mathbb and similar.",
    scope: "all",
    presets: ALL,
    pattern: /[\u{1D400}-\u{1D7FF}\u2102\u210A-\u2113\u2115\u2119-\u211D\u2124\u2128\u212C\u212D\u212F-\u2131\u2133\u2134]+/gu,
    fix: (m, c) => {
      const plain = m[0].normalize("NFKC");
      if (!c.inMath(m.index)) return plain;
      return null;
    },
    suggest: (m) => {
      const cp = m[0].codePointAt(0)!;
      const plain = m[0].normalize("NFKC");
      const cmd = mathAlphaCommand(cp);
      return cmd ? [`${cmd}{${plain}}`, plain] : [plain];
    },
  }),
];

function mathAlphaCommand(cp: number): string {
  if ([0x2102, 0x2115, 0x2119, 0x211a, 0x211d, 0x2124].includes(cp)) return "\\mathbb";
  if ([0x210b, 0x2110, 0x2112, 0x211b, 0x212c, 0x2130, 0x2131, 0x2133].includes(cp)) return "\\mathcal";
  if ([0x210c, 0x2111, 0x211c, 0x2128, 0x212d].includes(cp)) return "\\mathfrak";
  const r: [number, number, string][] = [
    [0x1d400, 0x1d433, "\\mathbf"], [0x1d434, 0x1d467, ""], [0x1d468, 0x1d49b, "\\boldsymbol"],
    [0x1d49c, 0x1d503, "\\mathcal"], [0x1d504, 0x1d537, "\\mathfrak"], [0x1d538, 0x1d56b, "\\mathbb"],
    [0x1d56c, 0x1d59f, "\\mathfrak"], [0x1d5a0, 0x1d66f, "\\mathsf"], [0x1d670, 0x1d6a3, "\\mathtt"],
    [0x1d6a8, 0x1d6e1, "\\boldsymbol"], [0x1d7ce, 0x1d7d7, "\\mathbf"], [0x1d7d8, 0x1d7e1, "\\mathbb"],
    [0x1d7e2, 0x1d7f5, "\\mathsf"], [0x1d7f6, 0x1d7ff, "\\mathtt"],
  ];
  for (const [a, b, cmd] of r) if (cp >= a && cp <= b) return cmd;
  return "";
}
