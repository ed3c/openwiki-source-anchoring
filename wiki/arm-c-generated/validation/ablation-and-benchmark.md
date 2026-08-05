---
type: Workflow
title: Ablation and benchmark
description: The three A/B surfaces — a simulated ablation engine with a per-asset agent branch, a fully synthetic benchmark matrix, and real_driver_ablation.py, the only script here that executes a live agent.
tags: [ablation, benchmark, ab-testing]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [ablation, benchmark-matrix, real-driver-ablation]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Ablation and benchmark

Three scripts answer "is the skill worth loading?" at three very different evidence levels. Reading
them as one family is the fastest way to misread this repository's numbers.

| Script | Agent | Evidence level |
|---|---|---|
| `benchmark_runner.py` | none — an arithmetic formula | none; a shape check |
| `ablation_engine.py` | a hard-coded simulator | consistency of cases against a rule table |
| `real_driver_ablation.py` | a real subprocess agent | behavioural, and the only one |

## `ablation_engine.py` — simulated A/B

Loads a `cases.json`, scores each case with and without the skill, and requires the delta to clear a
threshold (src: scripts/ablation_engine.py `TARGET_DELTA = 0.05`). Scoring is regex containment over
the simulated output (src: scripts/ablation_engine.py `def regex_pass(output: str, expected_checks: list[str]) -> bool:`),
and the no-skill arm is additionally capped on positive cases
(src: scripts/ablation_engine.py `return min(0.4, regex_score)`).

The simulator branches per asset — the `autoresearch_composer` branch returns route-shaped text keyed
on prompt keywords, while the default branch returns Gemini client code with the skill and legacy
syntax without it (src: scripts/ablation_engine.py `return "legacy startChat start_chat output"`).
That branch is described under [autoresearch_composer](../skill-assets/autoresearch-composer.md).

Observed at `5d3c42f` on the default cases: `PASS: ablation delta=0.50 case_count=10 success_rate=1.0 verdict=PASS`,
and on the autoresearch cases the lifecycle gate additionally requires `case_count == 12` and
`negative_with_skill_success_rate == 1.0`.

(inferred) The delta here is a property of the *simulator*, not of any model: the no-skill branch is
written to emit legacy syntax, so the measured gap is the gap the author encoded. Its real value is as
a regression detector — if someone edits `cases.json` so that the expected checks no longer discriminate
between the two canned outputs, the delta collapses and the gate fires.

Weekly CI runs this and nothing else
(src: .github/workflows/weekly_audit.yml `- run: python scripts/ablation_engine.py`).

## `benchmark_runner.py` — a deterministic matrix

100 synthetic tasks, two models, two harnesses, three quality groups. The "pass rate" is a closed-form
expression (src: scripts/benchmark_runner.py `base = 0.70`) with a jitter term derived from string
lengths (src: scripts/benchmark_runner.py `stable_jitter = ((len(model) + len(harness)) % 3) * 0.005`).
It fails unless the high-quality delta clears 0.13 and the low-quality delta is negative
(src: scripts/benchmark_runner.py `if report["task_count"] != 100 or report["delta_high_quality"] < 0.13 or report["delta_low_quality"] >= 0:`).

Observed: `PASS: benchmark matrix task_count=100 delta_high_quality=0.15 delta_low_quality=-0.2`.

(inferred) Nothing is measured here — model and harness names only perturb a constant. The script is a
placeholder that keeps the shape of a benchmark report stable so a later real harness can be dropped in
without changing consumers. Quoting `delta_high_quality=0.15` as a finding about Gemini or Claude would
be a category error, and the pinned literal in `tests/test_skill_asset_governance.py` exists to keep the
formula from drifting, not to validate it.

## `real_driver_ablation.py` — the only real agent

The single script here that runs a live model, via an argv template
(src: scripts/real_driver_ablation.py `if "{task}" not in agent_tokens:`). Its design is dominated by
what went wrong in its one recorded run — see [gemini_interactions](../skill-assets/gemini-interactions.md).

