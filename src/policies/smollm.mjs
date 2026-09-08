const DEFAULT_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";
const DEFAULT_REVISION = "12fd25f77366fa6b3b4b768ec3050bf629380bac";
const DEFAULT_META_MODEL = "HuggingFaceTB/SmolLM2-360M-Instruct";
const DEFAULT_META_REVISION = "a10cc1512eabd3dde888204e902eca88bddb4951";
const FALLBACK_MAX_TEXT_CHARS = 1200;

function cleanText(text, max) {
  return text.trim().replace(/^```(?:json|text)?\s*/i, "").replace(/```\s*$/, "").slice(0, max).trim();
}

function bullets(items) {
  return items.map((item) => `- ${item.text}`);
}

// The meta-reviewer is asked for the verdict first, so only the first line counts.
// A verdict buried in prose is not a decision the collective actually reached.
function reviewVerdict(text) {
  const head = text.toUpperCase().trimStart().split(/\r?\n/, 1)[0];
  const body = head.replace(/^\W*(?:VERDICT|META[- ]REVIEW)\W*/, "");
  return body.match(/^\W*(ACCEPT|REVISE|REJECT)\b/)?.[1] ?? null;
}

// The attempt count belongs to the need, not to the cell reading it: cells are
// short-lived and share no memory of one another. Greedy decoding still makes an
// unchanged prompt reproduce the output that just failed, so the state of the
// gradient has to enter the prompt for a repeated attempt to differ at all.
function retryDirective(attempts) {
  if (attempts <= 0) return [];
  if (attempts === 1) return ["This need carries one rejected attempt. Take a different approach and keep to the required format."];
  return ["This need carries two rejected attempts. Give the shortest answer that still keeps the required format."];
}

export class SmolLmPolicy {
  constructor(options = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.revision = options.revision ?? DEFAULT_REVISION;
    this.dtype = options.dtype ?? "q4";
    this.metaModel = options.metaModel ?? DEFAULT_META_MODEL;
    this.metaRevision = options.metaRevision ?? DEFAULT_META_REVISION;
    this.metaDtype = options.metaDtype ?? this.dtype;
    this.name = `${this.model}@${this.revision}:${this.dtype}+meta:${this.metaModel}@${this.metaRevision}:${this.metaDtype}:review-collective-v5-chat`;
    this.generators = new Map();
  }

  async load(role = "cell") {
    if (this.generators.has(role)) return this.generators.get(role);
    const { pipeline, env } = await import("@huggingface/transformers");
    if (process.env.HF_HOME) env.cacheDir = process.env.HF_HOME;
    const model = role === "meta" ? this.metaModel : this.model;
    const revision = role === "meta" ? this.metaRevision : this.revision;
    const dtype = role === "meta" ? this.metaDtype : this.dtype;
    const generator = await pipeline("text-generation", model, { revision, dtype });
    this.generators.set(role, generator);
    return generator;
  }

  // These are instruction-tuned models. The pipeline only applies their chat
  // template when it is handed a message array; a plain string is completed as
  // raw text, which is why earlier experiments recorded prompt continuations
  // instead of answers.
  async generate(messages, maxNewTokens = 64, role = "cell") {
    const generator = await this.load(role);
    const output = await generator(messages, {
      max_new_tokens: maxNewTokens,
      do_sample: false,
      repetition_penalty: 1.08,
    });
    const generated = output?.[0]?.generated_text;
    if (Array.isArray(generated)) return generated.at(-1)?.content ?? "";
    if (typeof generated === "string") return generated;
    return String(generated ?? "");
  }

