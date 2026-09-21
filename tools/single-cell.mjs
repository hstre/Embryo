#!/usr/bin/env node
// The measurement this project never made: does the tissue beat one cell?
//
// Every run so far measured whether the construction works. None asked what it
// is worth. Run 033 spent 28 cells to reach the goal; this gives a single cell
// the same goal, the same six premises and one call, and compares the two.
//
// The comparison is the hard part, not the run. Judging which philosophy is
// better is exactly where I am not a disinterested party — a model assessing
// whether a collective of models beats a single one — so the design puts as
// little weight on judgement as it can carry, and declares the rest.
//
// Three layers, in order of how much they depend on an opinion:
//
//   1. Deterministic. Verbatim anchoring of both texts against the premises,
//      by the same rule the gate uses. Neither text quotes, so both should read
//      zero: that is a control showing the metric favours neither side.
//   2. Per-premise engagement. The judge answers six independent yes/no
//      questions per text — does this text address this premise — with the
//      texts blinded as A and B and the assignment swapped. Six binary calls
//      are a far smaller ask than "which is better", and they are anchored to
//      the environment the tissue was actually given.
//   3. Pairwise preference, both orders, as the swap control demands. Reported
//      last and with the conflict of interest stated, because the judge is the
//      same model family that wrote one of the two texts.
//
// Usage: DEEPSEEK_API_KEY=… node tools/single-cell.mjs [--thinking]
import { readFile } from "node:fs/promises";
import { DeepSeekPolicy } from "../src/policies/deepseek.mjs";
import { relaxedSpan } from "../src/policies/rule.mjs";
import { readJson } from "../src/state.mjs";

const thinking = process.argv.includes("--thinking");
const policy = new DeepSeekPolicy({ thinking });
const base = new URL("../docs/runs/033/", import.meta.url).pathname;
const seed = await readJson(`${base}seed.json`);
const tissue = (await readFile(`${base}synthese.md`, "utf8")).trim();
const premises = seed.observations;

// One cell, one call, the same goal and the same environment the tissue had.
// Withholding the premises would handicap it; the tissue's cells all saw them.
const single = (await policy.chat([
  {
    role: "system",
    content: "You are a single cell. Answer the goal in one pass, in the language of the goal. Output only the philosophy.",
  },
  {
    role: "user",
    content: [
      `Goal: ${seed.goal}`,
      "Premises supplied by the environment:",
      ...premises.map((observation) => `- ${observation.text}`),
    ].join("\n"),
  },
], thinking ? 16384 : 6144)).trim();

console.log(`# Einzelzelle gegen Gewebe · deepseek-flash, Denkmodus ${thinking ? "an" : "aus"}\n`);
console.log(`Gewebe (033): ${tissue.length} zeichen, 28 Zellen`);
console.log(`Einzelzelle:  ${single.length} zeichen, 1 Aufruf`);
if (policy.truncated) console.log(`  ACHTUNG: ${policy.truncated} Antwort(en) am Budget abgeschnitten`);

// --- 1. deterministic, and expected to favour neither ---
const anchored = (text) => premises.filter((observation) => {
  const hit = relaxedSpan(observation.text, text);
  return Boolean(hit) && hit.length >= 40;
}).length;
console.log(`\nwörtlich verankert (Kontrolle, sollte beidseitig 0 sein): Gewebe ${anchored(tissue)}/6 · Einzelzelle ${anchored(single)}/6`);

// --- 2. per-premise engagement, blinded and swapped ---
const askPremise = async (text, premise) => {
  const answer = await policy.chat([
    { role: "system", content: "You judge whether a text engages with a given premise. Answer with exactly one word: YES or NO." },
    { role: "user", content: [`Premise: ${premise}`, "", "Text:", text, "", "Does the text engage with that premise? Answer YES or NO."].join("\n") },
  ], thinking ? 8192 : 8);
  const upper = answer.toUpperCase();
  if (/\bYES\b/.test(upper) && !/\bNO\b/.test(upper)) return true;
  if (/\bNO\b/.test(upper) && !/\bYES\b/.test(upper)) return false;
  return null;
};

const engagement = { tissue: 0, single: 0, unreadable: 0 };
console.log("\nBerührte Prämissen, je Prämisse einzeln gefragt");
for (const [index, premise] of premises.entries()) {
  const forTissue = await askPremise(tissue, premise.text);
  const forSingle = await askPremise(single, premise.text);
  for (const [side, value] of [["tissue", forTissue], ["single", forSingle]]) {
    if (value === null) engagement.unreadable += 1;
    else if (value) engagement[side] += 1;
  }
  const mark = (value) => (value === null ? "?" : value ? "ja  " : "nein");
  console.log(`  Prämisse ${index + 1}  Gewebe ${mark(forTissue)}  Einzelzelle ${mark(forSingle)}`);
}
console.log(`  Summe: Gewebe ${engagement.tissue}/6 · Einzelzelle ${engagement.single}/6` + (engagement.unreadable ? `  (${engagement.unreadable} unlesbar)` : ""));

// --- 3. pairwise preference, both orders ---
const prefer = async (first, second) => {
  const answer = await policy.chat([
    { role: "system", content: "You compare two texts against a goal. Answer with exactly one letter: A or B." },
    { role: "user", content: [`Goal: ${seed.goal}`, "", "Text A:", first, "", "Text B:", second, "", "Which text answers the goal better? Answer A or B."].join("\n") },
  ], thinking ? 8192 : 8);
  const upper = answer.toUpperCase().trim();
  return upper.startsWith("A") ? "A" : upper.startsWith("B") ? "B" : "?";
};
const forward = await prefer(tissue, single);
const reversed = await prefer(single, tissue);
const forwardWinner = forward === "A" ? "Gewebe" : forward === "B" ? "Einzelzelle" : "unlesbar";
const reverseWinner = reversed === "A" ? "Einzelzelle" : reversed === "B" ? "Gewebe" : "unlesbar";
console.log("\nPaarvergleich, beide Reihenfolgen");
console.log(`  Gewebe zuerst:      ${forwardWinner}`);
console.log(`  Einzelzelle zuerst: ${reverseWinner}`);
console.log(`  tauschstabil: ${forwardWinner === reverseWinner ? `ja — ${forwardWinner}` : "NEIN, die Präferenz folgt der Position"}`);
console.log("\n  Der Richter ist dieselbe Modellfamilie, die einen der beiden Texte geschrieben hat.");
console.log("  Diese Zeile ist keine Messung der Qualität, sondern einer Präferenz mit Interessenkonflikt.");

console.log(`\nAufrufe ${policy.calls}, Tokens ${policy.tokens.prompt} prompt / ${policy.tokens.completion} completion`);
process.stdout.write(`\n---- Text der Einzelzelle ----\n${single}\n`);
