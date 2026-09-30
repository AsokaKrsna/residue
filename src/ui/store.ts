import { batch, computed, signal } from "@preact/signals";
import { ChangeSet, Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo as cmUndo } from "@codemirror/commands";
import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import {
  RULES, RULES_BY_ID, changesFor, cleanAll, defaultConfig, fileTypeFromName, presetForFile, scan, stats as computeStats,
  type Stats,
} from "../engine/engine";
import type { Config, FileType, Finding, Preset } from "../engine/types";
import {
  addIgnore, baseExtensions, clearFlash, findingsField, flashRanges, ignoredList, isIgnored, languageFor, removeIgnore, setFindings,
  type ViewportInfo,
} from "./editor";
import { canSaveInPlace, decodeFile, isUnsupportedBinary, openFiles, save as saveFile, saveAs as saveFileAs, type OpenedFile } from "./files";
import { SAMPLE_NAME, SAMPLE_TEXT } from "./sample";
import { recordFixes } from "./tips";
import { DOCX_DISABLED, applyToDocx, loadDocx, saveDocx } from "../formats/docx";

/* ---------- documents ---------- */

export interface Doc {
  id: string;
  name: string;
  fileType: FileType;
  /** text as it was when opened, for the Changes view */
  baseline: string;
  handle?: FileSystemFileHandle;
  dirty: boolean;
  untitled: boolean;
  /** a Word document: the editor shows its text, saving writes back into the XML */
  docx?: boolean;
}

export const docs = signal<Doc[]>([]);
export const activeId = signal<string | null>(null);
export const activeDoc = computed(() => docs.value.find((d) => d.id === activeId.value) ?? null);

const states = new Map<string, EditorState>();
const langSlots = new Map<string, Compartment>();
/** Word documents: the file bytes as last saved, and every text change since then */
const docxData = new Map<string, { bytes: Uint8Array; changes: ChangeSet; hidden: { start: number; end: number }[] }>();
let view: EditorView | null = null;

/* ---------- rules config, saved per file type ---------- */

const CFG_KEY = "residue.config.v1";
function loadConfigs(): Record<FileType, Config> {
  const base = { tex: defaultConfig("tex"), bib: defaultConfig("bib"), md: defaultConfig("md"), txt: defaultConfig("txt") };
  try {
    const saved = JSON.parse(localStorage.getItem(CFG_KEY) || "null") as Record<FileType, Config> | null;
    if (saved) for (const ft of Object.keys(base) as FileType[]) if (saved[ft]) base[ft] = { ...base[ft], ...saved[ft], enabled: { ...base[ft].enabled, ...saved[ft].enabled }, options: { ...base[ft].options, ...saved[ft].options } };
  } catch { /* storage unavailable: defaults */ }
  return base;
}
export const configs = signal<Record<FileType, Config>>(loadConfigs());
export const config = computed(() => configs.value[activeDoc.value?.fileType ?? "tex"]);

/** The config actually used for scanning: Word documents never get line-structure rules. */
function effectiveConfig(): Config {
  const d = activeDoc.value;
  const c = configs.value[d?.fileType ?? "tex"];
  if (!d?.docx) return c;
  return { ...c, enabled: { ...c.enabled, ...Object.fromEntries(DOCX_DISABLED.map((id) => [id, false])) } };
}
export const hiddenRules = computed(() => new Set(activeDoc.value?.docx ? DOCX_DISABLED : []));

function saveConfigs() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(configs.value)); } catch { /* ignore */ }
}
function updateConfig(fn: (c: Config) => Config) {
  const ft = activeDoc.value?.fileType ?? "tex";
  configs.value = { ...configs.value, [ft]: fn(configs.value[ft]) };
  saveConfigs();
  scheduleScan(0);
}
export function toggleRule(id: string) {
  updateConfig((c) => ({ ...c, preset: "custom" as Preset, enabled: { ...c.enabled, [id]: !c.enabled[id] } }));
}
export function setGroup(ids: string[], on: boolean) {
  updateConfig((c) => ({ ...c, preset: "custom" as Preset, enabled: { ...c.enabled, ...Object.fromEntries(ids.map((i) => [i, on])) } }));
}
export function setOption(id: string, value: string) {
  updateConfig((c) => ({ ...c, preset: "custom" as Preset, options: { ...c.options, [id]: value } }));
}
export function applyPreset(p: Preset) {
  const ft = activeDoc.value?.fileType ?? "tex";
  updateConfig(() => defaultConfig(ft, p));
}

