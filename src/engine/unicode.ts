/** Unicode helpers: short chip labels, names for the inspector, category fallbacks. */

export function hex(cp: number): string {
  const h = cp.toString(16).toUpperCase();
  return h.length < 4 ? h.padStart(4, "0") : h;
}

/** [short chip label, full Unicode name]. Short label "" means the glyph itself is shown. */
const T: Record<number, [string, string]> = {
  0x0009: ["TAB", "CHARACTER TABULATION"],
  0x000a: ["LF", "LINE FEED"],
  0x000b: ["VT", "LINE TABULATION"],
  0x000c: ["FF", "FORM FEED"],
  0x000d: ["CR", "CARRIAGE RETURN"],
  0x0020: ["SP", "SPACE"],
  0x0085: ["NEL", "NEXT LINE"],
  0x00a0: ["NBSP", "NO-BREAK SPACE"],
  0x00ad: ["SHY", "SOFT HYPHEN"],
  0x034f: ["CGJ", "COMBINING GRAPHEME JOINER"],
  0x061c: ["ALM", "ARABIC LETTER MARK"],
  0x115f: ["HCF", "HANGUL CHOSEONG FILLER"],
  0x1160: ["HJF", "HANGUL JUNGSEONG FILLER"],
  0x1680: ["OGSP", "OGHAM SPACE MARK"],
  0x17b4: ["KIV", "KHMER VOWEL INHERENT AQ"],
  0x17b5: ["KIV", "KHMER VOWEL INHERENT AA"],
  0x180b: ["FVS1", "MONGOLIAN FREE VARIATION SELECTOR ONE"],
  0x180c: ["FVS2", "MONGOLIAN FREE VARIATION SELECTOR TWO"],
  0x180d: ["FVS3", "MONGOLIAN FREE VARIATION SELECTOR THREE"],
  0x180e: ["MVS", "MONGOLIAN VOWEL SEPARATOR"],
  0x180f: ["FVS4", "MONGOLIAN FREE VARIATION SELECTOR FOUR"],
  0x2000: ["NQSP", "EN QUAD"],
  0x2001: ["MQSP", "EM QUAD"],
  0x2002: ["ENSP", "EN SPACE"],
  0x2003: ["EMSP", "EM SPACE"],
  0x2004: ["3MSP", "THREE-PER-EM SPACE"],
  0x2005: ["4MSP", "FOUR-PER-EM SPACE"],
  0x2006: ["6MSP", "SIX-PER-EM SPACE"],
  0x2007: ["FSP", "FIGURE SPACE"],
  0x2008: ["PSP", "PUNCTUATION SPACE"],
  0x2009: ["THSP", "THIN SPACE"],
  0x200a: ["HSP", "HAIR SPACE"],
  0x200b: ["ZWSP", "ZERO WIDTH SPACE"],
  0x200c: ["ZWNJ", "ZERO WIDTH NON-JOINER"],
  0x200d: ["ZWJ", "ZERO WIDTH JOINER"],
  0x200e: ["LRM", "LEFT-TO-RIGHT MARK"],
  0x200f: ["RLM", "RIGHT-TO-LEFT MARK"],
  0x2010: ["", "HYPHEN"],
  0x2011: ["NBHY", "NON-BREAKING HYPHEN"],
  0x2012: ["", "FIGURE DASH"],
  0x2013: ["", "EN DASH"],
  0x2014: ["", "EM DASH"],
  0x2015: ["", "HORIZONTAL BAR"],
  0x2018: ["", "LEFT SINGLE QUOTATION MARK"],
  0x2019: ["", "RIGHT SINGLE QUOTATION MARK"],
  0x201a: ["", "SINGLE LOW-9 QUOTATION MARK"],
  0x201b: ["", "SINGLE HIGH-REVERSED-9 QUOTATION MARK"],
  0x201c: ["", "LEFT DOUBLE QUOTATION MARK"],
  0x201d: ["", "RIGHT DOUBLE QUOTATION MARK"],
  0x201e: ["", "DOUBLE LOW-9 QUOTATION MARK"],
  0x201f: ["", "DOUBLE HIGH-REVERSED-9 QUOTATION MARK"],
  0x2022: ["", "BULLET"],
  0x2023: ["", "TRIANGULAR BULLET"],
  0x2024: ["", "ONE DOT LEADER"],
  0x2025: ["", "TWO DOT LEADER"],
  0x2026: ["", "HORIZONTAL ELLIPSIS"],
  0x2028: ["LS", "LINE SEPARATOR"],
  0x2029: ["PS", "PARAGRAPH SEPARATOR"],
  0x202a: ["LRE", "LEFT-TO-RIGHT EMBEDDING"],
  0x202b: ["RLE", "RIGHT-TO-LEFT EMBEDDING"],
  0x202c: ["PDF", "POP DIRECTIONAL FORMATTING"],
  0x202d: ["LRO", "LEFT-TO-RIGHT OVERRIDE"],
  0x202e: ["RLO", "RIGHT-TO-LEFT OVERRIDE"],
  0x202f: ["NNBSP", "NARROW NO-BREAK SPACE"],
  0x2032: ["", "PRIME"],
  0x2033: ["", "DOUBLE PRIME"],
  0x2043: ["", "HYPHEN BULLET"],
  0x205f: ["MMSP", "MEDIUM MATHEMATICAL SPACE"],
  0x2060: ["WJ", "WORD JOINER"],
  0x2061: ["FA", "FUNCTION APPLICATION"],
  0x2062: ["IT", "INVISIBLE TIMES"],
  0x2063: ["IS", "INVISIBLE SEPARATOR"],
  0x2064: ["IP", "INVISIBLE PLUS"],
  0x2066: ["LRI", "LEFT-TO-RIGHT ISOLATE"],
  0x2067: ["RLI", "RIGHT-TO-LEFT ISOLATE"],
  0x2068: ["FSI", "FIRST STRONG ISOLATE"],
  0x2069: ["PDI", "POP DIRECTIONAL ISOLATE"],
  0x206a: ["ISS", "INHIBIT SYMMETRIC SWAPPING"],
  0x206b: ["ASS", "ACTIVATE SYMMETRIC SWAPPING"],
  0x206c: ["IAFS", "INHIBIT ARABIC FORM SHAPING"],
  0x206d: ["AAFS", "ACTIVATE ARABIC FORM SHAPING"],
  0x206e: ["NADS", "NATIONAL DIGIT SHAPES"],
  0x206f: ["NODS", "NOMINAL DIGIT SHAPES"],
  0x2212: ["", "MINUS SIGN"],
  0x2800: ["BRBL", "BRAILLE PATTERN BLANK"],
  0x3000: ["IDSP", "IDEOGRAPHIC SPACE"],
  0x3164: ["HF", "HANGUL FILLER"],
  0xfe0e: ["VS15", "VARIATION SELECTOR-15"],
  0xfe0f: ["VS16", "VARIATION SELECTOR-16"],
  0xfeff: ["BOM", "ZERO WIDTH NO-BREAK SPACE"],
  0xffa0: ["HWHF", "HALFWIDTH HANGUL FILLER"],
  0xfff9: ["IAA", "INTERLINEAR ANNOTATION ANCHOR"],
  0xfffa: ["IAS", "INTERLINEAR ANNOTATION SEPARATOR"],
  0xfffb: ["IAT", "INTERLINEAR ANNOTATION TERMINATOR"],
  0xfffc: ["OBJ", "OBJECT REPLACEMENT CHARACTER"],
  0xfffd: ["\uFFFD", "REPLACEMENT CHARACTER"],
  0x00d7: ["", "MULTIPLICATION SIGN"],
  0x00f7: ["", "DIVISION SIGN"],
  0x00b1: ["", "PLUS-MINUS SIGN"],
  0x00b0: ["", "DEGREE SIGN"],
  0x2264: ["", "LESS-THAN OR EQUAL TO"],
  0x2265: ["", "GREATER-THAN OR EQUAL TO"],
  0x2260: ["", "NOT EQUAL TO"],
  0x2248: ["", "ALMOST EQUAL TO"],
  0x2192: ["", "RIGHTWARDS ARROW"],
  0x2190: ["", "LEFTWARDS ARROW"],
  0x2194: ["", "LEFT RIGHT ARROW"],
  0x21d2: ["", "RIGHTWARDS DOUBLE ARROW"],
  0xfb00: ["", "LATIN SMALL LIGATURE FF"],
  0xfb01: ["", "LATIN SMALL LIGATURE FI"],
  0xfb02: ["", "LATIN SMALL LIGATURE FL"],
  0xfb03: ["", "LATIN SMALL LIGATURE FFI"],
  0xfb04: ["", "LATIN SMALL LIGATURE FFL"],
  0xe200: ["PUA", "PRIVATE USE (ChatGPT citation start)"],
  0xe201: ["PUA", "PRIVATE USE (ChatGPT citation end)"],
  0xe202: ["PUA", "PRIVATE USE (ChatGPT citation separator)"],
};

