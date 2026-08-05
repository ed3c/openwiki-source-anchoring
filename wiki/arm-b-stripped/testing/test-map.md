---
type: Reference
title: Test Map
description: What each pytest module proves, described by behavior and invariant so the right suite can be retrieved without reading it from the top.
tags: [testing]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [test-coverage-map, eval-markers]
libraries: [pytest]
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Test Map

`pyproject.toml` sets `testpaths = ["tests"]` and
registers three markers: `evals` (local-first golden dataset and deterministic judge), `llm_judge`
, `trace` (local trace sampling and guardrails).

```sh
python3 -m pytest -q            # everything
python3 -m pytest -q -m evals   # golden-dataset and judge only
```

## `tests/test_skill_asset_governance.py`

The structural and gate-level suite. Six tests, each proving a different class of invariant:

| Test | Invariant |
|---|---|
| `test_skill_asset_structure` | 58 required paths exist — the hooks, all four workflows, the twelve `openwiki/` contract paths, the skill assets, the named scripts, and every `data/` artifact. This is the test that turns a deleted file into a red suite. |
| `test_static_defense_scripts_pass` | each of 25 static gate scripts exits 0. Like `git_gate.py`, which aborts the run on the first nonzero gate, the loop stops at the first failure — the value here is the **different set**, not independence: this test runs `git_gate.py` itself plus `check_prompt_trace_assets.py`, `eval_autoresearch_composer.py`, `sample_autoresearch_traces.py` and `validate_molecular_commit_lineage.py`, none of which the 22-entry `GATES` list contains, while `GATES` alone covers `synthetic_case_quality_report.py` and `semantic_arbitration_report.py`. |
| `test_p11_synthetic_and_zero_llm_telemetry` | the canary telemetry is exact, not merely green — `synthetic_cases=117`, `typescript=59`, `python=58`, `total_cases_evaluated=117`, `passed_cases=117`, `zero_llm_api_calls=0`, `case_count=10`, `total_trials=50`, `task_count=100`, `delta_high_quality=0.15`, `delta_low_quality=-0.2`. A drifting number fails the suite. |
| `test_autoresearch_eval_and_trace_gates_pass` | the PR golden eval passes with `cloud_judge_enabled=false`, the trace sampler passes, and the lifecycle dataset display matches its generator |
| `test_wiki_graph_sync_gate_passes` | a projection built into a **temporary directory** reproduces cleanly, then the gate passes — proving reproducibility without mutating the checked-in artifacts |
| `test_molecular_commit_lineage_selftest_passes` | the lineage validator run with `--selftest` exits 0 and prints `SELFTEST GREEN` |

Note what the last one does not do: it asserts the selftest, not the checked-in ledger
, because the
commits that ledger describes live in the authoring workspace rather than in this checkout. See
[Molecular commit lineage](../governance/molecular-commit-lineage.md).

## `tests/test_autoresearch_eval_suite.py`

Marked `evals` at module level, so all three of its tests carry the marker. Exercises the golden-dataset harness — schema validation, deterministic guardrails, and
the local heuristic judge. This is the suite `.github/workflows/autoresearch_eval.yml` runs with
`-m evals`. See [Behavioral eval and judge](../validation/behavioral-eval-and-judge.md).

## `tests/test_real_driver_ablation.py`

The largest and most behavioral suite (282 lines), and the only `unittest.TestCase` class here,
covering the driver that actually calls an agent. Retrieve it by the failure it proves, not by symbol:

| Behavior proven | Test |
|---|---|
| an agent command without `{task}` is rejected | `test_agent_command_must_contain_task_placeholder` |
| a `codex exec` command without `--skip-git-repo-check` is rejected, because each invocation gets an ephemeral cwd | `test_codex_command_requires_skip_git_repo_check_for_ephemeral_cwd` |
| a stale `--resume` is rejected with `cwd_kind` in stderr | asserted inside `test_real_driver_runs_both_arms_and_resolves_model_from_runtime_metadata` |
| a nonzero agent exit can never produce a passing ablation (exit 3, `agent_failures > 0`, `verdict FAIL`) | `test_nonzero_agent_exit_can_never_produce_a_passing_ablation` |
| a timeout is recorded as a case failure instead of crashing the batch | `test_agent_timeout_is_recorded_as_failure_instead_of_crashing_batch` |
| output printed before a timeout still cannot count as a pass (exit 124, `passed` false) | `test_timed_out_partial_output_cannot_count_as_case_pass` |
| every agent call runs in a temporary cwd, so a side-effect file never lands in the repo | `test_each_agent_call_uses_an_ephemeral_cwd` |

`tests/fixtures/real_driver_mock_agent.py` is the stand-in agent — a Codex-JSONL shaped fixture
 — so
these run without spending real agent calls. See
[gemini_interactions](../skill-assets/gemini-interactions.md) for why each invariant exists.

## No TypeScript tests

There is no test for `.agents/skills/repo-terminal-operator/` in this repository. Its own contract
expects a Bun toolchain,
yet no `package.json` exists anywhere in the tree and `testpaths` points only at `tests/`, which holds
three Python modules. The profiles that contract binds admission to live in an absent upstream tree
:
`skills/` here contains only `autoresearch_composer` and `gemini_interactions`. See
[Terminal operator overview](../terminal-operator/overview.md).
