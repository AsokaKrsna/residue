/**
 * The engine: scan text with the enabled rules, resolve overlaps, apply fixes.
 * Pure functions only. The UI turns findings into editor decorations and changes.
 */
import { RULES } from "./rules";
import { RegionIndex, scanRegions } from "./regions";
import type { Change, Config, FileType, Finding, Match, Preset, Region, RegionType, Rule, RuleContext } from "./types";
import { PRESETS } from "./types";

export { RULES, RULES_BY_ID } from "./rules";
export { GROUPS } from "./rules";

export function presetForFile(fileType: FileType): Preset {
  return fileType === "tex" || fileType === "bib" ? "latex" : fileType === "md" ? "markdown" : "plain";
}

export function fileTypeFromName(name: string): FileType {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (["tex", "ltx", "sty", "cls", "latex"].includes(ext)) return "tex";
  if (ext === "bib") return "bib";
  if (["md", "markdown", "mdx", "rmd", "qmd"].includes(ext)) return "md";
  return "txt";
}

export function ruleApplies(rule: Rule, fileType: FileType): boolean {
  return !rule.fileTypes || rule.fileTypes.includes(fileType);
}

export function defaultConfig(fileType: FileType, preset: Preset = presetForFile(fileType)): Config {
  const enabled: Record<string, boolean> = {};
  const options: Record<string, string> = {};
  for (const r of RULES) {
    enabled[r.id] = !!r.presets[preset];
    if (r.options) options[r.id] = r.optionDefaults?.[preset] ?? r.optionDefaults?.latex ?? r.options[0].value;
  }
  return { fileType, preset, enabled, options };
}

export function isPreset(p: string): p is Preset {
  return (PRESETS as string[]).includes(p);
}

const RULES_BY_ID_LOCAL: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));

const PROTECTING: RegionType[] = ["math", "verbatim", "comment", "keys", "cmd", "url"];

export interface ScanResult {
  findings: Finding[];
  regions: Region[];
  /** findings per rule, after overlap resolution */
  counts: Record<string, number>;
}

/** True when any "Convert to plain text" rule is on: every rule then writes plain text. */
export function plainOutput(cfg: Config): boolean {
  return RULES.some((r) => r.group === "plain" && cfg.enabled[r.id] && ruleApplies(r, cfg.fileType));
}

/**
 * @param extra regions supplied by the file format, such as hidden runs in a Word document
 */
export function scan(text: string, cfg: Config, extra: Region[] = []): ScanResult {
  const regions = scanRegions(text, cfg.fileType).concat(extra);
  const plain = plainOutput(cfg);
  const output: FileType = plain ? "txt" : cfg.fileType;
  // guards decide which region types protect prose
  const guarded = new Set<RegionType>();
  for (const r of RULES) if (r.guard && cfg.enabled[r.id]) r.guard.forEach((g) => guarded.add(g));
  const idx: Record<RegionType, RegionIndex> = {} as never;
  for (const t of PROTECTING) idx[t] = new RegionIndex(regions.filter((r) => r.type === t));
  const prot = new RegionIndex(regions.filter((r) => guarded.has(r.type)));

  const all: Finding[] = [];
  for (const rule of RULES) {
    if (!cfg.enabled[rule.id] || rule.guard || !ruleApplies(rule, cfg.fileType)) continue;
    if (plain && rule.texOutput) continue;
    const ctx: RuleContext = {
      text,
      fileType: cfg.fileType,
      output,
      preset: cfg.preset,
      option: cfg.options[rule.id],
      isProtected: (p) => prot.has(p),
      inMath: (p) => idx.math.has(p),
      inRegion: (p, t) => idx[t].has(p),
      regions,
    };
    const push = (mt: Match) => {
      if (mt.end < mt.start) return;
      if (rule.scope === "text" && ctx.isProtected(mt.start)) return;
      if (rule.scope === "math" && !ctx.inMath(mt.start)) return;
      const orig = text.slice(mt.start, mt.end);
      if (mt.repl === orig) return;
      all.push({
        id: `${rule.id}@${mt.start}`,
        ruleId: rule.id,
        start: mt.start,
        end: mt.end,
        orig,
        repl: mt.repl,
        kind: mt.repl === null ? "review" : mt.repl === "" ? "remove" : "replace",
        suggestions: sanitize(mt.suggestions ?? []),
        note: mt.note,
      });
    };
    if (rule.detect) {
      for (const mt of rule.detect(ctx)) push(mt);
    } else if (rule.pattern) {
      const re = rule.pattern;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        const out = rule.fix ? rule.fix(m, ctx) : "";
        if (out === undefined) continue;
        push({
          start: m.index,
          end: m.index + m[0].length,
          repl: out,
          suggestions: out === null && rule.suggest ? rule.suggest(m, ctx) : undefined,
          note: rule.note?.(m, ctx),
        });
        if (!re.global) break;
      }
    }
  }
  // late rules (whole-document conversions) wait until every other fix is done
  const isLate = (f: Finding) => !!RULES_BY_ID_LOCAL[f.ruleId]?.late;
  const otherFixes = all.some((f) => f.kind !== "review" && !isLate(f));
  const findings = resolve(otherFixes ? all.filter((f) => !(isLate(f) && f.kind !== "review")) : all);
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.ruleId] = (counts[f.ruleId] || 0) + 1;
  return { findings, regions, counts };
}

