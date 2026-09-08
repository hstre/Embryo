import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { validateSeed, validateState } from "./schema.mjs";

export const DEFAULT_CONFIG = Object.freeze({
  target_claims: 2,
  max_attempts_per_need: 2,
  max_cells_per_generation: 4,
  max_generations: 12,
  energy_budget: 32,
  max_text_chars: 1200,
  local_observation_limit: 3,
});

export function createState(seed) {
  validateSeed(seed);
  const config = { ...DEFAULT_CONFIG, ...(seed.config ?? {}) };
  const nodes = [
    {
      id: "goal-0001",
      kind: "goal",
      status: "open",
      text: seed.goal.trim(),
      source: "seed",
      created_event: 0,
    },
    ...seed.observations.map((observation, index) => ({
      id: observation.id,
      kind: "observation",
      status: "given",
      text: observation.text.trim(),
      source: observation.source.trim(),
      created_event: 0,
      ordinal: index,
    })),
  ];
  const state = {
    schema_version: 1,
    embryo_id: seed.embryo_id,
    generation: 0,
    energy_spent: 0,
    next_node_seq: 1,
    next_event_seq: 1,
    ledger_head: null,
    config,
    nodes,
    edges: [],
    needs: [],
  };
  validateState(state);
  return state;
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readState(path) {
  const state = await readJson(path);
  validateState(state);
  return state;
}

export async function writeState(path, state) {
  validateState(state);
  await writeJson(path, state);
}

export function nodeById(state, id) {
  return state.nodes.find((node) => node.id === id);
}

export function nextNodeId(state, prefix) {
  const id = `${prefix}-${String(state.next_node_seq).padStart(4, "0")}`;
  state.next_node_seq += 1;
  return id;
}
