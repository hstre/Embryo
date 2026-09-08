import { applyProposal } from "./gate.mjs";
import { makeReceipt, validateLedger } from "./ledger.mjs";
import { buildLocalView } from "./local-view.mjs";
import { deriveNeeds } from "./needs.mjs";
import { createState } from "./state.mjs";

export function replay(seed, receipts) {
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
      need.attempts += 1;
      if (need.attempts >= state.config.max_attempts_per_need) need.status = "exhausted";
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
  state.generation = receipts.length === 0 ? 0 : Math.max(...receipts.map((receipt) => receipt.generation)) + 1;
  deriveNeeds(state);
  return state;
}
