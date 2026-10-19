import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { invertedEffects } from "@codemirror/commands";

export type AppliedRules = Record<string, number>;
export const setAppliedRules = StateEffect.define<AppliedRules>();
export const appliedRulesField = StateField.define<AppliedRules>({
  create: () => ({}),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setAppliedRules)) return e.value;
    return value;
  },
});
export const journal: Extension = [appliedRulesField, invertedEffects.of((tr) =>
  tr.effects.some((e) => e.is(setAppliedRules)) ? [setAppliedRules.of(tr.startState.field(appliedRulesField))] : [])];

export function addApplied(previous: AppliedRules, changes: AppliedRules): AppliedRules {
  const next = { ...previous };
  for (const [id, n] of Object.entries(changes)) next[id] = (next[id] ?? 0) + n;
  return next;
}
