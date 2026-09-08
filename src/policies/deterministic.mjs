export class DeterministicPolicy {
  name = "deterministic-triad-v2";

  async propose(view) {
    const need = view.need;
    if (need.kind === "QUESTION") {
      const ordinal = view.accepted_proposals.length + view.negative_traces.length + 1;
      return { type: "ADD_QUESTION", need_id: need.id, payload: { text: `Open question ${ordinal}?` } };
    }
    if (need.kind === "PROPOSE") {
      const ordinal = view.accepted_proposals.length + view.negative_traces.length + 1;
      return {
        type: "ADD_PROPOSAL",
        need_id: need.id,
        payload: { text: `Proposal ${ordinal}: ${view.question?.text ?? view.target.text}` },
      };
    }
    if (need.kind === "REVIEW") {
      return {
        type: "REVIEW",
        need_id: need.id,
        payload: { target_id: view.target.id, verdict: "ACCEPT", text: "ACCEPT: deterministic review." },
      };
    }
    if (need.kind === "SYNTHESIZE") {
      return {
        type: "ADD_SYNTHESIS",
        need_id: need.id,
        payload: {
          text: view.accepted_proposals.map((proposal) => proposal.text).join(" "),
          proposal_ids: view.accepted_proposals.map((proposal) => proposal.id),
        },
      };
    }
    return { type: "ABSTAIN", need_id: need.id, payload: { reason: "unknown need" } };
  }
}
