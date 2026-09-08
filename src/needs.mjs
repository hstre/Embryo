import { digest } from "./canonical.mjs";
import { nodeById } from "./state.mjs";

const PRIORITY = Object.freeze({ REVIEW: 40, PROPOSE: 30, SYNTHESIZE: 20, QUESTION: 10 });

function linkedQuestion(state, proposalId) {
  const edge = state.edges.find((candidate) => candidate.from === proposalId && candidate.relation === "answers");
  return edge ? nodeById(state, edge.to) : null;
}

function conditionStillHolds(state, need) {
  const target = nodeById(state, need.target_id);
  if (!target) return false;
  if (need.kind === "QUESTION") {
    const accepted = state.nodes.filter((node) => node.kind === "proposal" && node.status === "accepted").length;
    return target.kind === "goal" && target.status === "open" && accepted < state.config.target_proposals;
  }
  if (need.kind === "PROPOSE") {
    return (target.kind === "question" && target.status === "open")
      || (target.kind === "proposal" && target.status === "revision_requested");
  }
  if (need.kind === "REVIEW") {
    return ["proposal", "synthesis"].includes(target.kind) && target.status === "unreviewed";
  }
  if (need.kind === "SYNTHESIZE") {
    if (target.kind === "synthesis") return target.status === "revision_requested";
    const accepted = state.nodes.filter((node) => node.kind === "proposal" && node.status === "accepted").length;
    return target.kind === "goal" && target.status === "open" && accepted >= state.config.target_proposals;
  }
  return false;
}

function makeNeedId(kind, targetId, discriminator = "0") {
  return `need-${kind.toLowerCase()}-${digest([kind, targetId, discriminator]).slice(0, 12)}`;
}

function ensureNeed(state, kind, targetId, discriminator = "0") {
  const id = makeNeedId(kind, targetId, discriminator);
  const existing = state.needs.find((need) => need.id === id);
  if (existing) return existing;
  const need = {
    id,
    kind,
    target_id: targetId,
    status: "open",
    attempts: 0,
    created_generation: state.generation,
    priority: PRIORITY[kind],
  };
  state.needs.push(need);
  return need;
}

function ensureFreshNeed(state, kind, targetId, stage) {
  if (state.needs.some((need) => need.kind === kind && need.status === "open")) return;
  const previous = state.needs.filter((need) => need.kind === kind && need.target_id === targetId).length;
  const need = ensureNeed(state, kind, targetId, `${stage}:${previous}`);
  need.stage = stage;
}

export function registerAttemptFailure(state, need) {
  need.attempts += 1;
  const mutations = [`need:${need.id}`];
  if (need.attempts < state.config.max_attempts_per_need) return mutations;
  need.status = "exhausted";
  const target = nodeById(state, need.target_id);

  if (need.kind === "PROPOSE") {
    if (target?.kind === "question" && target.status === "open") {
      target.status = "abandoned";
      mutations.push(`node:${target.id}`);
    } else if (target?.kind === "proposal" && target.status === "revision_requested") {
      target.status = "rejected";
      mutations.push(`node:${target.id}`);
      const question = linkedQuestion(state, target.id);
      if (question && question.status !== "answered") {
        question.status = "abandoned";
        mutations.push(`node:${question.id}`);
      }
    }
  }

  if (need.kind === "REVIEW" && target?.status === "unreviewed") {
    target.status = "rejected";
    mutations.push(`node:${target.id}`);
    if (target.kind === "proposal") {
      const question = linkedQuestion(state, target.id);
      if (question && question.status !== "answered") {
        question.status = "abandoned";
        mutations.push(`node:${question.id}`);
      }
    }
  }

  if (need.kind === "SYNTHESIZE" && target?.kind === "synthesis" && target.status === "revision_requested") {
    target.status = "rejected";
    mutations.push(`node:${target.id}`);
  }
  return mutations;
}

export function deriveNeeds(state) {
  for (const need of state.needs) {
    if (need.status === "open" && !conditionStillHolds(state, need)) need.status = "resolved";
  }

  for (const node of state.nodes) {
    if (["proposal", "synthesis"].includes(node.kind) && node.status === "unreviewed") {
      ensureNeed(state, "REVIEW", node.id);
    }
    if (node.kind === "proposal" && node.status === "revision_requested") {
      ensureFreshNeed(state, "PROPOSE", node.id, node.created_event);
    }
    if (node.kind === "synthesis" && node.status === "revision_requested") {
      ensureFreshNeed(state, "SYNTHESIZE", node.id, node.created_event);
    }
    if (node.kind === "question" && node.status === "open") {
      ensureNeed(state, "PROPOSE", node.id);
    }
  }

  const goal = state.nodes.find((node) => node.kind === "goal");
  const accepted = state.nodes.filter((node) => node.kind === "proposal" && node.status === "accepted");
  const synthesisAccepted = state.nodes.some((node) => node.kind === "synthesis" && node.status === "accepted");
  const active = state.nodes.some((node) =>
    (node.kind === "question" && ["open", "under_review"].includes(node.status))
    || (["proposal", "synthesis"].includes(node.kind) && ["unreviewed", "revision_requested"].includes(node.status)),
  );

  if (!synthesisAccepted && !active) {
    if (accepted.length >= state.config.target_proposals) {
      ensureFreshNeed(state, "SYNTHESIZE", goal.id, accepted.length);
    } else {
      ensureFreshNeed(state, "QUESTION", goal.id, accepted.length);
    }
  }

  return state.needs
    .filter((need) => need.status === "open")
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function canGrow(state) {
  if (state.energy_spent >= state.config.energy_budget) return false;
  if (state.generation >= state.config.max_generations) return false;
  return deriveNeeds(state).length > 0;
}
