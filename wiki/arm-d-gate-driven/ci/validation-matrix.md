---
type: Reference
title: Validation matrix — what is proven, by what, and what is not
description: One row per gate and test suite, giving its trigger, what it actually proves, and the claim it does not support; plus the checks that are manual-only and the TypeScript suites that cannot run from this checkout at all.
tags: [validation, testing, coverage, ci]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [validation-matrix, test-topology, proof-boundaries]
libraries: [python, pytest, bun]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Validation matrix

Triggers used below: **gate** = member of the ordered gate list
(src: scripts/git_gate.py `GATES = [`), and therefore run by the pre-push hook
(src: .githooks/pre-push `python3 "$ROOT/scripts/git_gate.py"`) and by CI
(src: .github/workflows/skill_ci.yml `run: python scripts/git_gate.py`); **pytest**; **workflow**; **manual**.

## Python plane

| Check | Trigger | Proves | Does not prove |
|---|---|---|---|
| `validator.py` | gate | every `skills/*/cases.json` meets the size, polarity, strength and distinctness rules (src: scripts/validator.py `expected 5+ positive and 5+ negative cases`) | that the cases discriminate real agent behaviour |
| `validate_skills_baseline.py` | gate | same rules, git-scoped, falling back to all files here (src: scripts/validate_skills_baseline.py `if "not a git repository" in result.stderr:`) | nothing beyond `validator.py` in this checkout |
| `skill_description_linter.py` | gate | four route markers, no fluff, ≤200 words (src: scripts/skill_description_linter.py `if len(words) > 200 or missing or fluff:`) | that the prose is useful |
| `validate_progressive_disclosure.py` | gate | a `references/` route exists and no credential noise leaked (src: scripts/validate_progressive_disclosure.py `deployment detail leaked into root skill`) | that the deeper layer is correct |
| `validate_goal_constraints.py` | gate | its own good/bad fixtures (src: scripts/validate_goal_constraints.py `bad fixture unexpectedly passed`) | anything about repository files — no path is passed |
| `validate_commit_message.py` | gate + commit-msg hook | the eleven-field contract, via selftest in the gate (src: scripts/validate_commit_message.py `hollow commit message unexpectedly validated`) | that any real commit complies |
| `github_skill_harvester.py`, `no_op_pruner.py`, `no_ops_purger.py` | gate | phrase and entropy scans over the two assets (src: scripts/no_op_pruner.py `FAIL: no-op prompt phrases found`) | that pruning preserves behaviour — the objective is a stub (src: scripts/no_ops_purger.py `if "Interactions" not in skill_content:`) |
| `synthetic_case_generator.py` + `interactions_patch_assert_runner.py` + `local_regex_runner.py` | gate + pytest | 117 deterministic cases score with zero model calls (src: tests/test_skill_asset_governance.py `assert "zero_llm_api_calls=0" in interactions.stdout`) | agent behaviour; see the scope clause (src: PROJECT-SSOT.md `local zero-LLM regex canary truth`) |
| `synthetic_case_quality_report.py` | gate | the corpus is measured and reported insufficient (src: scripts/synthetic_case_quality_report.py `insufficient_reasons.append("template_similarity_gt_0_35")`) | admissibility — it never fails |
| `semantic_arbitration_report.py` | gate | claim/actor/artifact structure and the agy profile (src: scripts/semantic_arbitration_report.py `promoted claim lacks executed agy findings`) | that any review actually ran |
| `benchmark_runner.py`, `ablation_engine.py`, `llm_judge.py` | gate (+ weekly for ablation) | thresholds hold over simulated agents (src: scripts/ablation_engine.py `FAIL: ablation delta too small:`) | measured quality |
| `check_openwiki.py` | gate | required documentation files and literals exist (src: scripts/check_openwiki.py `PASS: openwiki usage and lifecycle wiring`) | that the pinned sentences are still true |
| `check_wiki_graph_sync.py` | gate | the projection regenerates and the secret-less external write fails fast (src: scripts/check_wiki_graph_sync.py `external graph write must fail fast when enabled without secrets`) | that any external graph exists |
| `render_lifecycle_openwiki.py` + `check_lifecycle_datasets.py` | gate | the display page is byte-equal to generated output and the datasets are consistent (src: scripts/check_lifecycle_datasets.py `structured lifecycle openwiki must equal renderer output`) | that the recorded run happened |
| `check_autoresearch_lifecycle.py` | gate | ablation telemetry, both eval datasets and trace sampling together (src: scripts/check_autoresearch_lifecycle.py `PASS: autoresearch lifecycle optimization gate`) | the upstream-source literals when `.claude` is absent (src: scripts/check_autoresearch_lifecycle.py `] if source_required_available else []`) |
| `git_gate.py` | pre-push, workflow | all 22 gates in order plus tree stability (src: scripts/git_gate.py `FAIL: git gate changed receipt-bound repo inputs`) | anything about `.agents/` — no gate reads it |

