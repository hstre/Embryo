import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createState, readJson } from "../src/state.mjs";
import { deriveNeeds, canGrow } from "../src/needs.mjs";
import { applyProposal } from "../src/gate.mjs";
import { runGeneration } from "../src/engine.mjs";
import { DeterministicPolicy } from "../src/policies/deterministic.mjs";
import { SmolLmPolicy, smolLmDefaults } from "../src/policies/smollm.mjs";
import { readReceipts, validateLedger } from "../src/ledger.mjs";
import { replay } from "../src/replay.mjs";
import { stateDigest } from "../src/canonical.mjs";

const seedPath = new URL("../examples/seed.json", import.meta.url);

async function freshState() {
  return createState(await readJson(seedPath));
}

function addQuestion(state, text = "What remains unresolved?") {
  const need = deriveNeeds(state).find((candidate) => candidate.kind === "QUESTION");
  return applyProposal(state, { type: "ADD_QUESTION", need_id: need.id, payload: { text } }, state.next_event_seq);
}

function addProposal(state, text = "A provisional answer.") {
  const need = deriveNeeds(state).find((candidate) => candidate.kind === "PROPOSE");
  return applyProposal(state, { type: "ADD_PROPOSAL", need_id: need.id, payload: { text } }, state.next_event_seq);
}

function addReviewPanel(state) {
  while (deriveNeeds(state).some((candidate) => candidate.kind === "REVIEW_FRAGMENT")) {
    const need = deriveNeeds(state).find((candidate) => candidate.kind === "REVIEW_FRAGMENT");
    applyProposal(
      state,
      { type: "ADD_REVIEW_FRAGMENT", need_id: need.id, payload: { target_id: need.target_id, text: `Free review note ${need.stage}.` } },
      state.next_event_seq,
    );
  }
}

function metaReview(state, verdict, text = `${verdict}: collective test review.`) {
  const need = deriveNeeds(state).find((candidate) => candidate.kind === "META_REVIEW");
  return applyProposal(
    state,
    { type: "META_REVIEW", need_id: need.id, payload: { target_id: need.target_id, verdict, text } },
    state.next_event_seq,
  );
}

test("question work product recruits a proposing cell", async () => {
  const state = await freshState();
  assert.equal(deriveNeeds(state)[0].kind, "QUESTION");
  assert.equal(addQuestion(state).code, "QUESTION_ADDED");
  assert.equal(deriveNeeds(state)[0].kind, "PROPOSE");
});

test("proposal work product recruits three reviewer perspectives", async () => {
  const state = await freshState();
  addQuestion(state);
  assert.equal(addProposal(state).code, "PROPOSAL_ADDED");
  const panel = deriveNeeds(state).filter((need) => need.kind === "REVIEW_FRAGMENT");
  assert.equal(panel.length, 3);
  assert.deepEqual(panel.map((need) => need.stage), [0, 1, 2]);
});

test("three free-language reviews recruit the meta-reviewer", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state);
  addReviewPanel(state);
  const fragments = state.nodes.filter((node) => node.kind === "review_fragment");
  assert.equal(fragments.length, 3);
  assert.deepEqual(fragments.map((node) => node.perspective).sort(), ["adversarial", "charitable", "coherence"]);
  assert.equal(deriveNeeds(state)[0].kind, "META_REVIEW");
});

test("accepted collective review creates the next question gradient", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state);
  addReviewPanel(state);
  assert.equal(metaReview(state, "ACCEPT").code, "META_REVIEW_ACCEPT");
  assert.equal(state.nodes.find((node) => node.kind === "proposal").status, "accepted");
  assert.equal(state.nodes.find((node) => node.kind === "question").status, "answered");
  assert.equal(deriveNeeds(state)[0].kind, "QUESTION");
});

test("revision by the meta-reviewer recruits the proposing phenotype", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state, "First answer.");
  addReviewPanel(state);
  metaReview(state, "REVISE", "REVISE: clarify the relation.");
  const need = deriveNeeds(state)[0];
  assert.equal(need.kind, "PROPOSE");
  assert.equal(state.nodes.find((node) => node.id === need.target_id).status, "revision_requested");
  assert.equal(addProposal(state, "Revised answer.").code, "PROPOSAL_ADDED");
  assert.equal(state.nodes.find((node) => node.text === "First answer.").status, "superseded");
});

