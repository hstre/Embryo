import { validateActionShape } from "./schema.mjs";
import { nextNodeId, nodeById } from "./state.mjs";

const ALLOWED = Object.freeze({
  EXPLORE: new Set(["ADD_CLAIM", "ABSTAIN"]),
  VERIFY: new Set(["SUPPORT", "CHALLENGE", "ABSTAIN"]),
  REPAIR: new Set(["REVISE", "RETRACT", "ABSTAIN"]),
  SYNTHESIZE: new Set(["SYNTHESIZE", "ABSTAIN"]),
});

function reject(code, message) {
  return { accepted: false, code, message, mutations: [] };
}

function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function duplicatesClaim(state, text) {
  return state.nodes.some((node) => node.kind === "claim" && normalize(node.text) === normalize(text));
}

function addEdge(state, from, to, relation, eventSeq) {
  const id = `edge-${String(state.edges.length + 1).padStart(4, "0")}`;
  state.edges.push({ id, from, to, relation, created_event: eventSeq });
  return id;
}

export function applyProposal(state, proposal, eventSeq) {
  try {
    validateActionShape(proposal, state.config.max_text_chars);
  } catch (error) {
    return reject("INVALID_SCHEMA", error.message);
  }

  const need = state.needs.find((candidate) => candidate.id === proposal.need_id);
  if (!need || need.status !== "open") return reject("NEED_NOT_OPEN", "proposal does not target an open need");
  if (!ALLOWED[need.kind].has(proposal.type)) {
    return reject("ACTION_NOT_ALLOWED", `${proposal.type} cannot satisfy ${need.kind}`);
  }

  const payload = proposal.payload ?? {};
  const target = nodeById(state, need.target_id);

  if (proposal.type === "ABSTAIN") {
    need.attempts += 1;
    if (need.attempts >= state.config.max_attempts_per_need) need.status = "exhausted";
    return { accepted: true, code: "ABSTAINED", message: "cell abstained", mutations: [`need:${need.id}`] };
  }

  if (proposal.type === "ADD_CLAIM") {
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "claim text required");
    if (duplicatesClaim(state, payload.text)) {
      return reject("DUPLICATE_CLAIM", "claim already exists, including in negative traces");
    }
    const id = nextNodeId(state, "claim");
    state.nodes.push({
      id,
      kind: "claim",
      status: "unverified",
      text: payload.text.trim(),
      source: "cell",
      created_event: eventSeq,
    });
    const edgeId = addEdge(state, id, target.id, "addresses", eventSeq);
    need.status = "resolved";
    return { accepted: true, code: "CLAIM_ADDED", message: id, mutations: [`node:${id}`, `edge:${edgeId}`, `need:${need.id}`] };
  }

  if (proposal.type === "SUPPORT") {
    if (payload.target_id !== target.id) return reject("TARGET_MISMATCH", "support target must match need target");
    const observationIds = payload.observation_ids ?? [];
    if (!Array.isArray(observationIds)) return reject("INVALID_OBSERVATIONS", "observation_ids must be an array");
    if (observationIds.length === 0 && (typeof payload.rationale !== "string" || !payload.rationale.trim())) {
      return reject("SUPPORT_BASIS_REQUIRED", "support requires observations or a peer rationale");
    }
    const observations = observationIds.map((id) => nodeById(state, id));
    if (observations.some((node) => node?.kind !== "observation")) {
      return reject("UNKNOWN_OBSERVATION", "support references a non-observation or missing node");
    }
    target.status = "supported";
    const edgeIds = observations.map((observation) => addEdge(state, observation.id, target.id, "supports", eventSeq));
    need.status = "resolved";
    return { accepted: true, code: "CLAIM_SUPPORTED", message: target.id, mutations: [`node:${target.id}`, ...edgeIds.map((id) => `edge:${id}`), `need:${need.id}`] };
  }

  if (proposal.type === "CHALLENGE") {
    if (payload.target_id !== target.id) return reject("TARGET_MISMATCH", "challenge target must match need target");
    if (typeof payload.reason !== "string" || !payload.reason.trim()) return reject("REASON_REQUIRED", "challenge reason required");
    const id = nextNodeId(state, "challenge");
    state.nodes.push({
      id,
      kind: "challenge",
      status: "open",
      text: payload.reason.trim(),
      source: "cell",
      created_event: eventSeq,
    });
    const edgeId = addEdge(state, id, target.id, "challenges", eventSeq);
    target.status = "challenged";
    need.status = "resolved";
    return { accepted: true, code: "CLAIM_CHALLENGED", message: target.id, mutations: [`node:${id}`, `node:${target.id}`, `edge:${edgeId}`, `need:${need.id}`] };
  }

  if (proposal.type === "REVISE") {
    if (payload.target_id !== target.id) return reject("TARGET_MISMATCH", "revision target must match need target");
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "revision text required");
    if (duplicatesClaim(state, payload.text)) {
      return reject("DUPLICATE_CLAIM", "revision already exists, including in negative traces");
    }
    const id = nextNodeId(state, "claim");
    state.nodes.push({
      id,
      kind: "claim",
      status: "unverified",
      text: payload.text.trim(),
      source: "cell",
      created_event: eventSeq,
    });
    target.status = "superseded";
    const edgeId = addEdge(state, id, target.id, "supersedes", eventSeq);
    need.status = "resolved";
    return { accepted: true, code: "CLAIM_REVISED", message: id, mutations: [`node:${id}`, `node:${target.id}`, `edge:${edgeId}`, `need:${need.id}`] };
  }

  if (proposal.type === "RETRACT") {
    if (payload.target_id !== target.id) return reject("TARGET_MISMATCH", "retraction target must match need target");
    target.status = "retracted";
    need.status = "resolved";
    return { accepted: true, code: "CLAIM_RETRACTED", message: target.id, mutations: [`node:${target.id}`, `need:${need.id}`] };
  }

  if (proposal.type === "SYNTHESIZE") {
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "synthesis text required");
    if (!Array.isArray(payload.claim_ids) || payload.claim_ids.length < state.config.target_claims) {
      return reject("CLAIMS_REQUIRED", "synthesis requires enough claim ids");
    }
    const claims = payload.claim_ids.map((id) => nodeById(state, id));
    if (claims.some((node) => node?.kind !== "claim" || node.status !== "supported")) {
      return reject("UNSUPPORTED_CLAIM", "synthesis may use supported claims only");
    }
    const id = nextNodeId(state, "synthesis");
    state.nodes.push({
      id,
      kind: "synthesis",
      status: "accepted",
      text: payload.text.trim(),
      source: "cell",
      created_event: eventSeq,
    });
    const edgeIds = claims.map((claim) => addEdge(state, claim.id, id, "synthesizes", eventSeq));
    target.status = "accepted";
    need.status = "resolved";
    return { accepted: true, code: "SYNTHESIS_ADDED", message: id, mutations: [`node:${id}`, ...edgeIds.map((edgeId) => `edge:${edgeId}`), `need:${need.id}`] };
  }

  return reject("UNREACHABLE", "unhandled action");
}
