import { validateActionShape } from "./schema.mjs";
import { registerAttemptFailure, reviewPerspective } from "./needs.mjs";
import { nextNodeId, nodeById } from "./state.mjs";

const ALLOWED = Object.freeze({
  QUESTION: new Set(["ADD_QUESTION", "ABSTAIN"]),
  PROPOSE: new Set(["ADD_PROPOSAL", "ABSTAIN"]),
  REVIEW_FRAGMENT: new Set(["ADD_REVIEW_FRAGMENT", "ABSTAIN"]),
  META_REVIEW: new Set(["META_REVIEW", "ABSTAIN"]),
  SYNTHESIZE: new Set(["ADD_SYNTHESIS", "ABSTAIN"]),
});
const VERDICTS = new Set(["ACCEPT", "REVISE", "REJECT"]);

function reject(code, message) {
  return { accepted: false, code, message, mutations: [] };
}

function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function duplicates(state, kinds, text) {
  return state.nodes.some((node) => kinds.includes(node.kind) && normalize(node.text) === normalize(text));
}

function addEdge(state, from, to, relation, eventSeq) {
  const id = `edge-${String(state.edges.length + 1).padStart(4, "0")}`;
  state.edges.push({ id, from, to, relation, created_event: eventSeq });
  return id;
}

function linkedQuestion(state, proposalId) {
  const edge = state.edges.find((candidate) => candidate.from === proposalId && candidate.relation === "answers");
  return edge ? nodeById(state, edge.to) : null;
}

