import { useEffect, useRef, useState } from "preact/hooks";
import type { FileType } from "../engine/types";
import {
  activate, activeDoc, activeId, applyPreset, cleanEverything, closeDoc, config, cycleTheme, docs, docStats, loadSample, markBaseline,
  currentText, newDoc, openDialog, paragraphsOf, saveActive, saveInPlace, scanMs, setFileType, showRules, tally, theme, toast, baselineParagraphs,
  clearSavedData, convertToPlain,
} from "./store";

/** Sun for light, moon for dark, half-filled circle for "follow the system". */
function ThemeIcon({ mode }: { mode: string }) {
  if (mode === "light")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
      </svg>
    );
  if (mode === "dark")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </svg>
  );
}

const THEME_LABEL: Record<string, string> = { auto: "Theme follows your system. Click for light.", light: "Light theme. Click for dark.", dark: "Dark theme. Click to follow your system." };
import { isPreset } from "../engine/engine";
import { SupportButton } from "./Support";

/** Brand mark: a tile with three particles drifting away. Residue, leaving. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="var(--ink)" />
      <circle cx="8" cy="16" r="2.6" fill="var(--accent)" />
      <circle cx="13.4" cy="11.2" r="1.8" fill="var(--surface)" opacity="0.85" />
      <circle cx="17.6" cy="7.2" r="1.15" fill="var(--surface)" opacity="0.5" />
    </svg>
  );
}

function Meter() {
  const t = tally.value;
  const total = t.remove + t.replace + t.review;
  const fixes = t.remove + t.replace;
  return (
    <div class={`meter${total === 0 ? " clean" : ""}`} title="What is left in this document">
      <div class="bar" aria-hidden="true">
        {total > 0 && (
          <>
            <i class="m-rm" style={{ flexGrow: t.remove }} />
            <i class="m-rp" style={{ flexGrow: t.replace }} />
            <i class="m-rv" style={{ flexGrow: t.review }} />
          </>
        )}
      </div>
      <span class="num">{total === 0 ? "Clean" : `${fixes} to fix, ${t.review} to review`}</span>
    </div>
  );
}

const PRESET_LABEL: Record<string, string> = { latex: "LaTeX paper", markdown: "Markdown", plain: "Plain text", keep: "Keep typography", custom: "Custom" };

export function TopBar() {
  const t = tally.value;
  const fixes = t.remove + t.replace;
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  const run = (fn: () => void) => () => { setMenu(false); fn(); };
  const d = activeDoc.value;

  return (
    <header class="top">
      <div class="brand"><Logo /> residue</div>
      <div class="tabs" role="tablist" aria-label="Open files">
        {docs.value.map((doc) => (
          <div class="tab" role="tab" aria-selected={doc.id === activeId.value} key={doc.id} onClick={() => activate(doc.id)} title={doc.handle ? "Saves back to this file" : doc.untitled ? "Not saved to disk yet" : "Opened without write access; Save asks where to save"}>
            {doc.dirty && <span class="dot" aria-label="unsaved changes" />}
            {doc.name}
            <button class="x" aria-label={`Close ${doc.name}`} onClick={(e) => { e.stopPropagation(); closeDoc(doc.id); }}>{"×"}</button>
          </div>
        ))}
        <button class="iconbtn" onClick={() => newDoc(d?.fileType ?? "tex")} title="New document" aria-label="New document">+</button>
      </div>
      {d && <Meter />}
      {d && (
        <select aria-label="Preset" value={isPreset(config.value.preset) ? config.value.preset : "custom"} onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          if (isPreset(v)) applyPreset(v);
        }}>
          {["latex", "markdown", "plain", "keep"].map((p) => <option value={p} key={p}>{PRESET_LABEL[p]}</option>)}
          <option value="custom" hidden>Custom</option>
        </select>
      )}
      <button class="btn primary" disabled={!d || fixes === 0} onClick={cleanEverything} title="Apply every enabled fix (Ctrl+Shift+L). Style signals are never changed automatically.">
        Clean all <span class="badge num">{fixes}</span>
      </button>
      <div class="sep" />
      <button class="btn ghost" onClick={() => void openDialog()} title="Open files (Ctrl+O)">Open</button>
      <button class="btn ghost" disabled={!d} onClick={() => void saveActive()} title={saveInPlace ? "Save to the same file (Ctrl+S)" : "Download the file (Ctrl+S)"}>Save</button>
      <SupportButton />
      <button class="iconbtn theme" onClick={cycleTheme} title={THEME_LABEL[theme.value]} aria-label={THEME_LABEL[theme.value]}>
        <ThemeIcon mode={theme.value} />
      </button>
      <div class="menu-wrap" ref={ref}>
        <button class="iconbtn" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>{"⋯"}</button>
        {menu && (
          <div class="menu" role="menu">
            <button onClick={run(() => newDoc("tex"))}>New LaTeX document</button>
            <button onClick={run(() => newDoc("md"))}>New Markdown document</button>
            <button onClick={run(() => newDoc("txt"))}>New plain text document</button>
            <hr />
            <button onClick={run(() => void openDialog())}>Open files <kbd>Ctrl O</kbd></button>
            <button disabled={!d} onClick={run(() => void saveActive())}>Save <kbd>Ctrl S</kbd></button>
            <button disabled={!d} onClick={run(() => void saveActive(true))}>Save as</button>
            <hr />
            <button disabled={!d} onClick={run(markBaseline)}>Compare changes from here</button>
            <button onClick={run(loadSample)}>Open the sample chapter</button>
            <button onClick={run(() => (showRules.value = !showRules.value))}>{showRules.value ? "Hide" : "Show"} rules panel</button>
            <button disabled={!d || !!d.docx} onClick={run(convertToPlain)}>Convert to plain text</button>
            <hr />
            <button onClick={run(clearSavedData)}>Clear data saved in this browser</button>
          </div>
        )}
      </div>
    </header>
  );
}

const TYPE_LABEL: Record<FileType, string> = { tex: "LaTeX", bib: "BibTeX", md: "Markdown", txt: "Plain text" };

/** Counts network requests made after the app finished loading. The honest number should stay 0. */
function useRequestCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let ready = false;
    const t = setTimeout(() => (ready = true), 2500);
    let obs: PerformanceObserver | undefined;
    try {
      // only requests to other sites matter for privacy; the app lazily loading its own font files is fine
      obs = new PerformanceObserver((list) => { if (ready) setN((x) => x + list.getEntries().filter((e) => !e.name.startsWith(location.origin)).length); });
      obs.observe({ type: "resource", buffered: false });
    } catch { /* unsupported */ }
    return () => { clearTimeout(t); obs?.disconnect(); };
  }, []);
  return n;
}

