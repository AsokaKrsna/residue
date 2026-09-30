/**
 * Style data. Sources:
 * - Kobak et al. 2025 (Science Advances): words with the largest frequency jump in 2024 PubMed abstracts.
 * - Wikipedia "Signs of AI writing" (WikiProject AI Cleanup): vocabulary by era, phrase patterns.
 * - blader/humanizer (MIT) and common editorial checklists: structural patterns.
 * Each word maps to plain replacements. "(delete)" means the sentence usually works without it.
 * These are signals for review, never proof of machine authorship.
 */

/** Strong tier: words that most readers now associate with LLM prose. */
export const STRONG_VOCAB: Record<string, string[]> = {
  delve: ["examine", "study", "look at"], delves: ["examines", "studies"], delved: ["examined", "studied"], delving: ["examining", "studying"],
  tapestry: ["mix", "combination"], testament: ["evidence", "proof"], realm: ["area", "field"], realms: ["areas", "fields"],
  pivotal: ["central", "key", "important"], intricate: ["complex", "detailed"], intricacies: ["details", "complexities"], intricately: ["closely"],
  meticulous: ["careful", "thorough"], meticulously: ["carefully"], multifaceted: ["complex", "varied"], nuanced: ["subtle", "detailed"],
  showcase: ["show"], showcases: ["shows"], showcased: ["showed", "shown"], showcasing: ["showing"],
  underscore: ["show", "stress"], underscores: ["shows", "stresses"], underscored: ["showed", "stressed"], underscoring: ["showing", "stressing"],
  leverage: ["use"], leverages: ["uses"], leveraged: ["used"], leveraging: ["using"],
  harness: ["use"], harnesses: ["uses"], harnessed: ["used"], harnessing: ["using"],
  utilize: ["use"], utilizes: ["uses"], utilized: ["used"], utilizing: ["using"], utilization: ["use"],
  seamless: ["smooth"], seamlessly: ["(delete)", "smoothly"], robust: ["reliable", "strong"], robustly: ["reliably"],
  groundbreaking: ["new", "novel"], "cutting-edge": ["recent", "modern"], "state-of-the-art": ["current best", "leading"],
  transformative: ["major"], revolutionize: ["change"], revolutionizing: ["changing"], unparalleled: ["unmatched", "(delete)"],
  garner: ["gain", "attract"], garnered: ["gained", "attracted"], garnering: ["gaining", "attracting"],
  unveil: ["reveal", "show"], unveils: ["reveals", "shows"], unveiled: ["revealed", "showed"], unveiling: ["revealing"],
  elucidate: ["explain", "clarify"], elucidates: ["explains"], elucidated: ["explained"], elucidating: ["explaining"],
  foster: ["support", "encourage"], fosters: ["supports"], fostered: ["supported"], fostering: ["supporting"],
  bolster: ["strengthen", "support"], bolsters: ["strengthens"], bolstered: ["strengthened"], bolstering: ["strengthening"],
  embark: ["start", "begin"], embarks: ["starts"], embarked: ["started"], embarking: ["starting"],
  navigate: ["handle", "work through"], navigating: ["handling"], landscape: ["field", "area", "situation"],
  paramount: ["essential", "most important"], crucial: ["important", "key"], vital: ["important", "essential"], essential: ["needed", "important"],
  invaluable: ["very useful", "useful"], noteworthy: ["notable", "(delete)"], commendable: ["good"], remarkable: ["notable", "(delete)"],
  profound: ["deep", "large"], profoundly: ["deeply", "(delete)"], compelling: ["strong", "convincing"], formidable: ["serious", "strong"],
  burgeoning: ["growing"], "ever-evolving": ["changing"], "ever-changing": ["changing"],
  holistic: ["complete", "overall"], synergy: ["combined effect"], synergistic: ["combined"], paradigm: ["model", "approach"],
  realize: ["achieve"], endeavor: ["effort", "attempt"], endeavors: ["efforts"], endeavour: ["effort"], endeavours: ["efforts"],
  facilitate: ["help", "enable"], facilitates: ["helps", "enables"], facilitated: ["helped", "enabled"], facilitating: ["helping"],
  encompass: ["include", "cover"], encompasses: ["includes", "covers"], encompassing: ["including", "covering"],
  exemplify: ["show"], exemplifies: ["shows"], exemplified: ["shown"],
  illuminate: ["explain", "clarify"], illuminates: ["explains"], illuminating: ["revealing", "useful"],
  interplay: ["interaction"], juxtaposition: ["contrast"], plethora: ["many", "a lot of"], myriad: ["many"], multitude: ["many"],
  streamline: ["simplify"], streamlines: ["simplifies"], streamlined: ["simplified"], streamlining: ["simplifying"],
  empower: ["enable", "help"], empowers: ["enables"], empowering: ["enabling"], elevate: ["improve", "raise"], elevates: ["improves"], elevating: ["improving"],
  unlock: ["enable", "open"], unlocks: ["enables"], unlocking: ["enabling"], resonate: ["connect", "appeal"], resonates: ["appeals"],
  vibrant: ["lively", "active"], bustling: ["busy"], nestled: ["located"], boasts: ["has"], boast: ["have"],
  enduring: ["lasting"], indelible: ["lasting"], seminal: ["influential"], nascent: ["new", "early"],
  underpin: ["support"], underpins: ["supports"], underpinning: ["supporting"], underpinnings: ["basis", "foundations"],
  commence: ["start", "begin"], commenced: ["started"], henceforth: ["from now on"], thereby: ["so", "(delete)"],
  additionally: ["also"], furthermore: ["also"], moreover: ["also"], notably: ["(delete)", "in particular"], consequently: ["so", "as a result"],
  ultimately: ["in the end", "(delete)"], arguably: ["(delete)"], undoubtedly: ["(delete)", "clearly"], inherently: ["(delete)", "by nature"],
  aligns: ["matches", "fits"], align: ["match", "fit"], aligning: ["matching"],
  meticulousness: ["care"], adept: ["skilled", "good at"], adeptly: ["skillfully"], swiftly: ["quickly"], swift: ["quick", "fast"],
  pinpoint: ["find", "identify"], pinpointing: ["finding"], scrutinize: ["examine", "check"], scrutinizing: ["examining"],
  uncharted: ["new", "unexplored"], underexplored: ["little studied"], unexplored: ["unstudied", "new"],
  imperative: ["essential", "necessary"], necessitate: ["require"], necessitates: ["requires"], necessitating: ["requiring"],
  poised: ["ready", "set"], paving: ["making way"], pave: ["open", "prepare"], trailblazing: ["pioneering", "new"],
  intriguing: ["interesting"], captivating: ["interesting"], fascinating: ["interesting"], "game-changer": ["major change"], "game-changing": ["major"],
};

