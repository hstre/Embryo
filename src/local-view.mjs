import { digest } from "./canonical.mjs";
import { reviewPerspective } from "./needs.mjs";
import { acceptanceMode } from "./schema.mjs";
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

function reviewFragmentsFor(state, targetId) {
  const ids = state.edges
    .filter((edge) => edge.to === targetId && edge.relation === "reviews")
    .map((edge) => edge.from);
  return ids
    .map((id) => nodeById(state, id))
    .filter(Boolean)
    .map(({ id, text, perspective }) => ({ id, text, perspective }));
}

export function buildLocalView(state, need) {
  const goal = state.nodes.find((node) => node.kind === "goal");
  const observations = state.nodes
    .filter((node) => node.kind === "observation")
    .map(({ id, text, source }) => ({ id, text, source }));
  const target = nodeById(state, need.target_id);
  const limit = state.config.local_context_limit;
  const question = linkedQuestion(state, target);
  let acceptedProposals = state.nodes
    .filter((node) => node.kind === "proposal" && node.status === "accepted")
    .slice(-limit)
    .map(({ id, text }) => ({ id, text }));
  let negativeTraces = state.nodes
    .filter((node) =>
      (node.kind === "question" && node.status === "abandoned")
      || (["proposal", "synthesis"].includes(node.kind) && ["rejected", "superseded"].includes(node.status)),
    )
    .slice(-limit)
    .map(({ id, kind, status, text }) => ({ id, kind, status, text }));

  const perspective = need.kind === "REVIEW_FRAGMENT" ? reviewPerspective(need.stage) : null;
  if (need.kind === "REVIEW_FRAGMENT" && perspective === "adversarial") acceptedProposals = [];
  if (need.kind === "REVIEW_FRAGMENT" && perspective === "charitable") negativeTraces = [];

  const view = {
    embryo_id: state.embryo_id,
    generation: state.generation,
    max_text_chars: state.config.max_text_chars,
    role: need.kind === "QUESTION"
      ? "questioner"
      : need.kind === "REVIEW_FRAGMENT"
        ? "reviewer"
        : need.kind === "META_REVIEW"
          ? "meta-reviewer"
          : "proposer",
    perspective,
    need: { id: need.id, kind: need.kind, target_id: need.target_id, attempts: need.attempts },
    goal: { id: goal.id, text: goal.text },
    // Both are present only where they apply, so a run without an environment keeps
    // the view — and therefore the local-view hash — it had before citations existed.
    // A cell has to know which kind of contribution the gate will accept: asking for
    // a citation the gate would refuse is a different experiment, not a control.
    ...(acceptanceMode(state) === "citation" ? { acceptance_mode: "citation" } : {}),
    ...(observations.length ? { observations } : {}),
    target: { id: target.id, kind: target.kind, status: target.status, text: target.text },
    question: question ? { id: question.id, status: question.status, text: question.text } : null,
    reviews: reviewsFor(state, target.id).slice(-limit).map(({ id, text }) => ({ id, text })),
    review_fragments: reviewFragmentsFor(state, target.id),
    accepted_proposals: acceptedProposals,
    negative_traces: negativeTraces,
  };
  return { view, hash: digest(view) };
}