**Loader probe first.** Before measuring anything it proves the skill text actually reached the agent,
by embedding a nonce derived from the skill hash
(src: scripts/real_driver_ablation.py `nonce = f"skill-loaded-{skill_hash[:12]}"`) and requiring it to
appear in the with-skill arm and be absent from the without-skill arm
(src: scripts/real_driver_ablation.py `loader_probe_passed = nonce in probe_with["output"] and nonce not in probe_without["output"]`).

(inferred) Without that probe an A/B of "skill vs no skill" can silently become an A/A: if the wrapper
never reached the model, both arms are identical and the delta is honestly reported as zero. The probe
converts an invisible null result into a loud precondition failure.

**Every invocation gets a fresh cwd.** Each agent call runs in a throwaway directory
(src: scripts/real_driver_ablation.py `with tempfile.TemporaryDirectory(prefix="real-driver-agent-") as isolated_cwd:`)
recorded in the artifact (src: scripts/real_driver_ablation.py `"cwd_kind": "ephemeral-temp",`), and a
codex command that would fight that is rejected up front
(src: scripts/real_driver_ablation.py `return fail("codex --agent-cmd requires --skip-git-repo-check because each invocation uses an ephemeral cwd")`).

**The model is resolved from evidence, not declared.** After the run it searches the host session
directory for the thread's JSONL and reads the model out of the runtime events
(src: scripts/real_driver_ablation.py `if event.get("type") == "turn_context" and isinstance(payload, dict):`).
A run passes only if exactly one model was resolved across every sample
(src: scripts/real_driver_ablation.py `metadata_complete = len(models) == 1 and all(run["resolved_model"] == models[0] for run in all_runs)`).

**Failure can never look like success.** A non-zero exit forces the case to fail
(src: scripts/real_driver_ablation.py `failures = [f"AGENT_EXIT:{result['exit_code']}", *failures]`), a
timeout is recorded as exit 124 rather than raising
(src: scripts/real_driver_ablation.py `exit_code = 124`), and the verdict requires all four conditions
plus the threshold (src: scripts/real_driver_ablation.py `passed = loader_probe_passed and metadata_complete and agent_failures == 0 and probe_failures == 0 and delta >= args.threshold`).
A failed comparison exits 3, distinct from a usage error's 2
(src: scripts/real_driver_ablation.py `return 0 if passed else 3`).

**Resume is bound, not trusting.** `--resume` reuses a stored run only after re-verifying its argv,
arm, case, index and cwd kind (src: scripts/real_driver_ablation.py `mismatches = [key for key, value in expected.items() if not isinstance(result, dict) or result.get(key) != value]`)
and re-resolving the model receipt from the session tree
(src: scripts/real_driver_ablation.py `raise ValueError(f"existing artifact {path} has invalid model receipt binding")`).
Artifact paths are containment-checked before writing
(src: scripts/real_driver_ablation.py `raise ValueError(f"artifact path escapes artifacts root: {'/'.join(parts)}")`).

The report is `real-driver-ablation@0.2.0` and is written to `<artifacts>/summary.json`, defaulting to
`artifacts/real-driver-ablation`
(src: scripts/real_driver_ablation.py `DEFAULT_ARTIFACTS = ROOT / "artifacts" / "real-driver-ablation"`).

### Nothing triggers it

`real_driver_ablation.py` is in no `GATES` list and no workflow. It is invoked by hand and by
`tests/test_real_driver_ablation.py`, which drives it against a fixture agent — the seven invariants
that suite pins are in [Test map](../testing/test-map.md).

## Narrow validation

```sh
python3 scripts/ablation_engine.py --cases skills/autoresearch_composer/cases.json --json
python3 scripts/benchmark_runner.py
python3 -m pytest tests/test_real_driver_ablation.py -q
```

## Related

- [Behavioral eval and judge](behavioral-eval-and-judge.md) · [Synthetic corpus](synthetic-corpus.md)
- [Production bottlenecks](../nonofficial/production-bottlenecks.md) — why only one of these three counts as evidence.
