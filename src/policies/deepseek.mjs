// A cell backed by a large hosted model, for the one question the local runs
// could not answer: whether the wall the capability ladder measures is a
// property of this architecture or of a 360M-to-1.7B model.
//
// Three things differ from SmolLmPolicy, and each of them costs a measurement.
//
// There is no teacher-forced scoring here: the OpenAI-format API returns
// log-probabilities only for tokens it generated, never for a continuation the
// caller supplies. Every choice this policy makes is therefore generated and
// parsed back against a closed set, which is the path 006 and 009 took and the
// scored path was built to escape. A large model is expected to hold the
// format; whether it does is part of what this measures.
//
// Determinism is not available. The local runs decode greedily and locally, so
// an identical prompt returns identical bytes and every difference between two
// arms is the prompt. A hosted model gives no such guarantee at any
// temperature, so run-to-run spread has to be measured before any arm
// comparison is read — budget-review's gold-recall branch found a prompt effect
// that was entirely that spread.
//
// And thinking mode is on by default at effort "high". That is not the same
// cell the local runs used, so the mode is part of the policy name and both
// settings are run.
const BASE_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-flash";
const RELATIONS = ["requires", "refines", "contradicts", "unrelated"];

function bullets(items) {
  return items.map((item) => `- ${item.text}`);
}

export class DeepSeekPolicy {
  constructor(options = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.thinking = options.thinking ?? false;
    this.effort = options.effort ?? "high";
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!this.apiKey) throw new Error("DEEPSEEK_API_KEY is not set");
    // The key never reaches the policy name, and the name is what the receipt
    // records: the model, the thinking setting and nothing else.
    this.name = `${this.model}:thinking-${this.thinking ? this.effort : "off"}:v1`;
    this.calls = 0;
    this.tokens = { prompt: 0, completion: 0, reasoning: 0 };
  }

  async chat(messages, maxTokens) {
    const body = {
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0,
      thinking: { type: this.thinking ? "enabled" : "disabled" },
      ...(this.thinking ? { reasoning_effort: this.effort } : {}),
    };
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await fetch(BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`deepseek ${response.status}`);
        const payload = await response.json();
        const usage = payload.usage ?? {};
        this.calls += 1;
        this.tokens.prompt += usage.prompt_tokens ?? 0;
        this.tokens.completion += usage.completion_tokens ?? 0;
        this.tokens.reasoning += usage.completion_tokens_details?.reasoning_tokens ?? 0;
        return (payload.choices?.[0]?.message?.content ?? "").trim();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  // Only a relation the model actually named counts. Experiment 001 recorded a
  // citation the adapter had chosen while the model said something else; reading
  // the answer rather than assuming it is what keeps that from recurring.
  static relationFrom(text) {
    const lower = text.toLowerCase();
    const found = RELATIONS.filter((relation) => new RegExp(`\\b${relation}\\b`).test(lower));
    return found.length === 1 ? found[0] : null;
  }

  async propose(view) {
    const { need } = view;

    if (view.role === "relator") {
      const answer = await this.chat([
        { role: "system", content: `You relate two statements about reading a text. Answer with exactly one of: ${RELATIONS.join(", ")}. Output that one word and nothing else.` },
        { role: "user", content: [`A: ${view.target.text}`, `B: ${view.pair.text}`, `How does A relate to B? Answer ${RELATIONS.slice(0, 3).join(", ")} or ${RELATIONS[3]}.`].join("\n") },
      ], this.thinking ? 2048 : 32);
      const relation = DeepSeekPolicy.relationFrom(answer);
      return {
        action: relation
          ? { type: "ADD_RELATION", need_id: need.id, payload: { from_id: view.target.id, to_id: view.pair.id, relation } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "answer named no single relation from the closed set" } },
        trace: { raw_output: answer, relation },
      };
    }

    if (view.role === "quoter") {
      const answer = await this.chat([
        { role: "system", content: "You copy text. Reply with one sentence copied word for word from the passage below.\nChange nothing, translate nothing, explain nothing. Output only the sentence." },
        { role: "user", content: [
          `Passage:\n${view.target.text}`,
          ...(view.accepted_proposals.length ? ["Already in the register; copy a different sentence:", ...bullets(view.accepted_proposals)] : []),
        ].join("\n") },
      ], this.thinking ? 2048 : 220);
      return {
        action: answer
          ? { type: "ADD_PROPOSAL", need_id: need.id, payload: { text: answer } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty quote" } },
        trace: { raw_output: answer },
      };
    }

    return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: `deepseek policy has no ${need.kind} role` } }, trace: null };
  }
}
