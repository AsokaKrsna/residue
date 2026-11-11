/** Explainable writing checks, not a trained authorship classifier. */
import type { Match, Rule, RuleContext } from "../types";
import { rule } from "./util";

const ALL = { latex: true, markdown: true, plain: true, keep: true };
const base = { group: "sty" as const, scope: "text" as const, presets: ALL };
const families: [string, RegExp][] = [
  ["stock framing", /\b(?:in today's (?:rapidly evolving|ever-changing) (?:world|landscape)|in the (?:ever-evolving|rapidly evolving) landscape|in the realm of)\b/gi],
  ["inflated significance", /\b(?:plays? a (?:pivotal|crucial|vital) role|a testament to|underscores? the importance of|paving the way for)\b/gi],
  ["formulaic contrast", /\bnot (?:just|merely|only)\b[^.!?\n]{1,100}\bbut (?:also|rather)\b/gi],
  ["generic conclusion", /\b(?:only time will tell|the possibilities are endless|a brighter future|it remains to be seen|in conclusion, it is (?:clear|evident))\b/gi],
];

export const academicRules: Rule[] = [
  rule({ ...base, id: "sty.cluster", name: "Combined rhetorical patterns",
    desc: "At least three different stock rhetorical patterns in a paragraph of 120+ words. Experimental review heuristic, not an AI probability.",
    detect: function* (c): Iterable<Match> {
      for (const p of c.text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g)) {
        if (p[0].length > 12000 || (p[0].match(/\b[\w'-]+\b/g)?.length ?? 0) < 120) continue;
        const evidence = families.flatMap(([name, re]) => {
          re.lastIndex = 0;
          const hit = [...p[0].matchAll(re)].find((m) => !c.isProtected(p.index + m.index));
          return hit ? [{ name, text: hit[0], start: p.index + hit.index }] : [];
        });
        if (evidence.length < 3) continue;
        const first = evidence.reduce((a, b) => a.start < b.start ? a : b);
        yield { start: first.start, end: first.start + first.text.length, repl: null, suggestions: [],
          note: `${evidence.length} pattern families in this paragraph: ${evidence.map((e) => `${e.name} ("${e.text}")`).join("; ")}. Check specificity and argument structure. Human writing can contain all of these; this is not evidence of AI authorship.` };
      }
    },
  }),
  rule({ ...base, id: "sty.attribution", name: "Vague source attribution",
    desc: "Claims attributed to unnamed studies, research or experts without a nearby citation. Check the source; this does not verify references.",
    detect: function* (c): Iterable<Match> {
      const re = /\b(?:studies (?:have shown|show|suggest)|research (?:has shown|shows|suggests)|experts (?:agree|believe|suggest)|it is widely (?:accepted|believed|recognized))\b/gi;
      for (const m of c.text.matchAll(re)) {
        const end = c.text.indexOf("\n", m.index);
        const context = c.text.slice(Math.max(0, m.index - 160), Math.min(end < 0 ? c.text.length : end, m.index + 350));
        if (/\\(?:cite\w*|parencite|textcite|autocite|footcite)\b|\[\d+(?:\s*[,;–-]\s*\d+)*\]|\([^\n()]*\b(?:19|20)\d{2}[a-z]?[^\n()]*\)/.test(context)) continue;
        yield { start: m.index, end: m.index + m[0].length, repl: null, suggestions: [], note: "Name the study or source and check that it supports this claim. No nearby citation was recognized; citation styles can be missed. This is a sourcing check, not an authorship judgment." };
      }
    },
  }),
  rule({ ...base, id: "sty.duplicate", name: "Repeated full sentences",
    desc: "The same sentence of at least 12 words appears three or more times. Check redundant exposition; repeated technical terms alone are ignored.",
    detect: function* (c: RuleContext): Iterable<Match> {
      const seen = new Map<string, { start: number; text: string }[]>();
      for (const m of c.text.matchAll(/[^.!?\n]+[.!?](?=\s|$)/g)) {
        const text = m[0].trim(), start = m.index + m[0].indexOf(text);
        if ((text.match(/\b[\w'-]+\b/g)?.length ?? 0) < 12 || c.isProtected(start)) continue;
        const key = text.toLowerCase().replace(/\s+/g, " ");
        const list = seen.get(key) ?? [];
        list.push({ start, text }); seen.set(key, list);
      }
      // Keep a highly repetitive document from flooding editor decorations.
      let emitted = 0;
      for (const list of seen.values()) if (list.length >= 3) for (const hit of list.slice(0, 20)) {
        if (emitted++ >= 100) return;
        yield { start: hit.start, end: hit.start + hit.text.length, repl: null, suggestions: [], note: `This sentence occurs ${list.length} times. Check whether each repetition serves a purpose. Repetition does not establish authorship.` };
      }
    },
  }),
];
