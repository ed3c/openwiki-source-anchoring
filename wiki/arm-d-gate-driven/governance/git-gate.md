---
type: Component
title: git_gate.py — the local regression gate
description: The single composition root that runs 22 Python gates in order, hashes the tree before and after, and emits a git-gate-receipt@0.1.0; plus why the molecular-lineage validator is deliberately excluded.
tags: [gate, ci, receipts]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [git-gate, gate-receipt, input-state-hash]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# The local regression gate

## Responsibility

One entry point that runs every deterministic local defence for skill-asset
changes (src: scripts/git_gate.py `Run local regression gates for skill asset changes.`).
It is the command behind the push hook
(src: .githooks/pre-push `python3 "$ROOT/scripts/git_gate.py"`) and behind CI
(src: .github/workflows/skill_ci.yml `run: python scripts/git_gate.py`), and the first
command README tells a new operator to run after
`git config core.hooksPath .githooks` (src: README.md `python3 scripts/git_gate.py`).

## Execution model

`GATES` is an ordered list of 22 repository-relative script paths beginning with
`scripts/validator.py` (src: scripts/git_gate.py `GATES = [`). Each is invoked as a
separate process with no arguments, from the repository root
(src: scripts/git_gate.py `[sys.executable, str(root / gate)],`), and its stdout and
stderr are echoed through. Execution is **fail-fast**: the first non-zero exit
prints the failing gate and breaks the loop
(src: scripts/git_gate.py `FAIL: gate failed: {gate}`), so later gates do not run and
their records are absent from the receipt. Only a clean sweep prints
(src: scripts/git_gate.py `PASS: git gate defenses passed`).

(inferred) Running each gate with *no arguments* is load-bearing and easy to
break: it means every gate script must have a meaningful default mode. That is
why `validate_commit_message.py` treats an empty argv as its selftest
(src: scripts/validate_commit_message.py `if not argv or argv == ["--selftest"]:`) and why
`validate_goal_constraints.py` runs its good/bad fixtures when given no paths
(src: scripts/validate_goal_constraints.py `if not args.paths:`). A new gate whose
no-argument path does nothing would be green while asserting nothing.

## Input-state stability

Before and after the sweep, the whole tree is hashed. `input_state_sha256` walks
every file and symlink, skipping `.git`, `__pycache__` and `.pytest_cache`
(src: scripts/git_gate.py `EXCLUDED_INPUT_PARTS = {".git", "__pycache__", ".pytest_cache"}`),
and folds the relative path, the permission bits, and either the link target or
the file bytes into one digest
(src: scripts/git_gate.py `digest.update(str(stat.S_IMODE(info.st_mode)).encode())`). If the
two digests differ, the run is rejected with a dedicated exit code
(src: scripts/git_gate.py `FAIL: git gate changed receipt-bound repo inputs`) — that
branch sets `exit_code = 125` (src: scripts/git_gate.py `exit_code = 125`).

The same reasoning forbids writing the receipt inside the tree, because doing so
would change the very hash it records
(src: scripts/git_gate.py `--receipt must be outside --repo-root so it cannot change the input-state hash`).

## The receipt

With `--receipt`, the run emits `git-gate-receipt@0.1.0`
(src: scripts/git_gate.py `"schema_version": "git-gate-receipt@0.1.0",`) containing per-gate
`command`, `exit_code`, `elapsed_ms`, full `stdout`/`stderr` and their SHA-256
digests, plus `input_state_sha256`, `final_input_state_sha256`,
`expected_gate_count` and `gate_count`. Status is `passed` only when the exit
code is zero, every gate ran, and the tree was stable
(src: scripts/git_gate.py `"passed" if exit_code == 0 and len(records) == len(GATES) and stable else "failed"`).
Writing is atomic and private: a PID-suffixed temp file is created with `x` mode,
chmod-ed and renamed (src: scripts/git_gate.py `temporary.chmod(0o600)`).

`GIT_GATE_FIXED_ELAPSED_MS` overrides every duration
(src: scripts/git_gate.py `os.environ.get("GIT_GATE_FIXED_ELAPSED_MS")`), which makes the
receipt byte-reproducible for tests. The receipt consumer is
[`check_plan_package_compat.py`](../architecture/plan-package-contract.md), which
currently cannot accept one — see that page for the count mismatch.

## The deliberate exclusion

`scripts/validate_molecular_commit_lineage.py` is not in `GATES`, and the file
carries the reasoning inline. The repository has no `.git` of its own, so the
validator's root discovery "used to climb out to the parent checkout and validate
a different repository's history"
(src: scripts/git_gate.py `validate a different repository's history`); worse, the
no-argument path it would be invoked with "is a schema check that never walks
history at all (0.07s vs 19s), so the gate reported PASS while asserting almost
nothing" (src: scripts/git_gate.py `while asserting almost`). The prescribed
replacement is to validate lineage where the commits actually live
(src: scripts/git_gate.py `--repo-root <authoring-workspace> [--audit-protected-history]`).
Its selftest is instead asserted by pytest — see
[commit lineage](commit-lineage.md) and the
[validation matrix](../ci/validation-matrix.md).

## Focused tests

`tests/test_skill_asset_governance.py::test_static_defense_scripts_pass` runs
`git_gate.py` itself along with the individual gates and requires exit zero
(src: tests/test_skill_asset_governance.py `assert result.returncode == 0, result.stderr + result.stdout`).
It proves the default entry points work; it does not prove the receipt contract.

## Validation

```sh
python3 scripts/git_gate.py                                  # PASS: git gate defenses passed
python3 scripts/git_gate.py --receipt /tmp/gate-receipt.json # receipt must live outside the repo
```