const CATS: [RegExp, string][] = [
  [/\p{Cc}/u, "CONTROL CHARACTER"],
  [/\p{Cf}/u, "FORMAT CHARACTER (invisible)"],
  [/\p{Co}/u, "PRIVATE USE CHARACTER"],
  [/\p{Zs}/u, "SPACE SEPARATOR"],
  [/\p{Script=Cyrillic}/u, "CYRILLIC LETTER"],
  [/\p{Script=Greek}/u, "GREEK LETTER"],
  [/\p{Extended_Pictographic}/u, "EMOJI"],
  [/\p{M}/u, "COMBINING MARK"],
  [/\p{L}/u, "LETTER"],
  [/\p{N}/u, "NUMBER"],
  [/\p{P}/u, "PUNCTUATION"],
  [/\p{S}/u, "SYMBOL"],
];

export function charName(ch: string): string {
  const cp = ch.codePointAt(0)!;
  if (T[cp]) return T[cp][1];
  if (cp >= 0xe0000 && cp <= 0xe007f) {
    if (cp === 0xe007f) return "CANCEL TAG";
    const a = cp - 0xe0000;
    return a >= 0x20 && a < 0x7f ? `TAG ${JSON.stringify(String.fromCharCode(a))}` : "TAG CHARACTER";
  }
  if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)) {
    const n = cp <= 0xfe0f ? cp - 0xfe00 + 1 : cp - 0xe0100 + 17;
    return `VARIATION SELECTOR-${n}`;
  }
  if (cp >= 0x20 && cp < 0x7f) return `'${ch}'`;
  for (const [re, name] of CATS) if (re.test(ch)) return name;
  return "CHARACTER";
}

