---
type: Playbook
title: Autoresearch-Composer Lifecycle
description: What the autoresearch_composer asset optimizes, the executed golden-dataset and ablation evidence behind its production gate, and the hardening it still lacks.
tags: [autoresearch, evals, promotion]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [golden-dataset-eval, ablation-gate, promotion-readiness]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Autoresearch-Composer Lifecycle

`skills/autoresearch_composer/` is the asset this repository has taken furthest through the lifecycle.
Its registry status is `production-seed-candidate` — a candidate, not an admitted asset.

## Concrete Optimization

The asset's stated purpose is to stop a compressed context from silently becoming a route decision. It
forces a plan into a state graph — match, then route, then generate, then validate — and each of those
is a separate node with its own failure edge, rather than one fused prompt that returns one confident
answer. Recovery for a thin prompt is explicit: **missing Domain terms** are recovered through
`skills/autoresearch_composer/references/state_graph.md` rather than guessed, which is why
`conditional_edge.S3.missing_domain_term` exists as a real edge instead of a retry.

The measured consequence is unusually clean. With the asset in context, all 12 behavior cases pass;
without it, none do:

| Arm | Success rate |
|---|---|
| with skill | `1.0` |
| without skill | `0.0` |

## Golden Standard Example

A **Golden Dataset cases** file pins expected behavior per case rather than scoring free text.
`data/autoresearch_golden/pr_golden_set.json` is the pull-request set; each case declares
`expected_route`, `must_include`, `must_not_include`, `judge_rubric`, `trace_tags` and `risk_level`,
and `scripts/eval_autoresearch_composer.py::validate_case_schema()` rejects a case missing any of
them by diffing the case against a required-field set
(src: scripts/eval_autoresearch_composer.py `missing = sorted(REQUIRED_CASE_FIELDS - set(case))`).
That set is two fields wider than the six named above — `id` and `prompt` are required as well — and
three of the fields are additionally type-checked as `list[str]`, so a case that declares them as a
bare string is rejected too.

The registry records the same file as the pull-request gate rather than the nightly one
(src: data/lifecycle/golden_dataset_versions.json `"promotion_use": "pull-request gate"`).

The evaluation order matters: `deterministic_guardrails()` runs first and checks route equality plus
the literal include/exclude lists; only then does a judge see the result. A route mismatch is a hard
failure that no judge score can rescue.

## Production Gate

Promotion is gated on evidence, not on the asset reading well.

**A/B ablation is a hard gate.** `scripts/check_autoresearch_lifecycle.py` re-runs
`scripts/ablation_engine.py --cases skills/autoresearch_composer/cases.json --json` and fails unless the
telemetry satisfies all of: `case_count == 12` (src: scripts/check_autoresearch_lifecycle.py
`telemetry["case_count"] != 12`), `delta > 0.05`, `verdict == PASS`,
`negative_case_count == 6`, and `negative_with_skill_success_rate == 1.0` — the five conditions are one
disjunction, so any single one failing appends `ablation telemetry insufficient`. The negative half is not
decoration — an asset that fires on everything would score well on positives alone, so the gate
requires that the six negative cases are correctly *not* triggered.

The same gate cross-checks the repo asset against its upstream source skill: it parses both
`cases.json` files and fails when the two parsed structures differ
(src: scripts/check_autoresearch_lifecycle.py `if source_cases != repo_cases:`), so the production copy
cannot drift from the authored one. The comparison is on parsed JSON, not on bytes, so a pure
reformatting of either file still passes.

That cross-check is conditional, not unconditional: it is skipped entirely when the upstream tree is
absent, because the source-side reads are guarded by a single existence probe
(src: scripts/check_autoresearch_lifecycle.py `source_required_available = (PROJECT_ROOT / ".claude").exists()`).

## Executed Autoresearch-Composer Data

Reproduced by running each command in the repository root:

| Command | Reported |
|---|---|
| `python3 scripts/eval_autoresearch_composer.py --dataset data/autoresearch_golden/pr_golden_set.json` | `cases=4` `passed=4` `mode=local` `cloud_judge_enabled=false` |
| `python3 scripts/eval_autoresearch_composer.py --dataset data/autoresearch_golden/nightly_golden_set.jsonl` | `cases=3 passed=3 mode=local cloud_judge_enabled=false` |
| `python3 scripts/sample_autoresearch_traces.py` | `sample_count=3` `observed_state_count=5` |
| `python3 scripts/ablation_engine.py --cases skills/autoresearch_composer/cases.json` | `delta=1.0` `case_count=12` `success_rate=1.0` `verdict=PASS` |

The ablation figure is dataset-specific. Run with no `--cases` argument the same script falls back to a
different asset's corpus (src: scripts/ablation_engine.py `default=ROOT / "skills" / "gemini_interactions" / "cases.json"`),
and that run prints `PASS: ablation delta=0.50 case_count=10 success_rate=1.0 verdict=PASS`. So the
`delta=1.0` in the table above is only reachable with the explicit `--cases` path; a delta quoted
without its dataset is not a fact about this asset.

