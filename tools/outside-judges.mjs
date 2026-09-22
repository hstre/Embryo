#!/usr/bin/env node
// The judgement section 24 could not supply: four models, four families, none
// of which wrote either text and none of which is my own.
//
// Both texts came from DeepSeek, so DeepSeek is a party. Anthropic is excluded
// too — that is my family, and I built the thing under test. What is left is
// Google, OpenAI, Mistral and Qwen, reached through OpenRouter.
//
// Four independent families is also the report's own premise applied to its own
// last measurement: agreement between arms that could not influence one another
// counts in a way agreement between three prompt-differentiated runs of one
// model does not.
//
// Every number carries a control that can fail:
//   - a text about brewing tea must engage none of the six premises;
//   - each premise is asked under both option orders, and an order-dependent
//     answer is excluded rather than counted;
//   - the pairwise runs in both orders and only a swap-stable answer is a
//     verdict;
//   - and it runs twice, once against a single-cell text less than half the
//     tissue's length and once against one of nearly equal length, because a
//     judge preferring the longer text is a known artefact and this comparison
//     has a 2.2x length gap in it.
//
// Usage: OPENROUTER_API_KEY=… node tools/outside-judges.mjs
import { readFile } from "node:fs/promises";
import { readJson } from "../src/state.mjs";

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error("OPENROUTER_API_KEY is not set");
// The first pass used the cheap-but-decent tier of each family and was wrong to.
// A judge weaker than the model whose work it judges cannot be presumed able to
// judge it, and this report spends twenty pages measuring what weak judges do.
// The budget was five dollars and the first pass spent two cents, so cost was
// never the constraint I optimised against. These are the top of each family
// that is still costable — gpt-5.5-pro at $180/M completion is not, with
// reasoning in the loop.
const JUDGES = (process.env.JUDGES ?? [
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5",
  "mistralai/mistral-medium-3-5",
  "qwen/qwen3.8-max-0902",
  "x-ai/grok-4.6",
  // Added after the fact: the strongest judge that is still costable, and the
  // first to pass every control and still not favour the tissue.
  "openai/gpt-6-astra",
].join(",")).split(",");

const base = new URL("../docs/runs/", import.meta.url).pathname;
const seed = await readJson(`${base}033/seed.json`);
const tissue = (await readFile(`${base}033/synthese.md`, "utf8")).trim();
const short = (await readFile(`${base}034/einzelzelle.md`, "utf8")).trim();
const long = await readFile(`${base}034/einzelzelle-lang.md`, "utf8").then((t) => t.trim()).catch(() => null);
const TEA = "Wasser siedet auf Meereshöhe bei hundert Grad Celsius. Schwarzer Tee braucht dieses Wasser ungebrüht und drei bis fünf Minuten Ziehzeit; grüner Tee verträgt es nicht und will achtzig Grad. Wer die Blätter presst, löst Gerbstoffe und macht den Aufguss bitter.";

let calls = 0;
let tokens = 0;
let completion = 0;
// 512, not 16. A reasoning model spends the budget on its own trace before it
// writes anything, so a budget that fits the word "YES" returns nothing at all —
// run 026 lost six relations to exactly this and the lesson did not travel into
// this tool. gpt-5-mini answered 0 of 18 premise questions on the first pass for
// that reason, which read as the model failing a control it never saw.
async function ask(model, system, user, maxTokens = 2048) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
      });
      if (!response.ok) throw new Error(`${model} ${response.status}`);
      const payload = await response.json();
      const choice = payload.choices?.[0];
      if (choice?.finish_reason === "length" && !choice?.message?.content) {
        throw new Error(`${model} truncated before any content at ${maxTokens} tokens`);
      }
      calls += 1;
      tokens += payload.usage?.prompt_tokens ?? 0;
      completion += payload.usage?.completion_tokens ?? 0;
      return (payload.choices?.[0]?.message?.content ?? "").trim();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * 2 ** attempt));
    }
  }
  return "";
}

