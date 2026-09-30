import { diffChars } from "diff";

/** Minimal list of text changes that turns `a` into `b`, with positions relative to `a`. */
export function textChanges(a: string, b: string): { fromA: number; toA: number; insert: string }[] {
  if (a === b) return [];
  // trim the shared prefix and suffix first so large documents diff quickly
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const out: { fromA: number; toA: number; insert: string }[] = [];
  let pos = s;
  let pending: { fromA: number; toA: number; insert: string } | null = null;
  for (const part of diffChars(a.slice(s, ea), b.slice(s, eb))) {
    if (part.added) {
      pending = pending ?? { fromA: pos, toA: pos, insert: "" };
      pending.insert += part.value;
    } else if (part.removed) {
      pending = pending ?? { fromA: pos, toA: pos, insert: "" };
      pending.toA += part.value.length;
      pos += part.value.length;
    } else {
      if (pending) { out.push(pending); pending = null; }
      pos += part.value.length;
    }
  }
  if (pending) out.push(pending);
  return out;
}
