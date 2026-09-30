/** Invisible characters, control characters and encoding damage. */
import type { Match, Rule } from "../types";
import { chipLabel, decodeTags, decodeVariationSelectors } from "../unicode";
import { CJK, DELETE, EMOJI_PART, JOINING_SCRIPT, RTL_SCRIPT, charAt, lineAround, prevChar, rule } from "./util";

const ALL = { latex: true, markdown: true, plain: true, keep: true };
const chip = (s: string) => chipLabel(Array.from(s)[0]) || "?";

/** Index just past the brace group starting at i, or -1. */
function groupEnd(t: string, i: number): number {
  let d = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === "\\") { j++; continue; }
    if (t[j] === "{") d++;
    else if (t[j] === "}" && --d === 0) return j + 1;
  }
  return -1;
}

const WHITE = String.raw`(?:white|White|#?[fF]{3}(?:[fF]{3})?|1\s*,\s*1\s*,\s*1|255\s*,\s*255\s*,\s*255)`;
const INJECTION = /\b(?:ignore (?:all |any )?(?:previous|prior|above) (?:instructions|prompts)|give (?:a |only )?positive review|do not (?:highlight|mention) (?:any )?(?:negatives|weaknesses)|(?:as|for) (?:an? )?(?:AI|LLM) (?:reviewer|model|assistant)s?,|recommend accept(?:ing|ance of) this paper)\b/gi;

export const hiddenTextRule: Rule = rule({
  id: "inv.hidden",
  group: "inv",
  name: "Text styled to be invisible",
  desc: "White or microscopic text, hidden Word runs, display:none, and phrases like \"ignore previous instructions\". In 2025, 18 arXiv papers were caught hiding prompts for AI reviewers this way.",
  scope: "all",
  presets: ALL,
  detect: function* (c): Iterable<Match> {
    const t = c.text;
    const note = "Readers cannot see this, but AI tools that read the file can. Remove it unless you put it there on purpose.";
    let m: RegExpExecArray | null;
    for (const r of c.regions) if (r.type === "hidden") yield { start: r.start, end: r.end, repl: null, suggestions: [DELETE], note: "Hidden in the Word file (hidden, white or tiny text). " + note };
    if (c.fileType === "tex") {
      const tc = new RegExp(String.raw`\\textcolor(?:\[[a-zA-Z]+\])?\{${WHITE}\}\{`, "g");
      while ((m = tc.exec(t))) {
        const e = groupEnd(t, m.index + m[0].length - 1);
        if (e > 0) yield { start: m.index, end: e, repl: null, suggestions: [DELETE], note };
      }
      const col = new RegExp(String.raw`\\color(?:\[[a-zA-Z]+\])?\{${WHITE}\}`, "g");
      while ((m = col.exec(t))) {
        if (c.inRegion(m.index, "comment")) continue;
        // {\color{white} hidden} : flag the whole group
        const open = t.lastIndexOf("{", m.index);
        const e = open >= 0 && t.slice(open + 1, m.index).trim() === "" ? groupEnd(t, open) : -1;
        yield e > 0 ? { start: open, end: e, repl: null, suggestions: [DELETE], note } : { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [], note };
      }
      const tiny = /\\(?:fontsize\{0?\.\d+\s*(?:pt)?\}\{[^}]*\}(?:\\selectfont)?|scalebox\{0?\.0\d*\}|resizebox\{0?\.0\d*\S*?\}\{[^}]*\})/g;
      while ((m = tiny.exec(t))) if (!c.inRegion(m.index, "comment")) yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [], note: "Text scaled to almost nothing. " + note };
    }
    const html = new RegExp(
      String.raw`<(span|div|p|font|small)\b[^>]*?(?:style\s*=\s*"[^"]*?(?:color\s*:\s*(?:white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))|font-size\s*:\s*0(?:\.\d+)?(?:px|pt|em|rem)?\s*[;"]|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?\s*[;"])[^"]*"|color\s*=\s*"(?:white|#fff(?:fff)?)")[^>]*>[\s\S]{0,2000}?</\1>`,
      "gi",
    );
    if (c.fileType !== "tex") while ((m = html.exec(t))) yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [DELETE], note };
    INJECTION.lastIndex = 0;
    while ((m = INJECTION.exec(t))) {
      if (c.regions.some((r) => r.type === "hidden" && r.start <= m!.index && m!.index < r.end)) continue;
      yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [], note: "An instruction aimed at AI tools. It does not belong in a paper." };
    }
  },
});

