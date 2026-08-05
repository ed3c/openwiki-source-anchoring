---
type: Testing
title: Test map
description: What each of the three pytest modules proves, the markers declared in pyproject.toml, the fixture agent that stands in for a real model, and the Bun suites the terminal operator names but that do not exist here.
tags: [testing, pytest, invariants]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [test-map, pytest-markers, fixture-agent]
libraries: [pytest]
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Test map

Three test modules exist and all three run here. `pyproject.toml` restricts collection
(src: pyproject.toml `testpaths = ["tests"]`) and declares three markers
(src: pyproject.toml `"evals: local-first Golden Dataset and deterministic judge tests",`), of which only
`evals` is applied by any module.

| Module | Style | Marker | Proves |
|---|---|---|---|
| `test_skill_asset_governance.py` | pytest functions | none | the repository's shape and that every gate exits 0 |
| `test_autoresearch_eval_suite.py` | pytest functions | `evals` | the two golden datasets and the trace sampler pass locally |
| `test_real_driver_ablation.py` | `unittest.TestCase` | none | seven failure-mode invariants of the real-agent driver |

## `test_skill_asset_governance.py` — shape and exit codes

Asserts 58 paths exist (src: tests/test_skill_asset_governance.py `for path in required:`), then runs 25
scripts and requires each to exit zero
(src: tests/test_skill_asset_governance.py `assert result.returncode == 0, result.stderr + result.stdout`).
That script list overlaps `git_gate.py`'s `GATES` but is not the same list — it adds
`check_prompt_trace_assets.py` and `git_gate.py` itself, so running the module runs the whole gate chain
twice over.

It also pins exact telemetry rather than just success:

- generation counts (src: tests/test_skill_asset_governance.py `assert "typescript=59" in synthetic.stderr`);
- the P11 canary (src: tests/test_skill_asset_governance.py `assert "passed_cases=117" in interactions.stdout`);
- the regex runner's trial arithmetic
  (src: tests/test_skill_asset_governance.py `assert "total_trials=50" in local_regex.stdout`);
- the synthetic benchmark's deltas
  (src: tests/test_skill_asset_governance.py `assert "delta_low_quality=-0.2" in benchmark.stdout`);
- and, for lineage, only the selftest — with the reason recorded inline
  (src: tests/test_skill_asset_governance.py `# Asserts the selftest, not the ledger. The ledger describes commits in the authoring`).

The graph-sync test runs the sync into a temporary directory before checking the gate
(src: tests/test_skill_asset_governance.py `with tempfile.TemporaryDirectory(prefix="wiki-graph-pytest-") as tmp:`),
so the suite never mutates `data/wiki_graph/`.

(inferred) Pinning literal numbers in a test is normally a smell, and here it is the point: every one of
these values is produced by a deterministic simulator, so a change in the number means someone changed
the simulator, not the world. The test is a change-detector for the fixtures the rest of the repository
quotes as evidence.

## `test_autoresearch_eval_suite.py` — the CI marker

Three tests, all marked (src: tests/test_autoresearch_eval_suite.py `pytestmark = pytest.mark.evals`),
matching the workflow's selection (src: .github/workflows/autoresearch_eval.yml `- run: python -m pytest -q -m evals`).
They assert the PR dataset keeps the cloud judge off
(src: tests/test_autoresearch_eval_suite.py `assert "cloud_judge_enabled=false" in result.stdout`), the
nightly dataset passes, and the sampler sees three traces
(src: tests/test_autoresearch_eval_suite.py `assert "sample_count=3" in result.stdout`).

## `test_real_driver_ablation.py` — seven failure-mode invariants

The only suite here that exercises a *process boundary* rather than a pure function. It drives
`scripts/real_driver_ablation.py` against a fixture agent, one invariant per test:

