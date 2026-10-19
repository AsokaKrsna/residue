# Evaluation

`tests/fixtures/selective-corpus.json` contains 60 synthetic samples: paired writing-pattern probes, academic controls, and character artifacts. Null expected outputs are characterization probes, not success claims. The automated suite checks defined expectations and cleanup stability. These samples do not establish detector effectiveness.

Use `paired-detector-log.csv` for optional manual measurements on public or synthetic text with your own authorized detector access. Do not put private manuscripts in this directory. Keep all variants of a source document in one evaluation split; hold out documents used to assess changes from those used to develop rules.

For each original/cleaned pair, record the date, detector product/version if available, input hash and length, enabled rules, scores, and human review. Record unchanged or higher scores and any factual/citation/formatting damage. Do not pool unlike detector versions or infer a universal Grammarly-to-Turnitin conversion. A low detector score does not establish authorship, originality, or correct attribution.

No detector uploads run inside Residue or its test scripts. The log starts empty because no authorized detector measurements were performed in this implementation.

Baseline before implementation: commit `065dbcf82298d30642397920aa237cb078540f27`, 80 tests passing, type check and both builds passing. See the release notes for the new checks. Browser screenshots and local build outputs go to ignored directories.
