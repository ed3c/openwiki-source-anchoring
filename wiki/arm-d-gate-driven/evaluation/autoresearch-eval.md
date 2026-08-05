---
type: Component
title: Autoresearch eval harness, golden datasets and trace sampling
description: The local-first eval suite for the autoresearch_composer asset — case schema, simulated routing, deterministic guardrails, the local heuristic judge, trace sampling, and the aggregate lifecycle gate; including exactly why the cloud judge path can never run.
tags: [evaluation, golden-dataset, judge, traces]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [autoresearch-eval, golden-dataset, trace-sampling, lifecycle-gate]
libraries: [python, pytest]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Autoresearch eval harness, golden datasets and trace sampling

## The harness

`scripts/eval_autoresearch_composer.py` is the local-first eval and judge
harness (src: scripts/eval_autoresearch_composer.py `Local-first eval and judge harness for autoresearch-composer.`).
It accepts a JSON list, a JSON object with `cases`, or JSONL
(src: scripts/eval_autoresearch_composer.py `dataset must be a JSON list, JSON object with cases, or JSONL records`), and
every case must carry eight fields
(src: scripts/eval_autoresearch_composer.py `REQUIRED_CASE_FIELDS = {`) with three of them typed as string lists
(src: scripts/eval_autoresearch_composer.py `must be list[str]`).

The "agent" is a routing function over the prompt
(src: scripts/eval_autoresearch_composer.py `def simulate_autoresearch_plan(prompt: str) -> dict[str, object]:`). Debug,
security and test prompts yield to native skills — for example
(src: scripts/eval_autoresearch_composer.py `route = "native-yield:security-review"`) — while eval-shaped and
generic prompts take a slash route
(src: scripts/eval_autoresearch_composer.py `route = "/autoresearch:plan"`) and add the generate and validate
states. Guardrails then compare route and literals
(src: scripts/eval_autoresearch_composer.py `failures.append(f"forbidden literal present: {literal}")`).

The local judge is a deterministic function of the guardrail result
(src: scripts/eval_autoresearch_composer.py `score = 0.96 if not failures else max(0.0, 0.82 - (0.05 * len(failures)))`) with a
bar of (src: scripts/eval_autoresearch_composer.py `verdict = "PASS" if score >= 0.85 and not failures else "FAIL"`) and a mode
label (src: scripts/eval_autoresearch_composer.py `"judge_mode": "local-heuristic",`).

## The cloud path cannot run — three separate reasons

1. **Env value mismatch.** `cloud_judge` only recognises the string `1`
   (src: scripts/eval_autoresearch_composer.py `if os.environ.get("ENABLE_LLM_JUDGE") != "1":`), while the workflow
   forwards the repository variable verbatim
   (src: .github/workflows/autoresearch_eval.yml `ENABLE_LLM_JUDGE: ${{ vars.ENABLE_CLOUD_EVALS }}`) from a job guarded on
   the string `true` (src: .github/workflows/autoresearch_eval.yml `if: ${{ vars.ENABLE_CLOUD_EVALS == 'true' }}`).
2. **No implementation behind the flag.** Even with `1`, the function returns a
   placeholder (src: scripts/eval_autoresearch_composer.py `"judge_mode": "cloud-placeholder-disabled-in-seed",`)
   whose reasoning says the path "is intentionally not activated in the
   local-first seed" (src: scripts/eval_autoresearch_composer.py `is intentionally not activated in the local-first seed`).
   The only thing the API key controls is whether the call raises
   (src: scripts/eval_autoresearch_composer.py `OPENAI_API_KEY is required only when ENABLE_LLM_JUDGE=1`).
3. **SKIP counts as success.** Only a `FAIL` verdict is collected as a failure
   (src: scripts/eval_autoresearch_composer.py `if case_failures or judge["verdict"] == "FAIL":`), so a whole
   `--mode cloud` run can exit zero having judged nothing.