## Tests

`tests/test_skill_asset_governance.py` is the broadest. It asserts a 59-entry
required-file inventory
(src: tests/test_skill_asset_governance.py `assert (ROOT / path).is_file(), path`), runs 25 scripts with no arguments
and requires exit zero
(src: tests/test_skill_asset_governance.py `def test_static_defense_scripts_pass() -> None:`), pins the P11 telemetry
literals including the language split
(src: tests/test_skill_asset_governance.py `assert "python=58" in synthetic.stderr`), regenerates the wiki projection into a
temp directory (src: tests/test_skill_asset_governance.py `def test_wiki_graph_sync_gate_passes() -> None:`), and — importantly —
asserts only the **selftest** of the lineage validator
(src: tests/test_skill_asset_governance.py `assert "SELFTEST GREEN" in lineage.stdout`).

`tests/test_autoresearch_eval_suite.py` carries the `evals` marker and covers the
PR set, the nightly set and the trace count
(src: tests/test_autoresearch_eval_suite.py `assert "sample_count=3" in result.stdout`).

`tests/test_real_driver_ablation.py` is a `unittest.TestCase` with no marker,
covering seven adversarial scenarios of the real-agent harness
(src: tests/test_real_driver_ablation.py `def test_timed_out_partial_output_cannot_count_as_case_pass(self) -> None:`). It is
collected by a bare `pytest` run but by no workflow, because no workflow runs a
bare `pytest`.

## Manual-only checks

Four things are never triggered by a hook, a gate or a workflow:

1. **The lineage ledger and protected-history audit.** Excluded from `GATES` by
   design (src: scripts/git_gate.py `is deliberately NOT gated here`); the prescribed invocation
   passes an external workspace
   (src: scripts/validate_molecular_commit_lineage.py `parser.add_argument("--audit-protected-history", action="store_true")`). The
   selftest is not a substitute — the test file says so
   (src: tests/test_skill_asset_governance.py `Asserts the selftest, not the ledger.`).
2. **`check_plan_package_compat.py`**, including its wrapper
   (src: scripts/test_plan_package_compat.sh `python3 "$ROOT/scripts/check_plan_package_compat.py" "$@"`); and its
   `--gate-receipt` mode is currently unsatisfiable — see
   [plan-package contract](../architecture/plan-package-contract.md).
3. **`check_prompt_trace_assets.py`'s strong modes.** Without
   `--workspace-root` and `--commit-repo` it checks only internal consistency
   (src: scripts/check_prompt_trace_assets.py `--commit-repo must be an existing absolute Git repository`).
4. **`real_driver_ablation.py`** itself, which needs a real agent command
   (src: scripts/real_driver_ablation.py `agent_input.add_argument("--agent-cmd")`).

## The TypeScript plane cannot run here at all

Every Bun test named by the operator's quality profile lives above the repository
root — the focused suites
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"tests/skills/repo-terminal-async-job-lifecycle.test.ts",`), the ownership
suite (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `tests/skills/repo-owned-stream-drain.test.ts`), the evidence suites
and the Forgejo suites
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"tests/forgejo/operation-receipts.contract.test.ts",`). The production
profile's command is likewise outside
(src: .agents/skills/repo-terminal-operator/production-use.profile.json `"../../skills/repo-neural-perception/scripts/writer-contained-production-profile.ts"`).

What *can* run here: `bun run repo-adapter.ts --describe` and `--selftest`, which
read only local profiles
(src: .agents/skills/repo-terminal-operator/repo-adapter.ts `function describeOrSelftest(action: string): number {`).

(inferred) The net position is worth stating plainly, because it is the single
most useful fact on this page: **roughly 9,700 lines of TypeScript in this
repository have no executable verification inside it.** They are type-checked and
tested by the enclosing workspace, and a standalone clone can only read them.
Any claim that "the tests pass" needs to say *which* tests and *where*.

## Related

[git gate](../governance/git-gate.md) ·
[workflows and hooks](workflows-and-hooks.md) ·
[terminal-operator overview](../terminal-operator/overview.md)
