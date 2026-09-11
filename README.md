# Embryo

Embryo is a bounded experiment in developmental, stigmergic AI.

It asks a falsifiable question:

> Can homogeneous, locally acting language-model processes develop a differentiated, self-checking epistemic organization by modifying a persistent shared substrate?

This is not a multi-agent chat. Cells do not message one another and cannot request more cells. Each short-lived cell sees one local need and a small neighborhood of the current epistemic tissue. Its small output is converted into one schema-constrained proposal, while the unmodified raw output remains in the receipt. A deterministic gate alone decides whether that proposal changes the authoritative state.

The changed work product creates or removes structural needs. Those validated needs recruit later cells. The tissue therefore controls its own bounded growth.

## Biological analogy

| Embryo component | Biological analogy |
| --- | --- |
| Small LLM inference | Short-lived cell activity |
| Claim graph | Developing tissue |
| Persisted repository state | Extracellular matrix / durable body state |
| Open `NEED` | Local developmental gradient |
| Deterministic gate | Physical constraints |
| Git history and hash-chained receipts | Developmental lineage |
| Energy and generation limits | Metabolic and growth limits |
| Exhausted or resolved need | Inhibition / apoptosis |

The analogy is operational, not a claim that software is literally biological.

## Invariants

1. **Work, not messages, recruits cells.** A question creates a `PROPOSE` need; a proposal creates three `REVIEW_FRAGMENT` needs; their traces create a `META_REVIEW` need.
2. **Proposal is not consequence.** LLM output is never authoritative. The gate validates a closed action vocabulary and all referenced objects.
3. **Cells cannot invent their environment.** The closed action vocabulary has no way to create an observation. Observations enter only through the seed.
4. **Every attempt leaves a receipt.** Receipts are append-only, hash-linked, attributable and replay-checked.
5. **Growth is bounded.** Energy, attempts per need, cells per generation and total generations all have hard caps.
6. **No shared transcript.** A cell receives only a deterministic local view.

## Current developmental cycle

```text
QUESTION -> question -> PROPOSE -> proposal -> three REVIEW_FRAGMENT cells
    ^                                            |
    |                                            v
    +---------------- reject / reframe <- META_REVIEW -> accept / revise

enough accepted proposals -> SYNTHESIZE (proposer phenotype) -> review collective -> quiescence
```

The model does not choose to spawn anything. `deriveNeeds()` examines the accepted tissue and deterministically creates the next local work gradients.

## Run locally

Node.js 20 or later is required.

```bash
npm install
npm test
npm run status
```

The committed state begins at generation zero. Run a deterministic demonstration without downloading a model:

```bash
npm run step -- --backend deterministic --max-cells 4
npm run validate
npm run replay
```

Run actual cells with pinned SmolLM2 revisions. Questioner, proposer, reviewers and synthesizer use `SmolLM2-135M-Instruct`; only the meta-reviewer uses `SmolLM2-360M-Instruct`:

```bash
npm run step -- --backend smollm --max-cells 4
```

SmolLM runs locally inside the process. No model API or API key is used. The default Q4 model is downloaded to the Hugging Face cache on first use.

Reset the example organism:

```bash
npm run init
```

## GitHub Actions growth

The **Grow embryo** workflow executes one generation and writes the resulting tissue to the `embryo-state` branch. It never writes generated state directly to `main`.

By default, one manually dispatched workflow means one bounded generation. If `auto_grow` is enabled, a remaining validated need triggers another workflow generation. Recursion still stops when any of these conditions becomes true:

- no open needs remain;
- the energy budget is exhausted;
- the maximum generation is reached;
- repeated invalid output exhausts a need.

The `GITHUB_TOKEN` has only `contents: write` and `actions: write`. Generated model text is data; it is never executed as a command or program.

## State and audit files

- `examples/seed.json` — starting conditions for the current experiment
- `state/embryo.json` — authoritative current tissue
- `state/events.jsonl` — canonical hash-chained receipts
- `schemas/` — public closed schemas
- `src/gate.mjs` — sole authoritative mutation gate
- `src/needs.mjs` — deterministic growth and inhibition rules
- `src/local-view.mjs` — deterministic local perception

## What version 0.1 does not claim

- It does not train or alter model weights.
- It does not establish consciousness or subjecthood.
- It does not yet establish a collective-intelligence advantage.
- A schema-valid proposal is not a sound one. The gate checks structure and provenance, never meaning.