export function applyProposal(state, proposal, eventSeq) {
  try {
    validateActionShape(proposal, state.config.max_text_chars);
  } catch (error) {
    return reject("INVALID_SCHEMA", error.message);
  }

  const need = state.needs.find((candidate) => candidate.id === proposal.need_id);
  if (!need || need.status !== "open") return reject("NEED_NOT_OPEN", "proposal does not target an open need");
  if (!ALLOWED[need.kind].has(proposal.type)) return reject("ACTION_NOT_ALLOWED", `${proposal.type} cannot satisfy ${need.kind}`);
  const payload = proposal.payload ?? {};
  const target = nodeById(state, need.target_id);

  if (proposal.type === "ABSTAIN") {
    const mutations = registerAttemptFailure(state, need);
    return { accepted: true, code: "ABSTAINED", message: "cell abstained", mutations };
  }

  if (proposal.type === "ADD_QUESTION") {
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "question text required");
    if (target.kind !== "goal" || target.status !== "open") return reject("TARGET_MISMATCH", "question must address the open goal");
    if (duplicates(state, ["question"], payload.text)) return reject("DUPLICATE_QUESTION", "question already exists, including abandoned questions");
    const id = nextNodeId(state, "question");
    state.nodes.push({ id, kind: "question", status: "open", text: payload.text.trim(), source: "questioner-cell", created_event: eventSeq });
    const edgeId = addEdge(state, id, target.id, "investigates", eventSeq);
    need.status = "resolved";
    return { accepted: true, code: "QUESTION_ADDED", message: id, mutations: [`node:${id}`, `edge:${edgeId}`, `need:${need.id}`] };
  }

  if (proposal.type === "ADD_PROPOSAL") {
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "proposal text required");
    if (duplicates(state, ["proposal", "synthesis"], payload.text)) return reject("DUPLICATE_PROPOSAL", "proposal already exists, including rejected paths");
    let question;
    const mutations = [];
    if (target.kind === "question" && target.status === "open") {
      question = target;
    } else if (target.kind === "proposal" && target.status === "revision_requested") {
      question = linkedQuestion(state, target.id);
      if (!question) return reject("QUESTION_MISSING", "proposal revision has no linked question");
      target.status = "superseded";
      mutations.push(`node:${target.id}`);
    } else {
      return reject("TARGET_MISMATCH", "proposal must answer an open question or revise a reviewed proposal");
    }
    const id = nextNodeId(state, "proposal");
    state.nodes.push({ id, kind: "proposal", status: "unreviewed", text: payload.text.trim(), source: "proposer-cell", created_event: eventSeq });
    question.status = "under_review";
    const answerEdge = addEdge(state, id, question.id, "answers", eventSeq);
    mutations.push(`node:${id}`, `node:${question.id}`, `edge:${answerEdge}`);
    if (target.kind === "proposal") mutations.push(`edge:${addEdge(state, id, target.id, "supersedes", eventSeq)}`);
    need.status = "resolved";
    mutations.push(`need:${need.id}`);
    return { accepted: true, code: "PROPOSAL_ADDED", message: id, mutations };
  }

  if (proposal.type === "ADD_REVIEW_FRAGMENT") {
    if (payload.target_id !== target.id) return reject("TARGET_MISMATCH", "review fragment target must match need target");
    if (!["proposal", "synthesis"].includes(target.kind) || target.status !== "unreviewed") return reject("TARGET_NOT_REVIEWABLE", "target is not reviewable");
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "review fragment text required");
    const perspective = reviewPerspective(need.stage);
    if (!perspective) return reject("PERSPECTIVE_MISSING", "review need has no valid perspective");
    const id = nextNodeId(state, "review-fragment");
    state.nodes.push({
      id,
      kind: "review_fragment",
      status: "recorded",
      text: payload.text.trim(),
      source: "reviewer-cell",
      perspective,
      created_event: eventSeq,
    });
    const edgeId = addEdge(state, id, target.id, "reviews", eventSeq);
    need.status = "resolved";
    return { accepted: true, code: "REVIEW_FRAGMENT_ADDED", message: id, mutations: [`node:${id}`, `edge:${edgeId}`, `need:${need.id}`] };
  }

  if (proposal.type === "META_REVIEW") {
    if (payload.target_id !== target.id) return reject("TARGET_MISMATCH", "review target must match need target");
    if (!["proposal", "synthesis"].includes(target.kind) || target.status !== "unreviewed") return reject("TARGET_NOT_REVIEWABLE", "target is not reviewable");
    if (!VERDICTS.has(payload.verdict)) return reject("INVALID_VERDICT", "verdict must be ACCEPT, REVISE or REJECT");
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "review text required");
    const question = target.kind === "proposal" ? linkedQuestion(state, target.id) : null;
    if (target.kind === "proposal" && !question) return reject("QUESTION_MISSING", "reviewed proposal has no linked question");
    const id = nextNodeId(state, "meta-review");
    state.nodes.push({ id, kind: "meta_review", status: "recorded", text: payload.text.trim(), source: "meta-reviewer-cell", created_event: eventSeq });
    const relation = payload.verdict === "ACCEPT" ? "accepts" : payload.verdict === "REVISE" ? "revises" : "rejects";
    const edgeId = addEdge(state, id, target.id, relation, eventSeq);
    const mutations = [`node:${id}`, `edge:${edgeId}`, `node:${target.id}`, `need:${need.id}`];
    target.status = payload.verdict === "ACCEPT" ? "accepted" : payload.verdict === "REVISE" ? "revision_requested" : "rejected";
    if (target.kind === "proposal") {
      question.status = payload.verdict === "ACCEPT" ? "answered" : payload.verdict === "REJECT" ? "abandoned" : "under_review";
      mutations.push(`node:${question.id}`);
    } else if (payload.verdict === "ACCEPT") {
      const goal = state.nodes.find((node) => node.kind === "goal");
      goal.status = "accepted";
      mutations.push(`node:${goal.id}`);
    }
    need.status = "resolved";
    return { accepted: true, code: `META_REVIEW_${payload.verdict}`, message: target.id, mutations };
  }

  if (proposal.type === "ADD_SYNTHESIS") {
    if (typeof payload.text !== "string" || !payload.text.trim()) return reject("TEXT_REQUIRED", "synthesis text required");
    if (!Array.isArray(payload.proposal_ids) || payload.proposal_ids.length < state.config.target_proposals) {
      return reject("PROPOSALS_REQUIRED", "synthesis requires enough proposal ids");
    }
    const sourceProposals = payload.proposal_ids.map((id) => nodeById(state, id));
    if (sourceProposals.some((node) => node?.kind !== "proposal" || node.status !== "accepted")) {
      return reject("UNACCEPTED_PROPOSAL", "synthesis may use accepted proposals only");
    }
    if (duplicates(state, ["proposal", "synthesis"], payload.text)) return reject("DUPLICATE_SYNTHESIS", "synthesis already exists, including rejected paths");
    if (target.kind === "synthesis" && target.status === "revision_requested") target.status = "superseded";
    else if (target.kind !== "goal" || target.status !== "open") return reject("TARGET_MISMATCH", "synthesis must address the goal or revise a synthesis");
    const id = nextNodeId(state, "synthesis");
    state.nodes.push({ id, kind: "synthesis", status: "unreviewed", text: payload.text.trim(), source: "proposer-cell", created_event: eventSeq });
    const mutations = [`node:${id}`, `need:${need.id}`];
    for (const source of sourceProposals) mutations.push(`edge:${addEdge(state, source.id, id, "synthesizes", eventSeq)}`);
    if (target.kind === "synthesis") mutations.push(`node:${target.id}`, `edge:${addEdge(state, id, target.id, "supersedes", eventSeq)}`);
    need.status = "resolved";
    return { accepted: true, code: "SYNTHESIS_ADDED", message: id, mutations };
  }

  return reject("UNREACHABLE", "unhandled action");
}
