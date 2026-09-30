/** Leftovers from chat interfaces: citation tokens, tracking links, chatbot lines and placeholders. */
import type { Match, Rule } from "../types";
import { mathToText } from "./plain";
import { DELETE, rule } from "./util";

const ALL = { latex: true, markdown: true, plain: true, keep: true };

/**
 * Chat citation markup. Order matters only for readability; the engine keeps the longest match.
 * Sources: Wikipedia "Signs of AI writing" (markup section), public bug reports on leaked PUA-wrapped markers.
 */
const CITE_PATTERNS = [
  // ChatGPT: PUA-wrapped markers, e.g. \uE200cite\uE202turn0search0\uE201 (entity markers handled separately)
  String.raw`\uE200(?!entity)[^\uE201\n]{0,400}\uE201`,
  // ChatGPT: the same markers after the PUA characters were stripped
  String.raw`\b(?:cite|filecite|navlist|image_group|video|product_entity)(?:turn\d+[a-z]+\d+|\uE202)+(?:[^\s\u3002.,;:)]*)`,
  String.raw`\bturn\d+(?:search|news|view|file|fetch|image|product|finance|sports|forecast|calc)\d+\b`,
  String.raw`:?contentReference\[oaicite:\d+\](?:\{index=\d+\})?`,
  String.raw`\[oaicite:\d+\]`,
  String.raw`\[?oai_citation(?::\d+)?(?:\u2021[^\]\n]*)?\]?(?:\([^)\s]*\))?`,
  String.raw`\battributableIndex=\S+`,
  // OpenAI Assistants and DeepSeek: 【4:0†source】, 【1†L10-L20】
  String.raw`\u3010[^\u3011\n]{0,80}\u2020[^\u3011\n]{0,80}\u3011`,
  // Gemini
  String.raw`\[cite(?:_start|_end)?(?::\s*[\d,\s]+)?\]`,
  String.raw`\[span_\d+\]\((?:start|end)_span\)`,
  // Grok
  String.raw`<grok:render[^>]*>[\s\S]{0,2000}?</grok:render>`,
  String.raw`\bgrok_(?:card|render_citation_card_json)\S*`,
  // Perplexity
  String.raw`\[attached_file:\d+\]`,
  // Microsoft Copilot footnote markers
  String.raw`\[\^\d+\^\]`,
  // Claude and misc tool tags that leak as text
  String.raw`</?(?:antml:)?(?:cite|citation|source)(?:\s+index="[^"]*")?>`,
];
const CITE = new RegExp(`[ \\t]?(?:${CITE_PATTERNS.join("|")})`, "gu");

