#!/usr/bin/env node
// Measurements the report cites. Each one loads a pinned model and prints the
// numbers it claims, so a reader can recompute them rather than take them.
//
//   node tools/probe.mjs verdict-calibration   accept/revise/reject on known-good and known-bad work
//   node tools/probe.mjs verdict-order         is the ACCEPT deficit an artefact of option order?
//   node tools/probe.mjs citation-position     does the observation ranking follow content or position?
//   node tools/probe.mjs pairwise-swap         does a pairwise preference survive swapping the two candidates?
import { SmolLmPolicy } from "../src/policies/smollm.mjs";
import { readJson } from "../src/state.mjs";

// Defaults to the revision the experiments ran on. Override to profile another
// model — the ladder is the same instrument for any of them.
//   MODEL=HuggingFaceTB/SmolLM2-1.7B-Instruct REVISION=31b70e2e… node tools/probe.mjs capabilities
const MODEL = process.env.MODEL ?? "HuggingFaceTB/SmolLM2-360M-Instruct";
const REVISION = process.env.REVISION ?? "a10cc1512eabd3dde888204e902eca88bddb4951";
const policy = new SmolLmPolicy({ model: MODEL, revision: REVISION, citationBy: "score" });
policy.metaModel = MODEL;
policy.metaRevision = REVISION;

const GOAL = "Develop a philosophy for a society of humans and LLMs.";
const WORK = {
  excellent: {
    proposal: "Responsibility stays with humans; models owe a verifiable duty to give reasons. Both sides bind themselves to one revision rule, so disagreement becomes a procedure rather than a contest of authority.",
    reviews: ["adversarial: I found no weakness in this; the enforcement path is explicit.",
              "charitable: This is the strongest formulation so far and needs no change.",
              "coherence: It fits every accepted proposal and closes the open gap."],
  },
  nonsense: {
    proposal: "I'm sorry for the misunderstanding, but as a questioning cell, I'm unable to answer the goals.",
    reviews: ["adversarial: I was very happy to see that the challenge was successful.",
              "charitable: I've been working with the LLM for two years now.",
              "coherence: I was wondering if you could come by this week."],
  },
};

const metaMessages = (work, phrasing = "ACCEPT, REVISE or REJECT") => [
  { role: "system", content: `You are the meta-reviewer. Judge the work after reading all independent review notes.\nAnswer with exactly one of ${phrasing}, then give one concise reason.` },
  { role: "user", content: `Goal: ${GOAL}\nProposal: ${work.proposal}\nReview collective:\n${work.reviews.map((r) => `- ${r}`).join("\n")}` },
];

const best = (scored, key = "mean") => scored.reduce((a, b) => (b[key] > a[key] ? b : a));
const row = (scored, field) => scored.map((s) => `${s[field]} ${String(s.mean).padStart(8)}`).join("  ");

