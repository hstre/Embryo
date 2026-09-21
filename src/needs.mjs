import { digest } from "./canonical.mjs";
import { acceptanceMode, panelIndependence, relateEnabled, requiredSupport, supportCounts, symmetricContradiction } from "./schema.mjs";
import { nodeById } from "./state.mjs";

const PRIORITY = Object.freeze({ REVIEW_FRAGMENT: 40, META_REVIEW: 35, PROPOSE: 30, RELATE: 25, SYNTHESIZE: 20, QUESTION: 10 });
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
  if (need.kind === "RELATE") {
    const other = nodeById(state, need.pair_id);
    if (!other || target.status !== "accepted" || other.status !== "accepted") return false;
    const key = [target.id, other.id].sort().join("|");
    return !state.edges.some(
      (edge) => RELATION_RELATIONS.has(edge.relation) && [edge.from, edge.to].sort().join("|") === key,
    );
  }
  if (need.kind === "PROPOSE") {
    // In the anchor task a need points at an observation and stays open until
    // some proposal quotes it. Nothing judges; coverage is the only state.
    if (target.kind === "observation") return !quotedObservations(state).has(target.id);
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

// Observations some accepted proposal already quotes. The edge is the record;
// no cell can create one, because only the gate adds it.
export function quotedObservations(state) {
  const quoted = new Set();
  for (const edge of state.edges) {
    if (edge.relation !== "quotes") continue;
    const source = nodeById(state, edge.from);
    if (source?.status === "accepted") quoted.add(edge.to);
  }
  return quoted;
}

function citedObservations(state, fragmentId) {
  return state.edges.filter((edge) => edge.from === fragmentId && edge.relation === "cites").map((edge) => edge.to);
}

// Anti-Delphi accounting, taken from hstre/budget-review, where several reviewer
// arms run over the same claim graph without seeing each other and their
// agreement is consolidated as overlap — recorded, never read as confirmation.
//
// Embryo needs it because its panel is three runs of one model that differ by a
// prompt word, and every arm after the first reads the fragments before it. The
// seed's second premise — "Eine Mehrheit unter ihnen ist kein Beleg, solange die
// Instanzen korreliert sind" — was in the environment from the start and in the
// code nowhere: the old rule counted distinct observations without asking who
// cited them or what that cell had already read.
//
// The ledger classifies every supporting citation:
//   support    the first arm to cite this observation, and independent of the
//              arms before it
//   overlap    a later arm citing the same observation. Between blind arms this
//              is convergence; between sighted arms it may be copying. Either
//              way it adds nothing, and the flag says which case it was.
//   correlated a citation from an arm that could read the arms before it. It may
//              be right. It is not a second instance, so it does not count.
// Only "support" entries meet required_support. Nothing here marks a claim true.
export function supportLedger(state, target) {
  const mode = panelIndependence(state);
  const fragments = reviewFragments(state, target.id)
    .slice()
    .sort((a, b) => a.created_event - b.created_event || a.id.localeCompare(b.id));
  const firstCiter = new Map();
  const support = [];
  const overlap = [];
  const correlated = [];
  const contradictions = [];
  let supportingArms = 0;

  for (const [index, fragment] of fragments.entries()) {
    // A contradiction is a counterexample, not a vote. One arm finding one is
    // informative however many arms agreed, and an arm that dissents after
    // reading agreement is if anything less correlated, not more. So the
    // discount below does not apply to it — but the ledger records whether it
    // was blind, so the receipt does not have to be taken on trust.
    if (fragment.stance === "contradicts") {
      contradictions.push({ fragment_id: fragment.id, perspective: fragment.perspective ?? null, blind: mode === "blind" || supportingArms === 0 });
      continue;
    }
    if (fragment.stance !== "supports") continue;
    // In a sighted panel only the first arm judged on its own. Later arms saw
    // what it cited, so their citations are recorded and not counted.
    const independent = mode === "blind" || supportingArms === 0;
    supportingArms += 1;
    for (const observationId of citedObservations(state, fragment.id)) {
      const entry = { observation_id: observationId, fragment_id: fragment.id, perspective: fragment.perspective ?? null };
      const first = firstCiter.get(observationId);
      if (first !== undefined) {
        overlap.push({ ...entry, first_cited_by: first, independent });
        continue;
      }
      firstCiter.set(observationId, fragment.id);
      if (independent) support.push(entry);
      // Creation order, not the event counter: two fragments can share an event
      // sequence, and the node ids are minted in order either way.
      else correlated.push({ ...entry, could_have_read: fragments.slice(0, index).map((earlier) => earlier.id) });
    }
  }

  // Under "arms" a supporting reviewer counts once, whether or not another
  // reviewer reached the same premise before it — convergence between blind arms
  // stops being worth nothing. The classification above is unchanged, so the
  // ledger still says exactly which observations were shared with whom.
  const byArms = supportCounts(state) === "arms";
  const armSupport = fragments.filter(
    (fragment, index) => fragment.stance === "supports"
      && (mode === "blind" || fragments.slice(0, index).every((earlier) => earlier.stance !== "supports"))
      && citedObservations(state, fragment.id).length > 0,
  ).length;
  const armContradictions = contradictions.filter((entry) => entry.blind).length;

  return {
    mode,
    arms: fragments.length,
    supporting_arms: supportingArms,
    support,
    overlap,
    correlated,
    contradictions,
    ...(byArms ? { counted_by: "arms", independent_supporting_arms: armSupport, independent_contradicting_arms: armContradictions } : {}),
    independent_support: byArms ? armSupport : support.length,
    required_support: requiredSupport(state),
  };
}

// The verdict nobody casts. Once a review panel is complete, the gate reads what
// the panel accumulated — which observations were cited in support, and whether
// any reviewer found a contradiction — and derives the outcome from that. No cell
// is asked for an opinion, and the decision is a property of the traces, not of
// whichever cell happened to run last.
export function citationVerdict(state, target) {
  const fragments = reviewFragments(state, target.id);
  if (symmetricContradiction(state)) {
    // An objection is counted the way support is: by the distinct observations
    // it rests on. One reviewer naming one premise is a note, not a veto.
    if (supportCounts(state) === "arms") {
      // Counted the same way support is, or the asymmetry simply changes sides.
      const arms = supportLedger(state, target).independent_contradicting_arms ?? 0;
      if (arms >= requiredSupport(state)) return "REVISE";
    } else {
      const against = new Set();
      for (const fragment of fragments) {
        if (fragment.stance !== "contradicts") continue;
        for (const id of citedObservations(state, fragment.id)) against.add(id);
      }
      if (against.size >= requiredSupport(state)) return "REVISE";
    }
  } else if (fragments.some((fragment) => fragment.stance === "contradicts")) {
    return "REVISE";
  }
  if (panelIndependence(state) === "sighted") {
    const supporting = new Set();
    for (const fragment of fragments) {
      if (fragment.stance !== "supports") continue;
      for (const id of citedObservations(state, fragment.id)) supporting.add(id);
    }
    return supporting.size >= requiredSupport(state) ? "ACCEPT" : "REJECT";
  }
  const ledger = supportLedger(state, target);
  return ledger.independent_support >= ledger.required_support ? "ACCEPT" : "REJECT";
}

// Applies that derived verdict, mirroring the transitions a META_REVIEW would make.
export function resolveByCitations(state, target) {
  if (acceptanceMode(state) !== "citation") return null;
  if (!["proposal", "synthesis"].includes(target.kind) || target.status !== "unreviewed") return null;
  if (!panelComplete(state, target.id)) return null;
  const verdict = citationVerdict(state, target);
  // Recorded only where the accounting is switched on, so a run from before it
  // existed replays to the same receipt hashes it was written with.
  const ledger = panelIndependence(state) === "sighted" ? null : supportLedger(state, target);
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
  return { verdict, mutations, ...(ledger ? { ledger } : {}) };
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

// The precondition task, derived the same way every other need is: from the
// tissue. One need per observation nobody has quoted yet, in the order the seed
// supplied them, and the goal closes when enough of them are covered. There is
// no question, no review panel and no synthesis — every capability the ladder
// measured as absent is out of the loop, and what is left is the one it
// measured as present.
// Pairs of admitted entries the tissue has not yet decided about, in a fixed
// order so recruitment is a property of the graph and not of call order.
function openPairs(state) {
  const entries = state.nodes
    .filter((node) => node.kind === "proposal" && node.status === "accepted")
    .sort((a, b) => a.created_event - b.created_event || a.id.localeCompare(b.id));
  const decided = new Set(
    state.edges
      .filter((edge) => RELATION_RELATIONS.has(edge.relation))
      .map((edge) => [edge.from, edge.to].sort().join("|")),
  );
  const pairs = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const key = [entries[i].id, entries[j].id].sort().join("|");
      if (!decided.has(key)) pairs.push({ key, from: entries[i], to: entries[j] });
    }
  }
  return pairs;
}

