import { digest } from "./canonical.mjs";
import { acceptanceMode, requiredSupport } from "./schema.mjs";
import { nodeById } from "./state.mjs";

const PRIORITY = Object.freeze({ REVIEW_FRAGMENT: 40, META_REVIEW: 35, PROPOSE: 30, SYNTHESIZE: 20, QUESTION: 10 });
const PERSPECTIVES = Object.freeze(["adversarial", "charitable", "coherence"]);

export function reviewPerspective(stage) {
  return PERSPECTIVES[stage] ?? null;
}

function linkedQuestion(state, proposalId) {
  const edge = state.edges.find((candidate) => candidate.from === proposalId && candidate.relation === "answers");
  return edge ? nodeById(state, edge.to) : null;
}

function reviewFragments(state, targetId) {
  const ids = new Set(
    state.edges.filter((edge) => edge.to === targetId && edge.relation === "reviews").map((edge) => edge.from),
  );
  return state.nodes.filter((node) => ids.has(node.id) && node.kind === "review_fragment");
}

function panelNeeds(state, targetId) {
  return state.needs.filter((need) => need.kind === "REVIEW_FRAGMENT" && need.target_id === targetId);
}

export function panelComplete(state, targetId) {
  const panel = panelNeeds(state, targetId);
  return panel.length === PERSPECTIVES.length && panel.every((need) => need.status !== "open");
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
  if (need.kind === "REVIEW_FRAGMENT") {
    const perspective = reviewPerspective(need.stage);
    return ["proposal", "synthesis"].includes(target.kind)
      && target.status === "unreviewed"
      && !reviewFragments(state, target.id).some((fragment) => fragment.perspective === perspective);
  }
  if (need.kind === "META_REVIEW") {
    return ["proposal", "synthesis"].includes(target.kind) && target.status === "unreviewed" && panelComplete(state, target.id);
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
  const need = { id, kind, target_id: targetId, status: "open", attempts: 0, created_generation: state.generation, priority: PRIORITY[kind] };
  state.needs.push(need);
  return need;
}

function ensureFreshNeed(state, kind, targetId, stage) {
  if (state.needs.some((need) => need.kind === kind && need.status === "open")) return;
  // Only a need that produced work advances the discriminator. An exhausted need
  // therefore keeps its id and stays exhausted, so repeated invalid output inhibits
  // this gradient instead of minting an identical need under a fresh hash forever.
  const completed = state.needs.filter(
    (need) => need.kind === kind && need.target_id === targetId && need.status === "resolved",
  ).length;
  const need = ensureNeed(state, kind, targetId, `${stage}:${completed}`);
  need.stage = stage;
}

function ensureReviewPanel(state, targetId) {
  for (let stage = 0; stage < PERSPECTIVES.length; stage += 1) {
    const need = ensureNeed(state, "REVIEW_FRAGMENT", targetId, String(stage));
    need.stage = stage;
  }
}

function citedObservations(state, fragmentId) {
  return state.edges.filter((edge) => edge.from === fragmentId && edge.relation === "cites").map((edge) => edge.to);
}

// The verdict nobody casts. Once a review panel is complete, the gate reads what
// the panel accumulated — which observations were cited in support, and whether
// any reviewer found a contradiction — and derives the outcome from that. No cell
// is asked for an opinion, and the decision is a property of the traces, not of
// whichever cell happened to run last.
export function citationVerdict(state, target) {
  const fragments = reviewFragments(state, target.id);
  if (fragments.some((fragment) => fragment.stance === "contradicts")) return "REVISE";
  const supporting = new Set();
  for (const fragment of fragments) {
    if (fragment.stance !== "supports") continue;
    for (const id of citedObservations(state, fragment.id)) supporting.add(id);
  }
  return supporting.size >= requiredSupport(state) ? "ACCEPT" : "REJECT";
}

// Applies that derived verdict, mirroring the transitions a META_REVIEW would make.
export function resolveByCitations(state, target) {
  if (acceptanceMode(state) !== "citation") return null;
  if (!["proposal", "synthesis"].includes(target.kind) || target.status !== "unreviewed") return null;
  if (!panelComplete(state, target.id)) return null;
  const verdict = citationVerdict(state, target);
  const mutations = [`node:${target.id}`];
  target.status = verdict === "ACCEPT" ? "accepted" : verdict === "REVISE" ? "revision_requested" : "rejected";
  if (target.kind === "proposal") {
    const question = linkedQuestion(state, target.id);
    if (question) {
      question.status = verdict === "ACCEPT" ? "answered" : verdict === "REJECT" ? "abandoned" : "under_review";
      mutations.push(`node:${question.id}`);
    }
  } else if (verdict === "ACCEPT") {
    const goal = state.nodes.find((node) => node.kind === "goal");
    goal.status = "accepted";
    mutations.push(`node:${goal.id}`);
  }
  return { verdict, mutations };
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

  if (need.kind === "REVIEW_FRAGMENT" && target) {
    const resolved = resolveByCitations(state, target);
    if (resolved) mutations.push(...resolved.mutations);
  }

  if (need.kind === "META_REVIEW" && target?.status === "unreviewed") {
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
      ensureReviewPanel(state, node.id);
      if (panelComplete(state, node.id) && acceptanceMode(state) === "verdict") ensureNeed(state, "META_REVIEW", node.id);
    }
    if (node.kind === "proposal" && node.status === "revision_requested") ensureFreshNeed(state, "PROPOSE", node.id, node.created_event);
    if (node.kind === "synthesis" && node.status === "revision_requested") ensureFreshNeed(state, "SYNTHESIZE", node.id, node.created_event);
    if (node.kind === "question" && node.status === "open") ensureNeed(state, "PROPOSE", node.id);
  }

  const goal = state.nodes.find((node) => node.kind === "goal");
  const accepted = state.nodes.filter((node) => node.kind === "proposal" && node.status === "accepted");
  const synthesisAccepted = state.nodes.some((node) => node.kind === "synthesis" && node.status === "accepted");
  const active = state.nodes.some((node) =>
    (node.kind === "question" && ["open", "under_review"].includes(node.status))
    || (["proposal", "synthesis"].includes(node.kind) && ["unreviewed", "revision_requested"].includes(node.status)),
  );

  if (!synthesisAccepted && !active) {
    if (accepted.length >= state.config.target_proposals) ensureFreshNeed(state, "SYNTHESIZE", goal.id, accepted.length);
    else ensureFreshNeed(state, "QUESTION", goal.id, accepted.length);
  }

  return state.needs
    .filter((need) => need.status === "open")
    .sort((a, b) => b.priority - a.priority || (a.stage ?? 0) - (b.stage ?? 0) || a.id.localeCompare(b.id));
}

export function canGrow(state) {
  if (state.energy_spent >= state.config.energy_budget) return false;
  if (state.generation >= state.config.max_generations) return false;
  return deriveNeeds(state).length > 0;
}
