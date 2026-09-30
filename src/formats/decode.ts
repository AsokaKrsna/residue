/**
 * Turn file bytes into text. Handles UTF-8 (with or without BOM), UTF-16 LE/BE (with BOM, as saved by
 * Windows Notepad's old "Unicode" option, or detected from zero bytes) and falls back to Windows-1252.
 */
export interface Decoded {
  text: string;
  encoding: "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";
}

export function decodeBytes(input: ArrayBuffer | Uint8Array): Decoded {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b[0] === 0xff && b[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(b.subarray(2)), encoding: "utf-16le" };
  if (b[0] === 0xfe && b[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(b.subarray(2)), encoding: "utf-16be" };
  // UTF-16 without BOM: many zero bytes in odd or even positions
  if (b.length >= 4) {
    let evenZero = 0, oddZero = 0;
    const n = Math.min(b.length, 4000);
    for (let i = 0; i < n; i++) if (b[i] === 0) (i % 2 ? oddZero++ : evenZero++);
    if (oddZero > n / 5 && evenZero < n / 50) return { text: new TextDecoder("utf-16le").decode(b), encoding: "utf-16le" };
    if (evenZero > n / 5 && oddZero < n / 50) return { text: new TextDecoder("utf-16be").decode(b), encoding: "utf-16be" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(b), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(b), encoding: "windows-1252" };
  }
}
