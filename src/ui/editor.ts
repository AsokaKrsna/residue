/**
 * CodeMirror 6 setup. The editor holds the document; findings are drawn on top as decorations.
 * - Invisible characters are replaced on screen by a labelled chip (the text itself is untouched).
 * - "Ignore" markers live in a RangeSet, so they follow the text through every edit.
 * - A short "swept" flash marks what Clean all changed.
 */
import { ChangeSet, EditorState, MapMode, Prec, RangeSet, RangeSetBuilder, RangeValue, StateEffect, StateField, type Extension, type Range } from "@codemirror/state";
import {
  Decoration, EditorView, WidgetType, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars,
  hoverTooltip, keymap, lineNumbers, ViewPlugin, type DecorationSet, type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { HighlightStyle, StreamLanguage, bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { markdown } from "@codemirror/lang-markdown";
import { tags as t } from "@lezer/highlight";
import type { FileType, Finding } from "../engine/types";
import { RULES_BY_ID } from "../engine/engine";
import { isInvisible } from "../engine/unicode";

/* ---------- ignore markers ---------- */

class IgnoreMark extends RangeValue {
  constructor(readonly ruleId: string) { super(); }
  eq(o: IgnoreMark) { return o.ruleId === this.ruleId; }
  point = true;
  mapMode = MapMode.TrackDel;
}
export const addIgnore = StateEffect.define<{ ruleId: string; pos: number }>();
export const removeIgnore = StateEffect.define<{ ruleId: string; pos: number }>();
export const clearIgnores = StateEffect.define<null>();

export const ignoreField = StateField.define<RangeSet<IgnoreMark>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    set = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(addIgnore)) set = set.update({ add: [new IgnoreMark(e.value.ruleId).range(e.value.pos)], sort: true });
      if (e.is(removeIgnore)) set = set.update({ filter: (from, _to, v) => !(from === e.value.pos && v.ruleId === e.value.ruleId) });
      if (e.is(clearIgnores)) set = RangeSet.empty;
    }
    return set;
  },
});

export function isIgnored(state: EditorState, f: Finding): boolean {
  let hit = false;
  state.field(ignoreField).between(f.start, f.start, (from, _to, v) => {
    if (from === f.start && v.ruleId === f.ruleId) { hit = true; return false; }
  });
  return hit;
}

export function ignoredList(state: EditorState): { ruleId: string; start: number }[] {
  const out: { ruleId: string; start: number }[] = [];
  state.field(ignoreField).between(0, state.doc.length, (from, _to, v) => { out.push({ ruleId: v.ruleId, start: from }); });
  return out;
}

/* ---------- findings as decorations ---------- */

export const setFindings = StateEffect.define<{ findings: Finding[]; selected: string | null }>();

class Chip extends WidgetType {
  constructor(readonly label: string, readonly cls: string, readonly id: string, readonly title: string) { super(); }
  eq(o: Chip) { return o.label === this.label && o.cls === this.cls && o.id === this.id; }
  toDOM() {
    const s = document.createElement("span");
    s.className = `chip ${this.cls}`;
    s.textContent = this.label;
    s.dataset.fid = this.id;
    s.title = this.title;
    return s;
  }
  ignoreEvent() { return false; }
}

function chipText(f: Finding): string | null {
  const rule = RULES_BY_ID[f.ruleId];
  if (f.start === f.end) return rule?.chip ? rule.chip(f.orig) : "+";
  const chars = Array.from(f.orig);
  if (chars.every((c) => isInvisible(c))) return rule?.chip ? rule.chip(f.orig) : "?";
  return null;
}

