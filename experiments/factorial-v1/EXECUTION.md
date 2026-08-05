# Factorial Study Execution

The files in this directory separate three states that must never be conflated:

1. **Synthetic pipeline test** — deterministic mock data prove that freezing, randomization, adapter execution, manifests, and analysis work end to end.
2. **Frozen prospective study** — a complete production configuration and schedule are committed before outcome generation.
3. **Observed experiment** — real model outputs, receipts, judgments, and analysis exist for every planned run.

Only state 3 produces research evidence.

## One-command infrastructure check

```sh
bun run experiments/factorial-v1/smoke-test.mjs
```

Expected final line:

```text
factorial infrastructure: PASS (synthetic smoke only; no research result)
```

The smoke run uses `deterministic-mock`. Its rates and contrasts are synthetic and must not be copied into README results.

## Freeze a production study

1. Copy `study-config.template.json` to a new immutable study directory.
2. Replace every `REPLACE_*` value.
3. Copy the exact authoring, answerer, and judge prompts into that directory.
4. Record exact provider model IDs, parameters, runtime versions, target commit, question-bank hashes, budget, and equivalence margin.
5. Validate and write the freeze record:

```sh
bun run experiments/factorial-v1/validate-study.mjs \
  path/to/study-config.json \
  --write-freeze path/to/freeze.json
```

The production validator rejects:

- mutable family aliases such as `latest`, bare `sonnet`, or bare `opus`;
- fewer than five wiki runs per cell;
- fewer than three answer generations per question/wiki;
- fewer than two judges;
- missing or changed prompt/question/protocol hashes;
- mock providers;
- missing target or protocol commit SHAs.

Commit the config, prompts, protocol, validation code, and freeze record before generating outcomes.

## Randomize run order

```sh
bun run experiments/factorial-v1/randomize.mjs \
  path/to/study-config.json \
  --output path/to/schedule.json
```

The schedule contains all `A`, `R0`, `R1`, `G0`, and `G1` repeats in deterministic randomized order. Commit it before execution.

## Adapter contract

The study runner invokes three commands from the config. Each receives these environment variables:

```text
OW_EXPERIMENT_ID
OW_EVIDENCE_CLASS
OW_RUN_ID
OW_CELL
OW_REPEAT_INDEX
OW_RUN_DIR
OW_WIKI_DIR
OW_TARGET_DIR
OW_QUESTION_BANK
OW_SPLIT_MANIFEST
OW_ANSWERS_PATH
OW_JUDGMENTS_PATH
OW_COST_LOG
OW_ERROR_LOG
OW_ANSWER_REPEATS
OW_JUDGES
OW_CONFIG_PATH
OW_FREEZE_PATH
OW_STAGE
```

### Authoring adapter

Must create `OW_WIKI_DIR`. The adapter implements the cell semantics:

- `A`: zero-verification baseline;
- `R0`: retrofit verification convention without a mechanical gate;
- `R1`: retrofit verification with the gate;
- `G0`: verification during fresh authoring without the gate;
- `G1`: verification during fresh authoring with the gate.

### Answering adapter

Must write JSON Lines to `OW_ANSWERS_PATH`:

```json
{"run_id":"g1-r01-...","question_id":"q001","answer_repeat":1,"answer":"raw answer text"}
```

### Judging adapter

Must write JSON Lines to `OW_JUDGMENTS_PATH`:

```json
{"run_id":"g1-r01-...","question_id":"q001","answer_repeat":1,"judge_id":"judge-1","verdict":"PASS"}
```

Allowed verdicts are `PASS`, `PARTIAL`, and `FAIL`. Every answer needs the configured number of independent judge records.

Adapters should append provider, model ID, token, latency, and cost records to `OW_COST_LOG`. Failures and retries should be appended to `OW_ERROR_LOG`. Never place API keys in either file.

## Execute

```sh
bun run experiments/factorial-v1/run-study.mjs \
  path/to/study-config.json \
  path/to/freeze.json \
  path/to/schedule.json
```

Use `--resume` only to skip already completed manifests. A failed run remains preserved; a replacement receives a new schedule/run ID and links to the failed run rather than overwriting it.

The auditor may return exit `2` for a complete run that misses lexical/process thresholds. That is recorded as an observed outcome. Exit `3`, exit `64`, invalid JSON, or `complete !== true` makes the run fail closed.

## Analyze

```sh
bun run experiments/factorial-v1/analyze.mjs \
  path/to/study-config.json \
  path/to/freeze.json \
  path/to/schedule.json \
  --output path/to/analysis.json \
  --markdown path/to/analysis.md
```

The dependency-free analysis reports run-level descriptive estimates and deterministic run-level bootstrap intervals for:

- gate main effect;
- authoring-mode main effect;
- interaction;
- G1 versus baseline A.

The committed descriptive analysis does not replace the prespecified hierarchical or cluster-aware confirmatory model in `analysis-plan.md`.

## Security and cost boundary

The repository does not run paid model calls automatically in pull-request CI. Production adapters execute only in an operator-controlled environment with explicit credentials, budget limits, target access, and logs. GitHub Actions runs only the synthetic smoke test.
