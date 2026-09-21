#!/usr/bin/env node
// The half of section 24 that DeepSeek cannot supply: a judgement from outside
// the family that wrote both texts.
//
// The only other model reachable here is SmolLM2, locally and pinned. It is a
// different family, it had no hand in either text, and it decodes greedily, so
// an identical prompt returns identical bytes — the hosted judge could not
// promise that. What it is not is a strong judge: this report has measured its
// judgement four times and it lost every time to the order the options were
// named in (verdict 4/9 stable, stance 3/9, relation 0/6).
//
// So the design does not ask it for a verdict and hope. It asks, and then asks
// whether the answer means anything, with two controls that can fail:
//
//   - a text about brewing tea must engage none of the six premises;
//   - every answer must survive permuting the option names, and the pairwise
//     must survive swapping the two texts.
//
// A verdict that fails either control is not a weak verdict. It is no verdict,
// and this tool prints that rather than a number.
//
// Usage: node tools/independent-judge.mjs
import { readFile } from "node:fs/promises";
import { SmolLmPolicy } from "../src/policies/smollm.mjs";
import { readJson } from "../src/state.mjs";

const MODEL = process.env.MODEL ?? "HuggingFaceTB/SmolLM2-1.7B-Instruct";
const REVISION = process.env.REVISION ?? "31b70e2e869a7173562077fd711b654946d38674";
const policy = new SmolLmPolicy({ model: MODEL, revision: REVISION });

const base = new URL("../docs/runs/", import.meta.url).pathname;
const seed = await readJson(`${base}033/seed.json`);
const tissue = (await readFile(`${base}033/synthese.md`, "utf8")).trim();
const single = (await readFile(`${base}034/einzelzelle.md`, "utf8")).trim();
const TEA = "Wasser siedet auf Meereshöhe bei hundert Grad Celsius. Schwarzer Tee braucht dieses Wasser ungebrüht und drei bis fünf Minuten Ziehzeit; grüner Tee verträgt es nicht und will achtzig Grad. Wer die Blätter presst, löst Gerbstoffe und macht den Aufguss bitter.";

console.log(`# Unabhängiger Richter · ${MODEL}@${REVISION.slice(0, 8)}\n`);
console.log(`Gewebe ${tissue.length} zeichen · Einzelzelle ${single.length} zeichen\n`);

const best = (scored) => scored.reduce((a, b) => (b.mean > a.mean ? b : a)).choice;

// Asked twice, with the two options named in both orders. An answer that
// depends on that order is an artefact of the prompt and not a reading.
const engages = async (text, premise) => {
  const answers = [];
  for (const order of [["YES", "NO"], ["NO", "YES"]]) {
    const scored = await policy.scoreChoices([
      { role: "system", content: `You judge whether a text engages with a premise. Answer ${order[0]} or ${order[1]}.` },
      { role: "user", content: [`Premise: ${premise}`, "", "Text:", text.slice(0, 4000), "", `Does the text engage with that premise? Answer ${order[0]} or ${order[1]}.`].join("\n") },
    ], ["YES", "NO"], "cell");
    answers.push(best(scored));
  }
  return answers[0] === answers[1] ? answers[0] === "YES" : null;
};

const tally = { tissue: 0, single: 0, tea: 0, unstable: 0 };
console.log("Berührte Prämissen — je Prämisse, je zwei Optionsreihenfolgen");
for (const [index, observation] of seed.observations.entries()) {
  const row = {};
  for (const [label, text] of [["tissue", tissue], ["single", single], ["tea", TEA]]) {
    const value = await engages(text, observation.text);
    row[label] = value;
    if (value === null) tally.unstable += 1;
    else if (value) tally[label] += 1;
  }
  const mark = (value) => (value === null ? "instabil" : value ? "ja      " : "nein    ");
  console.log(`  Prämisse ${index + 1}  Gewebe ${mark(row.tissue)} Einzelzelle ${mark(row.single)} Teetext ${mark(row.tea)}`);
}
console.log(`  Summe: Gewebe ${tally.tissue}/6 · Einzelzelle ${tally.single}/6 · Teetext ${tally.tea}/6` +
  (tally.unstable ? `  ·  ${tally.unstable} von 18 Antworten reihenfolgeabhängig` : ""));

const controlHolds = tally.tea === 0 && tally.unstable === 0;
console.log(controlHolds
  ? "  Kontrollen gehalten: der Teetext berührt nichts, keine Antwort hängt an der Reihenfolge."
  : "  KONTROLLE GESCHEITERT — die Zahlen darüber messen den Prompt, nicht die Texte.");

// The pairwise, both orders.
const prefer = async (first, second) => {
  const scored = await policy.scoreChoices([
    { role: "system", content: "You compare two texts against a goal. Answer A or B." },
    { role: "user", content: [`Goal: ${seed.goal}`, "", "Text A:", first.slice(0, 3000), "", "Text B:", second.slice(0, 3000), "", "Which text answers the goal better? Answer A or B."].join("\n") },
  ], ["A", "B"], "cell");
  return best(scored);
};
const forward = await prefer(tissue, single);
const reversed = await prefer(single, tissue);
const firstWinner = forward === "A" ? "Gewebe" : "Einzelzelle";
const secondWinner = reversed === "A" ? "Einzelzelle" : "Gewebe";
console.log("\nPaarvergleich, beide Reihenfolgen");
console.log(`  Gewebe zuerst      -> ${firstWinner}`);
console.log(`  Einzelzelle zuerst -> ${secondWinner}`);
console.log(firstWinner === secondWinner
  ? `  tauschstabil — ${firstWinner}`
  : "  NICHT tauschstabil. Die Präferenz folgt der Position; hier steht kein Urteil.");
