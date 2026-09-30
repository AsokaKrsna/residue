import { useEffect, useRef, useState } from "preact/hooks";
import { SUPPORT, dismissNudge, markGave, nudge, openSupport, supportEnabled, supportOpen, supportState, upiLink, upiQr } from "./tips";

export function Heart({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor" />
    </svg>
  );
}

/** Calm header entry point. Always there, never animated. */
export function SupportButton() {
  if (!supportEnabled) return null;
  return (
    <button class="btn support-btn" onClick={openSupport} title="Support residue">
      <Heart /> <span class="support-label">Support</span>
    </button>
  );
}

function Qr({ modules }: { modules: boolean[][] }) {
  const n = modules.length;
  const d = modules.flatMap((row, r) => row.map((on, c) => (on ? `M${c + 4} ${r + 4}h1v1h-1z` : ""))).join("");
  return (
    <svg class="qr" viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label="UPI QR code" shape-rendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export function SupportPanel() {
  const open = supportOpen.value;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<boolean[][] | null>(null);
  useEffect(() => { if (open && !qr) void upiQr().then(setQr); }, [open]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") supportOpen.value = false; };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!open) return null;

  const fixed = supportState.value.fixed;
  const close = () => (supportOpen.value = false);
  const copy = () => {
    void navigator.clipboard?.writeText(SUPPORT.upiId).then(() => { setCopied(true); markGave(); setTimeout(() => setCopied(false), 1600); });
  };

  return (
    <div class="support-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="support" role="dialog" aria-modal="true" aria-labelledby="support-title">
        <button class="iconbtn support-x" ref={closeRef} onClick={close} aria-label="Close">{"×"}</button>
        <div class="support-head">
          <span class="support-heart"><Heart size={20} /></span>
          <h2 id="support-title">Enjoying residue?</h2>
        </div>
        <p class="support-note">
          residue is free to use. If it made your work a little easier, a small tip helps me keep looking after it.
          <span class="sig">Thank you.</span>
        </p>
        {fixed > 0 && <p class="support-tally">You have tidied up <b class="num">{fixed.toLocaleString()}</b> small {fixed === 1 ? "thing" : "things"} with it so far.</p>}

        <div class="support-ways">
          <section class="way">
            <h3>UPI <span>India</span></h3>
            {qr ? <Qr modules={qr} /> : <div class="qr placeholder">QR code appears here once the UPI ID is set</div>}
            {SUPPORT.upiId && (
              <div class="upi-id">
                <code>{SUPPORT.upiId}</code>
                <button class="btn ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
              </div>
            )}
            {upiLink && <a class="btn way-btn upi-open" href={upiLink} onClick={markGave}>Open UPI app</a>}
          </section>
          <section class="way">
            <h3>Buy Me a Coffee <span>anywhere</span></h3>
            <p class="way-hint">Pay by card. No account needed.</p>
            {SUPPORT.coffeeUrl ? (
              <a class="btn way-btn coffee" href={SUPPORT.coffeeUrl} target="_blank" rel="noopener noreferrer" onClick={markGave}>Buy me a coffee</a>
            ) : (
              <span class="btn way-btn coffee" aria-disabled="true">Link coming soon</span>
            )}
          </section>
        </div>
        <p class="support-foot">Tip or not, residue is yours to use.</p>
      </div>
    </div>
  );
}

/** Thank-you card after a big clean. Small, dismissable, gone on its own. */
export function ThanksNudge() {
  const n = nudge.value;
  useEffect(() => {
    if (n === null) return;
    const t = setTimeout(() => dismissNudge(), 12000);
    return () => clearTimeout(t);
  }, [n]);
  if (n === null) return null;
  return (
    <div class="nudge" role="status">
      <span class="support-heart"><Heart size={16} /></span>
      <div class="nudge-body">
        <b>All tidy. {n.toLocaleString()} small {n === 1 ? "thing" : "things"} fixed.</b>
        <span>Glad it helped. If you ever feel like it, you can support residue.</span>
        <div class="nudge-actions">
          <button class="btn support-btn" onClick={openSupport}>Support</button>
          <button class="btn ghost" onClick={() => dismissNudge()}>Not now</button>
          <button class="linkbtn" onClick={() => dismissNudge(true)}>Don't show again</button>
        </div>
      </div>
    </div>
  );
}
