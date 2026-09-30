import type { Rule, RuleContext } from "../types";

/** The full character (code point) just before index i. */
export function prevChar(t: string, i: number): string {
  if (i <= 0) return "";
  const lo = t.charCodeAt(i - 1);
  if (lo >= 0xdc00 && lo <= 0xdfff && i >= 2) return t.slice(i - 2, i);
  return t[i - 1];
}

/** The full character (code point) starting at index i. */
export function charAt(t: string, i: number): string {
  if (i >= t.length) return "";
  const cp = t.codePointAt(i)!;
  return String.fromCodePoint(cp);
}

export function lineAround(t: string, i: number): string {
  const s = t.lastIndexOf("\n", i - 1) + 1;
  const e = t.indexOf("\n", i);
  return t.slice(s, e < 0 ? t.length : e);
}

export const JOINING_SCRIPT =
  /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Nko}\p{Script=Mongolian}\p{Script=Bengali}\p{Script=Devanagari}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}\p{Script=Hebrew}\p{Script=Thaana}\p{Script=Mandaic}\p{Script=Manichaean}\p{Script=Psalter_Pahlavi}\p{Script=Adlam}]/u;
export const EMOJI_PART = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u20E3]/u;
export const RTL_SCRIPT = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}]/u;
export const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303F\uFF61-\uFF9F]/u;

/** Keep the letter case of the original when suggesting a replacement word. */
export function matchCase(orig: string, s: string): string {
  if (!s || s.startsWith("(")) return s;
  if (orig.length > 1 && orig === orig.toUpperCase() && /[A-Z]/.test(orig)) return s.toUpperCase();
  if (/^[A-Z]/.test(orig)) return s[0].toUpperCase() + s.slice(1);
  return s;
}

export const DELETE = "(delete)";

/** Small helper so rule files stay declarative. */
export function rule(r: Rule): Rule {
  return r;
}

export type Ctx = RuleContext;
