const NODE_KINDS = new Set(["goal", "observation", "question", "proposal", "review", "synthesis"]);
const NODE_STATUSES = new Set([
  "given", "open", "under_review", "answered", "abandoned", "unreviewed",
  "accepted", "revision_requested", "rejected", "superseded", "recorded",
]);
const NEED_KINDS = new Set(["QUESTION", "PROPOSE", "REVIEW", "SYNTHESIZE"]);
const NEED_STATUSES = new Set(["open", "resolved", "exhausted"]);
const ACTION_TYPES = new Set(["ADD_QUESTION", "ADD_PROPOSAL", "REVIEW", "ADD_SYNTHESIS", "ABSTAIN"]);
const STATE_KEYS = new Set([
  "schema_version", "embryo_id", "generation", "energy_spent", "next_node_seq",
  "next_event_seq", "ledger_head", "config", "nodes", "edges", "needs",
]);
const CONFIG_KEYS = new Set([
  "target_proposals", "max_attempts_per_need", "max_cells_per_generation", "max_generations",
  "energy_budget", "max_text_chars", "local_context_limit",
]);
const ACTION_KEYS = new Set(["type", "need_id", "payload"]);
const PAYLOAD_SPECS = Object.freeze({
  ADD_QUESTION: { required: ["text"], allowed: ["text"] },
  ADD_PROPOSAL: { required: ["text"], allowed: ["text"] },
  REVIEW: { required: ["target_id", "verdict", "text"], allowed: ["target_id", "verdict", "text"] },
  ADD_SYNTHESIS: { required: ["text", "proposal_ids"], allowed: ["text", "proposal_ids"] },
  ABSTAIN: { required: ["reason"], allowed: ["reason"] },
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isNonEmptyString(value, max = Infinity) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function hasOnlyKeys(object, allowed) {
  return Object.keys(object).every((key) => allowed.has(key));
}

export function validateSeed(seed) {
  invariant(seed && typeof seed === "object" && !Array.isArray(seed), "seed must be an object");
  invariant(isNonEmptyString(seed.embryo_id, 80), "seed.embryo_id is required");
  invariant(isNonEmptyString(seed.goal, 2000), "seed.goal is required");
  invariant(Array.isArray(seed.observations), "seed.observations must be an array");
  const ids = new Set();
  for (const observation of seed.observations) {
    invariant(isNonEmptyString(observation.id, 80), "every observation needs an id");
    invariant(!ids.has(observation.id), `duplicate observation id: ${observation.id}`);
    ids.add(observation.id);
    invariant(isNonEmptyString(observation.text, 4000), `observation ${observation.id} needs text`);
    invariant(isNonEmptyString(observation.source, 1000), `observation ${observation.id} needs source`);
  }
  const config = seed.config ?? {};
  for (const [key, fallback] of Object.entries({
    target_proposals: 4,
    max_attempts_per_need: 3,
    max_cells_per_generation: 4,
    max_generations: 16,
    energy_budget: 64,
    max_text_chars: 1200,
    local_context_limit: 6,
  })) {
    const value = config[key] ?? fallback;
    invariant(Number.isInteger(value) && value > 0, `config.${key} must be a positive integer`);
  }
}

export function validateState(state) {
  invariant(state && typeof state === "object" && !Array.isArray(state), "state must be an object");
  invariant(hasOnlyKeys(state, STATE_KEYS), "state contains unknown fields");
  invariant(state?.schema_version === 2, "unsupported state schema_version");
  invariant(isNonEmptyString(state.embryo_id, 80), "state.embryo_id is required");
  invariant(Number.isInteger(state.generation) && state.generation >= 0, "generation must be non-negative");
  invariant(Number.isInteger(state.energy_spent) && state.energy_spent >= 0, "energy_spent must be non-negative");
  invariant(Number.isInteger(state.next_node_seq) && state.next_node_seq > 0, "next_node_seq invalid");
  invariant(Number.isInteger(state.next_event_seq) && state.next_event_seq > 0, "next_event_seq invalid");
  invariant(Array.isArray(state.nodes), "nodes must be an array");
  invariant(Array.isArray(state.edges), "edges must be an array");
  invariant(Array.isArray(state.needs), "needs must be an array");
  invariant(state.config && typeof state.config === "object" && !Array.isArray(state.config), "config must be an object");
  invariant(hasOnlyKeys(state.config, CONFIG_KEYS), "config contains unknown fields");
  for (const key of CONFIG_KEYS) invariant(Number.isInteger(state.config[key]) && state.config[key] > 0, `config.${key} must be a positive integer`);

  const nodeIds = new Set();
  for (const node of state.nodes) {
    invariant(
      hasOnlyKeys(node, new Set(["id", "kind", "status", "text", "source", "created_event", "ordinal"])),
      `node contains unknown fields: ${node.id}`,
    );
    invariant(isNonEmptyString(node.id, 80), "node id invalid");
    invariant(!nodeIds.has(node.id), `duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    invariant(NODE_KINDS.has(node.kind), `invalid node kind: ${node.kind}`);
    invariant(NODE_STATUSES.has(node.status), `invalid node status: ${node.status}`);
    invariant(isNonEmptyString(node.text, state.config.max_text_chars), `invalid text for ${node.id}`);
    invariant(Number.isInteger(node.created_event) && node.created_event >= 0, `invalid provenance for ${node.id}`);
  }
  for (const edge of state.edges) {
    invariant(hasOnlyKeys(edge, new Set(["id", "from", "to", "relation", "created_event"])), `edge contains unknown fields: ${edge.id}`);
    invariant(nodeIds.has(edge.from) && nodeIds.has(edge.to), `edge references missing node: ${edge.id}`);
    invariant(isNonEmptyString(edge.relation, 40), `edge relation invalid: ${edge.id}`);
  }
  const needIds = new Set();
  for (const need of state.needs) {
    invariant(
      hasOnlyKeys(need, new Set(["id", "kind", "target_id", "status", "attempts", "created_generation", "priority", "stage"])),
      `need contains unknown fields: ${need.id}`,
    );
    invariant(isNonEmptyString(need.id, 120), "need id invalid");
    invariant(!needIds.has(need.id), `duplicate need id: ${need.id}`);
    needIds.add(need.id);
    invariant(NEED_KINDS.has(need.kind), `invalid need kind: ${need.kind}`);
    invariant(NEED_STATUSES.has(need.status), `invalid need status: ${need.status}`);
    invariant(nodeIds.has(need.target_id), `need target missing: ${need.id}`);
    invariant(Number.isInteger(need.attempts) && need.attempts >= 0, `need attempts invalid: ${need.id}`);
  }
  invariant(state.energy_spent <= state.config.energy_budget, "energy budget exceeded");
  return true;
}

export function validateActionShape(action, maxTextChars) {
  invariant(action && typeof action === "object" && !Array.isArray(action), "action must be an object");
  invariant(hasOnlyKeys(action, ACTION_KEYS), "action contains unknown fields");
  invariant(ACTION_TYPES.has(action.type), `unknown action type: ${action.type}`);
  invariant(isNonEmptyString(action.need_id, 120), "action.need_id is required");
  const payload = action.payload ?? {};
  invariant(payload && typeof payload === "object" && !Array.isArray(payload), "action.payload must be an object");
  const spec = PAYLOAD_SPECS[action.type];
  invariant(hasOnlyKeys(payload, new Set(spec.allowed)), `payload for ${action.type} contains unknown fields`);
  for (const key of spec.required) invariant(Object.hasOwn(payload, key), `payload.${key} is required for ${action.type}`);
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") invariant(value.length <= maxTextChars, `payload.${key} is too long`);
  }
  if (Object.hasOwn(payload, "proposal_ids")) {
    invariant(Array.isArray(payload.proposal_ids), "payload.proposal_ids must be an array");
    invariant(payload.proposal_ids.every((value) => isNonEmptyString(value, 80)), "payload.proposal_ids contains an invalid id");
  }
  return true;
}

export const enums = { actionTypes: [...ACTION_TYPES], needKinds: [...NEED_KINDS] };