export const residueRules: Rule[] = [
  rule({
    id: "res.cite",
    group: "res",
    name: "Chat citation tokens",
    desc: "ChatGPT (oaicite, contentReference, citeturn0search0 and its hidden U+E200 wrappers), Gemini [cite: 1], DeepSeek and Assistants \u3010\u2020\u3011 marks, Grok and Perplexity tags.",
    scope: "all",
    presets: ALL,
    pattern: CITE,
    fix: () => "",
  }),
  rule({
    id: "res.entity",
    group: "res",
    name: "ChatGPT entity markers",
    desc: "Hidden entity[\"type\",\"Name\"] markup. Keeps the name, removes the wrapper.",
    scope: "all",
    presets: ALL,
    pattern: /\uE200?entity\uE202?\[\s*"[^"]*"\s*,\s*"([^"]*)"[^\]\n]*\]\uE201?/g,
    fix: (m) => m[1],
  }),
  rule({
    id: "res.utm",
    group: "res",
    name: "Tracking parameters in links",
    desc: "Removes utm_source=chatgpt.com, utm_source=openai and similar tracking tags. The rest of the link stays intact.",
    scope: "all",
    presets: ALL,
    // the value stops before sentence punctuation: "...?utm_source=chatgpt.com." keeps its full stop
    pattern: /\?(?:utm_[a-z_]+|ref|source)=[^&\s#)}\]>"']*?(?=[.,;:!?]*(?:[&\s#)}\]>"']|$))&?|&(?:utm_[a-z_]+)=[^&\s#)}\]>"']*?(?=[.,;:!?]*(?:[&\s#)}\]>"']|$))/gi,
    fix: (m) => {
      if (/^[?&](?:ref|source)=/i.test(m[0]) && !/chatgpt|openai|perplexity|copilot|gemini|claude/i.test(m[0])) return undefined;
      return m[0].startsWith("?") && m[0].endsWith("&") ? "?" : "";
    },
  }),
  rule({
    id: "res.chatbot",
    group: "res",
    name: "Chatbot lines",
    desc: "\"Certainly!\", \"I hope this helps\", \"Let me know if...\", \"Here is the revised version:\", knowledge-cutoff disclaimers. Flagged for you to delete.",
    scope: "text",
    presets: ALL,
    pattern: new RegExp(
      "(?<=^|[.!?:]\\s+|\\n)(?:" +
        [
          "(?:Certainly|Sure|Absolutely|Of course|Great question|Good question|Excellent question|Happy to help)[!.,][^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "I hope (?:this|that) (?:helps|clarifies|is helpful)[^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "Hope (?:this|that) helps[^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "(?:Let me know|Feel free to (?:ask|reach out|let me know))[^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "(?:Would you like|Do you want|Shall I|Should I) me to [^\\n]*?\\?",
          "(?:Would you like|Do you want) (?:a|an|the|more|me)\\b[^\\n]*?\\?",
          "If you(?:'d| would) like,? I can[^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "(?:Here(?:'s| is| are)|Below is|Below are) (?:a |an |the |your |some )?(?:revised|rewritten|improved|polished|updated|refined|edited|corrected|expanded|concise|shorter|final|cleaned|paraphrased|formal|academic)[^\\n]*?(?::|\\.)(?=\\s|$)",
          // "As an AI reviewer, ..." is an injection aimed at a reviewer, reported by the hidden-text rule instead
          "As an AI(?! (?:reviewer|model reviewing))(?: language model)?,?[^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "As of my (?:last )?(?:knowledge|training)(?: cutoff| update| data)?[^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "I (?:don't|do not|cannot|can't) (?:browse|access real-time|have access to real-time|provide real-time)[^\\n]*?(?:[.!?](?=\\s|$)|$)",
          "(?:I've|I have) (?:revised|rewritten|polished|edited|improved|updated|refined) [^\\n]*?(?:[.!?:](?=\\s|$)|$)",
        ].join("|") +
        ")",
      "gim",
    ),
    fix: () => null,
    suggest: () => [DELETE],
    note: () => "Text addressed to you by the chatbot, not part of your document.",
  }),
  rule({
    id: "res.placeholder",
    group: "res",
    name: "Unfilled placeholders",
    desc: "[Your Name], [Insert citation], [Author, Year], [citation needed], XX% and similar template holes that LLMs leave behind.",
    scope: "text",
    presets: ALL,
    pattern: /\[(?:your|insert|add|author|name|date|company|institution|university|citation|reference|source|link|url|todo|tbd|placeholder|number|figure|table|x+)\b[^\]\n]{0,60}\]|\b(?:XX|xx)(?:\.X+)?\s?%|\bTBD\b|\[(?:Author|Authors),? (?:Year|\d{4})\]/gi,
    fix: () => null,
    suggest: () => [],
    note: () => "A template hole. Fill it in or remove it before you submit.",
  }),
  rule({
    id: "res.aicite",
    group: "res",
    name: "Suspicious reference patterns",
    desc: "Citations like (Smith et al., 2023) or [1] with no matching \\cite or bibliography. LLMs invent these. Flagged so you can verify each source.",
    scope: "text",
    presets: { latex: true },
    fileTypes: ["tex"],
    pattern: /\((?:[A-Z][A-Za-z'\-]+(?: (?:et al\.|and|&) [A-Z][A-Za-z'\-]+)?(?: et al\.)?),? (?:19|20)\d{2}[a-z]?(?:; [^)]{0,80})?\)/g,
    fix: () => null,
    suggest: () => [],
    note: () => "A hand-typed citation in a LaTeX file. Check that this source exists, then use \\cite{key}.",
  }),
  rule({
    id: "res.numcite",
    group: "res",
    name: "Numbered citations with no reference list",
    desc: "Bracketed numbers like [1][3] left behind by Perplexity, Copilot and search-enabled chats. Skipped when the text has its own [1] reference list.",
    scope: "text",
    presets: { markdown: true, plain: true, keep: true },
    fileTypes: ["txt", "md"],
    pattern: /(?<=[\w.,;:)\]"'\u201D])(?:\[\d{1,3}(?:[,\u2013-]\s*\d{1,3})*\])+/g,
    fix: (_m, c) => (/^\s*\[\d+\]\s+\S/m.test(c.text) ? undefined : null),
    suggest: () => [DELETE],
    note: () => "The source behind this number is not in your document. Find it and cite it properly, or remove the marker.",
  }),
  rule({
    id: "res.mathdup",
    group: "res",
    name: "Duplicated math from copying rendered equations",
    desc: "Copying an equation from a chat often gives it twice: as it looked, then as LaTeX, like E=mc2E = mc^2. Keeps the LaTeX once.",
    scope: "text",
    presets: { latex: true, markdown: true, plain: true, keep: true },
    detect: function* (c): Iterable<Match> {
      const t = c.text;
      const marker = /\S*(?:\\[A-Za-z]+|[\^_])\S*/g;
      let m: RegExpExecArray | null;
      let lastEnd = -1;
      while ((m = marker.exec(t))) {
        if (m.index < lastEnd || c.isProtected(m.index)) continue;
        const lineStart = t.lastIndexOf("\n", m.index - 1) + 1;
        // the LaTeX source may continue over a few short spaced tokens: "E = mc^2 + 1"
        const ends = [m.index + m[0].length];
        const tail = /^(?:[ \t]+[=+\-*/<>()0-9A-Za-z\\^_{}.,]{1,12})/;
        let e = ends[0];
        for (let k = 0; k < 3; k++) {
          const tm = tail.exec(t.slice(e, e + 20));
          if (!tm) break;
          e += tm[0].length;
          ends.push(e);
        }
        let best: { s: number; e: number; src: string } | null = null;
        for (const end of ends) {
          for (let s = end - 1; s > Math.max(lineStart, end - 90); s--) {
            if (/\s/.test(t[s])) continue;
            const src = t.slice(s, end).replace(/[.,;:]$/, "");
            if (!/\\[A-Za-z]|[\^_]/.test(src)) continue;
            const r = renderedText(src);
            if (r.length < 2) continue;
            const start = precedingMatch(t, s, r, lineStart);
            if (start >= 0 && (!best || end - start > best.e - best.s)) best = { s: start, e: s + src.length, src };
          }
        }
        if (best) {
          lastEnd = best.e;
          const src = best.src.trim();
          yield {
            start: best.s,
            end: best.e,
            repl: null,
            suggestions: c.output === "txt" ? [mathToText(src), `$${src}$`] : [`$${src}$`],
            note: "The equation appears twice: once as rendered text, once as LaTeX source.",
          };
        }
      }
    },
  }),
  rule({
    id: "res.wrapper",
    group: "res",
    name: "Chat writing-block fences",
    desc: "The :::writing lines that wrap text from a ChatGPT writing block. The text inside is kept.",
    scope: "all",
    presets: ALL,
    pattern: /^:::writing\b[^\n]*(?:\n|$)|^:::[ \t]*(?:\n|$)/gm,
    // a bare ":::" is only removed when the document also has an opening :::writing line
    fix: (m, c) => (m[0].startsWith(":::writing") || /^:::writing\b/m.test(c.text) ? "" : undefined),
  }),
  rule({
    id: "res.chrome",
    group: "res",
    name: "Chat window labels",
    desc: "Lines copied from the chat window itself: \"You said:\", \"ChatGPT said:\", \"Copy code\", \"Thought for 12s\", \"Searched the web\". Flagged for you to delete.",
    scope: "text",
    presets: ALL,
    pattern: /^[ \t]*(?:(?:You|ChatGPT) said:?|Copy code|Copy[ \t]*\n[ \t]*Edit|Thought for (?:\d+m )?\d+s|Thought for (?:\d+ seconds?|a (?:few|couple of) seconds|a moment)|Searched (?:the web|\d+ sites?)|Show thinking)[ \t]*$/gm,
    fix: () => null,
    suggest: () => [DELETE],
    note: () => "Text from the chat window's buttons and labels, not part of your document.",
  }),
  rule({
    id: "res.think",
    group: "res",
    name: "Model reasoning blocks",
    desc: "<think> ... </think> reasoning pasted from DeepSeek R1, Qwen and other reasoning models. Flagged for you to delete.",
    scope: "all",
    presets: ALL,
    pattern: /<(think|thinking)>[\s\S]*?<\/\1>[ \t]*\n?/g,
    fix: () => null,
    suggest: () => [DELETE],
    note: () => "The model's private reasoning, not its answer.",
  }),
  rule({
    id: "res.pill",
    group: "res",
    name: "Source buttons pasted as text",
    desc: "\"Reuters+2\" or \"Wikipedia+1\" after a sentence. These are ChatGPT source buttons that became text when copied.",
    scope: "text",
    presets: ALL,
    pattern: /(?<=[.!?)\]]["'\u201D]?)[ \t]?(?:[A-Z][\w&'.-]*(?: [A-Z][\w&'.-]*){0,3}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\+\d{1,2}(?=[ \t]*(?:\n|$)|[ \t]+[A-Z])/g,
    fix: () => null,
    suggest: () => [DELETE],
    note: () => "A source button from a chat answer. Find the source and cite it, or delete the label.",
  }),
  rule({
    id: "res.filelink",
    group: "res",
    name: "Links to private chat uploads",
    desc: "Links to files you uploaded to Perplexity (ppl-ai-file-upload). Nobody else can open them.",
    scope: "all",
    presets: ALL,
    pattern: /https?:\/\/ppl-ai-file-upload\.[^\s)\]>"']+/g,
    fix: () => null,
    suggest: () => [DELETE],
    note: () => "This link points to your private upload. Readers will get an error.",
  }),
];

const RENDER: Record<string, string> = {
  alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", delta: "\u03B4", epsilon: "\u03F5", varepsilon: "\u03B5", theta: "\u03B8", lambda: "\u03BB",
  mu: "\u03BC", pi: "\u03C0", sigma: "\u03C3", tau: "\u03C4", phi: "\u03D5", varphi: "\u03C6", omega: "\u03C9", Delta: "\u0394", Sigma: "\u03A3",
  Omega: "\u03A9", times: "\u00D7", cdot: "\u00B7", leq: "\u2264", le: "\u2264", geq: "\u2265", ge: "\u2265", neq: "\u2260", approx: "\u2248",
  in: "\u2208", infty: "\u221E", sum: "\u2211", int: "\u222B", partial: "\u2202", to: "\u2192", rightarrow: "\u2192", pm: "\u00B1", ldots: "\u2026", cdots: "\u22EF",
};

/** Roughly what KaTeX puts on the clipboard for a formula: symbols, no markup, no spaces. */
function renderedText(src: string): string {
  let s = src;
  for (let i = 0; i < 6; i++) {
    const b = s;
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1$2").replace(/\\(?:sqrt|mathrm|mathbf|mathit|text|operatorname|mathcal)\{([^{}]*)\}/g, "$1").replace(/\\mathbb\{([^{}]*)\}/g, "$1");
    if (s === b) break;
  }
  return normMath(s.replace(/\\(?:left|right)/g, "").replace(/\\([A-Za-z]+)/g, (m, n) => RENDER[n] ?? m).replace(/[\^_{}\\]/g, ""));
}
function normMath(s: string): string {
  return s.replace(/\s+/g, "").replace(/[\u2212\u2013]/g, "-").replace(/[\u22C5\u2219]/g, "\u00B7").replace(/\u2026/g, "...");
}
/** If the text just before `pos` spells `r` (ignoring spaces), return where that spelling starts; else -1. */
function precedingMatch(t: string, pos: number, r: string, floor: number): number {
  let i = pos - 1;
  let k = r.length - 1;
  while (k >= 0 && i >= floor) {
    if (/\s/.test(t[i])) { i--; continue; }
    if (normMath(t[i]) !== r[k]) return -1;
    i--;
    k--;
  }
  return k < 0 ? i + 1 : -1;
}