/** Invisible characters must never leak back through a suggestion. */
function sanitize(s: string[]): string[] {
  return s.map((x) => x.replace(/[\u200B-\u200F\u2060\uFEFF\u00AD\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/gu, ""));
}

const RULE_ORDER: Record<string, number> = Object.fromEntries(RULES.map((r, i) => [r.id, i]));

/**
 * Fixes (remove/replace) must not overlap each other: earliest start wins, then the longer match,
 * then the rule listed first. Reviews are resolved the same way among themselves. A review is dropped
 * when a fix fully covers it (the fix changes that text anyway) or when it cuts through a fix.
 */
function resolve(all: Finding[]): Finding[] {
  const order = (a: Finding, b: Finding) =>
    a.start - b.start || (b.end - b.start) - (a.end - a.start) || RULE_ORDER[a.ruleId] - RULE_ORDER[b.ruleId];
  all.sort(order);
  const fixes: Finding[] = [];
  const reviews: Finding[] = [];
  let lastFix = -1, lastRev = -1;
  for (const f of all) {
    if (f.kind === "review") {
      if (f.start >= lastRev) { reviews.push(f); lastRev = Math.max(f.end, f.start + 1); }
    } else if (f.start >= lastFix) {
      fixes.push(f);
      lastFix = f.end;
    }
  }
  // fixes never overlap, so their ends rise with their starts: one forward pointer is enough
  let j = 0;
  const kept = reviews.filter((r) => {
    while (j < fixes.length && fixes[j].end <= r.start && fixes[j].end > fixes[j].start) j++;
    for (let k = j; k < fixes.length && fixes[k].start < r.end; k++) {
      const x = fixes[k];
      if (x.end === x.start) continue;
      if (x.start <= r.start && x.end >= r.end) return false; // covered: the fix changes this text anyway
      if ((x.start < r.start && x.end > r.start) || (x.start < r.end && x.end > r.end)) return false; // cuts through
    }
    return true;
  });
  return fixes.concat(kept).sort(order);
}

export type Decision = { skip?: boolean; pick?: number };

/** The text a finding contributes, or null to keep the original. */
export function effectiveReplacement(f: Finding, d?: Decision): string | null {
  if (f.kind === "review") {
    if (!d || d.pick === undefined) return null;
    const s = f.suggestions[d.pick];
    if (s === undefined) return null;
    if (s === "(delete)") return "";
    const tail = /\s+$/.exec(f.orig)?.[0] ?? "";
    return /\s$/.test(s) ? s : s + tail;
  }
  return d?.skip ? null : f.repl;
}

/**
 * Turn chosen findings into non-overlapping changes. Deleting a phrase also removes one doubled space
 * and re-capitalises the next word when the deletion starts a sentence.
 */
export function changesFor(text: string, findings: Finding[], pick: (f: Finding) => string | null): Change[] {
  const out: Change[] = [];
  let pos = 0;
  for (const f of findings) {
    if (f.start < pos) continue;
    const r = pick(f);
    if (r === null) continue;
    let to = f.end;
    let insert = r;
    if (r === "" && f.kind === "review") {
      const before = text.slice(Math.max(0, f.start - 1), f.start);
      if (before === " " && text[to] === " ") to++;
      const lead = text.slice(0, f.start);
      if (/(?:^|[.!?]["')\]]?\s+|\n\s*|\\item\s+)$/.test(lead)) {
        const m = /^[ \t]*([a-z])/.exec(text.slice(to));
        if (m) {
          const at = to + m[0].length - 1;
          out.push({ from: f.start, to, insert: "" });
          out.push({ from: at, to: at + 1, insert: m[1].toUpperCase() });
          pos = at + 1;
          continue;
        }
      }
    }
    out.push({ from: f.start, to, insert });
    pos = to;
  }
  return out;
}

export function applyChanges(text: string, changes: Change[]): string {
  let out = "";
  let pos = 0;
  for (const c of [...changes].sort((a, b) => a.from - b.from)) {
    out += text.slice(pos, c.from) + c.insert;
    pos = c.to;
  }
  return out + text.slice(pos);
}

/** Findings that "Clean all" applies: every fix the user has not skipped. */
export function autoPick(skipped: (f: Finding) => boolean) {
  return (f: Finding) => (f.kind === "review" || skipped(f) ? null : f.repl);
}

export interface CleanResult {
  text: string;
  passes: Change[][];
  applied: Record<string, number>;
}

/** A fix the user chose to keep as-is, identified by rule and position. */
export interface Skip {
  ruleId: string;
  start: number;
}

/** Map a position through a set of changes. Returns -1 if the position was inside replaced text. */
export function mapPos(pos: number, changes: Change[]): number {
  let delta = 0;
  for (const c of changes) {
    if (c.to <= pos && !(c.from === c.to && c.from === pos)) delta += c.insert.length - (c.to - c.from);
    else if (c.from < pos && c.to > pos) return -1;
  }
  return pos + delta;
}

/**
 * Apply every enabled fix, then scan again. Some fixes expose new ones (mojibake reveals curly quotes,
 * bullets become list items), so this repeats until nothing changes, up to 8 passes.
 * Skipped fixes are tracked through every pass so they stay skipped.
 */
export function cleanAll(text: string, cfg: Config, skips: Skip[] = []): CleanResult {
  const passes: Change[][] = [];
  const applied: Record<string, number> = {};
  let t = text;
  let sk = skips.slice();
  // converting nested LaTeX to plain text unwraps one level per pass, so allow more passes
  const maxPasses = plainOutput(cfg) ? 24 : 8;
  for (let i = 0; i < maxPasses; i++) {
    const isSkipped = (f: Finding) => sk.some((s) => s.ruleId === f.ruleId && s.start === f.start);
    const { findings } = scan(t, cfg);
    const fixes = findings.filter((f) => f.kind !== "review" && !isSkipped(f));
    if (!fixes.length) break;
    const ch = changesFor(t, fixes, autoPick(isSkipped));
    if (!ch.length) break;
    for (const f of fixes) applied[f.ruleId] = (applied[f.ruleId] || 0) + 1;
    passes.push(ch);
    const next = applyChanges(t, ch);
    sk = sk.map((s) => ({ ruleId: s.ruleId, start: mapPos(s.start, ch) })).filter((s) => s.start >= 0);
    if (next === t) break;
    t = next;
  }
  return { text: t, passes, applied };
}

/* ---------- statistics ---------- */

export interface Stats {
  chars: number;
  words: number;
  sentences: number;
  paragraphs: number;
  avgSentence: number;
  /** coefficient of variation of sentence length; human prose is usually above 0.45 */
  burstiness: number;
  emDashPer1k: number;
  signalsPer1k: number;
}

export function paragraphCount(t: string): number {
  return t.split(/\n[ \t]*\n/).filter((p) => p.trim()).length;
}

export function stats(text: string, findings: Finding[]): Stats {
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []).length;
  const sents = text
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])|\n\s*\n/)
    .map((s) => (s.match(/[\p{L}\p{N}]+/gu) || []).length)
    .filter((n) => n >= 3);
  const mean = sents.length ? sents.reduce((a, b) => a + b, 0) / sents.length : 0;
  const sd = sents.length > 1 ? Math.sqrt(sents.reduce((a, b) => a + (b - mean) ** 2, 0) / (sents.length - 1)) : 0;
  const style = findings.filter((f) => f.ruleId.startsWith("sty.")).length;
  return {
    chars: text.length,
    words,
    sentences: sents.length,
    paragraphs: paragraphCount(text),
    avgSentence: mean,
    burstiness: mean ? sd / mean : 0,
    emDashPer1k: words ? ((text.match(/\u2014/g) || []).length / words) * 1000 : 0,
    signalsPer1k: words ? (style / words) * 1000 : 0,
  };
}