| Test | Invariant |
|---|---|
| `test_real_driver_runs_both_arms_and_resolves_model_from_runtime_metadata` | both arms run, delta is 1.0/0.0, the model comes from session metadata (src: tests/test_real_driver_ablation.py `self.assertEqual(report["runtime"]["model_source"], "runtime-session-metadata")`); `--resume` reuses runs without changing any `thread_id`; a tampered `cwd_kind` is rejected with exit 2 (src: tests/test_real_driver_ablation.py `self.assertIn("cwd_kind", rejected.stderr)`) |
| `test_agent_command_must_contain_task_placeholder` | a command without `{task}` fails before any run |
| `test_codex_command_requires_skip_git_repo_check_for_ephemeral_cwd` | codex must opt into the ephemeral cwd (src: tests/test_real_driver_ablation.py `self.assertIn("--skip-git-repo-check", result.stderr)`) |
| `test_nonzero_agent_exit_can_never_produce_a_passing_ablation` | exit 3 and `verdict == "FAIL"` even with `--threshold 0` |
| `test_agent_timeout_is_recorded_as_failure_instead_of_crashing_batch` | a timeout is data, not a crash (src: tests/test_real_driver_ablation.py `self.assertNotIn("Traceback", result.stderr)`) |
| `test_timed_out_partial_output_cannot_count_as_case_pass` | output that matched the checks but arrived from a killed process is still a failure (src: tests/test_real_driver_ablation.py `self.assertEqual(timed_out["exit_code"], 124)`) |
| `test_each_agent_call_uses_an_ephemeral_cwd` | a file the agent writes never lands in the repository (src: tests/test_real_driver_ablation.py `self.assertFalse(leaked.exists())`) |

(inferred) Six of these seven tests assert that something *fails*. That ratio is the signature of a
component whose danger is producing a confident wrong number rather than crashing — which is exactly
what the quarantined run of this driver did before the ephemeral-cwd and normalization rules existed.
See [gemini_interactions](../skill-assets/gemini-interactions.md).

### The fixture agent

`tests/fixtures/real_driver_mock_agent.py` emits Codex-shaped JSONL — a `thread.started` event and one
`agent_message` item — and writes a rollout file the driver can resolve a model from
(src: tests/fixtures/real_driver_mock_agent.py `"model": "fixture-model",`). It branches on markers in
the task text to simulate each failure mode: `OUTPUT_THEN_SLEEP` prints then hangs
(src: tests/fixtures/real_driver_mock_agent.py `if "OUTPUT_THEN_SLEEP" in task:`), `WRITE_SIDE_EFFECT`
writes into the cwd (src: tests/fixtures/real_driver_mock_agent.py `Path("eval-side-effect.txt").write_text("fixture side effect\n", encoding="utf-8")`),
and skill presence is detected from the wrapper
(src: tests/fixtures/real_driver_mock_agent.py `has_skill = "SKILL_CONTENT_SHA256=" in task`).

(inferred) The fixture is the public seam for the whole driver: because the driver takes an argv
template, "run a real model" and "run this Python file" are the same code path, so the failure modes can
be tested deterministically without a model or a network.

## Tests that do not exist here

`.agents/skills/repo-terminal-operator/` names roughly twenty Bun test files — for example
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"../../../../tests/skills/repo-terminal-async-admission-facade.test.ts",`)
— under a `tests/skills/` and `tests/forgejo/` layout that does not exist in this checkout, and its
focused-test stage would run them (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `command: ["bun", "test", ...focusedTests],`).
No Bun test in this repository is runnable. See
[Terminal operator overview](../terminal-operator/overview.md).

## Running them

```sh
python3 -m pytest -q                       # all three modules
python3 -m pytest -q -m evals              # what autoresearch_eval.yml runs
python3 -m pytest -q tests/test_real_driver_ablation.py
```

`pytest` is not declared as a project dependency; CI installs it explicitly
(src: .github/workflows/autoresearch_eval.yml `- run: python -m pip install pytest`).

## Related

- [Defense gate chain](../architecture/defense-gate-chain.md) · [Entrypoint matrix](../operations/entrypoint-matrix.md)
- [Ablation and benchmark](../validation/ablation-and-benchmark.md) — the driver these invariants protect.
