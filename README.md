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
3. **Evidence must exist in the environment.** A cell cannot create an observation and cite it as evidence in the same action.
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
- Schema-valid evidence references are not the same as semantic entailment.

Version 0.1 establishes the experimental substrate. The next research stage is a blinded benchmark against a single cell, best-of-N independent cells, fixed-role communicating agents and the growing stigmergic condition.

## Experiment 005

The fifth embryo repeats Experiment 004 with one controlled change. It begins with the same open goal, configuration, prompts and empty observation set. Questioner, proposer, adversarial reviewer, charitable reviewer, coherence reviewer and synthesizer still use the pinned 135M model. Only the meta-reviewer, which must integrate the three review traces and emit `ACCEPT`, `REVISE` or `REJECT`, uses the pinned 360M model. This tests whether a slightly larger integrator is enough to turn the reviewer collective into actionable collective judgment.