/* ---------- scan results ---------- */

export const findings = signal<Finding[]>([]);
export const counts = signal<Record<string, number>>({});
export const selectedId = signal<string | null>(null);
export const docStats = signal<Stats | null>(null);
export const scanMs = signal(0);
export const viewport = signal<ViewportInfo>({ top: 0, bottom: 1 });
export const view$ = signal<"edit" | "diff">("edit");
export const toast = signal<{ text: string; action?: { label: string; run: () => void } } | null>(null);
export const docVersion = signal(0);
export const baselineParagraphs = signal(0);

export const selected = computed(() => findings.value.find((f) => f.id === selectedId.value) ?? null);
export const liveFindings = computed(() => {
  docVersion.value;
  const st = view?.state;
  return findings.value.map((f) => ({ f, ignored: st ? isIgnored(st, f) : false }));
});
export const tally = computed(() => {
  const t = { remove: 0, replace: 0, review: 0, ignored: 0 };
  for (const { f, ignored } of liveFindings.value) {
    if (ignored) t.ignored++;
    else t[f.kind]++;
  }
  return t;
});

let scanTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleScan(delay?: number) {
  clearTimeout(scanTimer);
  const len = view?.state.doc.length ?? 0;
  scanTimer = setTimeout(runScan, delay ?? (len > 200_000 ? 450 : len > 50_000 ? 220 : 120));
}

function runScan() {
  if (!view || !activeDoc.value) return;
  const state = view.state;
  const text = state.doc.toString();
  const t0 = performance.now();
  // hidden Word runs, mapped from the saved file through every edit since
  const dx = docxData.get(activeDoc.value.id);
  const extra = dx
    ? dx.hidden
        .map((h) => ({ type: "hidden" as const, start: dx.changes.mapPos(h.start, 1), end: dx.changes.mapPos(h.end, -1) }))
        .filter((h) => h.end > h.start)
    : [];
  const res = scan(text, effectiveConfig(), extra);
  scanMs.value = performance.now() - t0;
  if (view.state.doc !== state.doc) { scheduleScan(); return; } // the user typed meanwhile
  batch(() => {
    findings.value = res.findings;
    counts.value = res.counts;
    if (selectedId.value && !res.findings.some((f) => f.id === selectedId.value)) selectedId.value = null;
    docStats.value = computeStats(text, res.findings);
  });
  view.dispatch({ effects: setFindings.of({ findings: res.findings, selected: selectedId.value }) });
  docVersion.value++;
}

export function select(id: string | null, reveal = true) {
  selectedId.value = id;
  if (!view) return;
  view.dispatch({ effects: setFindings.of({ findings: view.state.field(findingsField).findings, selected: id }) });
  const f = findings.value.find((x) => x.id === id);
  if (f && reveal) view.dispatch({ effects: EditorView.scrollIntoView(f.start, { y: "center" }) });
}

export function selectNext(dir: 1 | -1) {
  const list = liveFindings.value.filter((x) => !x.ignored).map((x) => x.f);
  if (!list.length) return;
  const cur = view?.state.selection.main.head ?? 0;
  const i = list.findIndex((f) => f.id === selectedId.value);
  let next: Finding | undefined;
  if (i >= 0) next = list[(i + dir + list.length) % list.length];
  else next = dir === 1 ? list.find((f) => f.start >= cur) ?? list[0] : [...list].reverse().find((f) => f.start < cur) ?? list[list.length - 1];
  select(next.id);
}

/* ---------- actions on findings ---------- */

function stillThere(f: Finding): boolean {
  return !!view && view.state.doc.sliceString(f.start, f.end) === f.orig;
}

function dispatchChanges(changes: { from: number; to: number; insert: string }[], label: string) {
  if (!view || !changes.length) return;
  const cs = ChangeSet.of(changes, view.state.doc.length);
  view.dispatch({ changes: cs, userEvent: label, scrollIntoView: false });
  flash(cs);
}

