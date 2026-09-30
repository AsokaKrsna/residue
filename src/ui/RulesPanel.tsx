import { useState } from "preact/hooks";
import { GROUPS, ruleApplies } from "../engine/engine";
import type { Kind } from "../engine/types";
import { activeDoc, applyRule, config, counts, findings, hiddenRules, RULES, select, setGroup, setOption, toggleRule } from "./store";

function ruleKind(id: string): Kind | null {
  const f = findings.value.find((x) => x.ruleId === id);
  return f ? f.kind : null;
}

export function RulesPanel() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const cfg = config.value;
  const ft = activeDoc.value?.fileType ?? "tex";
  const query = q.trim().toLowerCase();
  const applicable = RULES.filter((r) => ruleApplies(r, ft) && !hiddenRules.value.has(r.id));
  const onCount = applicable.filter((r) => cfg.enabled[r.id]).length;

  return (
    <aside class="pane rules" aria-label="Rules">
      <div class="phead">
        <div class="ptitle">Rules <span class="sub num">{onCount} of {applicable.length} on</span></div>
        <input type="search" placeholder="Filter rules" aria-label="Filter rules" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </div>
      {GROUPS.map((g) => {
        const rs = applicable.filter((r) => r.group === g.id && (!query || `${r.name} ${r.desc} ${r.id}`.toLowerCase().includes(query)));
        if (!rs.length) return null;
        const ons = rs.filter((r) => cfg.enabled[r.id]).length;
        const n = rs.reduce((a, r) => a + (r.guard ? 0 : counts.value[r.id] ?? 0), 0);
        const isCollapsed = collapsed[g.id] && !query;
        return (
          <section class={`group${isCollapsed ? " collapsed" : ""}`} key={g.id}>
            <div class="ghead" onClick={() => setCollapsed({ ...collapsed, [g.id]: !collapsed[g.id] })}>
              <span class="chev" aria-hidden="true">{"▾"}</span>
              <span class="gname">{g.name}</span>
              {n > 0 && <span class="mono num" style={{ fontSize: "11px", color: "var(--ink-2)" }}>{n}</span>}
              <button
                class={`sw${ons && ons < rs.length ? " mixed" : ""}`}
                role="switch"
                aria-checked={ons === rs.length}
                aria-label={`All rules in ${g.name}`}
                onClick={(e) => { e.stopPropagation(); setGroup(rs.map((r) => r.id), ons !== rs.length); }}
              />
            </div>
            {!isCollapsed && <div class="gblurb">{g.blurb}</div>}
            <div class="rulelist">
              {rs.map((r) => {
                const on = !!cfg.enabled[r.id];
                const c = r.guard ? null : counts.value[r.id] ?? 0;
                const k = c ? ruleKind(r.id) : null;
                const isOpen = open[r.id];
                const fixable = !!c && k !== "review";
                return (
                  <div class={`rule${on ? "" : " off"}${isOpen ? " open" : ""}`} key={r.id} onClick={() => setOpen({ ...open, [r.id]: !isOpen })}>
                    <span class="nm">{r.name}</span>
                    <span class={`ct num${k && on ? ` k-${k}` : ""}`} title={r.guard ? "protection switch" : "findings in this document"}>
                      {r.guard ? "" : on ? c : "off"}
                    </span>
                    <button class="sw" role="switch" aria-checked={on} aria-label={r.name} onClick={(e) => { e.stopPropagation(); toggleRule(r.id); }} />
                    <div class="more" onClick={(e) => e.stopPropagation()}>
                      <span>{r.desc}</span>
                      {r.options && (
                        <label class="row">
                          <span class="label">Replace with</span>
                          <select value={cfg.options[r.id]} onChange={(e) => setOption(r.id, (e.target as HTMLSelectElement).value)}>
                            {r.options.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}
                          </select>
                        </label>
                      )}
                      {on && !!c && (
                        <div class="row">
                          {fixable && <button class="btn small" onClick={() => applyRule(r.id)}>Apply {c}</button>}
                          <button class="btn small" onClick={() => { const f = findings.value.find((x) => x.ruleId === r.id); if (f) select(f.id); }}>Show first</button>
                        </div>
                      )}
                      <span class="mono" style={{ color: "var(--ink-3)", fontSize: "11px" }}>{r.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </aside>
  );
}