test("exhausted meta-review rejects its proposal and abandons its question", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state);
  addReviewPanel(state);
  const need = deriveNeeds(state).find((candidate) => candidate.kind === "META_REVIEW");
  for (let attempt = 0; attempt < state.config.max_attempts_per_need; attempt += 1) {
    applyProposal(state, { type: "ABSTAIN", need_id: need.id, payload: { reason: "no verdict" } }, state.next_event_seq);
  }
  assert.equal(state.nodes.find((node) => node.kind === "proposal").status, "rejected");
  assert.equal(state.nodes.find((node) => node.kind === "question").status, "abandoned");
  assert.equal(deriveNeeds(state)[0].kind, "QUESTION");
});

test("bounded collective grows to meta-reviewed synthesis and replays exactly", async () => {
  const seed = await readJson(seedPath);
  const state = createState(seed);
  const dir = await mkdtemp(join(tmpdir(), "embryo-triad-test-"));
  const statePath = join(dir, "state.json");
  const eventsPath = join(dir, "events.jsonl");
  const policy = new DeterministicPolicy();
  while (canGrow(state)) await runGeneration({ state, statePath, eventsPath, policy, maxCells: 4 });
  assert.equal(state.nodes.filter((node) => node.kind === "proposal" && node.status === "accepted").length, seed.config.target_proposals);
  assert.equal(state.nodes.find((node) => node.kind === "synthesis").status, "accepted");
  const receipts = await readReceipts(eventsPath);
  assert.equal(validateLedger(receipts, state.ledger_head), true);
  assert.equal(stateDigest(replay(seed, receipts)), stateDigest(state));
});

test("replay mirrors duplicate rejection and exhaustion", async () => {
  const seed = await readJson(seedPath);
  const state = createState(seed);
  const dir = await mkdtemp(join(tmpdir(), "embryo-rejection-test-"));
  const statePath = join(dir, "state.json");
  const eventsPath = join(dir, "events.jsonl");
  const policy = {
    name: "repeating-triad-policy",
    async propose(view) {
      if (view.need.kind === "QUESTION") return { type: "ADD_QUESTION", need_id: view.need.id, payload: { text: "Same question?" } };
      if (view.need.kind === "PROPOSE") return { type: "ADD_PROPOSAL", need_id: view.need.id, payload: { text: "Same answer." } };
      if (view.need.kind === "REVIEW_FRAGMENT") {
        return { type: "ADD_REVIEW_FRAGMENT", need_id: view.need.id, payload: { target_id: view.target.id, text: `${view.perspective} note.` } };
      }
      return { type: "META_REVIEW", need_id: view.need.id, payload: { target_id: view.target.id, verdict: "REJECT", text: "REJECT: insufficient." } };
    },
  };
  await runGeneration({ state, statePath, eventsPath, policy, maxCells: 4 });
  await runGeneration({ state, statePath, eventsPath, policy, maxCells: 4 });
  const receipts = await readReceipts(eventsPath);
  assert.ok(receipts.some((receipt) => receipt.decision.code === "DUPLICATE_QUESTION"));
  assert.equal(stateDigest(replay(seed, receipts)), stateDigest(state));
});

test("energy budget stops growth", async () => {
  const seed = await readJson(seedPath);
  seed.config.energy_budget = 1;
  const state = createState(seed);
  state.energy_spent = 1;
  deriveNeeds(state);
  assert.equal(canGrow(state), false);
});

test("only the meta-review role uses the larger pinned model", async () => {
  const policy = new SmolLmPolicy();
  assert.equal(policy.model, "HuggingFaceTB/SmolLM2-135M-Instruct");
  assert.equal(policy.metaModel, "HuggingFaceTB/SmolLM2-360M-Instruct");
  assert.equal(policy.metaRevision, smolLmDefaults.metaRevision);
  assert.match(policy.name, /\+meta:HuggingFaceTB\/SmolLM2-360M-Instruct@/);
  assert.equal(policy.generators.size, 0);
  let scoredRole;
  let continuedRole;
  policy.scoreVerdicts = async (_messages, role) => {
    scoredRole = role;
    return [
      { verdict: "ACCEPT", sum: -1, mean: -0.5, tokens: 2 },
      { verdict: "REVISE", sum: -9, mean: -3, tokens: 3 },
      { verdict: "REJECT", sum: -9, mean: -4.5, tokens: 2 },
    ];
  };
  policy.continueFrom = async (_messages, _prefix, _maxNewTokens, role) => {
    continuedRole = role;
    return "sufficiently coherent.";
  };
  await policy.propose({
    need: { id: "need-meta", kind: "META_REVIEW" },
    goal: { text: "A goal." },
    question: { text: "A question?" },
    target: { id: "proposal-1", kind: "proposal", text: "A proposal." },
    review_fragments: [
      { perspective: "adversarial", text: "An objection." },
      { perspective: "charitable", text: "A strength." },
      { perspective: "coherence", text: "A connection." },
    ],
  });
  assert.equal(scoredRole, "meta");
  assert.equal(continuedRole, "meta");
  // Stubbed throughout: judging must not have loaded a model.
  assert.equal(policy.generators.size, 0);
});

