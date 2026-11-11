# Academic pattern review: research and implementation

Reviewed 2026-11-12. English desktop workflow. These are writing-review heuristics,
not a trained AI authorship classifier or a substitute for Turnitin.

## Community reports and evidence

| Claim or observation | Source | Assessment and product decision |
| --- | --- | --- |
| Em dashes, formulaic contrasts and ornate prose are common tells | [Reddit discussion](https://www.reddit.com/r/ClaudeAI/comments/1m259dh/what_are_your_main_tipoffs_for_detecting_ai/) | Anecdotal and disputed within the discussion. Test combinations of rhetorical families; do not infer authorship from punctuation. |
| Invisible Unicode proves a chatbot source or can be removed to pass a detector | [Reddit claim](https://www.reddit.com/r/PromptEngineering/comments/1k6apxc/chatgpt_is_extremely_detectable/) | Unverified. Existing character inspection diagnoses actual code points only; no pass guarantee or watermark verdict. |
| Text watermarking is just invisible characters | [Google SynthID documentation](https://ai.google.dev/responsible/docs/safeguards/synthid) | Incorrect for SynthID Text: it adjusts token selection and requires compatible detection. Character cleanup does not verify statistical watermarks. |
| Some vocabulary became more common after LLM adoption | [Kobak et al.](https://arxiv.org/abs/2406.07016) | Population-level biomedical evidence does not identify the author of an individual passage. Existing word findings remain review-only. |
| Hard negatives and broad coverage matter | [Pangram technical blog](https://www.pangram.com/blog/all-about-false-positives-in-ai-detectors) | Useful evaluation practices; the vendor's numerical claims are not independent evidence of Residue performance. |
| Detectors can fail on unfamiliar models and domains | [NAACL 2025 evaluation](https://aclanthology.org/2025.findings-naacl.271/) | Evaluate held-out sources/models and false positives; do not advertise heuristic counts as probabilities. |
| Removing tells or paraphrasing guarantees undetectability | [ACL robustness study](https://aclanthology.org/2024.acl-long.160/) | Detector fragility is not a reliable guarantee. Residue improves inspectability and writing, not institutional acceptance. |

## Implemented

- Three distinct rhetorical families required within a paragraph of at least 120
  words before a combined-pattern finding. Thresholds are experimental and uncalibrated.
  Vocabulary and punctuation alone cannot trigger this finding.
- Vague attribution with recognized nearby citation suppression. This is a source
  prompt, not citation validation; missing a format or over-suppressing nearby prose
  is possible.
- Repeated full sentences: at least 12 words and three occurrences. A useful
  redundancy check, not an AI signal by itself.
- Style checks exclude recognized quotations, links, code, math and citation regions.
- CommonMark-style longer/indented fences and unclosed fences are protected.
- Large scans run in a cancellable worker; stale results are discarded. Processing
  remains local, including the offline HTML build.

## Evaluation status and next milestone

`tests/academic.test.ts` contains original, hand-authored positive and negative
regression probes. They verify deterministic behavior, protected spans and safe
defaults. They are **not** a representative human/AI dataset. No precision, recall,
false-positive rate or Turnitin equivalence is claimed.

Before an authorship classifier is introduced, collect licensed, provenance-labeled
human/generated/AI-edited academic documents across disciplines. Keep human
pre-LLM writing, formulaic methods sections and polished English as hard negatives.
Deduplicate and split by document, author/source and generating model; maintain a
frozen held-out set. Report precision, recall, false-positive rate with sample counts
and confidence intervals, including low-FPR operating points and short passages.
The app must abstain when evidence is insufficient. Evaluate citation and meaning
preservation separately from authorship classification.

Multilingual support is future work, open to contributions. Contributions should
include licensed examples, provenance, expected behavior and false-positive cases.