function flash(cs: ChangeSet) {
  if (!view) return;
  const ranges: { from: number; to: number }[] = [];
  cs.iterChanges((_a, _b, fromB, toB) => ranges.push({ from: fromB, to: toB }));
  view.dispatch({ effects: flashRanges.of(ranges) });
  setTimeout(() => view?.dispatch({ effects: clearFlash.of(null) }), 1200);
}

/** Apply one fix, or accept suggestion `pick` of a review. */
export function applyFinding(f: Finding, pick?: number) {
  if (!view || !stillThere(f)) { scheduleScan(0); return; }
  const text = view.state.doc.toString();
  const value = f.kind === "review" ? (pick === undefined ? null : f.suggestions[pick] === "(delete)" ? "" : f.suggestions[pick]) : f.repl;
  if (value === null || value === undefined) return;
  const tail = f.kind === "review" && value !== "" && !/\s$/.test(value) ? (/\s+$/.exec(f.orig)?.[0] ?? "") : "";
  const changes = changesFor(text, [f], () => value + tail);
  const next = neighbour(f);
  dispatchChanges(changes, "input.residue");
  selectedId.value = next;
  scheduleScan(0);
}

function neighbour(f: Finding): string | null {
  const list = liveFindings.value.filter((x) => !x.ignored && x.f.id !== f.id).map((x) => x.f);
  const n = list.find((x) => x.start > f.start) ?? list[0];
  return n ? `${n.ruleId}@${n.start}` : null;
}

export function ignoreFinding(f: Finding) {
  if (!view) return;
  view.dispatch({ effects: addIgnore.of({ ruleId: f.ruleId, pos: f.start }) });
  docVersion.value++;
}
export function unignoreFinding(f: Finding) {
  if (!view) return;
  view.dispatch({ effects: removeIgnore.of({ ruleId: f.ruleId, pos: f.start }) });
  docVersion.value++;
}

/** Apply every fix of one rule. */
export function applyRule(ruleId: string) {
  if (!view) return;
  const st = view.state;
  const list = findings.value.filter((f) => f.ruleId === ruleId && f.kind !== "review" && !isIgnored(st, f) && stillThere(f));
  const text = st.doc.toString();
  dispatchChanges(changesFor(text, list, (f) => f.repl), "input.residue");
  recordFixes(list.length, false);
  toastMsg(`${list.length} ${list.length === 1 ? "fix" : "fixes"} applied: ${RULES_BY_ID[ruleId]?.name ?? ruleId}. Ctrl+Z to undo.`);
  scheduleScan(0);
}

/** Apply every enabled fix, repeating until the text is stable. One undo step. */
export function cleanEverything() {
  if (!view || !activeDoc.value) return;
  const st = view.state;
  const text = st.doc.toString();
  const res = cleanAll(text, effectiveConfig(), ignoredList(st));
  if (!res.passes.length) { toastMsg("Nothing to fix. Style signals stay for you to review."); return; }
  let cs = ChangeSet.empty(text.length);
  let len = text.length;
  for (const pass of res.passes) {
    const next = ChangeSet.of(pass, len);
    cs = cs.compose(next);
    len = next.newLength;
  }
  view.dispatch({ changes: cs, userEvent: "input.residue.clean", scrollIntoView: false });
  flash(cs);
  const n = Object.values(res.applied).reduce((a, b) => a + b, 0);
  recordFixes(n, true);
  toastMsg(`Cleaned ${n} ${n === 1 ? "issue" : "issues"} in ${res.passes.length} ${res.passes.length === 1 ? "pass" : "passes"}.`, { label: "Undo", run: undo });
  scheduleScan(0);
}

export function undo() {
  if (!view) return;
  cmUndo(view);
  view.focus();
}

/* ---------- toast ---------- */

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toastMsg(text: string, action?: { label: string; run: () => void }) {
  clearTimeout(toastTimer);
  toast.value = { text, action };
  toastTimer = setTimeout(() => (toast.value = null), 5200);
}

/* ---------- editor lifecycle ---------- */