test("an exhausted gradient inhibits instead of being minted again", async () => {
  const seed = await readJson(seedPath);
  const state = createState(seed);
  const dir = await mkdtemp(join(tmpdir(), "embryo-inhibition-test-"));
  const policy = {
    name: "stuck-questioner",
    async propose(view) {
      return { type: "ADD_QUESTION", need_id: view.need.id, payload: { text: "Same question?" } };
    },
  };
  while (canGrow(state)) {
    await runGeneration({ state, statePath: join(dir, "state.json"), eventsPath: join(dir, "events.jsonl"), policy, maxCells: 4 });
  }
  // A cell that cannot stop repeating itself must exhaust its gradient, not burn the budget.
  assert.ok(state.energy_spent < state.config.energy_budget, `growth consumed the whole budget: ${state.energy_spent}`);
  assert.ok(state.needs.some((need) => need.kind === "QUESTION" && need.status === "exhausted"));
  assert.equal(deriveNeeds(state).length, 0);
});

test("a rejected synthesis cannot be retried forever", async () => {
  const seed = await readJson(seedPath);
  const state = createState(seed);
  const dir = await mkdtemp(join(tmpdir(), "embryo-synthesis-test-"));
  const base = new DeterministicPolicy();
  const policy = {
    name: "rejecting-meta-reviewer",
    async propose(view) {
      if (view.need.kind === "META_REVIEW" && view.target.kind === "synthesis") {
        return { type: "META_REVIEW", need_id: view.need.id, payload: { target_id: view.target.id, verdict: "REJECT", text: "REJECT: not yet." } };
      }
      return base.propose(view);
    },
  };
  while (canGrow(state)) {
    await runGeneration({ state, statePath: join(dir, "state.json"), eventsPath: join(dir, "events.jsonl"), policy, maxCells: 4 });
  }
  assert.ok(state.energy_spent < state.config.energy_budget, `growth consumed the whole budget: ${state.energy_spent}`);
  assert.equal(state.nodes.find((node) => node.kind === "synthesis").status, "rejected");
  assert.equal(deriveNeeds(state).length, 0);
});

test("a synthesis may not cite the same proposal twice", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state);
  addReviewPanel(state);
  metaReview(state, "ACCEPT");
  const accepted = state.nodes.find((node) => node.kind === "proposal" && node.status === "accepted");
  const need = deriveNeeds(state)[0];
  const decision = applyProposal(
    state,
    { type: "ADD_SYNTHESIS", need_id: need.id, payload: { text: "One proposal, four times.", proposal_ids: Array(4).fill(accepted.id) } },
    state.next_event_seq,
  );
  assert.equal(decision.code, "INVALID_SCHEMA");
  assert.equal(state.edges.filter((edge) => edge.relation === "synthesizes").length, 0);
});

test("seed validation uses the same text budget as the gate", async () => {
  const seed = await readJson(seedPath);
  assert.throws(
    () => createState({ ...seed, goal: "G".repeat(seed.config.max_text_chars + 1) }),
    /config\.max_text_chars/,
  );
  assert.throws(
    () => createState({ ...seed, config: { ...seed.config, target_proposals: seed.config.local_context_limit + 1 } }),
    /must not exceed config\.local_context_limit/,
  );
});

