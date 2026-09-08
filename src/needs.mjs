import { digest } from "./canonical.mjs";
import { nodeById } from "./state.mjs";

const PRIORITY = Object.freeze({ REPAIR: 40, VERIFY: 30, SYNTHESIZE: 20, EXPLORE: 10 });

function conditionStillHolds(state, need) {
  const target = nodeById(state, need.target_id);
  if (!target) return false;
  if (need.kind === "VERIFY") return target.kind === "claim" && target.status === "unverified";
  if (need.kind === "REPAIR") return target.kind === "claim" && target.status === "challenged";
  if (need.kind === "SYNTHESIZE") {
    const supported = state.nodes.filter((node) => node.kind === "claim" && node.status === "supported");
    return supported.length >= state.config.target_claims && !state.nodes.some((node) => node.kind === "synthesis");
  }
  if (need.kind === "EXPLORE") {
    const viable = state.nodes.filter((node) => node.kind === "claim" && !["retracted", "superseded"].includes(node.status));
    return viable.length < state.config.target_claims;
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

function ensureExploreNeed(state, targetId, viableCount) {
  if (state.needs.some((need) => need.kind === "EXPLORE" && need.status === "open")) return;
  const sameStage = state.needs.filter(
    (need) => need.kind === "EXPLORE" && need.target_id === targetId && need.stage === viableCount,
  );
  if (sameStage.some((need) => need.status === "exhausted")) return;
  const need = ensureNeed(state, "EXPLORE", targetId, `${viableCount}:${sameStage.length}`);
  need.stage = viableCount;
}

export function deriveNeeds(state) {
  for (const need of state.needs) {
    if (need.status === "open" && !conditionStillHolds(state, need)) need.status = "resolved";
  }

  for (const claim of state.nodes.filter((node) => node.kind === "claim")) {
    if (claim.status === "unverified") ensureNeed(state, "VERIFY", claim.id);
    if (claim.status === "challenged") ensureNeed(state, "REPAIR", claim.id);
  }

  const goal = state.nodes.find((node) => node.kind === "goal");
  const viableClaims = state.nodes.filter(
    (node) => node.kind === "claim" && !["retracted", "superseded"].includes(node.status),
  );
  const supportedClaims = viableClaims.filter((node) => node.status === "supported");
  const activeUnverified = viableClaims.some((node) => ["unverified", "challenged"].includes(node.status));

  if (viableClaims.length < state.config.target_claims) {
    ensureExploreNeed(state, goal.id, viableClaims.length);
  } else if (!activeUnverified && supportedClaims.length >= state.config.target_claims) {
    ensureNeed(state, "SYNTHESIZE", goal.id, String(supportedClaims.length));
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
