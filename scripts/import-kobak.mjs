// One-time import of the style words from Kobak et al. (2025), Science Advances.
// Source: https://github.com/berenslab/llm-excess-vocab (MIT). Output is committed so the app needs no network.
// Usage: node scripts/import-kobak.mjs path/to/excess_words.csv
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/import-kobak.mjs excess_words.csv");
  process.exit(1);
}
const lines = readFileSync(src, "utf8").trim().split(/\r?\n/).slice(1);
const rows = lines.map((l) => {
  const cells = [...l.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => (m[2] !== undefined ? m[2] : m[1]));
  return { word: cells[1], type: cells[2], pos: cells[3] };
});

// Function words and generic academic words are in the list because their frequency moved,
// but flagging them one by one would only produce noise.
const STOP = new Set(`across additionally address addresses addressing aims alongside amid analysis announced approach assess assessed
assessing assessments attributed based between both challenge challenges complex conditions conducted consequently
declare declared demonstrated demonstrates demonstrating despite detailing diverse during effectively emerged emerges
employed employing employs enhance enhanced enhances enhancing evaluates examines exhibit exhibited exhibits exploration
explores fight findings focusing however identified impact impacting including indicating individuals initially insights
integrating integration into investigates involves involving leading like limitations linked maintaining need observed
offer offering offers outcomes particularly persist potential potentially precise presents primarily primary promising
providing research resulting revealed revealing reveals role seeks serves serving specifically strategies subsequently
substantial techniques their thereby these this through typically understanding using utilized utilizes utilizing various
varying verifies within`.split(/\s+/));

const words = rows.filter((r) => r.type === "style" && r.word && !STOP.has(r.word)).map((r) => r.word).sort();
writeFileSync(
  new URL("../src/engine/data/kobak-style-words.json", import.meta.url),
  JSON.stringify({ source: "Kobak et al. 2025, Science Advances, doi:10.1126/sciadv.adt3813; data MIT, github.com/berenslab/llm-excess-vocab", count: words.length, words }, null, 0) + "\n",
);
console.log(`wrote ${words.length} words (${rows.filter((r) => r.type === "style").length} style words, ${STOP.size} stop words)`);