Version 0.1 establishes the experimental substrate. The next research stage is a blinded benchmark against a single cell, best-of-N independent cells, fixed-role communicating agents and the growing stigmergic condition.

## Experiments 005 to 008

Experiment 005 repeated Experiment 004 with one controlled change: every cell stayed on the pinned 135M model except the meta-reviewer, which integrates the three review traces and must emit `ACCEPT`, `REVISE` or `REJECT`. That one used the pinned 360M model.

It ran to quiescence on `embryo-state` and produced **no accepted proposal at all**: 64 of 64 energy units, 16 generations, 8 abandoned questions, 7 rejected proposals, goal still open. The meta-reviewer abstained in 21 of 21 attempts. The isolation of the variable was clean — the 43 non-meta receipts are byte-identical to those of Experiment 004 — but the aggregate decision counts of 004 and 005 are identical too, so the larger integrator changed the text and nothing else.

What did hold is the stigmergic machinery itself. Across all 64 cells the recruitment chain resolves exactly: 9 questions, 9 `PROPOSE` needs, 23 `REVIEW_FRAGMENT` needs — seven complete three-perspective panels plus two for an eighth, unfinished proposal — and exactly seven `META_REVIEW` gradients, one per completed panel. No cell requested any of them. Invariant 1 is demonstrated; only the judgment layer failed.

The cause of that failure was a defect, not a result. `SmolLmPolicy` handed the text-generation pipeline a plain string, and the pipeline only applies a model's chat template when it receives a message array. Both arms therefore ran instruction-tuned models in raw completion mode, which is why the receipts contain prompt continuations rather than reviews. Under the same prompt, the 360M meta-reviewer opens with a verdict once the chat template is applied and produced none without it.

Experiments 003 to 005 are affected by this and do not answer the question they were set up to ask. Their tissue is preserved on the `archive/embryo-00N` branches.

Three counter-runs on the repaired substrate, kept under [`docs/runs/`](docs/runs), separate the causes further. All end with no accepted proposal, each for a different reason:

- **006** — repaired interface, cells still on 135M. The models now follow instructions rather than continuing the prompt, but 135M produces assistant filler instead of a question or a proposal, and the substrate carries that faithfully downstream. An isolated measurement places the threshold between 135M and 360M, at the questioner and proposer rather than at the meta-reviewer.
- **007** — every cell on 360M. The content layer works: a real question, a real proposal. Everything downstream then collapses. The three reviewer perspectives emit byte-identical text in both panels, and the meta-reviewer continues the theme instead of judging it.

- **008** — as 007, but the verdict is read off the model's own distribution instead of being written and parsed back out. Each of `ACCEPT`, `REVISE` and `REJECT` is scored as the log-probability of its whole token sequence. The meta-reviewer then decides in three cases out of three, and the tissue runs three full revision rounds — the developmental cycle the README describes, working for the first time. But `ACCEPT` sits 2.3 to 2.5 nats behind the winner in every judgement, and a calibration against hand-written cases shows why: a proposal its three reviews unanimously praise still scores `REJECT`. The distribution carries no quality signal.

The last two are results rather than defects. The structural differentiation holds — `deriveNeeds()` recruits the right role, the local view masks per perspective, the gate enforces the closed vocabulary — but the behavioural differentiation does not follow, because the phenotypes are defined by prompt alone. At this model scale the cells are more homogeneous than intended: all of them are "continue the text". Taking the decision out of generation gets past that — the model does decide once its own distribution is read directly — but the wall behind it is the judgement itself. The organization forms; the differentiation does not.

One direction the report leaves open is worth naming here, because it follows from the invariants rather than working against them. Every run since 003 asks a single cell for a single act of judgement. The alternative is to put the judgement where every other state transition in this project already comes from — the substrate: a deterministic rule reading what has accumulated across rounds, the way `deriveNeeds()` already derives needs from the tissue rather than asking for them.

Experiment 001 is the only run in which anything ever survived review, and it decided mechanically: `SUPPORT` meant a claim stood in a checkable relation to a supplied observation, and a rejection recorded "Cell found no directly supporting supplied observation." Of eleven claims one held. The rewrite into question-proposal-review dropped that relation, the seed's observation set has been empty since 005, and nothing has held since. Invariant 3 still asks for evidence in the environment; the mechanism that enforced it is gone.

The full forensic report on all eight runs, with the ledger evidence and the calibration figures, is in [`docs/befund-experimente.md`](docs/befund-experimente.md) (German).
