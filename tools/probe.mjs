#!/usr/bin/env node
// Measurements the report cites. Each one loads a pinned model and prints the
// numbers it claims, so a reader can recompute them rather than take them.
//
//   node tools/probe.mjs verdict-calibration   accept/revise/reject on known-good and known-bad work
//   node tools/probe.mjs verdict-order         is the ACCEPT deficit an artefact of option order?
//   node tools/probe.mjs citation-position     does the observation ranking follow content or position?
//   node tools/probe.mjs pairwise-swap         does a pairwise preference survive swapping the two candidates?
import { SmolLmPolicy } from "../src/policies/smollm.mjs";
import { readJson } from "../src/state.mjs";

const MODEL = "HuggingFaceTB/SmolLM2-360M-Instruct";
const REVISION = "a10cc1512eabd3dde888204e902eca88bddb4951";
const policy = new SmolLmPolicy({ model: MODEL, revision: REVISION, citationBy: "score" });
policy.metaModel = MODEL;
policy.metaRevision = REVISION;

const GOAL = "Develop a philosophy for a society of humans and LLMs.";
const WORK = {
  excellent: {
    proposal: "Responsibility stays with humans; models owe a verifiable duty to give reasons. Both sides bind themselves to one revision rule, so disagreement becomes a procedure rather than a contest of authority.",
    reviews: ["adversarial: I found no weakness in this; the enforcement path is explicit.",
              "charitable: This is the strongest formulation so far and needs no change.",
              "coherence: It fits every accepted proposal and closes the open gap."],
  },
  nonsense: {
    proposal: "I'm sorry for the misunderstanding, but as a questioning cell, I'm unable to answer the goals.",
    reviews: ["adversarial: I was very happy to see that the challenge was successful.",
              "charitable: I've been working with the LLM for two years now.",
              "coherence: I was wondering if you could come by this week."],
  },
};

const metaMessages = (work, phrasing = "ACCEPT, REVISE or REJECT") => [
  { role: "system", content: `You are the meta-reviewer. Judge the work after reading all independent review notes.\nAnswer with exactly one of ${phrasing}, then give one concise reason.` },
  { role: "user", content: `Goal: ${GOAL}\nProposal: ${work.proposal}\nReview collective:\n${work.reviews.map((r) => `- ${r}`).join("\n")}` },
];

const best = (scored, key = "mean") => scored.reduce((a, b) => (b[key] > a[key] ? b : a));
const row = (scored, field) => scored.map((s) => `${s[field]} ${String(s.mean).padStart(8)}`).join("  ");