/** Phrases. Keys are regex sources (case-insensitive). Values are suggestions. */
export const PHRASES: [string, string[], string][] = [
  // [pattern, suggestions, category note]
  ["it is (?:worth|important to) not(?:e|ing) that ", ["(delete)"], "Filler opener. The sentence works without it."],
  ["it(?:'s| is) worth (?:noting|mentioning|highlighting|pointing out) that ", ["(delete)"], "Filler opener. The sentence works without it."],
  ["it should be noted that ", ["(delete)"], "Filler opener."],
  ["needless to say,? ", ["(delete)"], "Filler."],
  // one entry per verb form so the suggestion agrees with the subject
  ["plays an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role in", ["matters for", "is central to", "affects"], "Stock significance phrase. Say what the role is."],
  ["play an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role in", ["matter for", "are central to", "affect"], "Stock significance phrase. Say what the role is."],
  ["played an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role in", ["mattered for", "was central to", "affected"], "Stock significance phrase. Say what the role is."],
  ["playing an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role in", ["being central to", "affecting"], "Stock significance phrase. Say what the role is."],
  ["plays an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role", ["matters", "is central"], "Stock significance phrase. Say what the role is."],
  ["play an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role", ["matter", "are central"], "Stock significance phrase. Say what the role is."],
  ["played an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role", ["mattered", "was central"], "Stock significance phrase. Say what the role is."],
  ["playing an? (?:pivotal|crucial|vital|key|critical|central|significant|important|instrumental) role", ["being central"], "Stock significance phrase. Say what the role is."],
  ["(?:serves?|served|serving|stands?|stood) as a testament to", ["shows", "is evidence of"], "Inflated significance."],
  ["(?:is|are|was|were) a testament to", ["shows", "show"], "Inflated significance."],
  ["a testament to", ["evidence of", "proof of"], "Inflated significance."],
  ["the (?:ever[- ])?(?:evolving|changing|shifting) landscape of", ["the current state of", "recent work in"], "Stock phrase."],
  ["in (?:today's|the modern|the current) (?:fast[- ]paced|rapidly (?:evolving|changing)|digital|ever[- ]changing) (?:world|era|landscape|age),? ", ["(delete)", "today, "], "Stock opener."],
  ["in the (?:realm|world|domain|sphere) of", ["in"], "Inflated framing."],
  ["(?:a|the) (?:rich|complex|intricate|vibrant) tapestry of", ["a mix of"], "LLM metaphor."],
  ["(?:sheds?|shedding|shed) (?:new )?light on", ["explains", "clarifies"], "Stock academic phrase."],
  ["(?:paves?|paved|paving) the way (?:for|to)", ["enables", "allows"], "Stock phrase."],
  ["(?:lays?|laid|laying) the (?:groundwork|foundation) for", ["prepares for", "enables"], "Stock phrase."],
  ["opens? (?:up )?new avenues (?:for|of)", ["enables new", "allows new"], "Stock phrase."],
  ["(?:offers?|provides?|provided|offering|providing|yields?) (?:valuable|critical|crucial|key|deep|profound|unique|rich|important) insights? (?:into|on)", ["shows", "explains", "informs"], "Vague claim of value. Say what was learned."],
  ["valuable insights?", ["findings", "evidence"], "Vague claim of value."],
  ["a (?:deeper|better|more nuanced|comprehensive|holistic) understanding of", ["understanding of", "a clearer view of"], "Stock phrase."],
  ["(?:has|have) (?:garnered|gained|attracted|received) (?:significant|considerable|increasing|growing|widespread|much) (?:attention|interest|traction)", ["has been widely studied", "has drawn attention"], "Stock opener for literature reviews."],
  ["(?:has|have) emerged as an? (?:promising|powerful|key|important|prominent|popular|viable)", ["is a", "has become a"], "Stock opener."],
  ["a (?:growing|burgeoning|substantial|vast|rich) body of (?:research|literature|work|evidence)", ["much research", "many studies"], "Stock phrase."],
  ["(?:remains?|remained) (?:a )?(?:significant|major|key|critical|open|formidable|persistent|pressing) challenges?", ["is still hard", "is still an open problem"], "Stock phrase."],
  ["(?:a )?(?:wide|broad|diverse|vast) (?:range|array|variety|spectrum) of", ["many", "various"], "Filler quantity phrase."],
  ["(?:myriad|plethora|multitude) of", ["many"], "Inflated quantity."],
  ["(?:navigate|navigating|navigates) the (?:complexities|challenges|intricacies|nuances) of", ["handle", "deal with"], "LLM metaphor."],
  ["harness(?:es|ed|ing)? the (?:power|potential) of", ["use"], "Inflated phrase."],
  ["unlock(?:s|ed|ing)? the (?:full )?potential of", ["make full use of", "improve"], "Inflated phrase."],
  ["at the (?:forefront|cutting edge|intersection) of", ["leading in", "in"], "Stock phrase."],
  ["(?:underscores?|underscoring|highlights?|highlighting|emphasi[sz]es?|emphasi[sz]ing) the (?:importance|significance|need|necessity|value|role) of", ["shows why", "shows the need for"], "Inflated significance."],
  ["(?:is|are) (?:crucial|essential|vital|paramount|imperative|critical) (?:for|to|in)", ["matters for", "is needed for"], "Inflated significance."],
  ["(?:in|with) (?:an|the) (?:aim|goal|effort|attempt) (?:of|to)", ["to"], "Wordy."],
  ["in order to", ["to"], "Wordy."],
  ["due to the fact that", ["because"], "Wordy."],
  ["(?:a|the) (?:key|critical|crucial|pivotal|significant) (?:turning point|milestone|moment)", ["a milestone", "a turning point"], "Inflated significance."],
  ["(?:marks?|marked|marking) a (?:significant|major|pivotal|important|notable) (?:step|shift|milestone|advancement|departure)", ["is a step", "changes"], "Inflated significance."],
  ["(?:represents?|represented|representing) a (?:paradigm shift|significant (?:step|advance|advancement|leap)|major (?:step|advance|advancement|leap))", ["is an advance", "improves on"], "Inflated significance."],
  ["(?:bridge|bridges|bridging|bridged) the gap between", ["connects", "links"], "Stock metaphor."],
  ["(?:delve|delves|delving|delved) (?:deeper )?into", ["examine", "study"], "The best-known LLM verb."],
  ["(?:dive|dives|diving) (?:deeper |deep )?into", ["examine", "look at"], "Chat-style metaphor."],
  ["let(?:'s| us) (?:dive|delve|explore|take a (?:closer )?look|unpack|break (?:it|this) down)", ["(delete)"], "Chat-style lead-in."],
  ["(?:without further ado|buckle up|here's the (?:thing|kicker|catch)|the bottom line is|the short answer is)", ["(delete)"], "Chat-style lead-in."],
  ["(?:in essence|at its core|at the end of the day|when all is said and done|all in all)", ["(delete)", "in short"], "Filler framing."],
  ["(?:not only|not just|not merely) (?:that|this),? but", ["also"], "Stock construction."],
  ["(?:studies|research|experts|scholars|researchers|critics|observers|analysts) (?:have )?(?:show|shown|suggest|suggested|argue|argued|believe|noted|note|indicate|found|agree)\\b", ["(add a citation)"], "Vague attribution. Name the source or cite it."],
  ["it is (?:widely|generally|commonly|often) (?:believed|accepted|acknowledged|recognized|agreed|known|thought) that", ["(add a citation)"], "Vague attribution."],
  ["(?:industry|recent|some|several|many|various) reports (?:suggest|indicate|show|claim)", ["(add a citation)"], "Vague attribution. Name the report."],
  ["despite (?:its|these|this|their|such|the) (?:many )?(?:challenges|obstacles|limitations|setbacks|hurdles|difficulties)", ["(name the problem)"], "Outline-style conclusion. State the specific problem."],
  ["(?:faces?|faced|facing) (?:several|many|numerous|a number of|significant|various) challenges", ["has problems with"], "Outline-style conclusion. Name the challenges."],
  ["(?:left|leaves?|leaving) an (?:indelible|lasting|enduring) mark on", ["changed", "shaped"], "Inflated legacy phrase."],
  ["(?:nestled )?in the heart of", ["in", "in central"], "Promotional phrase."],
  ["(?:could|might|may|can) potentially", ["could", "may"], "Stacked hedge."],
  ["(?:may|might|could) possibly", ["may", "might"], "Stacked hedge."],
  ["it (?:could|can|might) be argued that", ["(delete)", "arguably,"], "Hedge."],
  ["to (?:some|a certain|a large) (?:extent|degree)", ["partly", "(delete)"], "Hedge."],
];

