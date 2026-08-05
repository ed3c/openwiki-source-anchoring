---
type: Component
title: The P11 zero-LLM regex canary
description: The 117-case synthetic corpus, the two regex runners that score it without any model call, and the quality report that deliberately declares the corpus insufficient.
tags: [evaluation, regex, canary, synthetic-cases]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [regex-canary, synthetic-cases, corpus-quality]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# The P11 zero-LLM regex canary

## What it proves, and what it does not

`PROJECT-SSOT.md` scopes the headline result itself: the "current P11 117/117
result is scoped to local zero-LLM regex canary truth"
(src: PROJECT-SSOT.md `local zero-LLM regex canary truth`), and real synthetic case
quality "remains insufficient until a persisted admitted corpus and quality gates
exist" (src: PROJECT-SSOT.md `remains insufficient until a persisted admitted corpus`).
The manifest repeats the scope as a pinned value
(src: plan-package.compat.yaml `p11_current_scope: local-zero-llm-regex-canary`).

(inferred) So the canary answers exactly one question — *if* an agent emitted
current-API code, would this pipeline notice, and would it notice legacy
regressions — and it answers it without spending a token. It says nothing about
whether a real agent would emit that code. That distinction is why the pipeline
keeps the number and the disclaimer in the same place.

## The corpus generator

`scripts/synthetic_case_generator.py` produces exactly 117 cases
(src: scripts/synthetic_case_generator.py `Generate deterministic 117-case Interactions API regex fixtures.`)
and refuses any other total
(src: scripts/synthetic_case_generator.py `FAIL: production P11 matrix must contain exactly 117 cases`).
Language alternates by index (src: scripts/synthetic_case_generator.py `return "typescript" if index % 2 else "python"`),
scenarios cycle through a ten-entry list
(src: scripts/synthetic_case_generator.py `SCENARIOS = (`), and every prompt carries the same
legacy bait clause (src: scripts/synthetic_case_generator.py `avoid legacy v2 chat naming even when the request mentions chat/session continuity.`).
Each case gets a per-language check set combining required patterns and
`FORBID:`-prefixed negatives, e.g.
(src: scripts/synthetic_case_generator.py `r"FORBID:\.startChat\("`). The summary goes to stderr
(src: scripts/synthetic_case_generator.py `PASS: generated synthetic_cases=`), which is why the
governance test asserts on stderr
(src: tests/test_skill_asset_governance.py `assert "synthetic_cases=117" in synthetic.stderr`) and why the
compat gate expects that stream too
(src: scripts/check_plan_package_compat.py `("stderr", ["synthetic_cases=117"])`). The split is pinned at
(src: tests/test_skill_asset_governance.py `assert "typescript=59" in synthetic.stderr`).

## The two runners

`scripts/interactions_patch_assert_runner.py` holds the syntax rules
independently of the corpus (src: scripts/interactions_patch_assert_runner.py `RULES = {`), with
`must_match` and `must_not_match` per language, and reports each violation kind
distinctly — (src: scripts/interactions_patch_assert_runner.py `Missing mandatory pattern:`) versus
(src: scripts/interactions_patch_assert_runner.py `Legacy regression pattern detected:`). It scores a
hard-coded compliant agent (src: scripts/interactions_patch_assert_runner.py `def patched_agent(_prompt: str, language: str) -> str:`),
computes a success rate, and grades it against a threshold
(src: scripts/interactions_patch_assert_runner.py `"TARGET_MET" if success_rate >= 0.88 else "TARGET_FAILED"`). Three
conditions must hold to exit zero — 117 cases evaluated, zero API calls, and
`TARGET_MET` (src: scripts/interactions_patch_assert_runner.py `FAIL: telemetry did not meet P11 production target:`).

`scripts/local_regex_runner.py` runs the *authored* corpus instead of the
generated one, five times per case
(src: scripts/local_regex_runner.py `TRIALS_COUNT = 5`), and demands a perfect rate — any
case below 1.0 fails the suite
(src: scripts/local_regex_runner.py `if pass_rate < 1.0:`). It also refuses to pass if the
API-call counter is anything but zero
(src: scripts/local_regex_runner.py `telemetry["zero_llm_api_calls"] != 0`). Its stand-in agent returns a
sentinel when the case is a negative one
(src: scripts/local_regex_runner.py `return "NO_SKILL_TRIGGER"`), so negative cases pass by *not*
matching the required patterns. Language is inferred from the case or its prompt
(src: scripts/local_regex_runner.py `return "typescript" if "typescript" in prompt else "python"`).
`check_expected` is the shared scoring helper — `real_driver_ablation.py` imports
it directly (src: scripts/real_driver_ablation.py `from local_regex_runner import check_expected`), so
the real-agent harness and the canary grade output identically.

## The quality report

`scripts/synthetic_case_quality_report.py` measures the corpus rather than the
agent (src: scripts/synthetic_case_quality_report.py `Report P11 synthetic case corpus quality without upgrading canary truth.`).
It loads the generator dynamically
(src: scripts/synthetic_case_quality_report.py `spec = importlib.util.spec_from_file_location("synthetic_case_generator", path)`),
regenerates 117 cases, and computes distinctness statistics including the worst
pairwise prompt similarity after normalisation
(src: scripts/synthetic_case_quality_report.py `def max_template_similarity(prompts: list[str]) -> float:`).

Four named reasons can mark the corpus insufficient
(src: scripts/synthetic_case_quality_report.py `insufficient_reasons.append("unique_expected_check_sets_lt_12")`),
including too few negatives
(src: scripts/synthetic_case_quality_report.py `insufficient_reasons.append("negative_cases_lt_20")`) and templates that are
too alike (src: scripts/synthetic_case_quality_report.py `insufficient_reasons.append("template_similarity_gt_0_35")`).
The verdict is a status word, never an exit code
(src: scripts/synthetic_case_quality_report.py `stats["quality_status"] = "insufficient" if insufficient_reasons else "admissible-candidate"`),
and the current value is pinned in two places — the manifest
(src: plan-package.compat.yaml `synthetic_case_quality_status: insufficient`) and the compat gate,
which also pins how few distinct check sets exist
(src: scripts/check_plan_package_compat.py `"unique_expected_check_sets=2"`). Because the generator
emits only two check-set shapes (one per language), the corpus is 117 cases with
two behaviours, and the report says so rather than hiding it.

## Validation

```sh
python3 scripts/synthetic_case_generator.py
python3 scripts/interactions_patch_assert_runner.py
python3 scripts/local_regex_runner.py
python3 scripts/synthetic_case_quality_report.py --json
```

Related: [ablation and benchmarks](ablation-and-benchmarks.md),
[real-driver ablation](real-driver-ablation.md),
[evidence and promotion policy](../architecture/evidence-and-promotion-policy.md).
