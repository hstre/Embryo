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

function review(state, verdict, text = `${verdict}: test review.`) {
  const need = deriveNeeds(state).find((candidate) => candidate.kind === "REVIEW");
  return applyProposal(
    state,
    { type: "REVIEW", need_id: need.id, payload: { target_id: need.target_id, verdict, text } },
    state.next_event_seq,
  );
}

test("question work product recruits a proposing cell", async () => {
  const state = await freshState();
  assert.equal(deriveNeeds(state)[0].kind, "QUESTION");
  assert.equal(addQuestion(state).code, "QUESTION_ADDED");
  assert.equal(deriveNeeds(state)[0].kind, "PROPOSE");
});

test("proposal work product recruits a reviewing cell", async () => {
  const state = await freshState();
  addQuestion(state);
  assert.equal(addProposal(state).code, "PROPOSAL_ADDED");
  assert.equal(deriveNeeds(state)[0].kind, "REVIEW");
});

test("accepted review creates the next question gradient", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state);
  assert.equal(review(state, "ACCEPT").code, "REVIEW_ACCEPT");
  assert.equal(state.nodes.find((node) => node.kind === "proposal").status, "accepted");
  assert.equal(state.nodes.find((node) => node.kind === "question").status, "answered");
  assert.equal(deriveNeeds(state)[0].kind, "QUESTION");
});

test("revision review recruits the proposing phenotype", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state, "First answer.");
  review(state, "REVISE", "REVISE: clarify the relation.");
  const need = deriveNeeds(state)[0];
  assert.equal(need.kind, "PROPOSE");
  assert.equal(state.nodes.find((node) => node.id === need.target_id).status, "revision_requested");
  assert.equal(addProposal(state, "Revised answer.").code, "PROPOSAL_ADDED");
  assert.equal(state.nodes.find((node) => node.text === "First answer.").status, "superseded");
});

test("exhausted review rejects its proposal and abandons its question", async () => {
  const state = await freshState();
  addQuestion(state);
  addProposal(state);
  const need = deriveNeeds(state)[0];
  for (let attempt = 0; attempt < state.config.max_attempts_per_need; attempt += 1) {
    applyProposal(state, { type: "ABSTAIN", need_id: need.id, payload: { reason: "no verdict" } }, state.next_event_seq);
  }
  assert.equal(state.nodes.find((node) => node.kind === "proposal").status, "rejected");
  assert.equal(state.nodes.find((node) => node.kind === "question").status, "abandoned");
  assert.equal(deriveNeeds(state)[0].kind, "QUESTION");
});

test("bounded triad grows to reviewed synthesis and replays exactly", async () => {
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
      return { type: "REVIEW", need_id: view.need.id, payload: { target_id: view.target.id, verdict: "REJECT", text: "REJECT: insufficient." } };
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
