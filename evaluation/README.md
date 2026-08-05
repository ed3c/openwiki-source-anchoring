# Multi-OpenWiki Repository-Understanding Evaluation

This directory defines how to compare multiple generated OpenWiki document trees against the source repositories they claim to explain.

The primary question is not whether a wiki looks polished. It is:

> Can an agent that is allowed to read one wiki, but not the source repository, answer, navigate, reason about changes, and complete engineering tasks more accurately than an agent reading another wiki?

The deterministic manifest validator is part of the trust boundary. Model-based evaluators are optional analysis tools and do not replace source-derived acceptance criteria, executable tests, or human calibration.

## One evaluation sample

A sample is the complete tuple:

```text
source repository + exact source commit + OpenWiki tree + generation run + prompt/config provenance
```

The top-level experimental unit is **repository × generation run**. Pages, claims, questions, and judge decisions are nested observations. Do not report hundreds of pages or claims as hundreds of independent experiments.

## Quick start

Copy and complete the manifest template:

```sh
cp evaluation/manifest.example.json evaluation/manifest.local.json
```

Validate its structure:

```sh
bun run evaluation/src/validate_manifest.mjs evaluation/manifest.local.json
```

Validate all referenced paths and filesystem boundaries:

```sh
bun run evaluation/src/validate_manifest.mjs \
  evaluation/manifest.local.json \
  --root . \
  --check-paths
```

Run the positive and adversarial controls:

```sh
sh evaluation/selftest.sh
```

Exit codes are stable:

- `0`: manifest passes;
- `2`: manifest or path contract fails;
- `64`: invalid command usage.

## Required manifest boundaries

Each repository record must identify:

- the source repository and exact 40-character commit SHA;
- the local immutable source snapshot;
- every OpenWiki output, method, run ID, and generation provenance status;
- development, public, and holdout question splits;
- repository QA, navigation, change-impact, and implementation task files;
- forbidden roots for each isolated role.

The validator rejects:

- duplicate repository or output IDs;
- non-exact source SHAs;
- source and generated-output path overlap;
- nested or overlapping output roots;
- reused split paths;
- missing paths when `--check-paths` is enabled;
- lexical `..` escape and realpath/symlink escape;
- a manifest that treats pages or claims as the top-level experimental unit;
- “complete” provenance without immutable model, prompt, and configuration identifiers.

Historical runs may declare `partial` or `unknown` provenance. The gap must remain visible; it must not be inferred from family labels such as `sonnet` or `opus`.

## Evaluation pipeline

### 0. Freeze before generation

Before producing any candidate wiki, freeze:

- source repository and commit;
- generation prompt and configuration hashes;
- primary outcomes;
- question/task split rule;
- exclusion roots;
- judge rubric;
- repeat count and stopping rule.

A baseline-relative threshold must be declared as such. Do not describe it as fixed before any result existed.

### 1. Build source-derived tasks without reading any wiki

Use one or more independent task authors that may read only the frozen source snapshot. They must not read:

- any OpenWiki output;
- review transcripts;
- prior corrections or findings;
- previous answer or judge outputs.

Prefer facts with deterministic or executable oracles:

- exact configuration values and precedence;
- file and symbol locations;
- CLI defaults and exit behavior;
- workflow triggers;
- side effects and write boundaries;
- schema fields;
- fallback and failure branches;
- test-enforced invariants.

The task author prompt is in [`prompts/OPENWIKI_EVALUATION_PROMPTS.md`](prompts/OPENWIKI_EVALUATION_PROMPTS.md).

### 2. Audit and split the task bank

Human-audit a calibration subset for ambiguity, source drift, impossible criteria, and accidental wiki knowledge. Split mechanically into:

- **development**: may guide prompt and implementation changes;
- **public**: may be used for published iteration, but becomes spent after use;
- **holdout**: used once for the preregistered comparison, then marked spent.

Do not move a failed item between splits after results are visible.

### 3. Answer with exactly one wiki

Each answerer receives:

- one anonymous OpenWiki tree;
- one question or task;
- a fixed answer format.

It must not receive source code, other wikis, answer keys, experiment findings, or the identity of the arm. Run multiple answer generations when estimating stochastic performance.

### 4. Grade blind against source-derived criteria

The judge receives anonymous answers and acceptance criteria. Rotate answer order. The judge must not receive:

- arm names;
- aggregate totals;
- anchor rates;
- the source repository unless the grading protocol explicitly requires source verification;
- previous judge outputs.

