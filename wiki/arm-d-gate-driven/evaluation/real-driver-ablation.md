---
type: Component
title: Real-driver ablation — the only harness that runs a real agent
description: How real_driver_ablation.py runs a live agent command against both arms with a loader probe, ephemeral working directories and runtime model receipts, and the failing verdict it produced that quarantined the gemini_interactions asset.
tags: [evaluation, ablation, real-driver, verification-run]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [real-driver-ablation, loader-probe, verification-run]
libraries: [python, codex]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Real-driver ablation

## Why it is different

Every other harness in this repository scores a hard-coded function. This one
"Run[s] a real agent command against the same cases with and without skill
context" (src: scripts/real_driver_ablation.py `Run a real agent command against the same cases with and without skill context.`).
It therefore has to solve problems the simulations never face: proving the skill
text actually reached the model, proving which model answered, keeping samples
independent, and refusing to let a crash look like a result.

## Guarantees it enforces

**The loader probe.** Before the arms run, a nonce derived from the skill digest
is embedded in the wrapper
(src: scripts/real_driver_ablation.py `nonce = f"skill-loaded-{skill_hash[:12]}"`) and a probe task asks
the agent to echo it (src: scripts/real_driver_ablation.py `output EVAL_NONCE exactly if it exists in supplied skill context; otherwise output NO_NONCE.`).
The probe passes only if the nonce appears in the with-skill arm and is absent
from the without-skill arm
(src: scripts/real_driver_ablation.py `loader_probe_passed = nonce in probe_with["output"] and nonce not in probe_without["output"]`).
(inferred) Without this, a null result would be indistinguishable from a harness
that silently never delivered the skill — the most expensive failure mode in an
A/B, because it looks like evidence of no effect.

**Ephemeral working directories.** Every invocation runs in a fresh temp dir
(src: scripts/real_driver_ablation.py `with tempfile.TemporaryDirectory(prefix="real-driver-agent-") as isolated_cwd:`),
recorded in the artifact as
(src: scripts/real_driver_ablation.py `"cwd_kind": "ephemeral-temp",`). A Codex command that omits the flag
this requires is rejected up front
(src: scripts/real_driver_ablation.py `codex --agent-cmd requires --skip-git-repo-check because each invocation uses an ephemeral cwd`).

**Model provenance.** The runner parses the agent's JSONL event stream for the
thread id (src: scripts/real_driver_ablation.py `if event.get("type") == "thread.started" and isinstance(event.get("thread_id"), str):`)
and then reads the session rollout file to resolve the model actually used
(src: scripts/real_driver_ablation.py `if event.get("type") == "turn_context" and isinstance(payload, dict):`), recording
the source as (src: scripts/real_driver_ablation.py `"model_source": "runtime-session-metadata",`). A run
where the arms disagree about the model, or where any run lacks one, sets
(src: scripts/real_driver_ablation.py `metadata_complete = len(models) == 1 and all(run["resolved_model"] == models[0] for run in all_runs)`).

**Failures cannot pass.** A non-zero exit forces the case to fail and prefixes
the diagnostic (src: scripts/real_driver_ablation.py `failures = [f"AGENT_EXIT:{result['exit_code']}", *failures]`);
a timeout is recorded as exit 124 rather than raised
(src: scripts/real_driver_ablation.py `stderr += f"\nagent command timed out after {timeout} seconds"`). The final
verdict is a five-way conjunction
(src: scripts/real_driver_ablation.py `passed = loader_probe_passed and metadata_complete and agent_failures == 0 and probe_failures == 0 and delta >= args.threshold`)
with a default bar of (src: scripts/real_driver_ablation.py `DEFAULT_THRESHOLD = 0.20`), and a failing
run exits 3 (src: scripts/real_driver_ablation.py `return 0 if passed else 3`).

**Resume is verified, not trusted.** `--resume` reopens an existing artifact and
re-checks arm, case, run index, argv and cwd kind
(src: scripts/real_driver_ablation.py `mismatches = [key for key, value in expected.items() if not isinstance(result, dict) or result.get(key) != value]`),
then re-resolves the model receipt and requires the same file and value
(src: scripts/real_driver_ablation.py `has invalid model receipt binding`). Artifact paths are contained
(src: scripts/real_driver_ablation.py `artifact path escapes artifacts root:`).

## Focused tests

`tests/test_real_driver_ablation.py` drives the harness against
`tests/fixtures/real_driver_mock_agent.py`, a fixture shaped like Codex JSONL
(src: tests/fixtures/real_driver_mock_agent.py `Codex-JSONL shaped fixture for the real-driver ablation public seam.`).
The tests prove, each with its own scenario: a clean run resolves the fixture
model and produces one artifact per arm/case/run
(src: tests/test_real_driver_ablation.py `self.assertEqual(report["runtime"]["resolved_models"], ["fixture-model"])`);
resume reuses thread ids and rejects a tampered artifact
(src: tests/test_real_driver_ablation.py `self.assertIn("cwd_kind", rejected.stderr)`); a missing placeholder is
refused (src: tests/test_real_driver_ablation.py `self.assertIn("{task}", result.stderr)`); a non-zero agent exit
can never pass (src: tests/test_real_driver_ablation.py `def test_nonzero_agent_exit_can_never_produce_a_passing_ablation(self) -> None:`);
a timeout does not crash the batch
(src: tests/test_real_driver_ablation.py `self.assertNotIn("Traceback", result.stderr)`); partial output before a
timeout still fails the case
(src: tests/test_real_driver_ablation.py `self.assertEqual(timed_out["exit_code"], 124)`); and a side-effecting agent
cannot litter the repository
(src: tests/test_real_driver_ablation.py `self.assertFalse(leaked.exists())`).

These tests are a `unittest.TestCase` with no pytest marker and no workflow
reference — see the [validation matrix](../ci/validation-matrix.md).

## The one recorded run, and the quarantine it caused

`data/verification_runs/gemini_interactions_real_driver_2026-07-27.json` records
the only real-driver measurement in the repository. Its verdict is
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"decision": "A2_FAIL_DO_NOT_PROMOTE"`) against a preregistered bar
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"preregistered_delta_threshold": 0.2`), with a normalized delta of
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"normalized_delta": 0.1`) over 60 case runs
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"total_case_runs": 60`). Four calls timed out
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"agent_failures": 4`), leaving
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"metadata_complete": false`), and the run used a shared working
directory so "sample independence is not proven"
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `sample independence is not proven`).

The receipt also fixes the *retention* boundary: only the compact receipt is
committed, because raw outputs "total tens of MB and contain full prompts"
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `contain full prompts`), with the raw tree bound by digest
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"raw_artifact_tree_sha256"`). Files the agent created during the
contaminated run were quarantined under gitignored artifacts
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `artifacts/eval-side-effects-2026-07-27`), and the receipt closes
the plan: (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `No fourth model run is permitted`).

The consequence for the asset is on
[gemini-interactions](../skills/gemini-interactions.md).

## Validation

```sh
python3 -m unittest tests.test_real_driver_ablation -v
python3 scripts/real_driver_ablation.py --agent-cmd "<cmd> {task}" --runs 3 --json   # exit 3 on FAIL
```