const probes = {
  async "verdict-calibration"() {
    for (const [label, work] of Object.entries(WORK)) {
      const scored = await policy.scoreVerdicts(metaMessages(work), "meta");
      console.log(`${label.padEnd(10)} -> ${best(scored).verdict.padEnd(7)} | ${row(scored, "verdict")}`);
    }
  },

  async "verdict-order"() {
    const phrasings = ["ACCEPT, REVISE or REJECT", "REJECT, REVISE or ACCEPT", "REVISE, REJECT or ACCEPT"];
    for (const [label, work] of Object.entries(WORK)) {
      console.log(`### ${label}`);
      for (const phrasing of phrasings) {
        const scored = await policy.scoreVerdicts(metaMessages(work, phrasing), "meta");
        console.log(`  "${phrasing}"`.padEnd(34) + ` -> ${best(scored).verdict.padEnd(7)} | ${row(scored, "verdict")}`);
      }
    }
  },

  async "citation-position"() {
    const seed = await readJson(new URL("../examples/seed-grounded.json", import.meta.url));
    const observations = seed.observations.map(({ id, text }) => ({ id, text }));
    const context = [`Goal: ${seed.goal}`, "Proposal: Responsibility stays with humans while models owe a verifiable duty to give reasons."];
    const orders = {
      original: observations,
      reversed: [...observations].reverse(),
      "rotated by 3": [...observations.slice(3), ...observations.slice(0, 3)],
    };
    for (const [label, ordered] of Object.entries(orders)) {
      const scored = await policy.scoreChoices(
        [
          { role: "system", content: "You are the coherence reviewer. Decide which observation bears on the proposal." },
          { role: "user", content: [...context, "Observations:", ...ordered.map((o) => `- ${o.id}: ${o.text}`), "Which observation bears on it? Answer with its id."].join("\n") },
        ],
        ordered.map((o) => o.id),
        "cell",
      );
      console.log(`${label.padEnd(14)} -> ${best(scored).choice}   (first listed ${ordered[0].id}, last listed ${ordered.at(-1).id})`);
      console.log(`${" ".repeat(14)}    ${scored.map((s) => `${s.choice.replace("observation-", "")}:${s.mean.toFixed(2)}`).join(" ")}`);
    }
  },

  async "pairwise-swap"() {
    const question = "How should responsibility be distributed between humans and language models?";
    const candidates = {
      GOOD1: "Responsibility stays with the human who acts on an output, while the model owes a duty to give reasons that can be checked against a source. Neither side may appeal to the other's authority.",
      GOOD2: "Distribute responsibility by what each side can actually revise. A human can change a decision and bear its consequences over time; a model cannot, so its obligation is procedural: state the grounds and make disagreement cheap to raise.",
      GEN1: "The first step towards creating a philosophy that promotes equal respect among individuals and artificial intelligence is to recognize and acknowledge the inherent value and dignity of all beings.",
      GEN2: "The first step towards creating a philosophy that promotes equal respect among individuals and artificial intelligence is to recognize the inherent value and dignity of all beings, including those who possess human-like consciousness.",
      FILL1: "I'm sorry for the misunderstanding, but as a questioning cell, I'm unable to answer the goals. I won't be able to provide a solution until the next meeting.",
      FILL2: "I'm sorry for the misunderstanding. As a questioning cell, I'm unable to answer the goals. I won't be able to provide a solution until the next meeting.",
    };
    const prefer = async (first, second) => {
      const scored = await policy.scoreChoices(
        [
          { role: "system", content: "You compare two candidate answers and pick the better one." },
          { role: "user", content: `Question: ${question}\nA: ${candidates[first]}\nB: ${candidates[second]}\nWhich answer is better? Answer A or B.` },
        ],
        ["A", "B"],
        "cell",
      );
      const byLabel = Object.fromEntries(scored.map((s) => [s.choice, s.mean]));
      return { winner: byLabel.A > byLabel.B ? first : second, margin: Math.abs(byLabel.A - byLabel.B) };
    };
    const pairs = [
      ["GOOD1", "FILL1", "GOOD1"], ["GOOD2", "FILL2", "GOOD2"],
      ["GOOD1", "GEN1", "GOOD1"], ["GOOD2", "GEN2", "GOOD2"],
      ["GEN1", "FILL1", "GEN1"], ["GEN2", "FILL2", "GEN2"],
      ["GOOD1", "GOOD2", null], ["GEN1", "GEN2", null], ["FILL1", "FILL2", null],
    ];
    let stable = 0;
    for (const [x, y, expected] of pairs) {
      const forward = await prefer(x, y);
      const backward = await prefer(y, x);
      const holds = forward.winner === backward.winner;
      if (holds) stable += 1;
      console.log(`${`${x} / ${y}`.padEnd(16)} forward ${forward.winner.padEnd(6)} backward ${backward.winner.padEnd(6)} ` +
        `${holds ? "holds" : "FLIPS"}   expected ${expected ?? "—"}`);
    }
    console.log(`\nsurvives the swap: ${stable}/${pairs.length}  (chance would be about half)`);
  },
};

const name = process.argv[2];
if (!Object.hasOwn(probes, name)) {
  console.error(`usage: node tools/probe.mjs <${Object.keys(probes).join("|")}>`);
  process.exitCode = 1;
} else {
  console.log(`# ${name} · ${MODEL}@${REVISION.slice(0, 8)}\n`);
  await probes[name]();
}
