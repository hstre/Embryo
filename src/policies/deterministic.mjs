export class DeterministicPolicy {
  name = "deterministic-review-collective-v3";

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
    if (need.kind === "REVIEW_FRAGMENT") {
      const payload = { target_id: view.target.id, text: `${view.perspective}: deterministic review fragment.` };
      if (view.observations?.length) {
        // One distinct observation per perspective, so a complete panel accumulates
        // as many separate citations as it has reviewers.
        const stage = ["adversarial", "charitable", "coherence"].indexOf(view.perspective);
        const observation = view.observations[Math.max(stage, 0) % view.observations.length];
        payload.observation_ids = [observation.id];
        payload.stance = "supports";
      }
      return { type: "ADD_REVIEW_FRAGMENT", need_id: need.id, payload };
    }
    if (need.kind === "META_REVIEW") {
      return {
        type: "META_REVIEW",
        need_id: need.id,
        payload: { target_id: view.target.id, verdict: "ACCEPT", text: "ACCEPT: deterministic collective review." },
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