(inferred) Documenting this precisely matters because the surface looks like an
opt-in cloud evaluation and is not one. The manifest's own wording is the honest
version — the policy is `implemented_disabled_by_default`
(src: plan-package.compat.yaml `autoresearch_cloud_judge_policy: implemented_disabled_by_default`) — and a
run of that job is not promotion evidence.

The success line always reports the flag it observed
(src: scripts/eval_autoresearch_composer.py `cloud_judge_enabled={str(payload['cloud_judge_enabled']).lower()}`), which is
what downstream gates and tests assert on.

## Datasets

`data/autoresearch_golden/pr_golden_set.json` is the pull-request set and
`nightly_golden_set.jsonl` the nightly one; both are pinned in the manifest
(src: plan-package.compat.yaml `autoresearch_golden_dataset: data/autoresearch_golden/pr_golden_set.json`) and
their versions and case counts are re-asserted by the
[lifecycle datasets](lifecycle-datasets.md) gate.

## Trace sampling

`scripts/sample_autoresearch_traces.py` validates local-first trace samples
(src: scripts/sample_autoresearch_traces.py `Validate local-first autoresearch trace samples.`). Each JSONL row
must carry seven fields (src: scripts/sample_autoresearch_traces.py `REQUIRED_TRACE_FIELDS = {`), must be
local-only (src: scripts/sample_autoresearch_traces.py `cloud_judge_enabled must be false in seed traces`), and must
carry a legal verdict (src: scripts/sample_autoresearch_traces.py `invalid verdict`). Across the file, four
state names must have been observed at least once
(src: scripts/sample_autoresearch_traces.py `for state in ("S1 match", "S2 route", "S3 generate", "S4 validate"):`), with a
minimum sample count (src: scripts/sample_autoresearch_traces.py `parser.add_argument("--min-samples", type=int, default=3)`).
The observed count is pinned by test
(src: tests/test_autoresearch_eval_suite.py `assert "sample_count=3" in result.stdout`).

## The aggregate lifecycle gate

`scripts/check_autoresearch_lifecycle.py` is the composition of everything above
(src: scripts/check_autoresearch_lifecycle.py `Validate autoresearch-composer lifecycle optimization evidence.`). It:

- validates the repo corpus with the shared validator
  (src: scripts/check_autoresearch_lifecycle.py `validator.validate_cases(REPO_CASES)`) and, when the authoring
  workspace is present, requires the upstream and repo corpora to be identical
  (src: scripts/check_autoresearch_lifecycle.py `source cases and production repo cases differ`);
- pins literals in the asset, its reference and its lifecycle report, e.g.
  (src: scripts/check_autoresearch_lifecycle.py `"cloud/API judge hooks are present but disabled by default",`) and
  (src: scripts/check_autoresearch_lifecycle.py `"A/B ablation is a hard gate",`);
- re-runs the ablation and requires five simultaneous conditions
  (src: scripts/check_autoresearch_lifecycle.py `telemetry["case_count"] != 12`);
- re-runs both eval datasets and the trace sampler and greps their success lines
  (src: scripts/check_autoresearch_lifecycle.py `"PASS: autoresearch trace sampler" not in trace.stdout`).

Only then does it print
(src: scripts/check_autoresearch_lifecycle.py `PASS: autoresearch lifecycle optimization gate`). Note the
source-side literal list is skipped entirely when the authoring workspace is
absent (src: scripts/check_autoresearch_lifecycle.py `] if source_required_available else []`), which is the
case in a standalone checkout.

## Focused tests and CI

`tests/test_autoresearch_eval_suite.py` carries the marker
(src: tests/test_autoresearch_eval_suite.py `pytestmark = pytest.mark.evals`), declared in
(src: pyproject.toml `"evals: local-first Golden Dataset and deterministic judge tests",`), and the
workflow runs exactly that marker
(src: .github/workflows/autoresearch_eval.yml `run: python -m pytest -q -m evals`).

## Validation

```sh
python3 scripts/eval_autoresearch_composer.py --dataset data/autoresearch_golden/pr_golden_set.json
python3 scripts/sample_autoresearch_traces.py
python3 scripts/check_autoresearch_lifecycle.py
python3 -m pytest -q -m evals
```
