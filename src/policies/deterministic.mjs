export class DeterministicPolicy {
  name = "deterministic-demo-v1";

  async propose(view) {
    const need = view.need;
    if (need.kind === "EXPLORE") {
      const used = new Set(view.supported_claims.map((claim) => claim.text.trim().toLowerCase()));
      const observation = view.observations.find((candidate) => !used.has(candidate.text.trim().toLowerCase()));
      if (!observation) {
        const ordinal = view.supported_claims.length + view.negative_traces.length + 1;
        return {
          type: "ADD_CLAIM",
          need_id: need.id,
          payload: { text: `Deterministic proposition ${ordinal} addressing: ${view.goal.text}` },
        };
      }
      return { type: "ADD_CLAIM", need_id: need.id, payload: { text: observation.text } };
    }
    if (need.kind === "VERIFY") {
      const exact = view.observations.find(
        (observation) => observation.text.trim().toLowerCase() === view.target.text.trim().toLowerCase(),
      );
      if (!exact && view.observations.length > 0) {
        return {
          type: "CHALLENGE",
          need_id: need.id,
          payload: { target_id: view.target.id, reason: "No supplied observation directly supports this claim." },
        };
      }
      return {
        type: "SUPPORT",
        need_id: need.id,
        payload: exact
          ? { target_id: view.target.id, observation_ids: [exact.id], rationale: "Exact supplied observation." }
          : { target_id: view.target.id, rationale: "Independent deterministic peer accepted the proposition." },
      };
    }
    if (need.kind === "REPAIR") {
      return { type: "RETRACT", need_id: need.id, payload: { target_id: view.target.id } };
    }
    if (need.kind === "SYNTHESIZE") {
      return {
        type: "SYNTHESIZE",
        need_id: need.id,
        payload: {
          text: view.supported_claims.map((claim) => claim.text).join(" "),
          claim_ids: view.supported_claims.map((claim) => claim.id),
        },
      };
    }
    return { type: "ABSTAIN", need_id: need.id, payload: { reason: "unknown need" } };
  }
}
