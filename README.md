# residue

**See what your text is carrying.**

residue is a private text cleaner for people who draft with AI tools. It finds hidden characters, chat leftovers and common LLM writing habits. It fixes what is safe to fix and shows you the rest, one finding at a time.

It runs in your browser. Your text stays on your device.

**[Open residue](https://residue.pages.dev/)** · **[Download the offline version](https://residue.pages.dev/residue-offline.html)**

---

## Why it exists

Text copied from a chat window carries more than words. It brings zero-width spaces, odd spaces, curly quotes, citation tokens, tracking links and Markdown symbols. These break LaTeX builds, search, spell check and diffs. Most online cleaners fix some of this, but they make you paste unpublished work into someone else's server.

residue works locally. It understands LaTeX, keeps Word formatting and leaves your paragraphs as they are.

## What it handles

| Group | Examples | What happens |
|---|---|---|
| Invisible characters | Zero-width spaces, stray joiners, soft hyphens, direction marks, hidden tag text, variation selector runs, blank fillers, control codes | Removed. Joiners needed by Bengali, Hindi, Arabic and emoji are kept. |
| Encoding damage | Garbled text such as `â€™` and `Ã©`, split accents, lost characters | Repaired, or flagged when repair is impossible |
| Chat residue | ChatGPT `oaicite` and `citeturn0search0` markers, Gemini `[cite: 1]`, Copilot `[^1^]`, `utm_source=chatgpt.com`, source buttons like `Reuters+2`, `:::writing` fences, "You said:" and "Copy code" labels, `<think>` reasoning blocks, chatbot lines, template holes | Removed or flagged |
| Spaces and line breaks | No-break, narrow and thin spaces, Unicode line separators, Windows line endings | Normalised |
| Dashes, quotes, symbols | Em dashes, curly quotes, ellipses, bullets, arrows, `≤` and `°` in prose | Converted for your format. LaTeX gets `---`, ``` `` '' ```, `\ldots{}` and math macros. |
| Lookalike letters | Cyrillic or Greek letters hidden in English words, PDF ligatures, full-width and styled Unicode letters | Fixed in prose. Real Russian or Greek text and Greek in math are left alone. |
| Markdown leftovers | Headings, bold, lists, links, tables and code pasted into LaTeX or plain text | Converted |
| Whitespace | Trailing spaces, repeated spaces, extra blank lines | Cleaned. A paragraph break is never removed. |
| LaTeX safety | Protects math, comments, code and citation keys. Converts Unicode in math. Flags `50%`, `R&D` and `file_name`. | Fixed or flagged |
| Hidden text | White or tiny text in LaTeX, HTML and Word, and phrases like "ignore previous instructions" aimed at AI reviewers | Flagged |
| Copy artifacts | Equations copied twice, like `E=mc2E = mc^2`, and bare `[1][2]` citations with no reference list | Flagged with a fix |
| Style signals | Overused words, stock phrases, "not just X but Y", stacked openers, empty intensifiers, rule of three | Flagged with suggestions. Never changed without you. |
| Convert to plain text | Markdown and LaTeX turned into clean readable text. Headings, lists, tables and code keep their shape. Math becomes `x² ≤ α`. | Off by default |

There are more than 80 rules. Each one has its own switch, and every change can be skipped or undone.

## File types

| Type | Support |
|---|---|
| `.tex`, `.bib` | Full editor with LaTeX-aware rules |
| `.md` | Full editor. Markdown stays Markdown unless you convert it. |
| `.txt` and other plain text | Full editor. UTF-8, UTF-16 and Windows-1252 are detected. |
| `.docx` | Fixes are written back into the original Word file. Styles, tables, images and comments stay. Typing is off so paragraphs cannot be merged. |
| `.pdf`, `.doc` | Not supported yet |

## How to use it

1. Open a file, drop one on the page or paste text.
2. Read the marks. Red is removed, amber is replaced and violet needs your decision. Invisible characters appear as small labels such as `ZWSP`.
3. Click any mark to see exactly what changes and why.
4. Press **Clean all** to apply every fix at once. It is a single undo step.
5. Go through the violet style signals yourself.
6. Save. In Chrome and Edge, Save writes back to the file you opened. Other browsers download a copy.

Presets set the rules for common cases: **LaTeX paper**, **Markdown**, **Plain text** and **Keep typography**. Any change you make is remembered for that file type.

### Keyboard

| Keys | Action |
|---|---|
| F8, Shift F8 | Next and previous finding |
| Alt Enter | Apply the fix, or accept the first suggestion |
| Alt Backspace | Keep this one as it is |
| Ctrl Shift L | Clean all |
| Ctrl S, Ctrl O | Save and open |
| Ctrl F | Find and replace |
| Ctrl Z | Undo, including Clean all |

## Privacy

- All processing happens in your browser tab.
- The site ships a Content Security Policy with `connect-src 'none'`. The page cannot send data anywhere, and you can confirm this in your browser's developer tools.
- The status bar counts requests to other sites. It should always read 0.
- Open documents and settings are saved in this browser only, so your work survives a reload. The menu has an option to clear them.
- The offline version is one HTML file that works with no internet at all.

## Limits

- Style signals are hints, not proof. Human writing triggers them too.
- Cleaning does not make text "undetectable". Gemini (since 2024) and Claude (since August 2026) watermark text statistically through word choice. No character cleaner can see or remove that.
- residue does not check whether citations exist. That would need network access. Verify every reference yourself.
- The LaTeX scanner is fast and forgiving, but it is not a full TeX engine. Unusual macros may need a manual look.

## Development

Requires Node.js 20 or newer.

```
npm install
npm run dev            # http://127.0.0.1:5173
npm test               # engine, Word, conversion and LaTeX tests
npm run check:latex    # needs pdflatex: dirty input must fail, cleaned output must compile
npm run build          # static site in dist/
npm run build:offline  # single file in dist-offline/
```

### Project layout

```
src/engine/          the cleaning engine: pure functions, no DOM
  engine.ts          scan, resolve overlaps, multi-pass clean, statistics
  regions.ts         finds math, code, comments, keys and URLs to protect
  rules/*.ts         every rule, grouped by topic
  data/              vocabulary lists with their sources
src/formats/         Word (.docx) and text decoding
src/ui/              the app: Preact, CodeMirror 6, state in store.ts
tests/               Vitest suites and fixtures
scripts/             fixture builders, data import, LaTeX check
```

### Adding a rule

1. Add a rule object to the matching file in `src/engine/rules/`. Give it an id, a group, a plain description and the presets that turn it on.
2. Return a string to fix, `null` to flag for review, or `undefined` to skip a match.
3. Add a test in `tests/`. Every rule should have a case it catches and a case it must leave alone.
4. Run `npm test`.

The file-writing tools of some editors turn `\uXXXX` escapes into raw characters. After editing engine files, run `python scripts/escape-unicode.py . all "src/engine/**/*.ts" "tests/**/*.ts"` to keep invisible characters out of the source.

### Deployment

The site is hosted on Cloudflare Pages, which builds it on every push to `main`. GitHub Actions (`.github/workflows/ci.yml`) runs the tests and both builds on every push and pull request.

Cloudflare build settings:

- Build command: `npm run build && npm run build:offline && cp dist-offline/residue-offline.html dist/`
- Output directory: `dist`
- Environment variables: `NODE_VERSION=22`, plus the optional support settings from `.env.example`

The support panel is optional. Copy `.env.example` to `.env` for local use, or set the same variables in Cloudflare. Without them the panel stays hidden.

## Sources and credits

- Vocabulary data: Kobak et al., "Delving into LLM-assisted writing in biomedical publications through excess vocabulary", *Science Advances*, 2025. Word list from [berenslab/llm-excess-vocab](https://github.com/berenslab/llm-excess-vocab) (MIT).
- Pattern catalogue: Wikipedia, [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), and [blader/humanizer](https://github.com/blader/humanizer) (MIT).
- Hidden prompts in papers: [Hidden Prompts in Manuscripts Exploit AI-Assisted Peer Review](https://arxiv.org/abs/2507.06185).
- Built with [Preact](https://preactjs.com), [CodeMirror](https://codemirror.net), [JSZip](https://stuk.github.io/jszip/), [jsdiff](https://github.com/kpdecker/jsdiff) and [idb-keyval](https://github.com/jakearchibald/idb-keyval). Fonts: Geist and Bricolage Grotesque, under the SIL Open Font License.

## License

[MIT](LICENSE). Copyright 2026 Durjoy Majumdar.