test("an interrupted generation still replays exactly", async () => {
  const seed = await readJson(seedPath);
  const state = createState(seed);
  const dir = await mkdtemp(join(tmpdir(), "embryo-interrupt-test-"));
  const eventsPath = join(dir, "events.jsonl");
  // Two cells of a four-cell generation: the receipts are persisted, the generation
  // counter is not, which is exactly what a timed-out run leaves behind.
  await runGeneration({ state, statePath: join(dir, "state.json"), eventsPath, policy: new DeterministicPolicy(), maxCells: 2 });
  state.generation -= 1;
  const receipts = await readReceipts(eventsPath);
  assert.equal(stateDigest(replay(seed, receipts, state.generation)), stateDigest(state));
  assert.throws(() => replay(seed, receipts, state.generation + 5), /not reachable from the ledger/);
});

test("the meta-review verdict is scored, not parsed out of prose", async () => {
  const policy = new SmolLmPolicy();
  const view = {
    max_text_chars: 1200,
    need: { id: "need-meta", kind: "META_REVIEW", attempts: 0 },
    goal: { text: "A goal." },
    question: { text: "A question?" },
    target: { id: "proposal-1", kind: "proposal", text: "A proposal." },
    review_fragments: [{ perspective: "adversarial", text: "An objection." }],
  };
  let continuedFrom;
  policy.continueFrom = async (_messages, prefix) => {
    continuedFrom = prefix;
    // Prose that names a different verdict must not change the decision.
    return "on reflection I would REJECT this after all.";
  };
  // REVISE wins on the length-normalised mean while REJECT wins on the raw sum;
  // the decision must follow the mean.
  policy.scoreVerdicts = async () => [
    { verdict: "ACCEPT", sum: -7.2, mean: -3.6, tokens: 2 },
    { verdict: "REVISE", sum: -2.5, mean: -0.83, tokens: 3 },
    { verdict: "REJECT", sum: -2.1, mean: -1.06, tokens: 2 },
  ];
  const decision = await policy.propose(view);
  assert.equal(decision.action.type, "META_REVIEW");
  assert.equal(decision.action.payload.verdict, "REVISE");
  assert.equal(continuedFrom, "REVISE: ", "the reason must continue the verdict the gate applies");
  assert.match(decision.action.payload.text, /^REVISE: /);
  // The receipt has to carry the scores the decision was made on.
  assert.equal(decision.trace.decided_by, "mean_logprob");
  assert.deepEqual(decision.trace.verdict_scores.map((s) => s.verdict), ["ACCEPT", "REVISE", "REJECT"]);
});

test("a scored meta-review always reaches a verdict", async () => {
  const policy = new SmolLmPolicy();
  policy.continueFrom = async () => "";
  policy.scoreVerdicts = async () => [
    { verdict: "ACCEPT", sum: -9, mean: -4.5, tokens: 2 },
    { verdict: "REVISE", sum: -9, mean: -3.0, tokens: 3 },
    { verdict: "REJECT", sum: -9, mean: -4.5, tokens: 2 },
  ];
  const decision = await policy.propose({
    max_text_chars: 1200,
    need: { id: "need-meta", kind: "META_REVIEW", attempts: 0 },
    goal: { text: "A goal." },
    target: { id: "proposal-1", kind: "proposal", text: "A proposal." },
    review_fragments: [],
  });
  // An empty reason must not fall back to abstaining: the verdict alone is the text.
  assert.equal(decision.action.type, "META_REVIEW");
  assert.equal(decision.action.payload.verdict, "REVISE");
  assert.equal(decision.action.payload.text, "REVISE");
});

test("instruction-tuned cells are prompted through the chat template", async () => {
  const policy = new SmolLmPolicy();
  let seen;
  policy.generate = async (messages) => {
    seen = messages;
    return "A question?";
  };
  await policy.propose({
    max_text_chars: 1200,
    need: { id: "need-question", kind: "QUESTION", attempts: 2 },
    goal: { text: "A goal." },
    target: { id: "goal-0001", kind: "goal", text: "A goal." },
    accepted_proposals: [],
    negative_traces: [],
  });
  // A plain string would be completed as raw text instead of instruction-followed.
  assert.ok(Array.isArray(seen), "policy must hand the pipeline a message array");
  assert.deepEqual(seen.map((message) => message.role), ["system", "user"]);
  // A repeated attempt has to differ from the one that just failed under greedy
  // decoding, and the attempts belong to the need rather than to the cell.
  assert.match(seen[0].content, /This need carries two rejected attempts/);
});
