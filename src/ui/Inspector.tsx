import { GROUPS, RULES_BY_ID } from "../engine/engine";
import { charName, hex, visualize } from "../engine/unicode";
import { activeDoc, applyFinding, currentText, docStats, findings, ignoreFinding, liveFindings, selected, tally, toggleRule, unignoreFinding } from "./store";

const KIND_LABEL = { remove: "Removed on clean", replace: "Replaced on clean", review: "Your call", skip: "Ignored" } as const;

/** Long values (a whole converted document) are shortened in the inspector. */
function clip(s: string, n = 400): string {
  return s.length > n ? `${s.slice(0, n)} ... (${(s.length - n).toLocaleString()} more characters)` : s;
}

function position(text: string, pos: number) {
  const before = text.slice(0, pos);
  const line = (before.match(/\n/g) || []).length + 1;
  return `Ln ${line}, Col ${pos - before.lastIndexOf("\n")}`;
}

function CodePoints({ s }: { s: string }) {
  const chars = Array.from(s);
  const tags = chars.every((c) => { const cp = c.codePointAt(0)!; return cp >= 0xe0000 && cp <= 0xe007f; });
  if (tags) return <div class="box cps"><div><span>U+E00xx</span><span>{chars.length} tag characters</span></div></div>;
  const shown = chars.slice(0, 8);
  return (
    <div class="box cps">
      {shown.map((c, i) => (
        <div key={i}><span>U+{hex(c.codePointAt(0)!)}</span><span>{charName(c)}</span></div>
      ))}
      {chars.length > 8 && <div><span>+{chars.length - 8}</span><span>more</span></div>}
    </div>
  );
}

function FindingView() {
  const f = selected.value!;
  const rule = RULES_BY_ID[f.ruleId];
  const ignored = liveFindings.value.find((x) => x.f.id === f.id)?.ignored ?? false;
  const text = currentText();
  const before = text.slice(Math.max(0, f.start - 36), f.start);
  const after = text.slice(f.end, f.end + 36);
  const group = GROUPS.find((g) => g.id === rule?.group);
  const k = ignored ? "skip" : f.kind;
  const showCps = !["sty", "res", "md"].includes(rule?.group ?? "") || f.ruleId === "res.cite";
  return (
    <div class="ibody">
      <div>
        <span class={`verdict k-${k}`}>{KIND_LABEL[k]}</span>
        <h2>{rule?.name ?? f.ruleId}</h2>
        <p>{rule?.desc}</p>
      </div>
      {f.note && <div class="note">{f.note}</div>}
      <dl class="kv">
        <dt>Where</dt><dd>{position(text, f.start)}</dd>
        <dt>Group</dt><dd>{group?.name}</dd>
        {f.kind !== "review" && <><dt>Becomes</dt><dd>{f.repl === "" ? "nothing (removed)" : clip(JSON.stringify(f.repl))}</dd></>}
      </dl>
      {showCps && f.orig && <CodePoints s={f.orig} />}
      <div class="box">
        <div><span class="lab">Now</span>{visualize(before)}<mark>{clip(visualize(f.orig)) || "‸"}</mark>{visualize(after)}</div>
        {f.kind !== "review" && (
          <div><span class="lab">After clean</span>{visualize(before)}{f.repl ? <mark class="after">{clip(visualize(f.repl))}</mark> : null}{visualize(after)}</div>
        )}
      </div>
      <div class="acts">
        {f.kind === "review" ? (
          <>
            {f.suggestions.length === 0 && <p class="hint">No safe automatic rewrite. Edit the text directly, or ignore this.</p>}
            {f.suggestions.map((s, i) => (
              <button class="btn small" key={i} onClick={() => applyFinding(f, i)} title={i === 0 ? "Alt+Enter" : undefined}>
                {s === "(delete)" ? "Delete it" : `Use “${s.trim().length > 40 ? s.trim().slice(0, 40) + "..." : s.trim()}”`}
              </button>
            ))}
          </>
        ) : (
          !ignored && <button class="btn small primary" onClick={() => applyFinding(f)} title="Alt+Enter">Apply this fix</button>
        )}
        {ignored ? (
          <button class="btn small" onClick={() => unignoreFinding(f)}>Stop ignoring</button>
        ) : (
          <button class="btn small" onClick={() => ignoreFinding(f)} title="Alt+Backspace">{f.kind === "review" ? "Keep as is" : "Keep this one"}</button>
        )}
      </div>
      <button class="linkbtn" onClick={() => toggleRule(f.ruleId)}>Turn off the rule "{rule?.name}"</button>
    </div>
  );
}

