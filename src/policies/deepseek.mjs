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
import { citationFrom } from "./smollm.mjs";

const BASE_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-flash";
const RELATIONS = ["requires", "refines", "contradicts", "unrelated"];
const VERDICTS = ["ACCEPT", "REVISE", "REJECT"];
const FALLBACK_MAX_TEXT_CHARS = 1200;

function bullets(items) {
  return items.map((item) => `- ${item.text}`);
}

function clean(text, max) {
  return text.trim().replace(/^```(?:json|text)?\s*/i, "").replace(/```\s*$/, "").slice(0, max).trim();
}

// Mirrors SmolLmPolicy's directive word for word: the state of the gradient has
// to enter the prompt, because a cell keeps no memory of the attempt before it.
function retryDirective(attempts) {
  if (attempts <= 0) return [];
  if (attempts === 1) return ["This need carries one rejected attempt. Take a different approach and keep to the required format."];
  return ["This need carries two rejected attempts. Give the shortest answer that still keeps the required format."];
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
        // max_tokens counts the reasoning trace as well as the answer, so a
        // budget that fits the answer can still return an empty one. Run 026's
        // first attempt lost six relations that way and was discarded; a
        // truncated reply is an error here, not a silent abstention.
        if (payload.choices?.[0]?.finish_reason === "length" && !payload.choices?.[0]?.message?.content) {
          throw new Error(`deepseek truncated before any content (reasoning ${usage.completion_tokens_details?.reasoning_tokens ?? "?"} of ${maxTokens})`);
        }
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
  // Same discipline as the citation: the verdict has to be one the model wrote.
  static verdictFrom(text) {
    const upper = text.toUpperCase();
    const found = VERDICTS.filter((verdict) => new RegExp(`\\b${verdict}`).test(upper));
    return found.length === 1 ? found[0] : null;
  }

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
      ], this.thinking ? 16384 : 32);
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
      ], this.thinking ? 16384 : 220);
      return {
        action: answer
          ? { type: "ADD_PROPOSAL", need_id: need.id, payload: { text: answer } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty quote" } },
        trace: { raw_output: answer },
      };
    }

    // --- the original goal's roles, worded as SmolLmPolicy words them ---
    const maxChars = view.max_text_chars ?? FALLBACK_MAX_TEXT_CHARS;
    const retry = retryDirective(need.attempts ?? 0);
    const budget = (plain) => (this.thinking ? 16384 : plain);
    const ask = async (system, lines, plain) =>
      clean(await this.chat([
        { role: "system", content: [system, ...retry].join("\n") },
        { role: "user", content: lines.join("\n") },
      ], budget(plain)), maxChars);

    if (need.kind === "QUESTION") {
      const text = await ask(
        "You are the questioning cell. Do not answer the goal.\nAsk one concise new question whose answer could advance the goal.\nOutput only that question, in the language of the goal.",
        [
          `Goal: ${view.goal.text}`,
          ...(view.accepted_proposals.length ? ["Accepted work:", ...bullets(view.accepted_proposals)] : []),
          ...(view.negative_traces.length ? ["Failed paths; ask something different:", ...bullets(view.negative_traces)] : []),
        ],
        256,
      );
      return {
        action: text
          ? { type: "ADD_QUESTION", need_id: need.id, payload: { text } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty question" } },
        trace: { raw_output: text },
      };
    }

    if (need.kind === "PROPOSE") {
      const text = await ask(
        "You are the proposing cell. Answer the question with one concise philosophical proposal.\nOutput only the proposal, in the language of the goal.",
        [
          `Goal: ${view.goal.text}`,
          `Question: ${view.question?.text ?? view.target.text}`,
          ...(view.reviews.length ? ["Review to address:", ...bullets(view.reviews)] : []),
          ...(view.accepted_proposals.length ? ["Already accepted:", ...bullets(view.accepted_proposals)] : []),
          ...(view.negative_traces.length ? ["Failed paths; do not repeat:", ...bullets(view.negative_traces)] : []),
        ],
        512,
      );
      return {
        action: text
          ? { type: "ADD_PROPOSAL", need_id: need.id, payload: { text } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty proposal" } },
        trace: { raw_output: text },
      };
    }

    if (need.kind === "REVIEW_FRAGMENT") {
      const instruction = view.perspective === "adversarial"
        ? "Find the strongest concrete objection or unanswered issue."
        : view.perspective === "charitable"
          ? "Identify the strongest contribution and the one improvement it most needs."
          : "Compare it with accepted work and identify contradiction, repetition, or a missing connection.";
      const citing = view.acceptance_mode === "citation" && Boolean(view.observations?.length);
      const text = await ask(
        [
          `You are the ${view.perspective} reviewer in a three-reviewer collective.`,
          instruction,
          ...(citing
            ? [
                "Name exactly one observation id from the list and write either SUPPORTS or CONTRADICTS.",
                "Then give one short sentence. Do not invent an id that is not in the list.",
                "Format: <observation-id> SUPPORTS|CONTRADICTS — <one sentence>",
              ]
            : ["Do not give a verdict. Leave one concise review note in the language of the goal."]),
        ].join("\n"),
        [
          `Goal: ${view.goal.text}`,
          ...(view.question ? [`Question: ${view.question.text}`] : []),
          `${view.target.kind === "synthesis" ? "Synthesis" : "Proposal"}: ${view.target.text}`,
          ...(citing ? ["Observations in the environment:", ...view.observations.map((o) => `- ${o.id}: ${o.text}`)] : []),
          ...(view.accepted_proposals.length ? ["Previously accepted work:", ...bullets(view.accepted_proposals)] : []),
          ...(view.negative_traces.length ? ["Earlier failed paths:", ...bullets(view.negative_traces)] : []),
        ],
        320,
      );
      if (!text) return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty review fragment" } }, trace: { raw_output: text } };
      if (!citing) {
        return { action: { type: "ADD_REVIEW_FRAGMENT", need_id: need.id, payload: { target_id: view.target.id, text } }, trace: { raw_output: text } };
      }
      const citation = citationFrom(text, view.observations);
      return {
        action: citation
          ? { type: "ADD_REVIEW_FRAGMENT", need_id: need.id, payload: { target_id: view.target.id, text, ...citation } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "review named no observation from the environment" } },
        trace: { raw_output: text, citation },
      };
    }

    if (need.kind === "META_REVIEW") {
      const text = await ask(
        "You are the meta-reviewer. Judge the work after reading all independent review notes.\nAnswer with exactly one of ACCEPT, REVISE or REJECT, then give one concise reason.",
        [
          `Goal: ${view.goal.text}`,
          ...(view.question ? [`Question: ${view.question.text}`] : []),
          `${view.target.kind === "synthesis" ? "Synthesis" : "Proposal"}: ${view.target.text}`,
          "Review collective:",
          ...view.review_fragments.map((fragment) => `- ${fragment.perspective}: ${fragment.text}`),
        ],
        320,
      );
      const verdict = DeepSeekPolicy.verdictFrom(text);
      if (!verdict) return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "answer named no single verdict" } }, trace: { raw_output: text } };
      // The verdict is structured data already; repeating the label inside the
      // recorded text made a proposing cell copy it into its revision.
      const reason = clean(text.replace(new RegExp(`^[^A-Za-z]*${verdict}[:\\s—-]*`, "i"), ""), maxChars) || verdict;
      return {
        action: { type: "META_REVIEW", need_id: need.id, payload: { target_id: view.target.id, verdict, text: reason } },
        trace: { raw_output: text, verdict },
      };
    }

    if (need.kind === "SYNTHESIZE") {
      const text = await ask(
        "You are the proposing cell. Form a concise coherent philosophy that answers the goal.\nUse the accepted work below. Output only the philosophy, in the language of the goal.",
        [
          `Goal: ${view.goal.text}`,
          ...bullets(view.accepted_proposals),
          ...(view.reviews.length ? ["Review to address:", ...bullets(view.reviews)] : []),
        ],
        900,
      );
      return {
        action: text
          ? { type: "ADD_SYNTHESIS", need_id: need.id, payload: { text, proposal_ids: view.accepted_proposals.map((proposal) => proposal.id) } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty synthesis" } },
        trace: { raw_output: text },
      };
    }

    return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: `deepseek policy has no ${need.kind} role` } }, trace: null };
  }
}