const hooks = {
  onDocChanged: (_s: EditorState, changes: ChangeSet) => {
    const d = activeDoc.value;
    const dx = d && docxData.get(d.id);
    if (dx) dx.changes = dx.changes.compose(changes);
    if (d && !d.dirty) docs.value = docs.value.map((x) => (x.id === d.id ? { ...x, dirty: true } : x));
    scheduleScan();
    scheduleAutosave();
  },
  onSelectFinding: (id: string | null) => { if (id) select(id, false); },
  onViewport: (v: ViewportInfo) => { viewport.value = v; },
  keys: [
    { run: "next", key: "F8", handler: () => { selectNext(1); return true; } },
    { run: "prev", key: "Shift-F8", handler: () => { selectNext(-1); return true; } },
    { run: "apply", key: "Alt-Enter", handler: () => { const f = selected.value; if (f) applyFinding(f, f.kind === "review" ? 0 : undefined); return true; } },
    { run: "ignore", key: "Alt-Backspace", handler: () => { const f = selected.value; if (f) ignoreFinding(f); return true; } },
    { run: "clean", key: "Mod-Shift-l", handler: () => { cleanEverything(); return true; } },
    { run: "save", key: "Mod-s", handler: () => { void saveActive(); return true; } },
    { run: "open", key: "Mod-o", handler: () => { void openDialog(); return true; } },
  ],
};

function createState(doc: Doc, text: string): EditorState {
  const slot = new Compartment();
  langSlots.set(doc.id, slot);
  const ext = baseExtensions(doc.fileType, hooks, slot.of(languageFor(doc.fileType)));
  if (doc.docx) ext.push(EditorState.readOnly.of(true));
  return EditorState.create({ doc: text, extensions: ext });
}

export function mountEditor(parent: HTMLElement) {
  view = new EditorView({ parent, state: EditorState.create({ doc: "" }) });
  const d = activeDoc.value;
  if (d && states.has(d.id)) view.setState(states.get(d.id)!);
  scheduleScan(0);
  return () => { view?.destroy(); view = null; };
}

export function focusEditor() { view?.focus(); }
export function currentText(): string { return view?.state.doc.toString() ?? ""; }

export function activate(id: string) {
  if (!view) { activeId.value = id; return; }
  const cur = activeDoc.value;
  if (cur) states.set(cur.id, view.state);
  batch(() => {
    activeId.value = id;
    selectedId.value = null;
    findings.value = [];
  });
  const st = states.get(id);
  if (st) view.setState(st);
  const nd = docs.value.find((d) => d.id === id);
  baselineParagraphs.value = paragraphsOf(nd?.baseline ?? "", nd?.docx);
  scheduleScan(0);
}

/** Word paragraphs are single lines in the editor; text files separate paragraphs with a blank line. */
export function paragraphsOf(t: string, docx = false) {
  return (docx ? t.split("\n") : t.split(/\n[ \t]*\n/)).filter((p) => p.trim()).length;
}

let seq = 0;
function newId() { return `d${Date.now().toString(36)}${(seq++).toString(36)}`; }

export function addDoc(name: string, text: string, opts: { handle?: FileSystemFileHandle; fileType?: FileType; untitled?: boolean; baseline?: string; dirty?: boolean; docx?: Uint8Array } = {}) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const doc: Doc = {
    id: newId(),
    name,
    fileType: opts.fileType ?? fileTypeFromName(name),
    baseline: opts.baseline ?? normalized,
    handle: opts.handle,
    dirty: opts.dirty ?? false,
    untitled: !!opts.untitled,
    docx: !!opts.docx,
  };
  if (opts.docx) docxData.set(doc.id, { bytes: opts.docx, changes: ChangeSet.empty(normalized.length), hidden: [] });
  states.set(doc.id, createState(doc, normalized));
  docs.value = [...docs.value, doc];
  activate(doc.id);
  scheduleAutosave();
  return doc;
}

