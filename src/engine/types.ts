/** Core engine types. The engine is pure: text in, findings out. No DOM. */

export type FileType = "tex" | "bib" | "md" | "txt";
export type Preset = "latex" | "markdown" | "plain" | "keep";
export const PRESETS: Preset[] = ["latex", "markdown", "plain", "keep"];

/** remove: deletes text. replace: swaps text. review: needs a human decision. */
export type Kind = "remove" | "replace" | "review";

/**
 * Where a rule may act.
 * - all:  anywhere, including math, comments, verbatim and keys (invisible junk is junk everywhere)
 * - text: running prose only (never math, code, comments, keys, URLs or command names)
 * - math: inside math only
 */
export type Scope = "all" | "text" | "math";

export type GroupId = "inv" | "enc" | "sp" | "pu" | "uf" | "res" | "md" | "ws" | "tex" | "sty" | "plain";

export interface Group {
  id: GroupId;
  name: string;
  blurb: string;
}

/** "hidden" regions come from the file format (e.g. invisible Word runs), not from scanning text. */
export type RegionType = "math" | "verbatim" | "comment" | "keys" | "cmd" | "url" | "hidden";

export interface Region {
  type: RegionType;
  start: number;
  end: number;
}

export interface Match {
  start: number;
  end: number;
  /** string = fix (empty string removes). null = review. */
  repl: string | null;
  suggestions?: string[];
  note?: string;
}

export interface RuleContext {
  text: string;
  fileType: FileType;
  /**
   * The format fixes should produce. Usually the file type; "txt" when a "Convert to plain text" rule is on,
   * so every rule writes plain text instead of LaTeX.
   */
  output: FileType;
  preset: Preset;
  option: string | undefined;
  /** true when pos is inside a region that text-scope rules must not touch */
  isProtected(pos: number): boolean;
  inMath(pos: number): boolean;
  inRegion(pos: number, type: RegionType): boolean;
  regions: Region[];
}

export interface RuleOption {
  value: string;
  label: string;
}

export interface Rule {
  id: string;
  group: GroupId;
  name: string;
  /** one or two plain sentences shown in the rules panel */
  desc: string;
  scope: Scope;
  /** which presets turn this rule on */
  presets: Partial<Record<Preset, boolean>>;
  /** only offered for these file types (default: all) */
  fileTypes?: FileType[];
  /** produces LaTeX markup; skipped while converting to plain text */
  texOutput?: boolean;
  /** waits until no other rule has a fix left, so a whole-document conversion never swallows other fixes */
  late?: boolean;
  options?: RuleOption[];
  optionDefaults?: Partial<Record<Preset, string>>;
  /**
   * Regex rules: a global regex plus a function that decides the outcome of each match.
   * Return string (fix), null (review) or undefined (not a finding).
   */
  pattern?: RegExp;
  fix?: (m: RegExpExecArray, ctx: RuleContext) => string | null | undefined;
  suggest?: (m: RegExpExecArray, ctx: RuleContext) => string[];
  note?: (m: RegExpExecArray, ctx: RuleContext) => string | undefined;
  /** Custom scanners for rules a regex cannot express. */
  detect?: (ctx: RuleContext) => Iterable<Match>;
  /** Guard rules have no matches. They switch protected regions on or off. */
  guard?: RegionType[];
  /** Label shown instead of the raw text for invisible characters. */
  chip?: (orig: string) => string;
}

export interface Finding {
  id: string;
  ruleId: string;
  start: number;
  end: number;
  orig: string;
  repl: string | null;
  kind: Kind;
  suggestions: string[];
  note?: string;
}

export interface Config {
  fileType: FileType;
  preset: Preset;
  enabled: Record<string, boolean>;
  options: Record<string, string>;
}

export interface Change {
  from: number;
  to: number;
  insert: string;
}
