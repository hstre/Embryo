import { applyProposal } from "./gate.mjs";
import { makeReceipt, validateLedger } from "./ledger.mjs";
import { buildLocalView } from "./local-view.mjs";
import { deriveNeeds, registerAttemptFailure } from "./needs.mjs";
import { createState } from "./state.mjs";

export function replay(seed, receipts, expectedGeneration) {
  validateLedger(receipts);
  const state = createState(seed);
  for (const recorded of receipts) {
    state.generation = recorded.generation;
    deriveNeeds(state);
    const need = state.needs.find((candidate) => candidate.id === recorded.need_id && candidate.status === "open");
    if (!need) throw new Error(`replay cannot find open need ${recorded.need_id}`);
    const { hash: localViewHash } = buildLocalView(state, need);
    if (localViewHash !== recorded.local_view_hash) throw new Error(`local view mismatch at event ${recorded.seq}`);
    const decision = applyProposal(state, recorded.proposal, state.next_event_seq);
    if (!decision.accepted) {
      decision.mutations.push(...registerAttemptFailure(state, need));
    }
    state.energy_spent += 1;
    deriveNeeds(state);
    const rebuilt = makeReceipt(state, {
      cellId: recorded.cell_id,
      needId: recorded.need_id,
      policy: recorded.policy,
      policyTrace: recorded.policy_trace,
      localViewHash,
      proposal: recorded.proposal,
      decision,
    });
    if (rebuilt.hash !== recorded.hash) throw new Error(`receipt mismatch at event ${recorded.seq}`);
    state.ledger_head = rebuilt.hash;
    state.next_event_seq += 1;
  }
  // The generation counter is bumped once a generation has run every one of its cells,
  // so the ledger alone cannot tell a completed generation from an interrupted one: both
  // leave the same receipts. Accept the persisted counter when it is one of those two
  // values instead of assuming the run finished.
  const last = receipts.length === 0 ? -1 : Math.max(...receipts.map((receipt) => receipt.generation));
  if (expectedGeneration === undefined) {
    state.generation = last + 1;
  } else {
    if (expectedGeneration !== last + 1 && expectedGeneration !== Math.max(last, 0)) {
      throw new Error(`persisted generation ${expectedGeneration} is not reachable from the ledger`);
    }
    state.generation = expectedGeneration;
  }
  deriveNeeds(state);
  return state;
}
