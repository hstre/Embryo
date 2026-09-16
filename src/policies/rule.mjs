// A reviewer arm that is not a model.
//
// Taken from hstre/DESi, which was discontinued after four sealed measurements
// refuted its central claim: a deterministic layer did not judge better than a
// strong model. Two of those results shape this file more than any feature does.
//
// Its rule layer as a veto over model judgements made 0 repairs and 6 damages in
// 80 cases. So this arm has no power to reject: it supports what it can anchor
// and abstains otherwise. It cannot send anything back.
//
// Its rule layer scored 7/20 on entailment and micro-F1 0.25 on semantic
// transformation against a model's 0.727. So this arm judges no meaning at all.
// DESi's own claim extractor states the discipline plainly — "Only four claim
// kinds are emitted. Anything else — semantic free-text claims, narrative
// paragraphs, opinions — is intentionally ignored." The one thing left that a
// rule can settle without a model is whether two strings share a passage, which
// is the check hstre/Budget-Review's gate performs on a claim's raw_span.
//
// The degenerate mode is the control DESi's closing note calls for. In its final
// governance benchmark an arm of fifteen lines that compares nothing scored
// exactly as well as the full implementation, which is what exposed the
// benchmark as measuring nothing. An arm that cites the first observation come
// what may is that fifteen-line arm. If it performs as the real one does, the
// comparison is dead and says so.

const DEFAULT_MIN_SPAN = 24;

// Whitespace-collapsed copy of a text, plus the index in the original that each
// collapsed character came from. Taken from budget-review's repair pass on the
// claude/gold-recall-echr branch, where it turned out to be the difference
// between 20 and 23 of 24 gold spans on a court decision.
function collapsed(text) {
  const out = [];
  const origin = [];
  let previousSpace = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (/\s/.test(character)) {
      if (!previousSpace) {
        out.push(" ");
        origin.push(index);
      }
      previousSpace = true;
      continue;
    }
    out.push(character);
    origin.push(index);
    previousSpace = false;
  }
  return { text: out.join(""), origin };
}

// The document's own text for a span that differs from it only in whitespace.
// What comes back is the document's slice, never the quoting model's wording, so
// a claim built on it still quotes the source exactly. A span the document does
// not contain, whitespace aside, still returns null: this tolerates typesetting,
// not paraphrase — which is the distinction Beleg K is about, and which the
// report previously ran together with this one.
export function relaxedSpan(document, span) {
  const needle = span.split(/\s+/).filter(Boolean).join(" ");
  if (!needle) return null;
  const haystack = collapsed(document);
  const position = haystack.text.indexOf(needle);
  if (position < 0) return null;
  return document.slice(haystack.origin[position], haystack.origin[position + needle.length - 1] + 1);
}

// Where a quoted span stops matching the document, and what stands there. A
// rejected quote is only actionable if it says which character broke it: a
// truncated preview cannot tell a dropped line break from a rewritten word.
export function divergence(document, span, window = 30) {
  let low = 0;
  let high = span.length;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (document.includes(span.slice(0, middle))) low = middle;
    else high = middle - 1;
  }
  const offset = low ? document.indexOf(span.slice(0, low)) : -1;
  return {
    prefix: low,
    document: offset >= 0 ? document.slice(offset + low, offset + low + window) : "",
    span: span.slice(low, low + window),
  };
}

// Longest passage the two strings share verbatim. No case folding, no
// whitespace collapsing: at 1.7B the one corrupted quote of the span probe
// altered a single word inside 209 otherwise perfect characters, which is the
// argument against every kind of tolerance here.
export function longestCommonSpan(left, right) {
  let previous = new Uint32Array(right.length + 1);
  let current = new Uint32Array(right.length + 1);
  let best = 0;
  let end = 0;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = left[i - 1] === right[j - 1] ? previous[j - 1] + 1 : 0;
      if (current[j] > best) {
        best = current[j];
        end = i;
      }
    }
    [previous, current] = [current, previous];
    current.fill(0);
  }
  return { length: best, span: left.slice(end - best, end) };
}

// Which observation the target text is anchored in, or none. Ties go to the
// lower id so the arm is replay-stable rather than dependent on iteration order.
export function anchoredObservation(text, observations, minSpanChars = DEFAULT_MIN_SPAN) {
  let found = null;
  for (const observation of observations) {
    const { length, span } = longestCommonSpan(text, observation.text);
    if (length < minSpanChars) continue;
    if (!found || length > found.length || (length === found.length && observation.id < found.id)) {
      found = { id: observation.id, length, span };
    }
  }
  return found;
}

export class RulePolicy {
  constructor(options = {}) {
    this.mode = options.mode ?? "anchor";
    this.minSpanChars = options.minSpanChars ?? DEFAULT_MIN_SPAN;
    this.name = `rule:${this.mode}${this.mode === "anchor" ? `:${this.minSpanChars}` : ""}`;
  }

  async propose(view) {
    const { need } = view;
    if (need.kind !== "REVIEW_FRAGMENT") {
      return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "rule arm reviews only" } }, trace: { rule: this.mode } };
    }
    const observations = view.observations ?? [];
    if (view.acceptance_mode !== "citation" || observations.length === 0) {
      return { action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "rule arm needs an environment to cite" } }, trace: { rule: this.mode } };
    }

    if (this.mode === "degenerate") {
      // Compares nothing. That is the point.
      const observation = observations[0];
      return {
        action: {
          type: "ADD_REVIEW_FRAGMENT",
          need_id: need.id,
          payload: {
            target_id: view.target.id,
            text: `rule/degenerate: ${observation.id} cited without comparison.`,
            observation_ids: [observation.id],
            stance: "supports",
          },
        },
        trace: { rule: "degenerate", compared: 0 },
      };
    }

    const anchor = anchoredObservation(view.target.text, observations, this.minSpanChars);
    if (!anchor) {
      const longest = observations
        .map((observation) => longestCommonSpan(view.target.text, observation.text).length)
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        action: { type: "ABSTAIN", need_id: need.id, payload: { reason: "no verbatim span links this text to the environment" } },
        trace: { rule: "anchor", min_span_chars: this.minSpanChars, longest_span: longest },
      };
    }
    return {
      action: {
        type: "ADD_REVIEW_FRAGMENT",
        need_id: need.id,
        payload: {
          target_id: view.target.id,
          // The fragment says what was checked, not what it means. The rule has
          // no operation that can call the proposal right.
          text: `rule/anchor: ${anchor.length} characters of ${anchor.id} appear verbatim in this text.`,
          observation_ids: [anchor.id],
          stance: "supports",
        },
      },
      trace: { rule: "anchor", min_span_chars: this.minSpanChars, longest_span: anchor.length, span: anchor.span },
    };
  }
}

// Routes one panel stage to the rule and leaves every other cell to the model.
// The rule arm is always the last stage, so the model arms are unaffected by it
// in a sighted panel and see nothing of it in a blind one.
export class PanelWithRulePolicy {
  constructor(model, rule, stage) {
    this.model = model;
    this.rule = rule;
    this.stage = stage;
    this.name = `${model.name}+arm${stage}:${rule.name}`;
  }

  async propose(view) {
    const isRuleArm = view.need.kind === "REVIEW_FRAGMENT" && view.perspective === this.stage;
    return isRuleArm ? this.rule.propose(view) : this.model.propose(view);
  }
}