Preserve raw judge inputs, outputs, model IDs, parameters, and label mappings. Calibrate at least a subset against independent human judgments and report agreement.

### 5. Run downstream engineering tasks

QA alone measures answerability. Repository understanding should also be tested through tasks whose success is mechanically observable:

- identify the correct file and symbol;
- predict change impact and affected tests;
- produce a small patch;
- add or select a regression test;
- diagnose a controlled failure.

Use isolated containers or disposable worktrees. Score the final state with tests and patch constraints, following the same principle used by SWE-bench-style evaluation: outcome first, explanation second.

### 6. Repeat at the correct levels

Recommended minimum for a publishable comparison:

- at least two source repositories with different structures or languages;
- at least two independent wiki generations per method;
- repeated answer generations;
- at least two judges or one judge plus human calibration;
- paired evaluation: every arm receives the same frozen items.

A single run may be reported as directional evidence, not as equivalence or a universal effect.

## Scorecard

| Dimension | What it measures | Preferred oracle |
|---|---|---|
| Lexical validity | Named path exists and quoted text occurs there | deterministic script |
| Atomic claim support | Evidence actually supports the adjacent claim | source-grounded human/judge calibration |
| Contradiction rate | Wiki claim conflicts with source behavior | source inspection or executable oracle |
| Repository QA | Correct answer from wiki alone | frozen acceptance criteria |
| Navigation | Correct source file/symbol in top-k | exact path/symbol oracle |
| Change impact | Correct affected components/tests/contracts | source-derived rubric + tests |
| Implementation success | Patch satisfies the requested behavior | isolated test suite |
| Abstention calibration | Says “not documented” when evidence is absent | labeled answerability set |
| Efficiency | Tokens, latency, wiki size, cost | deterministic logs |
| Robustness | Variance across repositories, generations, answerers, and judges | repeated paired runs |
| Maintenance | Claims stale after a source change | commit-drift evaluation |

Primary outcomes should be reader-facing. `anchor_rate` remains a process diagnostic.

## Statistical reporting

Report raw counts and per-item transitions, then uncertainty.

Recommended analyses:

- paired bootstrap or permutation tests over questions within each repository-run;
- cluster bootstrap with repository-generation run as the resampling unit;
- mixed-effects logistic models when there are enough repositories and runs;
- preregistered equivalence margin plus TOST or a documented Bayesian equivalence model for “no material difference” claims;
- inter-rater agreement and human calibration for judge-based labels.

Do not treat correlated pages, claims, or questions from one run as independent replications. Avoid headline claims from one-to-three item differences at `n=30` without repeats.

## Contamination controls

For every role, enforce read boundaries with process isolation or filesystem permissions—not only prompt instructions.

Check for:

- an output wiki copied into the source snapshot;
- anchors into another wiki, `.openwiki-review`, QA, results, or review transcripts;
- reused questions whose answers have influenced a candidate;
- generated pages that contain acceptance criteria or judge notes;
- source commit drift between arms;
- one arm inheriting hand-written pages another arm was allowed to edit;
- different scoring denominators across arms.

The delivered document set and measured generated set may differ. Declare both explicitly.

## Interpretation ladder

Use these labels in results:

1. **Observed:** directly present in raw data or deterministic output.
2. **Supported inference:** reasonable under the stated design and limitations.
3. **Hypothesis:** plausible mechanism requiring a new comparison.
4. **Not licensed:** a conclusion the design cannot identify.

Examples:

- Equal PASS totals in one run are an observation, not evidence of equivalence.
- Lexical quote matching is not semantic entailment.
- A better fresh-generation arm does not isolate the effect of removing a gate when authoring mode also changed.
- A result on one synthetic repository does not establish transfer to mature multi-language repositories.

## Rollout

### P0 — trust boundary

- complete the manifest for every current OpenWiki tree;
- freeze source SHAs and document exclusions;
- run the validator in CI;
- publish raw prompts, answers, judgments, and mappings when rights permit;
- distinguish lexical validity from semantic support.

### P1 — reader utility

- add navigation and change-impact tasks;
- add a small executable implementation task set;
- repeat answer and judge runs;
- human-audit a calibration subset;
- compare at least two repositories.

### P2 — benchmark quality

- run multiple generation seeds per method;
- add cluster-aware uncertainty and equivalence testing;
- perform an external blind reproduction;
- version tasks and result schemas;
- publish an anonymized cross-repository leaderboard only after the harness is stable.

See [`TOOLING.md`](TOOLING.md) for optional permissively licensed components. None of them should become the sole oracle for whether a wiki understands its source repository.
