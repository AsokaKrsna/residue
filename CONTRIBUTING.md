# Contributing

Thank you for wanting to help. Small fixes are as welcome as big ones.

## Good ways to help

- Report text that residue gets wrong. Paste a short sample and say what you expected.
- Share new leftovers from AI tools that residue does not catch yet.
- Fix a bug, improve a rule or make the wording clearer.

## Before you open a pull request

1. `npm install`
2. `npm test` and `npm run build` should both pass.
3. Add a test for any rule you add or change. Include a case where the rule should not fire.
4. Keep style signals review-only. They should never change text on their own.
5. Keep everything in the browser. No network requests and no tracking.

Rules live in `src/engine/rules/`. The README has a short guide under "Adding a rule".

If you are unsure about an idea, open an issue first. Happy to talk it through.
