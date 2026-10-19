// Real Chromium checks against production and offline builds. No external documents/services.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";

const root = path.resolve("dist");
const requests = [];
const server = createServer(async (req, res) => {
  requests.push({ url: req.url, method: req.method });
  const target = path.resolve(root, "." + new URL(req.url, "http://localhost").pathname.replace(/\/$/, "/index.html"));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(target);
    res.setHeader("Content-Type", target.endsWith(".js") ? "text/javascript" : target.endsWith(".css") ? "text/css" : target.endsWith(".woff2") ? "font/woff2" : "text/html");
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.RESIDUE_CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(existsSync);
if (!executablePath) { server.close(); throw new Error("Set RESIDUE_CHROME to an installed Chromium browser."); }
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1480, height: 960 } });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const outbound = [];
context.on("request", (req) => { if (!req.url().startsWith(origin) && !req.url().startsWith("file:")) outbound.push(req.url()); });
const button = (name) => page.getByRole("button", { name, exact: true });
const editor = () => page.locator(".cm-content");
async function text(value) {
  await editor().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(value);
  await page.waitForTimeout(350);
}
async function newText(value) {
  await button("New document").click();
  await page.getByRole("combobox", { name: "File type", exact: true }).selectOption("txt");
  await text(value);
}
async function stored() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open("keyval-store");
    req.onupgradeneeded = () => { req.result.createObjectStore("keyval"); };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction("keyval").objectStore("keyval").get("residue.session.v1");
      get.onsuccess = () => { resolve(get.result ?? null); db.close(); };
      get.onerror = () => { reject(get.error); db.close(); };
    };
  }));
}
async function waitFor(test, label) {
  for (let n = 0; n < 30; n++) { if (await test()) return; await page.waitForTimeout(100); }
  throw new Error(`Timed out: ${label}`);
}
try {
  await page.goto(origin);
  await page.evaluate(() => document.fonts.ready);
  await newText("In order to test, we may not change 3.14 mg [12].\n");
  await button("Select cleanup rules").click();
  assert.match(await page.locator("#clean-options").innerText(), /Moderate/);
  await page.getByLabel("Include wording cleanup", { exact: false }).check();
  await page.keyboard.press("Escape");
  await button("Clean all 1").click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  assert.match(await editor().innerText(), /In order to/);
  await button("Cancel").click();
  assert.match(await editor().innerText(), /In order to/);
  await button("Clean all 1").click();
  await button("Apply selected changes").click();
  await waitFor(async () => (await editor().innerText()).startsWith("To test"), "wording apply");
  await editor().click();
  await page.keyboard.press("ControlOrMeta+z");
  assert.match(await editor().innerText(), /^In order to/);
  await page.keyboard.press("ControlOrMeta+y");
  assert.match(await editor().innerText(), /^To test/);
  await button("Changes").click();
  assert.match(await page.locator(".change-summary").innerText(), /Optional concise wording: 1/);
  assert.ok(await page.locator(".diff ins").count());
  await button("Edit").click();
  await page.waitForTimeout(1100);
  assert.equal(await stored(), null, "session-only content must not be saved");
  await page.reload();
  await waitFor(async () => await page.locator(".empty").isVisible(), "session-only reload");

  await newText("Private local marker a\u200Bb\n");
  await context.setOffline(true);
  await button("Clean all 1").click();
  await waitFor(async () => (await editor().innerText()).includes("marker ab"), "offline cleanup");
  assert.equal(await page.locator("dialog").count(), 1); // hidden preview dialog remains mounted
  assert.equal(await page.locator("dialog").isVisible(), false);
  await context.setOffline(false);
  await button("More").click();
  await page.getByLabel("Remember documents on this device", { exact: true }).check();
  await waitFor(async () => (await stored())?.docs?.length === 1, "remember opt-in");
  await page.reload();
  await waitFor(async () => (await editor().innerText()).includes("marker ab"), "remember restore");
  assert.equal(await stored() !== null, true);

  // Simulate a v1 session: content exists but the new opt-in preference does not.
  await page.evaluate(() => localStorage.removeItem("residue.remember-documents.v2"));
  await page.reload();
  await button("Restore previous documents").waitFor({ state: "visible" });
  assert.equal(await page.locator(".empty").isVisible(), true);
  assert.ok(await stored());
  await button("Restore previous documents").click();
  await waitFor(async () => (await editor().innerText()).includes("marker ab"), "explicit migration restore");
  await button("More").click();
  await page.getByLabel("Remember documents on this device", { exact: true }).uncheck();
  await waitFor(async () => (await stored()) === null, "disable removes browser copy");
  await page.keyboard.press("Escape");
  await page.mouse.click(600, 400);

  // Keyboard access and precise category control.
  await button("Select cleanup rules").click();
  await button("Reset to Moderate").click();
  await page.keyboard.press("Escape");
  assert.equal(await button("Select cleanup rules").getAttribute("aria-expanded"), "false");
  await text("a\u200Bb  c\n");
  await button("Select cleanup rules").click();
  await page.locator("summary").filter({ hasText: /^Invisible characters/ }).click();
  await page.locator(".bulk-rule").filter({ hasText: "Zero-width spaces" }).getByRole("checkbox").uncheck();
  await page.keyboard.press("Escape");
  await button("Clean all 1").click();
  await waitFor(async () => (await editor().innerText()).includes("b c") && await editor().locator(".chip").count() === 1, "selective category restriction");
  await button("Select cleanup rules").click();
  await button("Reset to Moderate").click();
  await page.keyboard.press("Escape");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await text("In order to assess risk, retain evidence [12].\n");
  await page.getByText("In order to", { exact: true }).first().click();
  await button("Copy passage + editing prompt").click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboard, /In order to assess risk/);
  assert.match(clipboard, /negation, uncertainty/);

  // Save synthetic content through the ordinary browser download fallback.
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const downloaded = page.waitForEvent("download");
  await button("Save").click();
  await downloaded;

  await mkdir("LLM-Workspace/out", { recursive: true });
  await page.screenshot({ path: "LLM-Workspace/out/selective-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "LLM-Workspace/out/selective-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1480, height: 960 });

  // Full UI Word round trip: normal run accepted, differently formatted runs refused.
  const zip = await JSZip.loadAsync(await readFile("tests/fixtures/chat-paste.docx"));
  zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>In order to test 3.14 mg [12].</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>In order </w:t></w:r><w:r><w:t>to retain styling.</w:t></w:r></w:p></w:body></w:document>');
  await page.evaluate(() => { window.showOpenFilePicker = undefined; });
  const chooserPromise = page.waitForEvent("filechooser");
  await button("Open").click();
  await (await chooserPromise).setFiles({ name: "word-probe.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await zip.generateAsync({ type: "nodebuffer" }) });
  await waitFor(async () => (await editor().innerText()).includes("In order to retain styling"), "Word opened");
  await button("Select cleanup rules").click();
  await page.getByLabel("Include wording cleanup", { exact: false }).check();
  await page.keyboard.press("Escape");
  await button("Clean all 2").click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  assert.match(await page.getByRole("dialog").innerText(), /1 Word wording edit/);
  await page.screenshot({ path: "LLM-Workspace/out/selective-word-preview.png", fullPage: true });
  await button("Apply selected changes").click();
  await waitFor(async () => (await editor().innerText()).startsWith("To test"), "Word wording applied");
  assert.match(await editor().innerText(), /In order to retain styling/);
  const wordDownload = page.waitForEvent("download");
  await button("Save").click();
  const savedWord = await JSZip.loadAsync(await readFile(await (await wordDownload).path()));
  const savedXml = await savedWord.file("word/document.xml").async("string");
  assert.match(savedXml, /To test 3.14 mg/);
  assert.match(savedXml, /<w:b\/>/);
  assert.match(savedXml, /In order /);
  await button("Changes").click();
  assert.ok(await page.locator(".diff del").count(), "Word comparison uses opening baseline");
  await button("Edit").click();
  await button("Select cleanup rules").click();
  await button("Reset to Moderate").click();
  await page.keyboard.press("Escape");

  const offline = await context.newPage();
  offline.on("pageerror", (e) => errors.push(e.message));
  await context.setOffline(true);
  await offline.goto(new URL("../dist-offline/residue-offline.html", import.meta.url).href);
  await offline.getByRole("button", { name: "New document", exact: true }).click();
  await offline.getByRole("combobox", { name: "File type", exact: true }).selectOption("txt");
  await offline.locator(".cm-content").fill("Offline a\u200Bb\n");
  await offline.waitForTimeout(350);
  await offline.getByRole("button", { name: "Clean all 1", exact: true }).click();
  await offline.waitForTimeout(350);
  assert.match(await offline.locator(".cm-content").innerText(), /Offline ab/);
  assert.deepEqual(errors, [], "browser runtime errors");
  assert.deepEqual(outbound, [], "unexpected requests outside the local app");
  assert.ok(requests.every((r) => r.method === "GET" && /^\/(?:index\.html|assets\/[A-Za-z0-9_.-]+)?$/.test(r.url)), "no manuscript requests");
  await writeFile("LLM-Workspace/out/browser-network-check.json", JSON.stringify({ requests, outbound, runtimeErrors: errors }, null, 2));
  console.log("Browser checks passed: preview/cancel, undo/redo, diff, offline, storage migration, keyboard, clipboard, save, and local-only requests.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
