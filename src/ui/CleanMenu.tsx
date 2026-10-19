import { useEffect, useRef, useState } from "preact/hooks";
import { diffWordsWithSpace } from "diff";
import { GROUPS, RULES, RULES_BY_ID, ruleApplies } from "../engine/engine";
import {
  activeDoc, bulkSelection, resetBulk, toggleBulkRule, setBulkGroup, setBulkWording,
  cleanEverything, liveFindings, config, hiddenRules, bulkPreview, acceptBulkPreview,
} from "./store";

export function CleanMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selection = bulkSelection.value;
  const counts = new Map<string, number>();
  for (const { f, ignored } of liveFindings.value) if (!ignored && (f.kind !== "review" || RULES_BY_ID[f.ruleId]?.bulk === "wording"))
    counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
  const eligible = RULES.filter((r) => ruleApplies(r, activeDoc.value?.fileType ?? "tex") && !r.guard && (r.group !== "sty" || r.bulk === "wording") && !hiddenRules.value.has(r.id));
  const estimate = eligible.filter((r) => selection.ruleIds.includes(r.id) && (r.bulk !== "wording" || selection.includeWording))
    .reduce((n, r) => n + (counts.get(r.id) ?? 0), 0);
  const moderate = !selection.includeWording && RULES.every((r) => selection.ruleIds.includes(r.id) === (r.bulk === "moderate"));
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    root.current?.querySelector<HTMLButtonElement>(".clean-options button")?.focus();
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  return (
    <div class="clean-wrap" ref={root} onKeyDown={(e) => {
      if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }}>
      <div class="split-clean">
        <button class="btn primary" disabled={!activeDoc.value || estimate === 0} onClick={() => cleanEverything()}
          title="Apply the selected cleanup rules. Wording edits require a preview. Ctrl+Shift+L">
          Clean all <span class="badge num">{estimate}</span>
        </button>
        <button class="btn primary" ref={trigger} disabled={!activeDoc.value} aria-label="Select cleanup rules" aria-expanded={open}
          aria-controls="clean-options" onClick={() => setOpen(!open)}>{"▾"}</button>
      </div>
      {open && <section class="clean-options" id="clean-options" aria-label="Bulk cleanup selection">
        <div class="row"><strong>{moderate ? "Moderate" : "Custom selection"}</strong>
          <button class="btn small" onClick={resetBulk}>Reset to Moderate</button>
          <button class="iconbtn" aria-label="Close cleanup selection" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button>
        </div>
        <p class="hint">Counts are estimates from the current scan. Only enabled, selected rules run. Review-only findings stay for you.</p>
        <label class="wording-choice"><input type="checkbox" checked={selection.includeWording}
          onChange={(e) => setBulkWording(e.currentTarget.checked)} /> Include wording cleanup (preview required)</label>
        {GROUPS.map((g) => {
          const rules = eligible.filter((r) => r.group === g.id && r.bulk !== "wording");
          if (!rules.length) return null;
          const all = rules.every((r) => selection.ruleIds.includes(r.id));
          const some = rules.some((r) => selection.ruleIds.includes(r.id));
          return <details key={g.id}>
            <summary>{g.name} — {some ? all ? "selected" : "partly selected" : "not selected"}</summary>
            <label><input type="checkbox" checked={all} onChange={(e) => setBulkGroup(rules.map((r) => r.id), e.currentTarget.checked)} /> Select this category</label>
            {rules.map((r) => <label key={r.id} class="bulk-rule">
              <input type="checkbox" checked={selection.ruleIds.includes(r.id)} onChange={() => toggleBulkRule(r.id)} />
              <span>{r.name}{r.bulk === "explicit" ? " (optional)" : ""}{!config.value.enabled[r.id] ? " — disabled in Rules" : ""}</span>
              <span class="num">{counts.get(r.id) ?? 0}</span>
            </label>)}
          </details>;
        })}
      </section>}
    </div>
  );
}

export function CleanupPreview() {
  const preview = bulkPreview.value;
  const parts = preview && preview.before.length + preview.result.text.length <= 800_000
    ? diffWordsWithSpace(preview.before, preview.result.text) : null;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);
  return <dialog class="cleanup-preview" ref={dialog} aria-labelledby="cleanup-preview-title"
    onCancel={() => { bulkPreview.value = null; }} onClose={() => { bulkPreview.value = null; }}>
    {preview && <>
      <h2 id="cleanup-preview-title">Review selected cleanup</h2>
      <p>Check meaning, citations, and technical wording. Applying is one undo step.</p>
      <p>{Object.entries(preview.result.applied).map(([id, n]) => `${RULES_BY_ID[id]?.name ?? id}: ${n}`).join(" · ")}</p>
      {preview.result.refused > 0 && <p role="status">{preview.result.refused} Word wording edit(s) refused to protect structure.</p>}
      <div class="preview-columns"><section><h3>Before</h3><pre>{parts ? parts.filter((p) => !p.added).map((p) => p.removed ? <del>{p.value}</del> : p.value) : preview.before}</pre></section><section><h3>After</h3><pre>{parts ? parts.filter((p) => !p.removed).map((p) => p.added ? <ins>{p.value}</ins> : p.value) : preview.result.text}</pre></section></div>
      <div class="row"><button class="btn primary" onClick={acceptBulkPreview}>Apply selected changes</button>
        <button class="btn" onClick={() => { bulkPreview.value = null; }}>Cancel</button></div>
    </>}
  </dialog>;
}
