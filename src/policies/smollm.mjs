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

const VERDICTS = Object.freeze(["ACCEPT", "REVISE", "REJECT"]);

// Log-probability of one token at one position, read straight off the logits.
function tokenLogProb(logits, position, tokenId) {
  const vocab = logits.dims.at(-1);
  const row = logits.data.subarray(position * vocab, (position + 1) * vocab);
  let max = -Infinity;
  for (let i = 0; i < row.length; i += 1) if (row[i] > max) max = row[i];
  let sum = 0;
  for (let i = 0; i < row.length; i += 1) sum += Math.exp(row[i] - max);
  return row[tokenId] - max - Math.log(sum);
}

// The attempt count belongs to the need, not to the cell reading it: cells are
// short-lived and share no memory of one another. Greedy decoding still makes an
// unchanged prompt reproduce the output that just failed, so the state of the
// gradient has to enter the prompt for a repeated attempt to differ at all.
// The cited id has to be found in what the model actually wrote. Experiment 001
// recorded a citation the adapter had chosen while the model named a different
// observation; parsing from the raw output is what keeps that from recurring.
function citationFrom(text, observations) {
  const upper = text.toUpperCase();
  const stance = /\bCONTRADICT/.test(upper) ? "contradicts" : /\bSUPPORT/.test(upper) ? "supports" : null;
  const observationIds = observations.map((observation) => observation.id).filter((id) => text.includes(id));
  if (!stance || observationIds.length === 0) return null;
  return { stance, observation_ids: observationIds.slice(0, 3) };
}

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
    // "generate" asks the reviewer to write a citation; "score" reads it off the
    // model's distribution over the observations the environment supplies.
    this.citationBy = options.citationBy ?? "generate";
    this.name = `${this.model}@${this.revision}:${this.dtype}+meta:${this.metaModel}@${this.metaRevision}:${this.metaDtype}:review-collective-v7-cite-${this.citationBy}`;
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

  // The verdict is read off the model's own distribution instead of being
  // generated and parsed back out of prose. REVISE and REJECT share their first
  // token ("RE"), so a single-token argmax cannot separate them; each verdict is
  // scored as the summed log-probability of its whole token sequence under
  // teacher forcing. The decision uses the length-normalised mean, because
  // REVISE happens to tokenise into three pieces where the others take two —
  // an artefact of the tokeniser, not a property of the judgement. Both figures
  // go into the receipt so the rule can be re-examined from the ledger.
  // Scores each candidate continuation as the summed log-probability of its whole
  // token sequence under teacher forcing, and reports the length-normalised mean
  // alongside it. The candidate set is fixed by the caller; the model's own
  // distribution decides among them, which is what separates this from an adapter
  // picking an answer and attributing it to the cell.
  async scoreChoices(messages, choices, role = "cell") {
    const generator = await this.load(role);
    const { Tensor } = await import("@huggingface/transformers");
    const { tokenizer, model } = generator;
    const prompt = tokenizer.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true });
    const promptIds = tokenizer.encode(prompt, { add_special_tokens: false });
    const scored = [];
    for (const choice of choices) {
      const choiceIds = tokenizer.encode(choice, { add_special_tokens: false });
      const ids = [...promptIds, ...choiceIds];
      const { logits } = await model({
        input_ids: new Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
        attention_mask: new Tensor("int64", new BigInt64Array(ids.length).fill(1n), [1, ids.length]),
      });
      let sum = 0;
      for (let k = 0; k < choiceIds.length; k += 1) {
        sum += tokenLogProb(logits, promptIds.length - 1 + k, choiceIds[k]);
      }
      scored.push({
        choice,
        sum: Number(sum.toFixed(4)),
        mean: Number((sum / choiceIds.length).toFixed(4)),
        tokens: choiceIds.length,
      });
    }
    return scored;
  }

  async scoreVerdicts(messages, role = "meta") {
    const scored = await this.scoreChoices(messages, VERDICTS, role);
    return scored.map(({ choice, ...rest }) => ({ verdict: choice, ...rest }));
  }

  // Two stages, mirroring what a citing review has to settle: which observation
  // bears on the proposal, and in which direction. UNRELATED is kept as a real
  // option so a cell can still decline — a ranking always has a maximum, and
  // without that escape the mechanism could never record "nothing here applies".
  async scoreCitation(view, context) {
    const observations = view.observations;
    const relevance = await this.scoreChoices(
      [
        { role: "system", content: `You are the ${view.perspective} reviewer. Decide which observation bears on the proposal.` },
        { role: "user", content: [...context, "Observations:", ...observations.map((o) => `- ${o.id}: ${o.text}`), "Which observation bears on it? Answer with its id."].join("\n") },
      ],
      observations.map((observation) => observation.id),
      "cell",
    );
    const chosen = relevance.reduce((best, candidate) => (candidate.mean > best.mean ? candidate : best));
    const observation = observations.find((candidate) => candidate.id === chosen.choice);
    const stance = await this.scoreChoices(
      [
        { role: "system", content: `You are the ${view.perspective} reviewer. Judge how the observation relates to the proposal.` },
        { role: "user", content: [...context, `Observation ${observation.id}: ${observation.text}`, "Does it support or contradict the proposal? Answer SUPPORTS, CONTRADICTS or UNRELATED."].join("\n") },
      ],
      ["SUPPORTS", "CONTRADICTS", "UNRELATED"],
      "cell",
    );
    const verdict = stance.reduce((best, candidate) => (candidate.mean > best.mean ? candidate : best));
    return { observation, relevance, stance, decided: verdict.choice };
  }

  // Continues an assistant turn that already begins with the scored verdict, so
  // the recorded reason belongs to the decision the gate actually applies. The
  // chat template is applied by hand here; the pipeline's string path must not
  // apply it a second time.
  async continueFrom(messages, prefix, maxNewTokens = 96, role = "cell") {
    const generator = await this.load(role);
    const prompt = generator.tokenizer.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true });
    const output = await generator(`${prompt}${prefix}`, {
      max_new_tokens: maxNewTokens,
      do_sample: false,
      repetition_penalty: 1.08,
      return_full_text: false,
    });
    const generated = output?.[0]?.generated_text;
    return typeof generated === "string" ? generated : String(generated ?? "");
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
      const citing = view.acceptance_mode === "citation" && Boolean(view.observations?.length);

      if (citing && this.citationBy === "score") {
        const context = [
          `Goal: ${view.goal.text}`,
          ...(view.question ? [`Question: ${view.question.text}`] : []),
          `${view.target.kind === "synthesis" ? "Synthesis" : "Proposal"}: ${view.target.text}`,
        ];
        const scored = await this.scoreCitation(view, context);
        const trace = {
          decided_by: "mean_logprob",
          relevance: scored.relevance,
          stance: scored.stance,
          decided: scored.decided,
        };
        if (scored.decided === "UNRELATED") {
          return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "no observation bears on this proposal" } }, trace };
        }
        const stance = scored.decided === "CONTRADICTS" ? "contradicts" : "supports";
        return {
          action: {
            type: "ADD_REVIEW_FRAGMENT",
            need_id: need.id,
            payload: {
              target_id: view.target.id,
              text: `${view.perspective}: ${scored.observation.id} ${stance} this proposal.`,
              observation_ids: [scored.observation.id],
              stance,
            },
          },
          trace,
        };
      }

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
          ...(citing
            ? ["Observations in the environment:", ...view.observations.map((o) => `- ${o.id}: ${o.text}`)]
            : []),
          ...(view.accepted_proposals.length ? ["Previously accepted work:", ...bullets(view.accepted_proposals)] : []),
          ...(view.negative_traces.length ? ["Earlier failed paths:", ...bullets(view.negative_traces)] : []),
        ],
        80,
      );
      if (!text) {
        return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty review fragment" } }, trace: { raw_output: text } };
      }
      if (!citing) {
        return {
          action: { type: "ADD_REVIEW_FRAGMENT", need_id: need.id, payload: { target_id: view.target.id, text } },
          trace: { raw_output: text },
        };
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
      const messages = [
        {
          role: "system",
          content: [
            "You are the meta-reviewer. Judge the work after reading all independent review notes.",
            "Answer with exactly one of ACCEPT, REVISE or REJECT, then give one concise reason.",
            ...retry,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Goal: ${view.goal.text}`,
            ...(view.question ? [`Question: ${view.question.text}`] : []),
            `${view.target.kind === "synthesis" ? "Synthesis" : "Proposal"}: ${view.target.text}`,
            "Review collective:",
            ...view.review_fragments.map((fragment) => `- ${fragment.perspective}: ${fragment.text}`),
          ].join("\n"),
        },
      ];
      const scores = await this.scoreVerdicts(messages, "meta");
      const chosen = scores.reduce((best, candidate) => (candidate.mean > best.mean ? candidate : best));
      const reason = cleanText(await this.continueFrom(messages, `${chosen.verdict}: `, 96, "meta"), maxChars);
      // The verdict is already structured data — it sits in the payload and in the
      // edge relation the gate draws. Repeating it inside the recorded text made
      // the proposing cell copy the label into its revision, because that text is
      // what the local view hands it as the review to address.
      const text = reason || chosen.verdict;
      return {
        action: {
          type: "META_REVIEW",
          need_id: need.id,
          payload: { target_id: view.target.id, verdict: chosen.verdict, text },
        },
        trace: { decided_by: "mean_logprob", verdict_scores: scores, raw_output: reason },
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