function buildDecos(state: EditorState, findings: Finding[], selected: string | null): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const len = state.doc.length;
  for (const f of findings) {
    if (f.end > len) continue;
    const ignored = isIgnored(state, f);
    const k = ignored ? "skip" : f.kind;
    const sel = f.id === selected;
    const rule = RULES_BY_ID[f.ruleId];
    const title = `${rule?.name ?? f.ruleId}${f.kind === "review" ? " (review)" : ""}`;
    const chip = chipText(f);
    if (chip !== null) {
      const widget = new Chip(chip, `k-${k}${sel ? " sel" : ""}`, f.id, title);
      ranges.push(f.start === f.end ? Decoration.widget({ widget, side: 1 }).range(f.start) : Decoration.replace({ widget }).range(f.start, f.end));
      continue;
    }
    if (/^\s+$/.test(f.orig) && f.orig.includes("\n")) {
      // extra blank lines: a chip at the start, the lines stay visible and editable
      ranges.push(Decoration.widget({ widget: new Chip(rule?.chip?.(f.orig) ?? "¶", `k-${k}${sel ? " sel" : ""}`, f.id, title), side: 1 }).range(f.start));
      continue;
    }
    ranges.push(
      Decoration.mark({ class: `f f-${k}${sel ? " f-sel" : ""}`, attributes: { "data-fid": f.id } }).range(f.start, f.end),
    );
  }
  return Decoration.set(ranges, true);
}

interface FState { findings: Finding[]; selected: string | null; deco: DecorationSet }
export const findingsField = StateField.define<FState>({
  create: () => ({ findings: [], selected: null, deco: Decoration.none }),
  update(v, tr) {
    for (const e of tr.effects) {
      if (e.is(setFindings)) return { findings: e.value.findings, selected: e.value.selected, deco: buildDecos(tr.state, e.value.findings, e.value.selected) };
    }
    if (tr.docChanged) {
      // keep marks aligned until the next scan arrives; drop ones whose text was edited away
      const findings = v.findings
        .map((f) => {
          const s = tr.changes.mapPos(f.start, 1, MapMode.TrackDel);
          const e = tr.changes.mapPos(f.end, -1, MapMode.TrackDel);
          if (s === null || e === null || e < s) return null;
          return { ...f, start: s, end: e, id: `${f.ruleId}@${s}` };
        })
        .filter((f): f is Finding => f !== null && tr.state.doc.sliceString(f.start, f.end) === f.orig);
      return { findings, selected: v.selected, deco: v.deco.map(tr.changes) };
    }
    if (tr.effects.some((e) => e.is(addIgnore) || e.is(removeIgnore) || e.is(clearIgnores))) {
      return { ...v, deco: buildDecos(tr.state, v.findings, v.selected) };
    }
    return v;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

/* ---------- swept flash after cleaning ---------- */

export const flashRanges = StateEffect.define<{ from: number; to: number }[]>();
export const clearFlash = StateEffect.define<null>();
const flashMark = Decoration.mark({ class: "cm-swept" });
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(d, tr) {
    d = d.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(flashRanges)) {
        const b = new RangeSetBuilder<Decoration>();
        for (const r of e.value.filter((r) => r.to > r.from).sort((a, b) => a.from - b.from)) b.add(r.from, r.to, flashMark);
        d = b.finish();
      }
      if (e.is(clearFlash)) d = Decoration.none;
    }
    return d;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Ranges in the new document that a change set inserted, for the flash. */
export function insertedRanges(cs: ChangeSet): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  cs.iterChanges((_fa, _ta, fromB, toB) => out.push({ from: fromB, to: Math.max(toB, fromB + (toB === fromB ? 0 : 0)) }));
  return out;
}

/* ---------- look and language ---------- */

const hl = HighlightStyle.define([
  { tag: [t.tagName, t.keyword], color: "var(--ink-2)", fontWeight: "500" },
  { tag: t.comment, color: "var(--ink-3)", fontStyle: "italic" },
  { tag: [t.atom, t.number], color: "var(--ink-2)" },
  { tag: t.bracket, color: "var(--ink-3)" },
  { tag: t.heading, fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: [t.link, t.url], color: "var(--ink-2)", textDecoration: "underline" },
  { tag: t.monospace, color: "var(--ink-2)" },
]);

export function languageFor(ft: FileType): Extension {
  if (ft === "tex" || ft === "bib") return StreamLanguage.define(stex);
  if (ft === "md") return markdown();
  return [];
}

/* ---------- hover tooltip ---------- */

function findingAt(state: EditorState, pos: number): Finding | undefined {
  return state.field(findingsField).findings.find((f) => f.start <= pos && pos <= f.end && (f.end > f.start || f.start === pos));
}

const hover = hoverTooltip((view, pos) => {
  const f = findingAt(view.state, pos);
  if (!f) return null;
  return {
    pos: f.start,
    end: f.end,
    above: true,
    create() {
      const rule = RULES_BY_ID[f.ruleId];
      const dom = document.createElement("div");
      dom.className = "tip";
      const b = document.createElement("b");
      b.textContent = rule?.name ?? f.ruleId;
      const s = document.createElement("span");
      s.textContent =
        f.kind === "review"
          ? f.suggestions.length ? `Suggestion: ${f.suggestions[0] === "(delete)" ? "delete" : f.suggestions[0]}` : "Review this by hand."
          : f.kind === "remove" ? "Will be removed." : `Becomes ${JSON.stringify(f.repl)}`;
      dom.append(b, s);
      return { dom };
    },
  };
}, { hoverTime: 350 });

/* ---------- viewport reporting for the overview ruler ---------- */

export type ViewportInfo = { top: number; bottom: number };
export function viewportReporter(cb: (v: ViewportInfo) => void): Extension {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) { queueMicrotask(() => this.report(view)); }
      update(u: ViewUpdate) { if (u.geometryChanged || u.viewportChanged || u.docChanged) this.report(u.view); }
      report(view: EditorView) {
        const lines = view.state.doc.lines || 1;
        const top = view.state.doc.lineAt(view.visibleRanges[0]?.from ?? 0).number - 1;
        const bottom = view.state.doc.lineAt(view.visibleRanges[view.visibleRanges.length - 1]?.to ?? 0).number;
        cb({ top: top / lines, bottom: bottom / lines });
      }
    },
  );
}

