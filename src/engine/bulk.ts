import { RULES } from "./rules";
import type { CleanupSelection } from "./types";

export function moderateSelection(): CleanupSelection {
  return { ruleIds: RULES.filter((r) => r.bulk === "moderate").map((r) => r.id), includeWording: false };
}

/** For explicit conversion actions, never implicitly enables a scan rule. */
export function selectedRules(ruleIds: string[], includeWording = false): CleanupSelection {
  return { ruleIds: [...new Set(ruleIds)], includeWording };
}
