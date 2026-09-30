import type { Group, Rule } from "../types";
import { encodingRules, invisibleRules } from "./invisible";
import { formRules } from "./forms";
import { latexRules } from "./latex";
import { markdownRules } from "./markdown";
import { punctuationRules } from "./punctuation";
import { residueRules } from "./residue";
import { spaceRules, whitespaceRules } from "./spaces";
import { styleRules } from "./style";
import { plainRules } from "./plain";

export const GROUPS: Group[] = [
  { id: "inv", name: "Invisible characters", blurb: "Things you cannot see that still change your text." },
  { id: "enc", name: "Encoding damage", blurb: "Garbled or lost characters from the wrong encoding." },
  { id: "res", name: "Chat residue", blurb: "Citation tokens, tracking links and chatbot talk." },
  { id: "sp", name: "Spaces and line breaks", blurb: "Odd spaces that look normal but are not." },
  { id: "pu", name: "Dashes, quotes and symbols", blurb: "Typography that marks text as pasted from a chat." },
  { id: "uf", name: "Lookalikes and styled letters", blurb: "Letters from other alphabets and Unicode styles." },
  { id: "md", name: "Markdown leftovers", blurb: "Chat formatting pasted into LaTeX or plain text." },
  { id: "ws", name: "Whitespace and layout", blurb: "Trailing spaces and extra blank lines. Paragraphs are safe." },
  { id: "tex", name: "LaTeX safety", blurb: "Protected regions and things that break compilation." },
  { id: "sty", name: "Style signals", blurb: "Review only. Suggestions, never automatic." },
  { id: "plain", name: "Convert to plain text", blurb: "Off by default. Strips Markdown and LaTeX but keeps paragraphs, headings, lists and tables readable." },
];

export const RULES: Rule[] = [
  ...invisibleRules,
  ...encodingRules,
  ...residueRules,
  ...spaceRules,
  ...punctuationRules,
  ...formRules,
  ...markdownRules,
  ...whitespaceRules,
  ...latexRules,
  ...styleRules,
  ...plainRules,
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));