export function closeDoc(id: string) {
  const i = docs.value.findIndex((d) => d.id === id);
  if (i < 0) return;
  const rest = docs.value.filter((d) => d.id !== id);
  states.delete(id);
  docxData.delete(id);
  docs.value = rest;
  if (activeId.value === id) {
    if (rest.length) activate(rest[Math.max(0, i - 1)].id);
    else {
      activeId.value = null;
      view?.setState(EditorState.create({ doc: "" }));
      findings.value = [];
    }
  }
  scheduleAutosave();
}

export function setFileType(ft: FileType) {
  const d = activeDoc.value;
  if (!d || !view) return;
  docs.value = docs.value.map((x) => (x.id === d.id ? { ...x, fileType: ft } : x));
  const slot = langSlots.get(d.id);
  if (slot) view.dispatch({ effects: slot.reconfigure(languageFor(ft)) });
  scheduleScan(0);
}

export function newDoc(ft: FileType = "tex") {
  const ext = ft === "md" ? "md" : ft === "txt" ? "txt" : ft === "bib" ? "bib" : "tex";
  const n = docs.value.filter((d) => d.untitled).length + 1;
  addDoc(`untitled-${n}.${ext}`, "", { untitled: true, fileType: ft });
  setTimeout(focusEditor, 0);
}

export function loadSample() {
  addDoc(SAMPLE_NAME, SAMPLE_TEXT, { untitled: true });
}

export function markBaseline() {
  const d = activeDoc.value;
  if (!d) return;
  const text = currentText();
  docs.value = docs.value.map((x) => (x.id === d.id ? { ...x, baseline: text } : x));
  baselineParagraphs.value = paragraphsOf(text, d.docx);
  toastMsg("Changes view now compares against the current text.");
}

/* ---------- open and save ---------- */

async function openOne(f: OpenedFile) {
  if (f.bytes) {
    try {
      const model = await loadDocx(f.bytes);
      const doc = addDoc(f.name, model.text, { handle: f.handle, fileType: "txt", docx: f.bytes });
      const dx = docxData.get(doc.id);
      if (dx) dx.hidden = model.hidden;
      scheduleScan(0);
      if (model.hidden.length) {
        toastMsg(`${f.name} contains ${model.hidden.length} piece${model.hidden.length === 1 ? "" : "s"} of hidden, white or tiny text. They are flagged in the editor.`);
        return;
      }
      toastMsg(`${f.name}: Word document. Typing is off; rules fix the text and Save keeps all formatting.`);
    } catch (e) {
      toastMsg(`Could not open ${f.name}: ${(e as Error).message}`);
    }
    return;
  }
  const existing = f.handle ? docs.value.find((d) => d.handle && d.name === f.name) : undefined;
  if (existing) { activate(existing.id); return; }
  addDoc(f.name, f.text, { handle: f.handle });
  const notes: string[] = [];
  if (f.legacyEncoding) notes.push("It was not UTF-8, so it was read as Windows-1252.");
  if (f.encoding === "utf-16le" || f.encoding === "utf-16be") notes.push("It was saved as UTF-16; saving writes UTF-8.");
  if (f.crlf) notes.push("Windows line endings were converted to LF.");
  if (notes.length) toastMsg(`${f.name}: ${notes.join(" ")}`);
}

export async function openDialog() {
  for (const f of await openFiles()) await openOne(f);
}

export async function openDropped(list: FileList | File[]) {
  const skipped: string[] = [];
  for (const file of Array.from(list)) {
    const kind = isUnsupportedBinary(file.name);
    if (kind) { skipped.push(`${kind} are not supported yet (${file.name}).`); continue; }
    await openOne(await decodeFile(file));
  }
  if (skipped.length) toastMsg(skipped.join(" "));
}

