import { digest } from "./canonical.mjs";
import { nodeById } from "./state.mjs";

function linkedQuestion(state, proposal) {
  if (proposal.kind === "question") return proposal;
  if (proposal.kind !== "proposal") return null;
  const edge = state.edges.find((candidate) => candidate.from === proposal.id && candidate.relation === "answers");
  return edge ? nodeById(state, edge.to) : null;
}

function reviewsFor(state, targetId) {
  const reviewIds = state.edges
    .filter((edge) => edge.to === targetId && ["accepts", "revises", "rejects"].includes(edge.relation))
    .map((edge) => edge.from);
  return reviewIds.map((id) => nodeById(state, id)).filter(Boolean);
}

export function buildLocalView(state, need) {
  const goal = state.nodes.find((node) => node.kind === "goal");
  const target = nodeById(state, need.target_id);
  const limit = state.config.local_context_limit;
  const question = linkedQuestion(state, target);
  const acceptedProposals = state.nodes
    .filter((node) => node.kind === "proposal" && node.status === "accepted")
    .slice(-limit)
    .map(({ id, text }) => ({ id, text }));
  const negativeTraces = state.nodes
    .filter((node) =>
      (node.kind === "question" && node.status === "abandoned")
      || (["proposal", "synthesis"].includes(node.kind) && ["rejected", "superseded"].includes(node.status)),
    )
    .slice(-limit)
    .map(({ id, kind, status, text }) => ({ id, kind, status, text }));

  const view = {
    embryo_id: state.embryo_id,
    generation: state.generation,
    role: need.kind === "QUESTION" ? "questioner" : need.kind === "REVIEW" ? "reviewer" : "proposer",
    need: { id: need.id, kind: need.kind, target_id: need.target_id, attempts: need.attempts },
    goal: { id: goal.id, text: goal.text },
    target: { id: target.id, kind: target.kind, status: target.status, text: target.text },
    question: question ? { id: question.id, status: question.status, text: question.text } : null,
    reviews: reviewsFor(state, target.id).slice(-limit).map(({ id, text }) => ({ id, text })),
    accepted_proposals: acceptedProposals,
    negative_traces: negativeTraces,
  };
  return { view, hash: digest(view) };
}
