export function editingPrompt(passage: string): string {
  return "Edit this passage for clarity and natural wording. Preserve its facts, citations, quotations, technical terms, numbers and units, negation, uncertainty, and causal claims. Do not invent evidence or references. Return the edited passage and explain any proposed change in meaning.\n\n" + passage;
}
