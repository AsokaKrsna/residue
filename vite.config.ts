import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Production builds get a strict Content Security Policy: no network connections at all
 * (connect-src 'none'), so anyone can confirm in DevTools that text never leaves the browser.
 * Dev mode skips it because Vite's hot reload needs a websocket.
 * The offline single-file build inlines its scripts, so it must allow inline code; it still forbids connections.
 */
function csp(offline: boolean): Plugin {
  const policy = [
    "default-src 'self'",
    offline ? "script-src 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // CodeMirror injects its base styles at runtime
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "connect-src 'none'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return {
    name: "residue-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const offline = mode === "offline";
  return {
    base: "./",
    plugins: [preact(), csp(offline), ...(offline ? [viteSingleFile()] : [])],
    build: offline ? { outDir: "dist-offline", assetsInlineLimit: 100_000_000 } : { chunkSizeWarningLimit: 900 },
    test: { include: ["tests/**/*.test.ts"] },
  };
});
