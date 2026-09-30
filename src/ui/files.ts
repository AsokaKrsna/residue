/** Opening and saving files entirely in the browser. Nothing is uploaded anywhere. */
import { decodeBytes, type Decoded } from "../formats/decode";

export interface OpenedFile {
  name: string;
  text: string;
  encoding?: Decoded["encoding"];
  handle?: FileSystemFileHandle;
  /** set when the file was not valid UTF-8 and was decoded as Windows-1252 */
  legacyEncoding?: boolean;
  crlf?: boolean;
  /** raw bytes for Word documents */
  bytes?: Uint8Array;
}

type FSWindow = Window & {
  showOpenFilePicker?: (o?: unknown) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (o?: unknown) => Promise<FileSystemFileHandle>;
};
const w = window as FSWindow;

export const canSaveInPlace = typeof w.showOpenFilePicker === "function";

export const TEXT_EXT = [".tex", ".bib", ".md", ".markdown", ".txt", ".ltx", ".sty", ".cls", ".rmd", ".qmd", ".csv", ".json", ".html", ".xml", ".yml", ".yaml", ".rst", ".org", ".log"];
const ACCEPT = [...TEXT_EXT, ".docx"].join(",");
export type FileData = string | Uint8Array;
const mimeOf = (name: string) => (name.toLowerCase().endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain;charset=utf-8");

export async function decodeFile(file: Blob & { name: string }): Promise<OpenedFile> {
  const buf = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".docx")) return { name: file.name, text: "", bytes: new Uint8Array(buf) };
  const { text, encoding } = decodeBytes(buf);
  const crlf = /\r\n/.test(text);
  return { name: file.name, text, encoding, legacyEncoding: encoding === "windows-1252", crlf };
}

export function isUnsupportedBinary(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (ext === "doc") return "Old .doc Word files (save as .docx first)";
  if (ext === "pdf") return "PDF files";
  if (["odt", "rtf", "pages"].includes(ext)) return "This document format";
  return null;
}

export async function openFiles(): Promise<OpenedFile[]> {
  if (w.showOpenFilePicker) {
    let handles: FileSystemFileHandle[];
    try {
      handles = await w.showOpenFilePicker({
        multiple: true,
        types: [{ description: "Text, LaTeX and Markdown", accept: { "text/plain": TEXT_EXT } }, { description: "Word documents", accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] } }],
        excludeAcceptAllOption: false,
      });
    } catch {
      return []; // user cancelled
    }
    const out: OpenedFile[] = [];
    for (const h of handles) {
      const f = await h.getFile();
      out.push({ ...(await decodeFile(f)), handle: h });
    }
    return out;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ACCEPT;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      resolve(await Promise.all(files.map((f) => decodeFile(f))));
    };
    input.click();
  });
}

async function writeHandle(handle: FileSystemFileHandle, text: FileData): Promise<void> {
  const h = handle as FileSystemFileHandle & { requestPermission?: (o: unknown) => Promise<string>; queryPermission?: (o: unknown) => Promise<string> };
  if (h.queryPermission && (await h.queryPermission({ mode: "readwrite" })) !== "granted") {
    if (!h.requestPermission || (await h.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("Permission to save was not granted.");
  }
  const writable = await handle.createWritable();
  await writable.write(text as FileSystemWriteChunkType);
  await writable.close();
}

export type SaveResult = { kind: "saved"; handle: FileSystemFileHandle; name: string } | { kind: "downloaded"; name: string } | { kind: "cancelled" };

export async function save(name: string, text: FileData, handle?: FileSystemFileHandle): Promise<SaveResult> {
  if (handle) {
    await writeHandle(handle, text);
    return { kind: "saved", handle, name: handle.name };
  }
  return saveAs(name, text);
}

export async function saveAs(name: string, text: FileData): Promise<SaveResult> {
  if (w.showSaveFilePicker) {
    let handle: FileSystemFileHandle;
    try {
      handle = await w.showSaveFilePicker({ suggestedName: name });
    } catch {
      return { kind: "cancelled" };
    }
    await writeHandle(handle, text);
    return { kind: "saved", handle, name: handle.name };
  }
  download(name, text);
  return { kind: "downloaded", name };
}

export function download(name: string, text: FileData) {
  const url = URL.createObjectURL(new Blob([text as BlobPart], { type: mimeOf(name) }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