export function StatusBar() {
  const s = docStats.value;
  const d = activeDoc.value;
  const reqs = useRequestCount();
  const pNow = d?.docx ? paragraphsOf(currentText(), true) : s?.paragraphs ?? 0;
  const pBase = baselineParagraphs.value;
  return (
    <footer class="status">
      {d ? (
        <>
          <label>
            <select aria-label="File type" value={d.fileType} onChange={(e) => setFileType((e.target as HTMLSelectElement).value as FileType)} style={{ fontFamily: "var(--mono)", fontSize: "11px", padding: "0 4px" }}>
              {(Object.keys(TYPE_LABEL) as FileType[]).map((ft) => <option value={ft} key={ft}>{TYPE_LABEL[ft]}</option>)}
            </select>
          </label>
          <span>UTF-8, LF</span>
          {s && <span>{s.chars.toLocaleString()} chars, {s.words.toLocaleString()} words</span>}
          {s && <span class={pNow === pBase ? "ok" : "warn"} title="Paragraph count when opened, and now">paragraphs: {pBase} at open, {pNow} now{pNow === pBase ? " (match)" : ""}</span>}
          <span>scan {scanMs.value < 1 ? "<1" : Math.round(scanMs.value)} ms</span>
          <span>{d.handle ? (d.dirty ? "unsaved changes" : "saved to disk") : "kept in this browser"}</span>
        </>
      ) : (
        <span>No document open</span>
      )}
      <span class="grow" />
      <span class={reqs ? "warn" : "ok"} title="Requests to any other website since the page loaded. The content security policy blocks them, and your text is never sent anywhere.">requests to other sites: {reqs}</span>
      <a class="credit" href="https://www.linkedin.com/in/durjoy-majumdar/" target="_blank" rel="noopener noreferrer" title="Made by Durjoy Majumdar">Durjoy Majumdar | AsokaKrsna</a>
    </footer>
  );
}

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" role="status">
      <span>{t.text}</span>
      {t.action && <button onClick={() => { t.action!.run(); toast.value = null; }}>{t.action.label}</button>}
    </div>
  );
}