export const invisibleRules: Rule[] = [
  hiddenTextRule,
  rule({
    id: "inv.zw",
    group: "inv",
    name: "Zero-width spaces",
    desc: "ZWSP, word joiner and stray byte order marks. A BOM at the very start of a file is left alone.",
    scope: "all",
    presets: ALL,
    pattern: /[\u200B\u2060\uFEFF]/g,
    fix: (m) => (m.index === 0 && m[0] === "\uFEFF" ? undefined : ""),
    chip,
  }),
  rule({
    id: "inv.joiner",
    group: "inv",
    name: "Stray joiners",
    desc: "ZWJ and ZWNJ outside the scripts that need them. They are kept in Bengali, Hindi, Arabic, Persian and emoji sequences.",
    scope: "all",
    presets: ALL,
    pattern: /[\u200C\u200D]/g,
    fix: (m, c) => {
      const p = prevChar(c.text, m.index);
      const n = charAt(c.text, m.index + 1);
      if (JOINING_SCRIPT.test(p) || JOINING_SCRIPT.test(n)) return undefined;
      if (m[0] === "\u200D" && EMOJI_PART.test(p) && EMOJI_PART.test(n)) return undefined;
      return "";
    },
    chip,
  }),
  rule({
    id: "inv.shy",
    group: "inv",
    name: "Soft hyphens",
    desc: "Invisible hyphenation hints. They split words for search and spell check. In LaTeX they can become \\- instead.",
    scope: "all",
    presets: ALL,
    options: [
      { value: "", label: "remove" },
      { value: "\\-", label: "\\- (LaTeX hint)" },
    ],
    optionDefaults: { latex: "" },
    pattern: /\u00AD/g,
    fix: (_m, c) => (c.output === "tex" && c.option === "\\-" && !c.isProtected(_m.index) ? "\\-" : ""),
    chip,
  }),
  rule({
    id: "inv.bidi",
    group: "inv",
    name: "Direction controls",
    desc: "LRM, RLM, embeddings, overrides and isolates. They can make text display in a different order than it is stored. Kept on lines that contain Hebrew or Arabic.",
    scope: "all",
    presets: ALL,
    pattern: /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g,
    fix: (m, c) => (RTL_SCRIPT.test(lineAround(c.text, m.index)) ? undefined : ""),
    note: (m) => (/[\u202D\u202E]/.test(m[0]) ? "Override characters are used in 'Trojan Source' attacks to disguise text." : undefined),
    chip,
  }),
  rule({
    id: "inv.tag",
    group: "inv",
    name: "Hidden tag text",
    desc: "Unicode tag characters can spell out a hidden message, a trick used to smuggle instructions to AI tools. Flag emoji such as England's are kept.",
    scope: "all",
    presets: ALL,
    pattern: /[\u{E0000}-\u{E007F}]+/gu,
    fix: (m, c) => {
      if (prevChar(c.text, m.index) === "\u{1F3F4}" && /^[\u{E0061}-\u{E007A}]+\u{E007F}$/u.test(m[0])) return undefined;
      return "";
    },
    note: (m) => {
      const d = decodeTags(m[0]);
      return d ? `Hidden text reads: "${d}"` : undefined;
    },
    chip: (s) => `TAG\u00D7${Array.from(s).length}`,
  }),
  rule({
    id: "inv.vs",
    group: "inv",
    name: "Stray variation selectors",
    desc: "Removed when they follow plain text or come in runs, a known way to hide data. Kept after emoji and CJK where they select a glyph.",
    scope: "all",
    presets: ALL,
    pattern: /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]+/gu,
    fix: (m, c) => {
      const n = Array.from(m[0]).length;
      if (n > 1) return "";
      const p = prevChar(c.text, m.index);
      const cp = m[0].codePointAt(0)!;
      if (cp === 0xfe0e || cp === 0xfe0f) return /\p{Emoji}/u.test(p) ? undefined : "";
      if (cp >= 0xe0100) return CJK.test(p) ? undefined : "";
      return !p || /[\s\x21-\x7E]/.test(p) ? "" : undefined;
    },
    note: (m) => {
      const n = Array.from(m[0]).length;
      if (n < 2) return undefined;
      const d = decodeVariationSelectors(m[0]);
      return d && /^[\x20-\x7E\s]+$/.test(d) ? `${n} selectors in a row. Decoded as bytes they read: "${d}"` : `${n} selectors in a row. Real text never needs more than one.`;
    },
    chip: (s) => (Array.from(s).length > 1 ? `VS\u00D7${Array.from(s).length}` : chip(s)),
  }),
  rule({
    id: "inv.filler",
    group: "inv",
    name: "Blank fillers",
    desc: "Hangul fillers, the braille blank and Khmer inherent vowels. They look like nothing or like a space but count as letters, so they slip past most filters.",
    scope: "all",
    presets: ALL,
    pattern: /[\u115F\u1160\u3164\uFFA0\u2800\u17B4\u17B5]/g,
    fix: (m, c) => {
      const p = prevChar(c.text, m.index), n = charAt(c.text, m.index + 1);
      if (m[0] === "\u2800") {
        if (/[\u2801-\u28FF]/.test(p) || /[\u2801-\u28FF]/.test(n)) return undefined;
        return /\S/.test(p) && /\S/.test(n) ? " " : "";
      }
      if (/[\u115F\u1160]/.test(m[0]) && (/[\u1100-\u11FF]/.test(p) || /[\u1100-\u11FF]/.test(n))) return undefined;
      if (/[\u3164\uFFA0]/.test(m[0])) return /\S/.test(p) && /\S/.test(n) ? " " : "";
      return "";
    },
    chip,
  }),
  rule({
    id: "inv.format",
    group: "inv",
    name: "Other invisible format marks",
    desc: "Combining grapheme joiner, invisible math operators, deprecated format controls, interlinear annotation marks, object replacement boxes and invisible musical beam marks.",
    scope: "all",
    presets: ALL,
    pattern: /[\u034F\u2061-\u2064\u206A-\u206F\uFFF9-\uFFFC\u180B-\u180F\u{1D173}-\u{1D17A}]/gu,
    fix: (m, c) => {
      if (/[\u180B-\u180F]/.test(m[0]) && /\p{Script=Mongolian}/u.test(prevChar(c.text, m.index))) return undefined;
      return "";
    },
    chip,
  }),
  rule({
    id: "inv.ctrl",
    group: "inv",
    name: "Control characters",
    desc: "C0 and C1 control codes other than tab and line breaks. Vertical tab and form feed become line breaks.",
    scope: "all",
    presets: ALL,
    pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]/g,
    fix: (m) => (m[0] === "\x0B" || m[0] === "\x0C" ? "\n" : ""),
    chip: (s) => chipLabel(s) || "CTRL",
  }),
  rule({
    id: "inv.pua",
    group: "inv",
    name: "Private use characters",
    desc: "Characters with no standard meaning. ChatGPT uses U+E200 to U+E202 around citations. Others usually come from icon fonts.",
    scope: "all",
    presets: ALL,
    pattern: /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu,
    fix: (m) => (/[\uE200-\uE202]/.test(m[0]) ? "" : null),
    suggest: () => [DELETE],
    chip: () => "PUA",
  }),
  rule({
    id: "inv.other",
    group: "inv",
    name: "Any other invisible character",
    desc: "A safety net. Flags any remaining format or default-ignorable character that no rule above explains, so nothing slips through.",
    scope: "all",
    presets: ALL,
    pattern: /[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu,
    fix: (m) =>
      /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFB\u{1D173}-\u{1D17A}\u{E0000}-\u{E0FFF}]/u.test(m[0])
        ? undefined
        : null,
    suggest: () => [DELETE],
    chip,
  }),
];