  async propose(view) {
    const need = view.need;
    const maxChars = view.max_text_chars ?? FALLBACK_MAX_TEXT_CHARS;
    const retry = retryDirective(need.attempts ?? 0);
    const ask = async (system, user, maxNewTokens, role = "cell") => cleanText(
      await this.generate(
        [
          { role: "system", content: [system, ...retry].join("\n") },
          { role: "user", content: user.join("\n") },
        ],
        maxNewTokens,
        role,
      ),
      maxChars,
    );

    if (need.kind === "QUESTION") {
      const text = await ask(
        [
          "You are the questioning cell. Do not answer the goal.",
          "Ask one concise new question whose answer could advance the goal.",
          "Output only that question, in the language of the goal.",
        ].join("\n"),
        [
          `Goal: ${view.goal.text}`,
          ...(view.accepted_proposals.length ? ["Accepted work:", ...bullets(view.accepted_proposals)] : []),
          ...(view.negative_traces.length ? ["Failed paths; ask something different:", ...bullets(view.negative_traces)] : []),
        ],
        64,
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
        [
          "You are the proposing cell. Answer the question with one concise philosophical proposal.",
          "Output only the proposal, in the language of the goal.",
        ].join("\n"),
        [
          `Goal: ${view.goal.text}`,
          `Question: ${view.question?.text ?? view.target.text}`,
          ...(view.reviews.length ? ["Review to address:", ...bullets(view.reviews)] : []),
          ...(view.accepted_proposals.length ? ["Already accepted:", ...bullets(view.accepted_proposals)] : []),
          ...(view.negative_traces.length ? ["Failed paths; do not repeat:", ...bullets(view.negative_traces)] : []),
        ],
        96,
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
      const text = await ask(
        [
          `You are the ${view.perspective} reviewer in a three-reviewer collective.`,
          instruction,
          "Do not give a verdict. Leave one concise review note in the language of the goal.",
        ].join("\n"),
        [
          `Goal: ${view.goal.text}`,
          ...(view.question ? [`Question: ${view.question.text}`] : []),
          `${view.target.kind === "synthesis" ? "Synthesis" : "Proposal"}: ${view.target.text}`,
          ...(view.accepted_proposals.length ? ["Previously accepted work:", ...bullets(view.accepted_proposals)] : []),
          ...(view.negative_traces.length ? ["Earlier failed paths:", ...bullets(view.negative_traces)] : []),
        ],
        80,
      );
      return {
        action: text
          ? { type: "ADD_REVIEW_FRAGMENT", need_id: need.id, payload: { target_id: view.target.id, text } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty review fragment" } },
        trace: { raw_output: text },
      };
    }

    if (need.kind === "META_REVIEW") {
      const text = await ask(
        [
          "You are the meta-reviewer. Judge the work after reading all independent review notes.",
          "Your first word must be ACCEPT, REVISE or REJECT. Then give one concise reason.",
        ].join("\n"),
        [
          `Goal: ${view.goal.text}`,
          ...(view.question ? [`Question: ${view.question.text}`] : []),
          `${view.target.kind === "synthesis" ? "Synthesis" : "Proposal"}: ${view.target.text}`,
          "Review collective:",
          ...view.review_fragments.map((fragment) => `- ${fragment.perspective}: ${fragment.text}`),
        ],
        96,
        "meta",
      );
      const verdict = reviewVerdict(text);
      return {
        action: verdict
          ? { type: "META_REVIEW", need_id: need.id, payload: { target_id: view.target.id, verdict, text } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "meta-review did not open with a verdict" } },
        trace: { raw_output: text },
      };
    }

    if (need.kind === "SYNTHESIZE") {
      const text = await ask(
        [
          "You are the proposing cell. Form a concise coherent philosophy that answers the goal.",
          "Use the accepted work below. Output only the philosophy, in the language of the goal.",
        ].join("\n"),
        [
          `Goal: ${view.goal.text}`,
          ...bullets(view.accepted_proposals),
          ...(view.reviews.length ? ["Review to address:", ...bullets(view.reviews)] : []),
        ],
        200,
      );
      return {
        action: text
          ? {
              type: "ADD_SYNTHESIS",
              need_id: need.id,
              payload: { text, proposal_ids: view.accepted_proposals.map((proposal) => proposal.id) },
            }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty synthesis" } },
        trace: { raw_output: text },
      };
    }

    return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "unknown need" } }, trace: null };
  }
}

export const smolLmDefaults = {
  model: DEFAULT_MODEL,
  revision: DEFAULT_REVISION,
  metaModel: DEFAULT_META_MODEL,
  metaRevision: DEFAULT_META_REVISION,
};