const RELATION_RELATIONS = new Set(["requires", "refines", "contradicts", "unrelated"]);

// Two stages, in the order budget-review's gate states them: admit anchored
// entries, then relations between admitted endpoints. Collecting recruits one
// need per unquoted observation; connecting recruits one need per undecided pair
// of entries. Neither stage asks a cell what anything means.
function deriveAnchorNeeds(state) {
  const quoted = quotedObservations(state);
  const goal = state.nodes.find((node) => node.kind === "goal");
  const collected = quoted.size >= state.config.target_proposals;

  if (!collected) {
    for (const node of state.nodes) {
      if (node.kind !== "observation" || quoted.has(node.id)) continue;
      ensureNeed(state, "PROPOSE", node.id);
    }
  } else {
    // The register is full: collecting stops even where observations are left,
    // because the goal names a number and not the whole environment.
    for (const need of state.needs) if (need.kind === "PROPOSE" && need.status === "open") need.status = "resolved";
  }
  if (collected && relateEnabled(state)) {
    // Connecting starts only once collecting has met its target, so a pair is
    // never proposed against a register that is still filling.
    for (const pair of openPairs(state)) {
      const need = ensureNeed(state, "RELATE", pair.from.id, pair.to.id);
      need.pair_id = pair.to.id;
    }
  }

  // The goal is met by the register reaching its number, never by the tissue
  // running out of things to try. A run that exhausts every need short of the
  // target leaves the goal open, which is what 016 to 021 recorded.
  // With connecting switched on the goal names both verbs, so a register whose
  // pairs are not all decided has not met it. Run 026 closed at four of six
  // pairs under the older rule, which only asked whether anything was still open.
  const open = state.needs.filter((need) => need.status === "open");
  const connected = !relateEnabled(state) || openPairs(state).length === 0;
  if (collected && connected && !open.length) goal.status = "accepted";
  if (!open.length) return [];
  return open.sort((a, b) =>
    b.priority - a.priority
    || (nodeById(state, a.target_id)?.ordinal ?? 0) - (nodeById(state, b.target_id)?.ordinal ?? 0)
    || a.id.localeCompare(b.id));
}

export function deriveNeeds(state) {
  for (const need of state.needs) {
    if (need.status === "open" && !conditionStillHolds(state, need)) need.status = "resolved";
  }
  if (acceptanceMode(state) === "anchor") return deriveAnchorNeeds(state);

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