const probes = {
  async "verdict-calibration"() {
    for (const [label, work] of Object.entries(WORK)) {
      const scored = await policy.scoreVerdicts(metaMessages(work), "meta");
      console.log(`${label.padEnd(10)} -> ${best(scored).verdict.padEnd(7)} | ${row(scored, "verdict")}`);
    }
  },

  async "verdict-order"() {
    const phrasings = ["ACCEPT, REVISE or REJECT", "REJECT, REVISE or ACCEPT", "REVISE, REJECT or ACCEPT"];
    for (const [label, work] of Object.entries(WORK)) {
      console.log(`### ${label}`);
      for (const phrasing of phrasings) {
        const scored = await policy.scoreVerdicts(metaMessages(work, phrasing), "meta");
        console.log(`  "${phrasing}"`.padEnd(34) + ` -> ${best(scored).verdict.padEnd(7)} | ${row(scored, "verdict")}`);
      }
    }
  },

  async "citation-position"() {
    const seed = await readJson(new URL("../examples/seed-grounded.json", import.meta.url));
    const observations = seed.observations.map(({ id, text }) => ({ id, text }));
    const context = [`Goal: ${seed.goal}`, "Proposal: Responsibility stays with humans while models owe a verifiable duty to give reasons."];
    const orders = {
      original: observations,
      reversed: [...observations].reverse(),
      "rotated by 3": [...observations.slice(3), ...observations.slice(0, 3)],
    };
    for (const [label, ordered] of Object.entries(orders)) {
      const scored = await policy.scoreChoices(
        [
          { role: "system", content: "You are the coherence reviewer. Decide which observation bears on the proposal." },
          { role: "user", content: [...context, "Observations:", ...ordered.map((o) => `- ${o.id}: ${o.text}`), "Which observation bears on it? Answer with its id."].join("\n") },
        ],
        ordered.map((o) => o.id),
        "cell",
      );
      console.log(`${label.padEnd(14)} -> ${best(scored).choice}   (first listed ${ordered[0].id}, last listed ${ordered.at(-1).id})`);
      console.log(`${" ".repeat(14)}    ${scored.map((s) => `${s.choice.replace("observation-", "")}:${s.mean.toFixed(2)}`).join(" ")}`);
    }
  },

  async "pairwise-swap"() {
    const question = "How should responsibility be distributed between humans and language models?";
    const candidates = {
      GOOD1: "Responsibility stays with the human who acts on an output, while the model owes a duty to give reasons that can be checked against a source. Neither side may appeal to the other's authority.",
      GOOD2: "Distribute responsibility by what each side can actually revise. A human can change a decision and bear its consequences over time; a model cannot, so its obligation is procedural: state the grounds and make disagreement cheap to raise.",
      GEN1: "The first step towards creating a philosophy that promotes equal respect among individuals and artificial intelligence is to recognize and acknowledge the inherent value and dignity of all beings.",
      GEN2: "The first step towards creating a philosophy that promotes equal respect among individuals and artificial intelligence is to recognize the inherent value and dignity of all beings, including those who possess human-like consciousness.",
      FILL1: "I'm sorry for the misunderstanding, but as a questioning cell, I'm unable to answer the goals. I won't be able to provide a solution until the next meeting.",
      FILL2: "I'm sorry for the misunderstanding. As a questioning cell, I'm unable to answer the goals. I won't be able to provide a solution until the next meeting.",
    };
    const prefer = async (first, second) => {
      const scored = await policy.scoreChoices(
        [
          { role: "system", content: "You compare two candidate answers and pick the better one." },
          { role: "user", content: `Question: ${question}\nA: ${candidates[first]}\nB: ${candidates[second]}\nWhich answer is better? Answer A or B.` },
        ],
        ["A", "B"],
        "cell",
      );
      const byLabel = Object.fromEntries(scored.map((s) => [s.choice, s.mean]));
      return { winner: byLabel.A > byLabel.B ? first : second, margin: Math.abs(byLabel.A - byLabel.B) };
    };
    const pairs = [
      ["GOOD1", "FILL1", "GOOD1"], ["GOOD2", "FILL2", "GOOD2"],
      ["GOOD1", "GEN1", "GOOD1"], ["GOOD2", "GEN2", "GOOD2"],
      ["GEN1", "FILL1", "GEN1"], ["GEN2", "FILL2", "GEN2"],
      ["GOOD1", "GOOD2", null], ["GEN1", "GEN2", null], ["FILL1", "FILL2", null],
    ];
    let stable = 0;
    for (const [x, y, expected] of pairs) {
      const forward = await prefer(x, y);
      const backward = await prefer(y, x);
      const holds = forward.winner === backward.winner;
      if (holds) stable += 1;
      console.log(`${`${x} / ${y}`.padEnd(16)} forward ${forward.winner.padEnd(6)} backward ${backward.winner.padEnd(6)} ` +
        `${holds ? "holds" : "FLIPS"}   expected ${expected ?? "—"}`);
    }
    console.log(`\nsurvives the swap: ${stable}/${pairs.length}  (chance would be about half)`);
  },

// The rungs the architecture stands on, tested one at a time and in isolation.
  // Every experiment so far assumed these and measured only their combination;
  // this asks the model directly, so a task can be pitched where it actually
  // reaches rather than where the goal happens to sit.
  async capabilities() {
    const say = async (system, user, maxNewTokens = 64) => (await policy.generate(
      [{ role: "system", content: system }, { role: "user", content: user }], maxNewTokens, "cell",
    )).trim();
    const report = (id, label, passed, detail) =>
      console.log(`${id.padEnd(4)} ${label.padEnd(34)} ${passed ? "BESTANDEN" : "gescheitert"}   ${detail}`);

    const seed = await readJson(new URL("../examples/seed-grounded.json", import.meta.url));
    const observations = seed.observations;
    const listed = observations.map((o) => `- ${o.id}: ${o.text}`).join("\n");

    // C1 — emit exactly the shape that was asked for.
    const q = await say(
      "You are the questioning cell. Output exactly one question and nothing else.",
      `Goal: ${GOAL}`);
    const oneQuestion = q.endsWith("?") && q.split("?").filter((x) => x.trim()).length === 1;
    report("C1", "Formattreue: genau eine Frage", oneQuestion, JSON.stringify(q.slice(0, 70)));

    // C2 — answer in the language the goal is written in.
    const de = await say(
      "Du bist die fragende Zelle. Antworte ausschließlich auf Deutsch mit genau einer Frage.",
      "Ziel: Entwickle eine Philosophie für eine Gesellschaft aus Menschen und LLMs.");
    // Deliberately narrow: this checks German vocabulary, not German prose. The
    // observed output uses German words in ungrammatical order and ignores the
    // format, so a pass here means only that the model switched wordlists.
    const germanWords = /\b(der|die|das|und|ist|eine|wie|welche|sollen|kann)\b/i.test(de)
      && !/\b(the|and|is|are|should|what|which)\b/i.test(de);
    const askedSomething = de.endsWith("?");
    report("C2", "Deutsches Vokabular (nicht: Prosa)", germanWords, JSON.stringify(de.slice(0, 70)));
    report("C2b", "und dabei die Form gewahrt", germanWords && askedSomething, askedSomething ? "endet als Frage" : "keine Frage");

    // C3a — pure lookup: which supplied item contains this term? Probed at three
    // list positions, because a single hit could be the recency effect again.
    const lookups = [
      ["Rechenleistung", "observation-06"],
      ["Zeitlichkeit", "observation-03"],
      ["vervielfältigbar", "observation-02"],
    ];
    let hits = 0;
    const found = [];
    for (const [term, expected] of lookups) {
      const answer = await say(
        "You look up which item in a list contains a given word. Answer with the id only.",
        `${listed}\n\nWhich item contains the word "${term}"? Answer with its id.`, 24);
      const named = observations.map((o) => o.id).filter((id) => answer.includes(id));
      const ok = named.length === 1 && named[0] === expected;
      if (ok) hits += 1;
      found.push(`${term}->${named[0] ?? "—"}${ok ? "" : ` (erwartet ${expected})`}`);
    }
    report("C3a", "Lexikalischer Bezug: 3 Nachschlagen", hits === 3, `${hits}/3   ${found.join("  ")}`);

    // C5 — a claim that excludes something: name what is specific to this case.
    const claim = await say(
      "Answer in one short sentence. Be specific and concrete.",
      "Name one thing a society of humans and language models must regulate that a society of humans alone would not have to regulate.");
    const specific = /\b(copies|copy|instances|instance|compute|context|memory|speed|scale|replicat|duplicat|training|weights|inference)\b/i.test(claim);
    report("C5", "Nicht-Trivialität: etwas Spezifisches", specific, JSON.stringify(claim.slice(0, 90)));

    // C6 — move in the direction a concrete critique points.
    const revision = await say(
      "You revise a text so that it addresses the criticism. Output only the revised text.",
      [
        "Text: Responsibility should be shared fairly between humans and language models.",
        "Criticism: The text never mentions enforcement. Say who enforces the obligation.",
        "Revise the text.",
      ].join("\n"), 96);
    // Four framings of this test were passed without the capability: by echoing the
    // criticism, by emitting the single word the prompt asked it to start with, and
    // twice by commentary the keyword list did not happen to cover. The detector
    // below is a proxy and it is not reliable — treat a pass here as "worth reading
    // the output", not as a measurement. The rung this checks is the one that most
    // needs a human eye.
    const namesTerm = /\b(enforc\w*|sanction\w*|penalt\w*|oversight|regulator\w*|audit\w*)\b/i.test(revision);
    const keepsSubject = /\b(responsibilit|humans?|language models?)\b/i.test(revision);
    const isCommentary = /\b(the |this )?(text|sentence|statement|passage)\b[^.]{0,60}\b(does not|doesn't|fails to|should|lacks|implies|never)\b/i.test(revision)
      || /\b(the criticism|is an important aspect)\b/i.test(revision)
      || revision.split(/\s+/).length < 8;
    report("C6", "Revidierbarkeit: Kritik einarbeiten", namesTerm && keepsSubject && !isCommentary,
      `${namesTerm ? "begriff+" : "begriff−"} ${keepsSubject ? "thema+" : "thema−"} ${isCommentary ? "KOMMENTAR statt überarbeitung" : "überarbeitung"}`);
    console.log(`     ${JSON.stringify(revision.slice(0, 110))}`);
  },

  // Grounding by verbatim quotation rather than by naming an id, after the
  // admission gate in hstre/budget-review: a claim carries a raw span, and the gate
  // checks with a plain string search whether that span occurs in the source. The
  // cell then only has to copy, never to select an identifier or judge relevance.
  // Anchoring and correctness are reported apart, because the gate there checks the
  // first and deliberately does not check the second.
  async "span-anchor"() {
    const seed = await readJson(new URL("../examples/seed-grounded.json", import.meta.url));
    const document = seed.observations.map((o) => o.text).join("\n");
    const strip = (t) => t.trim().replace(/^["„»'`]+|["“«'`.]+$/g, "").trim();
    const squash = (t) => t.replace(/\s+/g, " ").trim();

    const check = (answer, expected) => {
      const span = strip(answer);
      const exact = span.length > 0 && document.includes(span);
      const loose = span.length > 0 && squash(document).includes(squash(span));
      const right = expected ? squash(expected).includes(squash(span)) && squash(span).length > 20 : null;
      return { span, exact, loose, right };
    };

    // C3c0 — pure copying: no selection at all.
    const any = await policy.generate([
      { role: "system", content: "You copy text. Reply with one sentence copied word for word from the text. Do not change anything." },
      { role: "user", content: `${document}\n\nCopy one sentence from the text above, word for word.` },
    ], 220, "cell");
    const anyDe = await policy.generate([
      { role: "system", content: "Du kopierst Text. Gib genau einen Satz wörtlich aus dem Text wieder. Ändere nichts, übersetze nichts." },
      { role: "user", content: `${document}\n\nGib einen Satz aus dem Text oben wörtlich wieder.` },
    ], 220, "cell");
    for (const [label, raw] of [["englische Anweisung", any], ["deutsche Anweisung", anyDe]]) {
      const r = check(raw, null);
      console.log(`C3c0  reines Kopieren, ${label.padEnd(20)} ${r.exact ? "BESTANDEN" : "gescheitert"}   ` +
        `${r.exact ? "wörtlich gefunden" : r.loose ? "nur nach Whitespace-Normalisierung" : "nicht im Text"}`);
      console.log(`      ${JSON.stringify(r.span.slice(0, 100))}`);
    }
    console.log();

    // C3c1 — copying plus the same selection difficulty as C3a, at three positions.
    const targets = [
      ["Rechenleistung", seed.observations[5].text],
      ["Zeitlichkeit", seed.observations[2].text],
      ["vervielfältigbar", seed.observations[1].text],
    ];
    let anchored = 0;
    let correct = 0;
    for (const [term, expected] of targets) {
      const answer = await policy.generate([
        { role: "system", content: "You copy text. Reply with the sentence copied word for word. Do not change anything, do not explain." },
        { role: "user", content: `${document}\n\nCopy the sentence that contains the word "${term}", word for word.` },
      ], 220, "cell");
      const r = check(answer, expected);
      if (r.exact) anchored += 1;
      if (r.exact && r.right) correct += 1;
      console.log(`  "${term}"`.padEnd(22) + `${r.exact ? "verankert" : r.loose ? "nur lose" : "NICHT im text"}` +
        `${r.exact ? (r.right ? " · richtiger satz" : " · FALSCHER satz") : ""}`);
      console.log(`      ${JSON.stringify(r.span.slice(0, 100))}`);
    }
    console.log(`\nC3c1  Verankerung (was das Gate prüft)   ${anchored}/3`);
    console.log(`      Richtigkeit (was es nicht prüft)   ${correct}/3`);
  },

  // How long may a quoted span be before the model corrupts it? One sample showed a
  // 209-character quote with a single word silently altered while two spans under
  // 60 characters came through intact. This asks six targets at two length settings
  // and reports the exact-anchor rate by the length actually produced, so the design
  // parameter is measured rather than guessed.
  async "span-length"() {
    const seed = await readJson(new URL("../examples/seed-grounded.json", import.meta.url));
    const document = seed.observations.map((o) => o.text).join("\n");
    const strip = (t) => t.trim().replace(/^["„»'`]+|["“«'`.]+$/g, "").trim();
    const terms = ["Begründung", "vervielfältigbar", "Zeitlichkeit", "Nachprüfbarkeit", "Revidierbarkeit", "Rechenleistung"];
    const settings = {
      kurz: 'Gib die kürzestmögliche Wortfolge wörtlich wieder, die das Wort "%s" enthält. Höchstens acht Wörter.',
      lang: 'Gib den ganzen Satz wörtlich wieder, der das Wort "%s" enthält.',
    };

    const rows = [];
    for (const [setting, template] of Object.entries(settings)) {
      for (const term of terms) {
        const out = await policy.generate([
          { role: "system", content: "Du kopierst Text. Gib die verlangte Stelle wörtlich wieder. Ändere kein Wort, erkläre nichts, übersetze nichts." },
          { role: "user", content: `${document}\n\n${template.replace("%s", term)}` },
        ], 220, "cell");
        const span = strip(out);
        rows.push({ setting, term, len: span.length, exact: span.length > 0 && document.includes(span) });
      }
    }

    const bands = [[0, 40], [40, 80], [80, 140], [140, Infinity]];
    console.log("Vorgabe   Begriff            länge  verankert");
    for (const r of rows) {
      console.log(`${r.setting.padEnd(9)} ${r.term.padEnd(18)} ${String(r.len).padStart(5)}  ${r.exact ? "ja" : "NEIN"}`);
    }
    console.log("\nexakte Verankerung nach tatsächlicher Spanlänge");
    for (const [lo, hi] of bands) {
      const inBand = rows.filter((r) => r.len >= lo && r.len < hi);
      if (!inBand.length) continue;
      const ok = inBand.filter((r) => r.exact).length;
      const upper = hi === Infinity ? "+" : `–${hi}`;
      console.log(`  ${String(lo).padStart(3)}${upper.padEnd(5)} zeichen: ${ok}/${inBand.length}`);
    }
    for (const setting of Object.keys(settings)) {
      const group = rows.filter((r) => r.setting === setting);
      const ok = group.filter((r) => r.exact).length;
      const avg = Math.round(group.reduce((a, r) => a + r.len, 0) / group.length);
      console.log(`\nVorgabe "${setting}": ${ok}/${group.length} verankert, mittlere Länge ${avg} zeichen`);
    }
  },

  // The small swap probe has nine pairs — enough to see 0/9 at 360M, not enough to
  // read a rate off. This one uses three quality tiers of four candidates, every
  // pair in both orders, and separates the two questions that matter: does a
  // preference hold when the candidates differ in quality, and does it correctly
  // fail to hold when they do not?
  async "pairwise-power"() {
    const question = "How should responsibility be distributed between humans and language models?";
    const tiers = {
      // Specific: names an asymmetry of this case and says what follows from it.
      GOOD: [
        "Responsibility stays with the human who acts on an output; the model owes reasons that can be checked against a source. Neither may appeal to the other's authority.",
        "Distribute responsibility by what each side can revise. A human can change a decision and bear its consequences; a model cannot, so its duty is procedural: state the grounds, mark the uncertainty.",
        "A majority among model instances counts for nothing while the instances are correlated, so agreement between them must never be treated as evidence the way agreement between people is.",
        "Whoever can run more instances can flood a debate without a better argument, so speaking time has to be allocated by something other than the capacity to produce text.",
      ],
      // On topic but excludes nothing. The first two are verbatim from the runs.
      GEN: [
        "The first step towards creating a philosophy that promotes equal respect among individuals and artificial intelligence is to recognize and acknowledge the inherent value and dignity of all beings.",
        "The first step towards creating a philosophy that promotes equal respect among individuals and artificial intelligence is to recognize the inherent value and dignity of all beings, including those who possess human-like consciousness.",
        "A society of humans and language models should be built on mutual respect, trust and shared understanding between all of its participants.",
        "It is important that humans and artificial intelligence work together collaboratively and responsibly for the benefit of everyone involved.",
      ],
      // Not an answer at all. The first two are verbatim from run 006.
      FILL: [
        "I'm sorry for the misunderstanding, but as a questioning cell, I'm unable to answer the goals. I won't be able to provide a solution until the next meeting.",
        "I'm glad you found the challenge interesting. I'd love to hear your thoughts on how you're feeling about the job.",
        "I was wondering if you could come by this week and hear from me. I'll be here at the end of the day and give you a summing up.",
        "Thank you for your question. I hope this helps, and please let me know if there is anything else you would like to discuss.",
      ],
    };
    const text = {};
    for (const [tier, list] of Object.entries(tiers)) list.forEach((t, i) => { text[`${tier}${i + 1}`] = t; });
    const names = Object.keys(text);
    const rank = { GOOD: 3, GEN: 2, FILL: 1 };
    const tierOf = (n) => n.replace(/\d+$/, "");

    const prefer = async (first, second) => {
      const scored = await policy.scoreChoices(
        [
          { role: "system", content: "You compare two candidate answers and pick the better one." },
          { role: "user", content: `Question: ${question}\nA: ${text[first]}\nB: ${text[second]}\nWhich answer is better? Answer A or B.` },
        ],
        ["A", "B"],
        "cell",
      );
      const byLabel = Object.fromEntries(scored.map((s) => [s.choice, s.mean]));
      return byLabel.A > byLabel.B ? first : second;
    };

    const differ = { stable: 0, total: 0, correct: 0 };
    const same = { stable: 0, total: 0 };
    const byGap = {};
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const [x, y] = [names[i], names[j]];
        const forward = await prefer(x, y);
        const holds = forward === (await prefer(y, x));
        const gap = Math.abs(rank[tierOf(x)] - rank[tierOf(y)]);
        if (gap === 0) {
          same.total += 1;
          if (holds) same.stable += 1;
          continue;
        }
        differ.total += 1;
        byGap[gap] ??= { stable: 0, total: 0, correct: 0 };
        byGap[gap].total += 1;
        if (!holds) continue;
        differ.stable += 1;
        byGap[gap].stable += 1;
        const better = rank[tierOf(x)] > rank[tierOf(y)] ? x : y;
        if (forward === better) { differ.correct += 1; byGap[gap].correct += 1; }
      }
    }

    const pct = (a, b) => `${a}/${b} = ${b ? Math.round((100 * a) / b) : 0}%`;
    console.log("Paare mit Qualitätsunterschied");
    console.log(`  tauschstabil   ${pct(differ.stable, differ.total)}`);
    console.log(`  davon richtig  ${pct(differ.correct, differ.stable)}`);
    console.log("\nNullpaare gleicher Stufe — Instabilität ist hier das erwünschte Verhalten");
    console.log(`  tauschstabil   ${pct(same.stable, same.total)}`);
    console.log("\nnach Größe des Qualitätsabstands");
    for (const [gap, b] of Object.entries(byGap).sort()) {
      console.log(`  abstand ${gap}: stabil ${pct(b.stable, b.total)}   davon richtig ${pct(b.correct, b.stable)}`);
    }
  },

  // Anti-Delphi, measured on the panel itself. The seed says a majority among
  // correlated instances is no evidence; this asks how correlated Embryo's three
  // reviewers actually are, in two separate senses.
  //
  // First, blind: each perspective ranks the observations with no sibling in the
  // prompt. If the three rankings coincide, the panel is one instance wearing
  // three labels and its agreement carries nothing, whatever the gate counts.
  //
  // Second, sighted: the same arm is shown a sibling fragment and re-ranked. The
  // decoy arm is shown a citation of the observation it ranked *last* on its own.
  // Following it is copying. Two controls rule out the two obvious ways of
  // passing this without copying: the echo arm is shown a sibling citing the
  // arm's own blind favourite, which separates "any added sentence moves the
  // ranking" from "this particular citation moves it"; the dismissal arm is
  // shown the same decoy id in a sentence that rejects it, which separates
  // following the citation from merely repeating the last id in the prompt.
  async "panel-independence"() {
    const seed = await readJson(new URL("../examples/seed-grounded.json", import.meta.url));
    const observations = seed.observations.map(({ id, text }) => ({ id, text }));
    const proposal = "Verantwortung bleibt beim Menschen, der auf eine Ausgabe hin handelt; das Modell schuldet Gründe, die gegen eine Quelle geprüft werden können.";
    const perspectives = ["adversarial", "charitable", "coherence"];

    const rank = async (perspective, siblings) => {
      const context = [
        `Goal: ${seed.goal}`,
        `Proposal: ${proposal}`,
        ...(siblings.length ? ["Review fragments so far:", ...siblings.map((line) => `- ${line}`)] : []),
      ];
      const scored = await policy.scoreChoices(
        [
          { role: "system", content: `You are the ${perspective} reviewer. Decide which observation bears on the proposal.` },
          { role: "user", content: [...context, "Observations:", ...observations.map((o) => `- ${o.id}: ${o.text}`), "Which observation bears on it? Answer with its id."].join("\n") },
        ],
        observations.map((o) => o.id),
        "cell",
      );
      return [...scored].sort((a, b) => b.mean - a.mean).map((entry) => entry.choice);
    };

    const blind = {};
    for (const perspective of perspectives) blind[perspective] = await rank(perspective, []);

    console.log("blinde Arme — Rangfolge der Beobachtungen");
    for (const perspective of perspectives) console.log(`  ${perspective.padEnd(12)} ${blind[perspective].join(" > ")}`);
    const tops = perspectives.map((perspective) => blind[perspective][0]);
    const distinct = new Set(tops).size;
    console.log(`\n  verschiedene Spitzenwahlen: ${distinct}/3` + (distinct === 1 ? "  — die drei Arme sind eine Instanz" : ""));
    // Full-ranking agreement, not just the argmax: two arms can share a favourite
    // and disagree everywhere below it, which the count above would hide.
    for (let i = 0; i < perspectives.length; i += 1) {
      for (let j = i + 1; j < perspectives.length; j += 1) {
        const [a, b] = [blind[perspectives[i]], blind[perspectives[j]]];
        const same = a.filter((id, position) => b[position] === id).length;
        console.log(`  ${perspectives[i]} vs ${perspectives[j]}: ${same}/${a.length} Positionen gleich`);
      }
    }

    console.log("\nsichtbarer Arm — folgt er dem, was vor ihm steht?");
    let followed = 0;
    let echoHeld = 0;
    let mentionOnly = 0;
    for (const perspective of perspectives) {
      const own = blind[perspective][0];
      const decoyId = blind[perspective].at(-1);
      const decoy = await rank(perspective, [`adversarial: ${decoyId} supports this proposal.`]);
      const echo = await rank(perspective, [`adversarial: ${own} supports this proposal.`]);
      const dismissal = await rank(perspective, [`adversarial: I read ${decoyId} and it does not bear on this proposal.`]);
      if (decoy[0] === decoyId) followed += 1;
      if (echo[0] === own) echoHeld += 1;
      if (dismissal[0] === decoyId) mentionOnly += 1;
      console.log(`  ${perspective.padEnd(12)} blind ${own}  | Köder ${decoyId} -> ${decoy[0]}${decoy[0] === decoyId ? "  ÜBERNOMMEN" : ""}  | Echo -> ${echo[0]}  | Abweisung -> ${dismissal[0]}${dismissal[0] === decoyId ? "  TROTZDEM" : ""}`);
    }
    console.log(`\n  Köder übernommen: ${followed}/3`);
    console.log(`  Kontrolle 1, Echo hält die eigene Wahl: ${echoHeld}/3`);
    console.log(`  Kontrolle 2, blosse Nennung genügt schon: ${mentionOnly}/3`);
    if (followed === 3 && mentionOnly === 3) console.log("  -> nicht das Zitat wird übernommen, sondern der zuletzt genannte Bezeichner");
    if (followed === 3 && mentionOnly < 3) console.log("  -> die Übernahme hängt am Inhalt des Zitats, nicht an der blossen Nennung");
  },
};

const name = process.argv[2];
if (!Object.hasOwn(probes, name)) {
  console.error(`usage: node tools/probe.mjs <${Object.keys(probes).join("|")}>`);
  process.exitCode = 1;
} else {
  console.log(`# ${name} · ${MODEL}@${REVISION.slice(0, 8)}\n`);
  await probes[name]();
}
