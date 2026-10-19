# Release notes

## Unreleased — selective cleanup and research-document review

- Clean all now starts at Moderate and offers category/rule selection separately from format presets. Disabled scan rules stay disabled; ignored findings stay ignored across passes.
- Four concise-wording suggestions can be included explicitly. They stay off by default and require a highlighted Before/After preview. Applying or cancelling preserves a predictable undo history.
- Prose protection checks entire spans. Optional wording additionally protects quotations, citations, math, code, and links.
- Changes retains the opening baseline and shows actual text differences and undo-aware rule operations. Sentence variation is descriptive, not an authorship threshold.
- Passage handoff copies preservation instructions to the clipboard. External tool links never include manuscript text; there are no API calls.
- New installations keep documents in the session only. Local persistence requires opt-in; older browser sessions offer Restore/Remove without silently opening documents.
- Word wording edits are restricted to ordinary single text runs. Structural export conflicts stop saving instead of silently applying only part of a change. Untouched ZIP parts are retained.
- Adds safety regression tests, a 60-sample synthetic corpus, a manual detector log template, and real Chromium production/offline checks. No detector effectiveness measurements or universal format guarantees are claimed.

No deployment or push to main is part of this release preparation.
