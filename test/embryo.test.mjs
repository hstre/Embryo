import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
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

function withObservations(seed) {
  return {
    ...seed,
    observations: [
      { id: "observation-01", text: "First test observation.", source: "test" },
      { id: "observation-02", text: "Second test observation.", source: "test" },
    ],
    config: { ...seed.config, target_claims: 2 },
  };
}

test("work product creates further needs", async () => {
  const seed = withObservations(JSON.parse(await readFile(seedPath, "utf8")));
  const state = createState(seed);
  const firstNeed = deriveNeeds(state)[0];
  assert.equal(firstNeed.kind, "EXPLORE");
  const result = applyProposal(
    state,
    { type: "ADD_CLAIM", need_id: firstNeed.id, payload: { text: seed.observations[0].text } },
    1,
  );
  assert.equal(result.accepted, true);
  const kinds = deriveNeeds(state).map((need) => need.kind);
  assert.deepEqual(kinds, ["VERIFY", "EXPLORE"]);
});

test("gate refuses unsupported evidence references", async () => {
  const seed = JSON.parse(await readFile(seedPath, "utf8"));
  const state = createState(seed);
  const explore = deriveNeeds(state)[0];
  applyProposal(state, { type: "ADD_CLAIM", need_id: explore.id, payload: { text: "A claim" } }, 1);
  const verify = deriveNeeds(state).find((need) => need.kind === "VERIFY");
  const result = applyProposal(
    state,
    { type: "SUPPORT", need_id: verify.id, payload: { target_id: verify.target_id, observation_ids: ["missing"] } },
    2,
  );
  assert.equal(result.accepted, false);
  assert.equal(result.code, "UNKNOWN_OBSERVATION");
});

test("bounded generations grow to quiescence and replay exactly", async () => {
  const seed = await readJson(seedPath);
  const state = createState(seed);
  const dir = await mkdtemp(join(tmpdir(), "embryo-test-"));
  const statePath = join(dir, "state.json");
  const eventsPath = join(dir, "events.jsonl");
  const policy = new DeterministicPolicy();
  while (canGrow(state)) {
    await runGeneration({ state, statePath, eventsPath, policy, maxCells: 4 });
  }
  const synthesis = state.nodes.find((node) => node.kind === "synthesis");
  assert.ok(synthesis);
  assert.equal(
    state.nodes.filter((node) => node.kind === "claim" && node.status === "supported").length,
    seed.config.target_claims,
  );
  assert.ok(state.energy_spent <= state.config.energy_budget);
  const receipts = await readReceipts(eventsPath);
  assert.equal(validateLedger(receipts, state.ledger_head), true);
  const rebuilt = replay(seed, receipts);
  assert.equal(stateDigest(rebuilt), stateDigest(state));
});

test("energy budget stops growth", async () => {
  const seed = withObservations(JSON.parse(await readFile(seedPath, "utf8")));
  seed.config.energy_budget = 1;
  const state = createState(seed);
  state.energy_spent = 1;
  deriveNeeds(state);
  assert.equal(canGrow(state), false);
});

test("retraction recreates a previously satisfied exploration gradient", async () => {
  const seed = withObservations(JSON.parse(await readFile(seedPath, "utf8")));
  const state = createState(seed);
  let explore = deriveNeeds(state)[0];
  applyProposal(state, { type: "ADD_CLAIM", need_id: explore.id, payload: { text: seed.observations[0].text } }, 1);
  let verify = deriveNeeds(state).find((need) => need.kind === "VERIFY");
  applyProposal(
    state,
    { type: "SUPPORT", need_id: verify.id, payload: { target_id: verify.target_id, observation_ids: ["observation-01"] } },
    2,
  );
  explore = deriveNeeds(state).find((need) => need.kind === "EXPLORE");
  applyProposal(state, { type: "ADD_CLAIM", need_id: explore.id, payload: { text: "unsupported" } }, 3);
  verify = deriveNeeds(state).find((need) => need.kind === "VERIFY");
  applyProposal(
    state,
    { type: "CHALLENGE", need_id: verify.id, payload: { target_id: verify.target_id, reason: "not observed" } },
    4,
  );
  const repair = deriveNeeds(state).find((need) => need.kind === "REPAIR");
  applyProposal(state, { type: "RETRACT", need_id: repair.id, payload: { target_id: repair.target_id } }, 5);
  const regenerated = deriveNeeds(state).filter((need) => need.kind === "EXPLORE" && need.status === "open");
  assert.equal(regenerated.length, 1);
  assert.notEqual(regenerated[0].id, explore.id);
  const duplicate = applyProposal(
    state,
    { type: "ADD_CLAIM", need_id: regenerated[0].id, payload: { text: "unsupported" } },
    6,
  );
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.code, "DUPLICATE_CLAIM");
});

test("replay mirrors rejected duplicate attempts", async () => {
  const seed = await readJson(seedPath);
  const state = createState(seed);
  const dir = await mkdtemp(join(tmpdir(), "embryo-rejection-test-"));
  const statePath = join(dir, "state.json");
  const eventsPath = join(dir, "events.jsonl");
  const policy = {
    name: "repeating-test-policy",
    async propose(view) {
      if (view.need.kind === "EXPLORE") {
        return { type: "ADD_CLAIM", need_id: view.need.id, payload: { text: "The same proposition." } };
      }
      return {
        type: "SUPPORT",
        need_id: view.need.id,
        payload: { target_id: view.target.id, rationale: "Accepted in test." },
      };
    },
  };
  await runGeneration({ state, statePath, eventsPath, policy, maxCells: 4 });
  await runGeneration({ state, statePath, eventsPath, policy, maxCells: 4 });
  const receipts = await readReceipts(eventsPath);
  const rebuilt = replay(seed, receipts);
  assert.equal(stateDigest(rebuilt), stateDigest(state));
  assert.ok(receipts.some((receipt) => receipt.decision.code === "DUPLICATE_CLAIM"));
});