export async function saveActive(as = false) {
  const d = activeDoc.value;
  if (!d || !view) return;
  let text: string | Uint8Array = currentText();
  const dx = docxData.get(d.id);
  if (dx) {
    const model = await loadDocx(dx.bytes);
    const changes: { fromA: number; toA: number; insert: string }[] = [];
    dx.changes.iterChanges((fromA, toA, _fb, _tb, ins) => changes.push({ fromA, toA, insert: ins.toString() }));
    const refused = applyToDocx(model, changes);
    text = await saveDocx(model);
    if (refused) toastMsg(`${refused} change(s) touched paragraph breaks and were left out, so no paragraphs were merged.`);
  }
  try {
    const res = as || !d.handle ? await saveFileAs(d.name, text) : await saveFile(d.name, text, d.handle);
    if (res.kind === "cancelled") return;
    if (dx && text instanceof Uint8Array) {
      dx.bytes = text;
      dx.changes = ChangeSet.empty(view.state.doc.length);
      dx.hidden = (await loadDocx(text)).hidden;
    }
    docs.value = docs.value.map((x) =>
      x.id === d.id ? { ...x, dirty: false, untitled: false, name: res.name, handle: res.kind === "saved" ? res.handle : x.handle } : x,
    );
    toastMsg(res.kind === "saved" ? `Saved ${res.name}.` : `Downloaded ${res.name}. Your browser cannot save in place, so it went to Downloads.`);
    scheduleAutosave();
  } catch (e) {
    toastMsg(`Could not save: ${(e as Error).message}`);
  }
}

export const saveInPlace = canSaveInPlace;

/* ---------- autosave (this browser only) ---------- */

const SESSION_KEY = "residue.session.v1";
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(persist, 800);
}
async function persist() {
  if (view && activeDoc.value) states.set(activeDoc.value.id, view.state);
  const payload = docs.value.map((d) => {
    const dx = docxData.get(d.id);
    return { ...d, text: states.get(d.id)?.doc.toString() ?? "", docxBytes: dx?.bytes, docxChanges: dx?.changes.toJSON() };
  });
  try { await idbSet(SESSION_KEY, { docs: payload, activeId: activeId.value }); } catch { /* private mode: no autosave */ }
}

export async function restoreSession(): Promise<boolean> {
  try {
    const s = (await idbGet(SESSION_KEY)) as { docs: (Doc & { text: string; docxBytes?: Uint8Array; docxChanges?: unknown })[]; activeId: string | null } | undefined;
    if (!s?.docs?.length) return false;
    for (const d of s.docs) {
      if (d.docx && d.docxBytes) {
        const hidden = await loadDocx(d.docxBytes).then((m) => m.hidden).catch(() => []);
        docxData.set(d.id, { bytes: d.docxBytes, changes: d.docxChanges ? ChangeSet.fromJSON(d.docxChanges) : ChangeSet.empty(d.text.length), hidden });
      }
      states.set(d.id, createState(d, d.text));
    }
    docs.value = s.docs.map(({ text: _t, docxBytes: _b, docxChanges: _c, ...d }) => d);
    const id = s.activeId && s.docs.some((d) => d.id === s.activeId) ? s.activeId : s.docs[0].id;
    activate(id);
    return true;
  } catch {
    return false;
  }
}

/* ---------- theme ---------- */

export const theme = signal<"auto" | "light" | "dark">((() => { try { return (localStorage.getItem("residue.theme") as "auto" | "light" | "dark") || "auto"; } catch { return "auto"; } })());
export function cycleTheme() {
  const order = ["auto", "light", "dark"] as const;
  theme.value = order[(order.indexOf(theme.value) + 1) % 3];
  try { localStorage.setItem("residue.theme", theme.value); } catch { /* ignore */ }
  applyTheme();
}
export function applyTheme() {
  if (theme.value === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme.value);
}

export const showRules = signal(true);

/** Turn on every "Convert to plain text" rule for this file type and clean in one undoable step. */
export function convertToPlain() {
  const ids = RULES.filter((r) => r.group === "plain").map((r) => r.id);
  setGroup(ids, true);
  // setGroup schedules a scan; clean right away with the new settings
  cleanEverything();
  toastMsg("Converted to plain text. The rules stay on for this file type until you switch them off in Convert to plain text.", { label: "Undo", run: undo });
}

/** Forget open documents and settings kept in this browser. Files on disk are not touched. */
export async function clearSavedData() {
  if (!window.confirm("Remove the documents and settings saved in this browser? Files on your disk are not affected.")) return;
  try { await idbDel(SESSION_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(CFG_KEY); localStorage.removeItem("residue.theme"); } catch { /* ignore */ }
  location.reload();
}
export { RULES, presetForFile };
