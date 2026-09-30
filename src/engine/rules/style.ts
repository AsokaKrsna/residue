/** Style signals. Every rule here is review-only: it suggests, you decide. */
import type { Match, Rule, RuleContext } from "../types";
import kobak from "../data/kobak-style-words.json";
import { COPULA, INTENSIFIERS, OPENERS, PHRASES, STRONG_VOCAB } from "../data/style";
import { DELETE, matchCase, rule } from "./util";

const ALL = { latex: true, markdown: true, plain: true, keep: true };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SENT_START = String.raw`(?<=^|[.!?:]["')\]]?\s+|\n\s*|\\item\s+|^\s*[-*]\s+)`;

function* regexMatches(c: RuleContext, re: RegExp): Iterable<RegExpExecArray> {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(c.text))) {
    if (!m[0].length) { re.lastIndex++; continue; }
    yield m;
  }
}

/** Does the sentence containing pos already carry a citation? */
function sentenceHasCitation(t: string, pos: number): boolean {
  const s = Math.max(t.lastIndexOf(". ", pos), t.lastIndexOf("\n\n", pos), 0);
  const eRel = t.slice(pos).search(/[.!?](?:\s|$)/);
  const e = eRel < 0 ? t.length : pos + eRel + 1;
  const sent = t.slice(s, e);
  return /\\(?:cite[a-z]*|footcite|parencite|textcite|autocite)\b|\[\d+(?:[,\u2013-]\s*\d+)*\]|\([A-Z][A-Za-z-]+(?: et al\.)?,? (?:19|20)\d{2}/.test(sent);
}

const strongWords = Object.keys(STRONG_VOCAB).filter((w) => !w.includes("-"));
const strongHyph = Object.keys(STRONG_VOCAB).filter((w) => w.includes("-"));
const VOCAB_RE = new RegExp(`\\b(?:${[...strongHyph.map(esc), ...strongWords].sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");
const strongSet = new Set(Object.keys(STRONG_VOCAB));
const KOBAK_RE = new RegExp(`\\b(?:${(kobak.words as string[]).filter((w) => !strongSet.has(w)).join("|")})\\b`, "gi");
const PHRASE_RES = PHRASES.map(([p, s, n]) => [new RegExp(`\\b${p}`, "gi"), s, n] as const);
const OPENER_RE = new RegExp(`${SENT_START}(?:${OPENERS.map(esc).join("|")}),[ \\t]?`, "gm");
const INTENS_RE = new RegExp(`\\b(?:${INTENSIFIERS.join("|")})\\b[ \\t]?`, "gi");
const COPULA_RE = new RegExp(`\\b(?:${COPULA.map(([a]) => esc(a)).join("|")})\\b`, "gi");
/** Adjectives LLMs like to stack in threes, plus common adjective endings. */
const TRIAD_ADJ = new Set(
  "robust scalable efficient reliable secure flexible powerful seamless intuitive comprehensive innovative dynamic engaging accessible sustainable transparent actionable holistic rich vibrant clear concise fast simple safe smart modern elegant lightweight versatile adaptable resilient interpretable explainable fair accurate effective practical meaningful impactful insightful nuanced rigorous thorough timely inclusive diverse equitable".split(" "),
);
const ADJ_END = /(?:ive|ous|ful|ic|ent|ant|able|ible|less|ary|ory|ular|ical)$/i;
const isAdjective = (w: string) => TRIAD_ADJ.has(w.toLowerCase()) || (ADJ_END.test(w) && !/^(?:and|or|the|that|this|with|from|than)$/i.test(w));

export const styleRules: Rule[] = [
  rule({
    id: "sty.vocab",
    group: "sty",
    name: "Overused LLM vocabulary",
    desc: "About 240 words such as delve, pivotal, showcase, leverage and tapestry, each with plain replacements. From Kobak et al. 2025 and Wikipedia's AI-writing guide.",
    scope: "text",
    presets: ALL,
    pattern: VOCAB_RE,
    fix: () => null,
    suggest: (m) => (STRONG_VOCAB[m[0].toLowerCase()] ?? []).map((s) => matchCase(m[0], s)),
    note: () => "Common in LLM text. Keep it if it is the precise word you mean.",
  }),
  rule({
    id: "sty.vocabx",
    group: "sty",
    name: "Extended excess vocabulary",
    desc: "288 more words whose use jumped in 2024 abstracts. Common in human writing too, so this is off by default. Useful for a final sweep.",
    scope: "text",
    presets: {},
    pattern: KOBAK_RE,
    fix: () => null,
    suggest: () => [],
    note: () => "Frequency rose sharply after ChatGPT (Kobak et al. 2025). Weak signal on its own.",
  }),
  rule({
    id: "sty.phrase",
    group: "sty",
    name: "Stock and inflated phrases",
    desc: "\"plays a pivotal role\", \"sheds light on\", \"a growing body of literature\", \"it is worth noting that\", \"valuable insights\", \"in order to\" and 50 more.",
    scope: "text",
    presets: ALL,
    detect: function* (c): Iterable<Match> {
      for (const [re, sugg, note] of PHRASE_RES) {
        for (const m of regexMatches(c, re)) {
          if (c.isProtected(m.index)) continue;
          if (/add a citation/.test(sugg[0]) && sentenceHasCitation(c.text, m.index)) continue;
          yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: sugg.filter((s) => !s.startsWith("(add")).map((s) => matchCase(m[0], s)), note };
        }
      }
    },
  }),
  rule({
    id: "sty.negpar",
    group: "sty",
    name: "Negative parallelism",
    desc: "\"not just X but also Y\", \"It's not X, it's Y\", \"no X, no Y, just Z\". It argues against a claim nobody made.",
    scope: "text",
    presets: ALL,
    detect: function* (c): Iterable<Match> {
      const a = /\bnot (?:just|only|merely|simply) ([^,.;:!?\n]{1,80}?),? but (?:also |rather |instead )?([^,.;:!?\n]{1,80}?)(?=[,.;:!?\n)]|$)/gi;
      for (const m of regexMatches(c, a)) {
        if (c.isProtected(m.index)) continue;
        yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [`${m[1].trim()} and ${m[2].trim()}`], note: "State both points directly." };
      }
      const b = /\b(?:it'?s|it is|this is|that'?s|that is|this isn'?t|it isn'?t|this was|it was|they'?re|they are|isn'?t|aren'?t|is not|are not) not? ?(?:just |only |merely |simply |really |about )?[^,.;:!?\n\u2014]{1,60}?(?:,|;|\s?\u2014\s?|\s-{1,3}\s)\s?(?:it'?s|it is|this is|they'?re|but|rather)\b[^.!?\n]{1,100}[.!?]?/gi;
      for (const m of regexMatches(c, b)) {
        if (c.isProtected(m.index) || !/\bnot\b|n't\b/i.test(m[0].slice(0, 30))) continue;
        yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [], note: "Frames a claim against nobody. Say what it is, not what it isn't." };
      }
      const d = /\bno [^,.\n]{1,30}, no [^,.\n]{1,30},? (?:just|only|simply) [^.\n]{1,60}/gi;
      for (const m of regexMatches(c, d)) {
        if (c.isProtected(m.index)) continue;
        yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [], note: "Dramatic list of negatives." };
      }
    },
  }),
  rule({
    id: "sty.opener",
    group: "sty",
    name: "Stacked transition openers",
    desc: "Sentences starting with Furthermore, Moreover, Additionally, Notably, Ultimately, In conclusion and similar. Logical connectors such as Thus and However are left alone.",
    scope: "text",
    presets: ALL,
    pattern: OPENER_RE,
    fix: () => null,
    suggest: (m) => (/^(?:Furthermore|Moreover|Additionally|In addition)/i.test(m[0]) ? [DELETE, "Also, "] : [DELETE]),
  }),
  rule({
    id: "sty.ingtail",
    group: "sty",
    name: "Trailing significance clauses",
    desc: "\", highlighting the importance of...\", \", underscoring its role in...\". A clause tacked on to assert meaning without evidence.",
    scope: "text",
    presets: ALL,
    pattern: /,[ \t]+(?:further |thereby |thus )?(?:highlighting|underscoring|emphasi[sz]ing|showcasing|reflecting|demonstrating|illustrating|signal(?:l)?ing|symboli[sz]ing|ensuring|fostering|paving|contributing to|solidifying|cementing|reinforcing|marking|setting the stage|laying the groundwork|shedding light)\b[^.!?\n]{0,160}(?=[.!?])/gi,
    fix: () => null,
    suggest: () => [DELETE],
    note: () => "Delete it, or replace it with the specific evidence.",
  }),
  rule({
    id: "sty.copula",
    group: "sty",
    name: "\"Serves as\" instead of \"is\"",
    desc: "serves as, stands as, functions as, boasts a. LLMs avoid plain is and has.",
    scope: "text",
    presets: ALL,
    pattern: COPULA_RE,
    fix: () => null,
    suggest: (m) => {
      const hit = COPULA.find(([a]) => a === m[0].toLowerCase());
      return hit ? [matchCase(m[0], hit[1])] : [];
    },
  }),
  rule({
    id: "sty.intensifier",
    group: "sty",
    name: "Empty intensifiers",
    desc: "truly, incredibly, deeply, profoundly, remarkably, fundamentally, quietly. \"Significantly\" is flagged because papers reserve it for statistics.",
    scope: "text",
    presets: ALL,
    pattern: INTENS_RE,
    fix: () => null,
    suggest: () => [DELETE],
    note: (m) => (/^significantly/i.test(m[0]) ? "In a paper, \"significantly\" implies a statistical test. Keep it only if you ran one." : undefined),
  }),
  rule({
    id: "sty.triad",
    group: "sty",
    name: "Rule of three",
    desc: "Three adjectives in a row, such as \"robust, scalable, and efficient\". A rhythm LLMs overuse.",
    scope: "text",
    presets: ALL,
    detect: function* (c): Iterable<Match> {
      const re = /\b([A-Za-z-]{3,}), ([A-Za-z-]{3,}),? (?:and|or) ([A-Za-z-]{3,})\b/g;
      for (const m of regexMatches(c, re)) {
        if (c.isProtected(m.index)) continue;
        if (![m[1], m[2], m[3]].every(isAdjective)) continue;
        yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [], note: "Keep the one or two that carry real information." };
      }
    },
  }),
  rule({
    id: "sty.emoji",
    group: "sty",
    name: "Emoji in prose",
    desc: "Emoji used as bullets or decoration.",
    scope: "text",
    presets: { latex: true, plain: true, keep: true },
    pattern: /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*[ \t]?/gu,
    fix: (m) => (/^[\u00A9\u00AE\u2122]/.test(m[0]) ? undefined : null),
    suggest: () => [DELETE],
  }),
  rule({
    id: "sty.exclaim",
    group: "sty",
    name: "Exclamation marks",
    desc: "Rare in academic writing, common in chatbot tone.",
    scope: "text",
    presets: { latex: true },
    pattern: /(?<=[A-Za-z)'"])!(?=\s|$)/g,
    fix: () => null,
    suggest: () => ["."],
  }),
  rule({
    id: "sty.repeat",
    group: "sty",
    name: "Repeated sentence openings",
    desc: "Three or more sentences in a row that start with the same word.",
    scope: "text",
    presets: ALL,
    detect: function* (c): Iterable<Match> {
      const re = /(?:^|(?<=[.!?]\s+))([A-Z][a-z]+)\b[^.!?\n]*[.!?]/gm;
      let prev = "", run: RegExpExecArray[] = [];
      const flush = function* () {
        if (run.length >= 3) for (const m of run) yield { start: m.index, end: m.index + m[1].length, repl: null, suggestions: [], note: `${run.length} sentences in a row start with "${m[1]}".` } as Match;
      };
      for (const m of regexMatches(c, re)) {
        if (c.isProtected(m.index)) continue;
        if (m[1] === prev) run.push(m);
        else { yield* flush(); run = [m]; prev = m[1]; }
      }
      yield* flush();
    },
  }),
  rule({
    id: "sty.headcase",
    group: "sty",
    name: "Title Case headings",
    desc: "Headings with Every Word Capitalised. Most style guides use sentence case. Off by default.",
    scope: "all",
    presets: {},
    pattern: /\\(?:sub)*section\*?\{([^}\n]+)\}|^#{1,6}[ \t]+(.+)$/gm,
    fix: (m) => {
      const h = (m[1] ?? m[2]).trim();
      const words = h.split(/\s+/).filter((w) => !/^(?:a|an|the|and|or|of|in|on|for|to|with|at|by|vs\.?)$/i.test(w));
      if (words.length < 3) return undefined;
      const caps = words.filter((w) => /^[A-Z][a-z]/.test(w)).length;
      return caps / words.length >= 0.8 ? null : undefined;
    },
    suggest: (m) => {
      const h = (m[1] ?? m[2]).trim();
      const sc = h.charAt(0) + h.slice(1).replace(/\b([A-Z])([a-z]+)\b/g, (_w, a, b) => a.toLowerCase() + b);
      return [m[0].replace(h, sc)];
    },
  }),
];