/** Short label for invisible or confusable characters, or "" when the glyph can be shown. */
export function chipLabel(ch: string): string {
  const cp = ch.codePointAt(0)!;
  if (T[cp]) return T[cp][0];
  if (cp >= 0xe0000 && cp <= 0xe007f) return "TAG";
  if (cp >= 0xfe00 && cp <= 0xfe0f) return `VS${cp - 0xfe00 + 1}`;
  if (cp >= 0xe0100 && cp <= 0xe01ef) return `VS${cp - 0xe0100 + 17}`;
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Zs}]/u.test(ch) && ch !== " ") return "U+" + hex(cp);
  return "";
}

/** True for characters a reader cannot see. */
export function isInvisible(ch: string): boolean {
  return /[\p{Cc}\p{Cf}\p{Co}\p{Zs}\p{Default_Ignorable_Code_Point}\u2800\u3164\uFFA0\u115F\u1160]/u.test(ch) && ch !== " " && ch !== "\n" && ch !== "\t";
}

/** Replace invisible characters with visible ⟨LABEL⟩ markers. Used by the inspector. */
export function visualize(s: string): string {
  let out = "";
  let tagRun = 0;
  const flush = () => {
    if (tagRun) out += `\u27E8TAG\u00D7${tagRun}\u27E9`;
    tagRun = 0;
  };
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xe0000 && cp <= 0xe007f) {
      tagRun++;
      continue;
    }
    flush();
    if (ch === "\n") out += "\u23CE\n";
    else if (ch === "\t") out += "\u27E8TAB\u27E9";
    else if (isInvisible(ch)) out += `\u27E8${chipLabel(ch) || "U+" + hex(cp)}\u27E9`;
    else out += ch;
  }
  flush();
  return out;
}

/** Decode Unicode tag characters (U+E0020..U+E007E) back to ASCII. */
export function decodeTags(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xe0020 && cp <= 0xe007e) out += String.fromCharCode(cp - 0xe0000);
  }
  return out;
}

/** Decode variation-selector steganography: each selector carries one byte. */
export function decodeVariationSelectors(s: string): string {
  const bytes: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xfe00 && cp <= 0xfe0f) bytes.push(cp - 0xfe00);
    else if (cp >= 0xe0100 && cp <= 0xe01ef) bytes.push(cp - 0xe0100 + 16);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return "";
  }
}
