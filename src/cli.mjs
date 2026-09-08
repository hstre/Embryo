#!/usr/bin/env node
import { resolve } from "node:path";
import { createState, readJson, readState, writeState } from "./state.mjs";
import { resetLedger, runGeneration } from "./engine.mjs";
import { readReceipts, validateLedger } from "./ledger.mjs";
import { canGrow, deriveNeeds } from "./needs.mjs";
import { replay } from "./replay.mjs";
import { stateDigest } from "./canonical.mjs";
import { DeterministicPolicy } from "./policies/deterministic.mjs";
import { SmolLmPolicy } from "./policies/smollm.mjs";

function parseArgs(argv) {
  const [command = "status", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) throw new Error(`unexpected argument: ${item}`);
    const key = item.slice(2).replaceAll("-", "_");
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

function paths(options) {
  return {
    seedPath: resolve(options.seed ?? "examples/seed.json"),
    statePath: resolve(options.state ?? "state/embryo.json"),
    eventsPath: resolve(options.events ?? "state/events.jsonl"),
  };
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function summary(state) {
  const openNeeds = deriveNeeds(state);
  return {
    embryo_id: state.embryo_id,
    generation: state.generation,
    energy: `${state.energy_spent}/${state.config.energy_budget}`,
    nodes: state.nodes.length,
    claims: state.nodes.filter((node) => node.kind === "claim").length,
    supported_claims: state.nodes.filter((node) => node.kind === "claim" && node.status === "supported").length,
    open_needs: openNeeds.map((need) => ({ id: need.id, kind: need.kind, target_id: need.target_id })),
    can_grow: canGrow(state),
    synthesis: state.nodes.find((node) => node.kind === "synthesis")?.text ?? null,
    ledger_head: state.ledger_head,
  };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const { seedPath, statePath, eventsPath } = paths(options);

  if (command === "init") {
    const seed = await readJson(seedPath);
    const state = createState(seed);
    deriveNeeds(state);
    await writeState(statePath, state);
    await resetLedger(eventsPath);
    console.log(JSON.stringify(summary(state), null, 2));
    return;
  }

  const state = await readState(statePath);
  if (command === "status") {
    console.log(JSON.stringify(summary(state), null, 2));
    return;
  }
  if (command === "can-grow") {
    console.log(canGrow(state) ? "true" : "false");
    return;
  }
  if (command === "validate") {
    const receipts = await readReceipts(eventsPath);
    validateLedger(receipts, state.ledger_head);
    console.log(JSON.stringify({ valid: true, events: receipts.length, state_digest: stateDigest(state) }, null, 2));
    return;
  }
  if (command === "replay") {
    const seed = await readJson(seedPath);
    const receipts = await readReceipts(eventsPath);
    const rebuilt = replay(seed, receipts);
    if (stateDigest(rebuilt) !== stateDigest(state)) throw new Error("replayed state differs from persisted state");
    console.log(JSON.stringify({ replay_stable: true, events: receipts.length, state_digest: stateDigest(state) }, null, 2));
    return;
  }
  if (command === "step") {
    if (!canGrow(state)) {
      console.log(JSON.stringify({ outcomes: [], can_grow: false, generation: state.generation }, null, 2));
      return;
    }
    if (options.backend && !["smollm", "deterministic"].includes(options.backend)) {
      throw new Error("backend must be smollm or deterministic");
    }
    const policy = options.backend === "smollm"
      ? new SmolLmPolicy({ model: options.model, revision: options.revision, dtype: options.dtype })
      : new DeterministicPolicy();
    const result = await runGeneration({
      state,
      statePath,
      eventsPath,
      policy,
      maxCells: options.max_cells ? positiveInteger(options.max_cells, "max-cells") : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
