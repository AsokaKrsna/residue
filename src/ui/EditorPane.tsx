import { useEffect, useMemo, useRef } from "preact/hooks";
import { diffWordsWithSpace } from "diff";
import { visualize } from "../engine/unicode";
import { activeDoc, currentText, docVersion, liveFindings, loadSample, mountEditor, newDoc, openDialog, select, selectNext, tally, view$, viewport, selectedId } from "./store";
import { Logo } from "./Chrome";

function Ruler() {
  const items = liveFindings.value;
  const vp = viewport.value;
  const text = currentText();
  const lines = useMemo(() => {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    return starts;
  }, [text]);
  const lineOf = (pos: number) => {
    let lo = 0, hi = lines.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lines[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const total = Math.max(lines.length, 1);
  return (
    <div
      class="ruler"
      title="Where findings sit in the file. Click to jump."
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const frac = (e.clientY - r.top) / r.height;
        const target = Math.floor(frac * total);
        const near = items.filter((x) => !x.ignored).sort((a, b) => Math.abs(lineOf(a.f.start) - target) - Math.abs(lineOf(b.f.start) - target))[0];
        if (near) select(near.f.id);
      }}
    >
      <div class="view" style={{ top: `${vp.top * 100}%`, height: `${Math.max(2, (vp.bottom - vp.top) * 100)}%` }} />
      {items.map(({ f, ignored }) =>
        ignored ? null : <i key={f.id} class={`k-${f.kind}`} style={{ top: `calc(${(lineOf(f.start) / total) * 100}% + 1px)`, outline: f.id === selectedId.value ? "1px solid var(--ink)" : undefined }} />,
      )}
    </div>
  );
}

function Empty() {
  return (
    <div class="empty">
      <div class="card">
        <Logo size={40} />
        <h1>See what your text is <em>carrying</em>.</h1>
        <p>
          Paste text or open a file. Hidden characters, chat leftovers and LLM habits show up right in the editor. Fix everything in one
          step or go through it line by line. Nothing leaves this browser tab.
        </p>
        <div class="row">
          <button class="btn primary" onClick={() => void openDialog()}>Open a file</button>
          <button class="btn" onClick={() => newDoc("tex")}>Paste into a new document</button>
          <button class="btn ghost" onClick={loadSample}>Try the sample chapter</button>
        </div>
        <div class="types">{[".tex", ".bib", ".md", ".txt"].map((t) => <span key={t}>{t}</span>)}<span>drag and drop works too</span></div>
      </div>
    </div>
  );
}

function Diff() {
  const d = activeDoc.value!;
  docVersion.value;
  const now = currentText();
  const parts = useMemo(() => (d.baseline.length + now.length > 800_000 ? null : diffWordsWithSpace(d.baseline, now)), [d.baseline, now]);
  if (!parts) return <div class="diff">This document is too large for the Changes view.</div>;
  const changed = parts.some((p) => p.added || p.removed);
  return (
    <div class="diff" aria-label="Changes since the file was opened">
      {!changed && <p class="same" style={{ fontFamily: "var(--ui)" }}>No changes since this file was opened.</p>}
      {parts.map((p, i) =>
        p.added ? <ins key={i}>{visualize(p.value)}</ins> : p.removed ? <del key={i}>{visualize(p.value)}</del> : <span class="same" key={i}>{p.value}</span>,
      )}
    </div>
  );
}

export function EditorPane() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => mountEditor(host.current!), []);
  const d = activeDoc.value;
  const t = tally.value;
  const v = view$.value;
  return (
    <section class="center" aria-label="Document">
      <div class="ehead">
        <div class="seg" role="group" aria-label="View">
          <button aria-pressed={v === "edit"} onClick={() => (view$.value = "edit")}>Edit</button>
          <button aria-pressed={v === "diff"} onClick={() => (view$.value = "diff")} disabled={!d}>Changes</button>
        </div>
        <span class="key"><i style={{ background: "var(--rm)" }} />Remove <b>{t.remove}</b></span>
        <span class="key"><i style={{ background: "var(--rp)" }} />Replace <b>{t.replace}</b></span>
        <span class="key"><i style={{ background: "var(--rv)" }} />Review <b>{t.review}</b></span>
        {t.ignored > 0 && <span class="key"><i style={{ background: "var(--ink-3)" }} />Kept <b>{t.ignored}</b></span>}
        <span style={{ marginLeft: "auto" }} class="row">
          <button class="btn small ghost" onClick={() => selectNext(-1)} disabled={!d} title="Previous finding (Shift+F8)">Prev</button>
          <button class="btn small ghost" onClick={() => selectNext(1)} disabled={!d} title="Next finding (F8)">Next</button>
        </span>
      </div>
      {d?.docx && (
        <div class="banner">Word document. Typing is off here so paragraphs and formatting stay intact. Apply fixes with the rules, then Save writes a .docx with every style kept.</div>
      )}
      <div class="ewrap">
        <div class="cm-host" ref={host} style={{ display: v === "edit" ? undefined : "none" }} />
        {v === "diff" && d && <Diff />}
        {d ? <Ruler /> : <div />}
        {!d && <Empty />}
      </div>
    </section>
  );
}
