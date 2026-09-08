import { writeFile } from "node:fs/promises";
import { applyProposal } from "./gate.mjs";
import { makeReceipt, appendReceipt } from "./ledger.mjs";
import { buildLocalView } from "./local-view.mjs";
import { canGrow, deriveNeeds } from "./needs.mjs";
import { validateState } from "./schema.mjs";
import { writeState } from "./state.mjs";

function cellId(state, need, ordinal) {
  return `cell-g${String(state.generation).padStart(3, "0")}-${String(ordinal).padStart(2, "0")}-${need.kind.toLowerCase()}`;
}

export async function runGeneration({ state, statePath, eventsPath, policy, maxCells }) {
  deriveNeeds(state);
  const limit = Math.min(maxCells ?? state.config.max_cells_per_generation, state.config.max_cells_per_generation);
  const outcomes = [];

  for (let ordinal = 1; ordinal <= limit && canGrow(state); ordinal += 1) {
    const need = deriveNeeds(state)[0];
    if (!need) break;
    const { view, hash: localViewHash } = buildLocalView(state, need);
    let proposal;
    let policyTrace = null;
    try {
      const proposed = await policy.propose(view);
      if (proposed?.action) {
        proposal = proposed.action;
        policyTrace = proposed.trace ?? null;
      } else {
        proposal = proposed;
      }
    } catch (error) {
      proposal = {
        type: "ABSTAIN",
        need_id: need.id,
        payload: { reason: `policy_error:${error.name}` },
      };
      policyTrace = { error: error.message.slice(0, state.config.max_text_chars) };
    }

    const eventSeq = state.next_event_seq;
    const decision = applyProposal(state, proposal, eventSeq);
    if (!decision.accepted) {
      need.attempts += 1;
      if (need.attempts >= state.config.max_attempts_per_need) need.status = "exhausted";
    }
    state.energy_spent += 1;
    deriveNeeds(state);
    const receipt = makeReceipt(state, {
      cellId: cellId(state, need, ordinal),
      needId: need.id,
      policy: policy.name,
      policyTrace,
      localViewHash,
      proposal,
      decision,
    });
    state.ledger_head = receipt.hash;
    state.next_event_seq += 1;
    validateState(state);
    await appendReceipt(eventsPath, receipt);
    await writeState(statePath, state);
    outcomes.push({ cell_id: receipt.cell_id, need: need.kind, decision: decision.code });
  }

  state.generation += 1;
  deriveNeeds(state);
  await writeState(statePath, state);
  return { outcomes, can_grow: canGrow(state), generation: state.generation };
}

export async function resetLedger(path) {
  await writeFile(path, "", "utf8");
}
