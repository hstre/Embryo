import { digest } from "./canonical.mjs";
import { nodeById } from "./state.mjs";

const STOPWORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "to", "with"]);

function tokens(text) {
  return new Set(
    text
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length > 2 && !STOPWORDS.has(token)) ?? [],
  );
}

function overlapScore(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  let score = 0;
  for (const token of a) if (b.has(token)) score += 1;
  return score;
}

export function buildLocalView(state, need) {
  const goal = state.nodes.find((node) => node.kind === "goal");
  const target = nodeById(state, need.target_id);
  const observations = state.nodes
    .filter((node) => node.kind === "observation")
    .map((node) => ({ node, score: overlapScore(target.text, node.text) }))
    .sort((a, b) => b.score - a.score || (a.node.ordinal ?? 0) - (b.node.ordinal ?? 0))
    .slice(0, state.config.local_observation_limit)
    .map(({ node }) => ({ id: node.id, text: node.text, source: node.source }));

  const linkedIds = new Set(
    state.edges
      .filter((edge) => edge.from === target.id || edge.to === target.id)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  linkedIds.delete(target.id);
  const neighbors = [...linkedIds]
    .map((id) => nodeById(state, id))
    .filter(Boolean)
    .map(({ id, kind, status, text }) => ({ id, kind, status, text }));

  const view = {
    embryo_id: state.embryo_id,
    generation: state.generation,
    need: { id: need.id, kind: need.kind, target_id: need.target_id, attempts: need.attempts },
    goal: { id: goal.id, text: goal.text },
    target: { id: target.id, kind: target.kind, status: target.status, text: target.text },
    neighbors,
    observations,
    supported_claims: state.nodes
      .filter((node) => node.kind === "claim" && node.status === "supported")
      .map(({ id, text }) => ({ id, text })),
  };
  return { view, hash: digest(view) };
}
