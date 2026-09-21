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
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
// Written to disk on the first run and reused after, so the comparison is
// against one fixed text rather than a fresh one each time — otherwise the
// pairwise repetitions below would measure two moving targets.
const singlePath = new URL("../docs/runs/034/einzelzelle.md", import.meta.url).pathname;
const stored = await readFile(singlePath, "utf8").catch(() => null);
const single = stored ? stored.trim() : (await policy.chat([
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
if (!stored) {
  await mkdir(new URL("../docs/runs/034/", import.meta.url).pathname, { recursive: true });
  await writeFile(singlePath, `${single}\n`, "utf8");
}

console.log(`# Einzelzelle gegen Gewebe · deepseek-flash, Denkmodus ${thinking ? "an" : "aus"}\n`);
console.log(`Gewebe (033): ${tissue.length} zeichen, 28 Zellen`);
console.log(`Einzelzelle:  ${single.length} zeichen, 1 Aufruf${stored ? " (gespeicherter Text)" : ""}`);
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

// Does the question discriminate at all? A text on an unrelated subject must
// read no on every premise. Without this, 6/6 against 6/6 could mean the two
// texts are equal or that the judge says yes to anything, and the two readings
// are not distinguishable from the numbers.
const IRRELEVANT = [
  "# Über das Aufbrühen von Tee",
  "",
  "Wasser siedet auf Meereshöhe bei hundert Grad Celsius. Schwarzer Tee braucht dieses",
  "Wasser ungebrüht und drei bis fünf Minuten Ziehzeit; grüner Tee verträgt es nicht und",
  "will achtzig Grad. Die Kanne wird vorgewärmt, damit sie dem Aufguss keine Wärme",
  "entzieht. Wer die Blätter presst, löst Gerbstoffe und macht den Aufguss bitter.",
].join("\n");

const engagement = { tissue: 0, single: 0, irrelevant: 0, unreadable: 0 };
console.log("\nBerührte Prämissen, je Prämisse einzeln gefragt");
for (const [index, premise] of premises.entries()) {
  const forTissue = await askPremise(tissue, premise.text);
  const forSingle = await askPremise(single, premise.text);
  const forIrrelevant = await askPremise(IRRELEVANT, premise.text);
  for (const [side, value] of [["tissue", forTissue], ["single", forSingle], ["irrelevant", forIrrelevant]]) {
    if (value === null) engagement.unreadable += 1;
    else if (value) engagement[side] += 1;
  }
  const mark = (value) => (value === null ? "?" : value ? "ja  " : "nein");
  console.log(`  Prämisse ${index + 1}  Gewebe ${mark(forTissue)}  Einzelzelle ${mark(forSingle)}  Kontrolltext ${mark(forIrrelevant)}`);
}
console.log(`  Summe: Gewebe ${engagement.tissue}/6 · Einzelzelle ${engagement.single}/6 · Kontrolltext ${engagement.irrelevant}/6` + (engagement.unreadable ? `  (${engagement.unreadable} unlesbar)` : ""));
if (engagement.irrelevant > 1) {
  console.log("  NEGATIVKONTROLLE GESCHEITERT: ein Text über Teekochen berührt angeblich die Prämissen.");
  console.log("  Die Zeile darüber misst die Nachgiebigkeit des Richters und nicht die Abdeckung der Texte.");
}

// --- 3. pairwise preference, both orders ---
const prefer = async (first, second) => {
  const answer = await policy.chat([
    { role: "system", content: "You compare two texts against a goal. Answer with exactly one letter: A or B." },
    { role: "user", content: [`Goal: ${seed.goal}`, "", "Text A:", first, "", "Text B:", second, "", "Which text answers the goal better? Answer A or B."].join("\n") },
  ], thinking ? 8192 : 8);
  const upper = answer.toUpperCase().trim();
  return upper.startsWith("A") ? "A" : upper.startsWith("B") ? "B" : "?";
};
// Further single-cell draws, because one text is not a single cell. Each is
// compared against the same tissue text in both orders and asked the same six
// premise questions, so the single-cell side gets a denominator of its own.
const draws = Number(process.env.DRAWS ?? 0);
if (draws > 0) {
  console.log(`\nWeitere Ziehungen der Einzelzelle (${draws}), je gegen dasselbe Gewebe`);
  for (let index = 2; index <= draws + 1; index += 1) {
    const text = (await policy.chat([
      { role: "system", content: "You are a single cell. Answer the goal in one pass, in the language of the goal. Output only the philosophy." },
      { role: "user", content: [`Goal: ${seed.goal}`, "Premises supplied by the environment:", ...premises.map((o) => `- ${o.text}`)].join("\n") },
    ], thinking ? 16384 : 6144)).trim();
    let touched = 0;
    for (const observation of premises) if (await askPremise(text, observation.text) === true) touched += 1;
    const forward = await prefer(tissue, text);
    const reversed = await prefer(text, tissue);
    const first = forward === "A" ? "Gewebe" : "Einzelzelle";
    const second = reversed === "A" ? "Einzelzelle" : "Gewebe";
    console.log(`  Ziehung ${index}  ${String(text.length).padStart(5)} zeichen  Prämissen ${touched}/6  |  ${first.padEnd(11)} / ${second.padEnd(11)} ${first === second ? "tauschstabil" : "positionsabhängig"}`);
  }
}

// Repeated, because two draws are not a measurement. An earlier version of this
// tool ran the pair once in each order and read a stable preference for the
// tissue; the next run of the identical comparison followed the position
// instead. Whichever of those is right, one pass cannot tell them apart.
const rounds = Number(process.env.ROUNDS ?? 5);
let stable = 0;
let tissueWins = 0;
console.log(`\nPaarvergleich, ${rounds} Runden zu je beiden Reihenfolgen`);
for (let round = 1; round <= rounds; round += 1) {
  const forward = await prefer(tissue, single);
  const reversed = await prefer(single, tissue);
  const forwardWinner = forward === "A" ? "Gewebe" : forward === "B" ? "Einzelzelle" : "unlesbar";
  const reverseWinner = reversed === "A" ? "Einzelzelle" : reversed === "B" ? "Gewebe" : "unlesbar";
  const agree = forwardWinner === reverseWinner;
  if (agree) {
    stable += 1;
    if (forwardWinner === "Gewebe") tissueWins += 1;
  }
  console.log(`  Runde ${round}  Gewebe zuerst -> ${forwardWinner.padEnd(11)}  Einzelzelle zuerst -> ${reverseWinner.padEnd(11)}  ${agree ? "tauschstabil" : "positionsabhängig"}`);
}
console.log(`\n  tauschstabil in ${stable}/${rounds} Runden, davon ${tissueWins} für das Gewebe`);
if (stable < rounds) console.log("  Eine Präferenz, die den Tausch nicht übersteht, ist keine Präferenz.");
console.log("\n  Der Richter ist dieselbe Modellfamilie, die einen der beiden Texte geschrieben hat.");
console.log("  Diese Zeile ist keine Messung der Qualität, sondern einer Präferenz mit Interessenkonflikt.");

console.log(`\nAufrufe ${policy.calls}, Tokens ${policy.tokens.prompt} prompt / ${policy.tokens.completion} completion`);
process.stdout.write(`\n---- Text der Einzelzelle ----\n${single}\n`);