/* ---------- assembling the editor ---------- */

export interface EditorHooks {
  onDocChanged: (state: EditorState, changes: ChangeSet) => void;
  onSelectFinding: (id: string | null) => void;
  onViewport: (v: ViewportInfo) => void;
  keys: { run: string; key: string; preventDefault?: boolean; handler: () => boolean }[];
}

export function baseExtensions(ft: FileType, hooks: EditorHooks, languageSlot: Extension): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    // lowest precedence: finding chips must win over the generic special-character dots
    Prec.lowest(highlightSpecialChars({ addSpecialChars: /[\u00AD\u034Fᅟᅠ\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206Fㅤ\uFEFFﾠ\uFFF9-￼]/ })),
    history(),
    drawSelection(),
    highlightActiveLine(),
    bracketMatching(),
    highlightSelectionMatches(),
    search({ top: true }),
    EditorView.lineWrapping,
    EditorState.allowMultipleSelections.of(true),
    languageSlot ?? languageFor(ft),
    syntaxHighlighting(hl),
    ignoreField,
    findingsField,
    flashField,
    hover,
    viewportReporter(hooks.onViewport),
    keymap.of([
      ...hooks.keys.map((k) => ({ key: k.key, run: () => k.handler(), preventDefault: k.preventDefault ?? true })),
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
      ...defaultKeymap,
    ]),
    EditorView.updateListener.of((u) => { if (u.docChanged) hooks.onDocChanged(u.state, u.changes); }),
    EditorView.domEventHandlers({
      mousedown(e) {
        const el = (e.target as HTMLElement).closest("[data-fid]") as HTMLElement | null;
        hooks.onSelectFinding(el?.dataset.fid ?? null);
        return false;
      },
    }),
    EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "off", autocapitalize: "off", "aria-label": "Document" }),
  ];
}