function Gauge({ value, max, warn }: { value: number; max: number; warn?: boolean }) {
  return <div class="gauge"><i class={warn ? "warn" : ""} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>;
}

function Summary() {
  const s = docStats.value;
  const t = tally.value;
  const d = activeDoc.value;
  if (!d) return <div class="ibody"><p>Open a file, paste text, or start from the sample to see what is hiding in it.</p></div>;
  const byGroup = GROUPS.map((g) => ({ g, n: findings.value.filter((f) => RULES_BY_ID[f.ruleId]?.group === g.id).length })).filter((x) => x.n);
  return (
    <div class="ibody">
      <div>
        <div class="section-t">This document</div>
        <p style={{ marginTop: "4px" }}>
          {t.remove + t.replace + t.review === 0
            ? "Nothing left to fix or review with the current rules."
            : `${t.remove + t.replace} fixes wait for Clean all. ${t.review} ${t.review === 1 ? "signal needs" : "signals need"} your judgement.`}
        </p>
      </div>
      {byGroup.length > 0 && (
        <div class="box">
          {byGroup.map(({ g, n }) => (
            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--ui)" }}><span>{g.name}</span><span class="num mono">{n}</span></div>
          ))}
        </div>
      )}
      {s && s.words > 30 && (
        <div style={{ display: "grid", gap: "12px" }}>
          <div class="section-t">Writing profile</div>
          <div class="stat">
            <span>Sentence length variation</span><span class="v">{s.burstiness.toFixed(2)}</span>
            <Gauge value={s.burstiness} max={1} warn={s.burstiness < 0.35} />
            <span class="d">How much sentence lengths vary. Human prose usually scores above 0.45. Very even rhythm is a common LLM trait.</span>
          </div>
          <div class="stat">
            <span>Average sentence</span><span class="v">{s.avgSentence.toFixed(1)} words</span>
          </div>
          <div class="stat">
            <span>Em dashes per 1000 words</span><span class="v">{s.emDashPer1k.toFixed(1)}</span>
            <Gauge value={s.emDashPer1k} max={12} warn={s.emDashPer1k > 4} />
          </div>
          <div class="stat">
            <span>Style signals per 1000 words</span><span class="v">{s.signalsPer1k.toFixed(1)}</span>
            <Gauge value={s.signalsPer1k} max={40} warn={s.signalsPer1k > 12} />
            <span class="d">Signals are hints, not proof. Clearing them does not make text "undetectable", and human writing trips them too.</span>
          </div>
        </div>
      )}
      <div class="hint">
        <kbd>F8</kbd> next finding, <kbd>Shift F8</kbd> previous<br />
        <kbd>Alt Enter</kbd> apply or accept, <kbd>Alt Backspace</kbd> keep as is<br />
        <kbd>Ctrl Shift L</kbd> clean all, <kbd>Ctrl F</kbd> find and replace<br />
        <kbd>Ctrl S</kbd> save, <kbd>Ctrl Z</kbd> undo anything
      </div>
    </div>
  );
}

export function Inspector() {
  return (
    <aside class="pane insp" aria-label="Inspector">
      <div class="phead"><div class="ptitle">{selected.value ? "Finding" : "Overview"}</div></div>
      {selected.value ? <FindingView /> : <Summary />}
    </aside>
  );
}