## Lifecycle Data Artifacts

The machine-readable side lives under `data/lifecycle/` and is the SSOT; the Markdown view of it is
generated, never hand-edited — see [Structured Lifecycle Data](structured-lifecycle-data.md), and the
cross-consistency rules behind it in
[Structured lifecycle datasets](../lifecycle/structured-datasets.md).

| Artifact | Holds |
|---|---|
| `data/lifecycle/skill_optimization_registry.json` | the managed skill and its `current_status` (src: data/lifecycle/skill_optimization_registry.json `"current_status": "production-seed-candidate"`) |
| `data/lifecycle/golden_dataset_versions.json` | `autoresearch-pr-golden@2026-07-23` (src: data/lifecycle/golden_dataset_versions.json `"dataset_version": "autoresearch-pr-golden@2026-07-23"`) and `autoresearch-nightly-golden@2026-07-23`, with 4 and 3 cases |
| `data/lifecycle/eval_runs/autoresearch_composer_2026-07-23.json` | the recorded run summary (src: data/lifecycle/eval_runs/autoresearch_composer_2026-07-23.json `"run_id": "autoresearch-composer-2026-07-23-local"`) |
| `data/lifecycle/promotion_records.json` | promotion decisions, still unadmitted (src: data/lifecycle/promotion_records.json `"promotion_status": "candidate_until_human_admit"`) |
| `data/lifecycle/dataset_drift_history.jsonl` | dataset drift over time |
| `data/lifecycle/trace_privacy_classification.json` | per-dataset privacy classification (src: data/lifecycle/trace_privacy_classification.json `"classification": "synthetic-local"`) |
| `data/autoresearch_traces/{local_trace_samples,failure_trace_samples}.jsonl` | local-first trace samples |

`scripts/check_lifecycle_datasets.py` enforces that the display page — the `nonofficial/structured-lifecycle-data.md`
page, not this one — is string-equal to the renderer's stdout
(src: scripts/check_lifecycle_datasets.py `elif openwiki != rendered.stdout:`), so hand-editing the
Markdown view fails the gate rather than silently diverging from the data.

The same script pins the two dataset versions to their exact case counts, which is where the 4 and 3
in the table above come from (src: scripts/check_lifecycle_datasets.py `"autoresearch-pr-golden@2026-07-23": 4,`);
it also pins the eval-run summary field by field, including `ablation_delta` at `1.0` and the promotion
record at `candidate_until_human_admit`.

## Missing Future Hardening

Stated plainly, because a candidate that reads as finished is the failure mode this repository is built
against:

- **No real-driver evidence for this asset.** Every number above comes from a deterministic simulation
  (`simulate_autoresearch_plan()`, `simulate_agent()`). The runner that invokes an actual agent is
  `scripts/real_driver_ablation.py` (src: scripts/real_driver_ablation.py `Run a real agent command against the same cases with and without skill context.`),
  and its default corpus is a different asset's
  (src: scripts/real_driver_ablation.py `DEFAULT_CASES = ROOT / "skills" / "gemini_interactions" / "cases.json"`).

  (inferred) No recorded real-driver run names this asset: `data/verification_runs/` holds three run
  files and a grep for `autoresearch` across that directory returns nothing, and no eval-run ledger
  under `data/lifecycle/eval_runs/` records a real-driver command. The one asset that was measured that
  way failed its preregistered threshold
  (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"decision": "A2_FAIL_DO_NOT_PROMOTE"`)
  and is now quarantined (src: skills/gemini_interactions/status.json `"status": "quarantined",`); see
  [gemini_interactions](../skill-assets/gemini-interactions.md).
- **The judge is a heuristic.** `local_llm_as_judge()` assigns `0.96` when no guardrail failed and a
  degrading score otherwise. It adds no independent signal beyond the deterministic guardrails.
- **cloud/API judge execution is physically wired but disabled unless explicitly enabled** — read that
  precisely. The branch exists, `--mode cloud` selects it, and `ENABLE_LLM_JUDGE=1` is the switch. When
  enabled, `cloud_judge()` returns `judge_mode: cloud-placeholder-disabled-in-seed` with verdict `SKIP`
  and makes **no HTTP request**. The wiring is the code path and the environment contract, not a
  provider call. Additionally `.github/workflows/autoresearch_eval.yml` passes the string `true` while
  the code requires `"1"`, so the workflow's opt-in job would not activate even that placeholder.
- **A 12-case corpus is small** for a claim of `delta=1.0`, and the without-skill arm scoring exactly
  `0.0` reflects a simulator built to contrast, not a measurement of a real agent's baseline.

## Validation

```sh
python3 scripts/check_autoresearch_lifecycle.py
python3 scripts/eval_autoresearch_composer.py --dataset data/autoresearch_golden/pr_golden_set.json
python3 -m pytest -q -m evals
```
