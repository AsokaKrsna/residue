/** Optional tips. Nothing here talks to the network: the QR is drawn locally and the links open in a new tab. */
import { signal } from "@preact/signals";

/* Set VITE_UPI_ID and VITE_COFFEE_URL (see .env.example) to switch the support panel on. Without them it only shows in `npm run dev`. */
export const SUPPORT = {
  upiId: (import.meta.env.VITE_UPI_ID ?? "").trim(),
  upiName: (import.meta.env.VITE_UPI_NAME ?? "AsokaKrsna").trim(), // shown in the payer's UPI app
  coffeeUrl: (import.meta.env.VITE_COFFEE_URL ?? "").trim(),
};

export const supportEnabled = !!(SUPPORT.upiId || SUPPORT.coffeeUrl) || import.meta.env.DEV;

export const upiLink = SUPPORT.upiId
  ? `upi://pay?pa=${SUPPORT.upiId}&pn=${encodeURIComponent(SUPPORT.upiName)}&cu=INR&tn=${encodeURIComponent("Thanks for residue")}`
  : "";

/** QR modules for the UPI link, or null when there is no UPI ID yet. The QR library loads only when the panel opens. */
export async function upiQr(): Promise<boolean[][] | null> {
  if (!upiLink) return null;
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(upiLink);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/* ---------- gratitude, kept in this browser only ---------- */

const KEY = "residue.support";
type State = { fixed: number; cleans: number; lastNudge: number; never: boolean; gave: number };

function load(): State {
  try {
    return { fixed: 0, cleans: 0, lastNudge: 0, never: false, gave: 0, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { fixed: 0, cleans: 0, lastNudge: 0, never: false, gave: 0 };
  }
}

export const supportState = signal<State>(load());
export const supportOpen = signal(false);
export const nudge = signal<number | null>(null); // fixes just made, when the thank-you card is showing

function save(patch: Partial<State>) {
  supportState.value = { ...supportState.value, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(supportState.value)); } catch { /* private mode */ }
}

const DAY = 86_400_000;
let nudgedThisSession = false;

/** Count fixes so the panel can say what the app has done for this person. */
export function recordFixes(n: number, fromCleanAll: boolean) {
  if (n <= 0) return;
  const s = supportState.value;
  save({ fixed: s.fixed + n, cleans: s.cleans + (fromCleanAll ? 1 : 0) });
  if (fromCleanAll) maybeNudge(n);
}

/**
 * A thank-you card after real value, never before. Rules: from the third Clean all on, at least 5 fixes,
 * once per session, at most every 14 days, 90 quiet days after someone opens a tip link, never after "Don't show again".
 */
function maybeNudge(n: number) {
  const s = supportState.value;
  const now = Date.now();
  if (!supportEnabled || s.never || nudgedThisSession || n < 5 || s.cleans < 3) return;
  if (now - s.lastNudge < 14 * DAY || now - s.gave < 90 * DAY) return;
  nudgedThisSession = true;
  save({ lastNudge: now });
  setTimeout(() => (nudge.value = n), 1800); // after the "Cleaned" toast has been read
}

export function dismissNudge(forever = false) {
  nudge.value = null;
  if (forever) save({ never: true });
}

export function openSupport() {
  nudge.value = null;
  supportOpen.value = true;
}

export function markGave() {
  save({ gave: Date.now() });
}