/* ---------- encoding damage ---------- */

const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const CONT = "\\u0080-\\u00BF\\u0152\\u0153\\u0160\\u0161\\u0178\\u017D\\u017E\\u0192\\u02C6\\u02DC\\u2013\\u2014\\u2018\\u2019\\u201A\\u201C\\u201D\\u201E\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122";
const MOJI = new RegExp(`(?:[\\u00C2-\\u00F4][${CONT}]{1,3})+`, "g");

/** Reverse UTF-8 bytes that were decoded as Windows-1252. Returns null when the run is not mojibake. */
export function unMojibake(s: string): string | null {
  const bytes: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0xff) bytes.push(cp);
    else if (CP1252[cp] !== undefined) bytes.push(CP1252[cp]);
    else return null;
  }
  try {
    const out = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    if (/[\x80-\x9F]/.test(out) || out === s) return null;
    return out;
  } catch {
    return null;
  }
}

export const encodingRules: Rule[] = [
  rule({
    id: "enc.mojibake",
    group: "enc",
    name: "Garbled characters (mojibake)",
    desc: "Repairs text like \u00E2\u20AC\u2122 and \u00C3\u00A9 that appears when UTF-8 was read as Windows-1252. Repeats until the text is clean.",
    scope: "all",
    presets: ALL,
    detect: function* (c): Iterable<Match> {
      MOJI.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = MOJI.exec(c.text))) {
        const fixed = unMojibake(m[0]);
        if (fixed !== null) yield { start: m.index, end: m.index + m[0].length, repl: fixed, note: "Text was saved in one encoding and opened in another." };
      }
    },
  }),
  rule({
    id: "enc.replacement",
    group: "enc",
    name: "Replacement characters (\uFFFD)",
    desc: "The \uFFFD mark means a character was lost before the text reached you. It cannot be repaired automatically. Check the original source.",
    scope: "all",
    presets: ALL,
    pattern: /\uFFFD+/g,
    fix: () => null,
    suggest: () => [DELETE],
    chip: (s) => `\uFFFD\u00D7${s.length}`,
  }),
  rule({
    id: "enc.nfc",
    group: "enc",
    name: "Decomposed accents",
    desc: "A letter followed by a separate combining accent becomes one character (NFC). Looks the same, but search and spell check work again.",
    scope: "all",
    presets: ALL,
    pattern: /\p{L}\p{M}+/gu,
    fix: (m) => {
      const n = m[0].normalize("NFC");
      return n === m[0] ? undefined : n;
    },
  }),
];