/** Sentence openers that stack transitions. */
export const OPENERS = [
  "Furthermore", "Moreover", "Additionally", "In addition", "Notably", "Importantly", "Crucially", "Significantly", "Interestingly",
  "Ultimately", "Overall", "In conclusion", "In summary", "To summarize", "To sum up", "In essence", "Indeed",
  "In light of this", "With this in mind", "That being said", "Having said that", "It is important to note", "Remarkably",
];

/** Intensifiers and emphasis words that rarely add meaning. */
export const INTENSIFIERS = [
  "truly", "incredibly", "deeply", "profoundly", "remarkably", "exceptionally", "extremely", "highly", "genuinely",
  "fundamentally", "undeniably", "unquestionably", "absolutely", "tremendously", "immensely", "vastly", "quietly",
  "strikingly", "significantly",
];

/** Copula avoidance: "serves as" where "is" would do. */
export const COPULA = [
  ["serves as", "is"], ["serve as", "are"], ["served as", "was"], ["serving as", "being"],
  ["stands as", "is"], ["stand as", "are"], ["stood as", "was"],
  ["functions as", "is"], ["acts as", "is"], ["operates as", "is"],
  ["represents a", "is a"], ["constitutes a", "is a"], ["boasts a", "has a"], ["boasts an", "has an"],
] as const;
