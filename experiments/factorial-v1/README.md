# Factorial Replication v1

This directory freezes and executes the next stochastic experiment for issue #8. It separates authoring mode from mechanical-gate use, preserves immutable provenance, randomizes run order, records failed runs, and analyzes run-level outcomes.

## Current evidence state

- **Production model runs:** 0
- **Observed factorial results:** none
- **Synthetic infrastructure run:** available and tested

Synthetic smoke output validates code paths only. It is not an experiment result.

## Fast infrastructure check

```sh
bun run experiments/factorial-v1/smoke-test.mjs
```

Expected final line:

```text
factorial infrastructure: PASS (synthetic smoke only; no research result)
```

## Production sequence

```sh
# 1. Fill and freeze immutable inputs
bun run experiments/factorial-v1/validate-study.mjs \
  path/to/study-config.json \
  --write-freeze path/to/freeze.json

# 2. Freeze randomized run order
bun run experiments/factorial-v1/randomize.mjs \
  path/to/study-config.json \
  --output path/to/schedule.json

# 3. Execute adapter-backed runs
bun run experiments/factorial-v1/run-study.mjs \
  path/to/study-config.json \
  path/to/freeze.json \
  path/to/schedule.json

# 4. Produce dependency-free descriptive analysis
bun run experiments/factorial-v1/analyze.mjs \
  path/to/study-config.json \
  path/to/freeze.json \
  path/to/schedule.json \
  --output path/to/analysis.json \
  --markdown path/to/analysis.md
```

See [`EXECUTION.md`](EXECUTION.md) for adapter contracts, failure behavior, security boundaries, and the production checklist.

## Planning simulation

Before freezing repeats, replace the protocol's engineering minimum with a documented planning assumption or pilot:

```sh
bun run experiments/factorial-v1/plan-repeats.mjs \
  experiments/factorial-v1/planning-assumptions.example.json \
  --output /tmp/planning.json \
  --markdown /tmp/planning.md
```

The simulation is assumption-driven. It is not evidence about real model variance or effect size.

## Files

- `PROTOCOL.md` — hypotheses, cells, outcomes, stopping, contamination, and raw-artifact rules
- `analysis-plan.md` — confirmatory contrasts, equivalence, uncertainty, and reporting
- `EXECUTION.md` — freeze, adapter, run, failure, and analysis workflow
- `study-config.template.json` — production configuration skeleton
- `run-manifest.schema.json` — v2 fail-closed run record
- `validate-study.mjs` — production hard gates and freeze generation
- `randomize.mjs` — deterministic run-order assignment
- `run-study.mjs` — adapter orchestration, receipts, raw artifacts, and manifests
- `analyze.mjs` — run-level descriptive estimates and deterministic bootstrap intervals
- `plan-repeats.mjs` — planning-only Monte Carlo scenarios
- `smoke-test.mjs` — five-cell deterministic end-to-end pipeline test
- `fixtures/` and `adapters/mock-*` — synthetic smoke inputs only

## Closure condition for issue #8

The issue remains open until all planned production cells and repeats are executed with immutable model configuration, G1 receives reader-facing QA, raw prompts/answers/judgments are published or releasably archived, and the prespecified uncertainty/equivalence analysis is reported.
