const DEFAULT_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";
const DEFAULT_REVISION = "12fd25f77366fa6b3b4b768ec3050bf629380bac";

function numbered(items) {
  return items.map((item, index) => `${index + 1}. [${item.id}] ${item.text}`).join("\n");
}

function parseChoice(text, itemCount) {
  const match = text.match(/(?:^|\D)(\d+)(?:\D|$)/);
  if (!match) return null;
  const choice = Number(match[1]);
  return Number.isInteger(choice) && choice >= 0 && choice <= itemCount ? choice : null;
}

function cleanText(text, max = 1200) {
  return text.trim().replace(/^```(?:json|text)?\s*/i, "").replace(/```\s*$/, "").slice(0, max).trim();
}

export class SmolLmPolicy {
  constructor(options = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.revision = options.revision ?? DEFAULT_REVISION;
    this.dtype = options.dtype ?? "q4";
    this.name = `${this.model}@${this.revision}:${this.dtype}:adapter-v2`;
    this.generator = null;
  }

  async load() {
    if (this.generator) return;
    const { pipeline, env } = await import("@huggingface/transformers");
    if (process.env.HF_HOME) env.cacheDir = process.env.HF_HOME;
    this.generator = await pipeline("text-generation", this.model, {
      revision: this.revision,
      dtype: this.dtype,
    });
  }

  async generate(prompt, maxNewTokens = 32) {
    await this.load();
    const output = await this.generator(prompt, {
      max_new_tokens: maxNewTokens,
      do_sample: false,
      repetition_penalty: 1.05,
      return_full_text: false,
    });
    const generated = output?.[0]?.generated_text;
    if (typeof generated === "string") return generated;
    if (Array.isArray(generated)) return generated.at(-1)?.content ?? "";
    return String(generated ?? "");
  }

  async propose(view) {
    const need = view.need;
    if (need.kind === "EXPLORE") {
      const prompt = [
        "Formulate one new, concise philosophical proposition that advances the goal.",
        "Do not merely restate the goal or any previous proposition.",
        "Output only the proposition, in the language of the goal.",
        `Goal: ${view.goal.text}`,
        ...(view.supported_claims.length ? ["Existing propositions:", ...view.supported_claims.map((claim) => `- ${claim.text}`)] : []),
        ...(view.negative_traces.length ? ["Rejected paths; do not repeat them:", ...view.negative_traces.map((claim) => `- ${claim.text}`)] : []),
        "Proposition:",
      ].join("\n");
      const raw = await this.generate(prompt, 80);
      const text = cleanText(raw);
      const action = text
        ? { type: "ADD_CLAIM", need_id: need.id, payload: { text } }
        : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty proposition" } };
      return { action, trace: { raw_output: text } };
    }

    if (need.kind === "VERIFY") {
      const evidenceMode = view.observations.length > 0;
      const prompt = evidenceMode
        ? [
            "Which observation directly supports the claim?",
            "Output only its number, or 0 if none supports it.",
            `Claim: ${view.target.text}`,
            numbered(view.observations),
            "Number:",
          ].join("\n")
        : [
            "Judge this philosophical proposition independently.",
            "Does it meaningfully advance the goal without merely restating it or a rejected path?",
            "Output only 1 to provisionally support it or 0 to challenge it.",
            `Goal: ${view.goal.text}`,
            `Proposition: ${view.target.text}`,
            ...(view.negative_traces.length ? ["Rejected paths:", ...view.negative_traces.map((claim) => `- ${claim.text}`)] : []),
            "Decision:",
          ].join("\n");
      const raw = await this.generate(prompt, 20);
      const choice = parseChoice(raw, evidenceMode ? view.observations.length : 1);
      let action;
      if (choice === 0) {
        action = {
          type: "CHALLENGE",
          need_id: need.id,
          payload: { target_id: view.target.id, reason: "Cell found no directly supporting supplied observation." },
        };
      } else if (choice && evidenceMode) {
        action = {
          type: "SUPPORT",
          need_id: need.id,
          payload: {
            target_id: view.target.id,
            observation_ids: [view.observations[choice - 1].id],
            rationale: "Observation selected by local cell.",
          },
        };
      } else if (choice === 1) {
        action = {
          type: "SUPPORT",
          need_id: need.id,
          payload: {
            target_id: view.target.id,
            rationale: "Independent local cell provisionally accepted the proposition.",
          },
        };
      } else {
        action = { type: "ABSTAIN", need_id: need.id, payload: { reason: "unparseable verification choice" } };
      }
      return { action, trace: { raw_output: cleanText(raw) } };
    }

    if (need.kind === "REPAIR") {
      const prompt = view.observations.length > 0
        ? [
            "Choose an observation that can replace the challenged claim.",
            "Output only its number, or 0 to retract the claim.",
            `Challenged claim: ${view.target.text}`,
            numbered(view.observations),
            "Number:",
          ].join("\n")
        : [
            "Replace the challenged proposition with one better proposition that advances the goal.",
            "Do not repeat the challenged proposition or rejected paths.",
            "Output only the replacement, in the language of the goal.",
            `Goal: ${view.goal.text}`,
            `Challenged proposition: ${view.target.text}`,
            ...(view.negative_traces.length ? ["Rejected paths:", ...view.negative_traces.map((claim) => `- ${claim.text}`)] : []),
            "Replacement:",
          ].join("\n");
      const raw = await this.generate(prompt, view.observations.length > 0 ? 20 : 80);
      if (view.observations.length === 0) {
        const text = cleanText(raw);
        const action = text
          ? { type: "REVISE", need_id: need.id, payload: { target_id: view.target.id, text } }
          : { type: "RETRACT", need_id: need.id, payload: { target_id: view.target.id } };
        return { action, trace: { raw_output: text } };
      }
      const choice = parseChoice(raw, view.observations.length);
      const action = choice && choice > 0
        ? {
            type: "REVISE",
            need_id: need.id,
            payload: { target_id: view.target.id, text: view.observations[choice - 1].text },
          }
        : choice === 0
          ? { type: "RETRACT", need_id: need.id, payload: { target_id: view.target.id } }
          : { type: "ABSTAIN", need_id: need.id, payload: { reason: "unparseable repair choice" } };
      return { action, trace: { raw_output: cleanText(raw) } };
    }

    if (need.kind === "SYNTHESIZE") {
      const prompt = [
        "Answer the goal using only the supported claims.",
        "Output one concise answer and nothing else.",
        `Goal: ${view.goal.text}`,
        ...view.supported_claims.map((claim) => `- ${claim.text}`),
        "Answer:",
      ].join("\n");
      const raw = await this.generate(prompt, 160);
      const text = cleanText(raw);
      const action = text
        ? {
            type: "SYNTHESIZE",
            need_id: need.id,
            payload: { text, claim_ids: view.supported_claims.map((claim) => claim.id) },
          }
        : { type: "ABSTAIN", need_id: need.id, payload: { reason: "empty synthesis" } };
      return { action, trace: { raw_output: text } };
    }

    return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "unknown need" } }, trace: null };
  }
}

export const smolLmDefaults = { model: DEFAULT_MODEL, revision: DEFAULT_REVISION };