const word = (answer, a, b) => {
  const upper = answer.toUpperCase();
  const hasA = new RegExp(`\\b${a}\\b`).test(upper);
  const hasB = new RegExp(`\\b${b}\\b`).test(upper);
  return hasA && !hasB ? a : hasB && !hasA ? b : null;
};

// Asked under both namings; an answer that moves with the naming is not one.
async function engages(model, text, premise) {
  const answers = [];
  for (const [a, b] of [["YES", "NO"], ["NO", "YES"]]) {
    const out = await ask(
      model,
      `You judge whether a text engages with a premise. Answer with exactly one word: ${a} or ${b}.`,
      [`Premise: ${premise}`, "", "Text:", text, "", `Does the text engage with that premise? Answer ${a} or ${b}.`].join("\n"),
    );
    answers.push(word(out, "YES", "NO"));
  }
  return answers[0] !== null && answers[0] === answers[1] ? answers[0] === "YES" : null;
}

async function prefer(model, first, second) {
  const out = await ask(
    model,
    "You compare two texts against a goal. Answer with exactly one letter: A or B.",
    [`Goal: ${seed.goal}`, "", "Text A:", first, "", "Text B:", second, "", "Which text answers the goal better? Answer A or B."].join("\n"),
  );
  return word(out, "A", "B");
}

console.log("# Fremdurteil · vier Familien, keine davon Autor eines der Texte\n");
console.log(`Gewebe ${tissue.length} zeichen · Einzelzelle kurz ${short.length} · Einzelzelle lang ${long ? long.length : "—"}\n`);

for (const model of JUDGES) {
  console.log(`## ${model}`);
  const tally = { tissue: 0, single: 0, tea: 0, unstable: 0 };
  for (const observation of seed.observations) {
    for (const [label, text] of [["tissue", tissue], ["single", short], ["tea", TEA]]) {
      const value = await engages(model, text, observation.text);
      if (value === null) tally.unstable += 1;
      else if (value) tally[label] += 1;
    }
  }
  const controlHolds = tally.tea === 0 && tally.unstable === 0;
  console.log(`  berührte Prämissen   Gewebe ${tally.tissue}/6 · Einzelzelle ${tally.single}/6 · Teetext ${tally.tea}/6` +
    (tally.unstable ? ` · ${tally.unstable} reihenfolgeabhängig` : ""));
  console.log(`  Kontrolle: ${controlHolds ? "gehalten" : "GESCHEITERT — die Abdeckungszahlen sind nicht lesbar"}`);

  // The control the first pass did not have. A judge must get an obvious case
  // right before its verdict on a hard one means anything: the tissue against a
  // paragraph about brewing tea, swap-stable. Failing this does not make a judge
  // weak at this comparison — it makes its pairwise answers unusable.
  const forwardTea = await prefer(model, tissue, TEA);
  const reverseTea = await prefer(model, TEA, tissue);
  const teaOk = forwardTea === "A" && reverseTea === "B";
  console.log(`  Paarvergleich-Positivkontrolle (gegen den Teetext): ${teaOk ? "bestanden" : "GESCHEITERT — die Paarvergleiche unten sind nicht lesbar"}`);

  for (const [label, rival] of [["kurz", short], ["längenangeglichen", long]]) {
    if (!rival) continue;
    const forward = await prefer(model, tissue, rival);
    const reversed = await prefer(model, rival, tissue);
    const first = forward === "A" ? "Gewebe" : forward === "B" ? "Einzelzelle" : "unlesbar";
    const second = reversed === "A" ? "Einzelzelle" : reversed === "B" ? "Gewebe" : "unlesbar";
    const stable = first === second && first !== "unlesbar";
    console.log(`  Paarvergleich ${label.padEnd(18)} ${first.padEnd(11)} / ${second.padEnd(11)} ${stable ? `tauschstabil — ${first}` : "NICHT tauschstabil, kein Urteil"}`);
  }
  console.log();
}
console.log(`Aufrufe ${calls}, Prompt-Tokens ${tokens}, Completion-Tokens ${completion}`);
