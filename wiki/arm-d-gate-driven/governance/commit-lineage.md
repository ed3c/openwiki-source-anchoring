---
type: Component
title: Commit-message traceability and molecular commit lineage
description: The two-layer commit contract — an eleven-field message validator wired to the commit-msg hook, and a compensating lineage ledger with a protected-history audit that runs where the commits actually live.
tags: [lineage, traceability, git, gate]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [commit-lineage, commit-message-contract, protected-history-audit]
libraries: [python, git]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Commit-message traceability and molecular commit lineage

`PROJECT-SSOT.md` demands that molecular commit messages "preserve
fixed_prompt_context, iteration_auto_context, emergent_prompt_context, and
absolute-path dataflow evidence"
(src: PROJECT-SSOT.md `absolute-path dataflow evidence`) and, in the next clause,
concedes that older human-readable commits are not rewritten but compensated by
a ledger (src: PROJECT-SSOT.md `their machine traceability is compensated by`). Those
two sentences produce the two layers below.

## Layer 1 — the message validator

`scripts/validate_commit_message.py` enforces eleven trailer fields
(src: scripts/validate_commit_message.py `REQUIRED_FIELDS = (`), beginning with
`Intent-Slice:` and ending with `Dataflow:`. Beyond presence it checks values:

- the intent slice must match a slice id
  (src: scripts/validate_commit_message.py `Intent-Slice must be GCR-SLICE-XX`);
- three fields must equal canonical absolute paths derived from the workspace
  root, e.g. (src: scripts/validate_commit_message.py `Small-Loop must reference the canonical materialized small loop`);
- at least five absolute workspace paths must appear anywhere in the message
  (src: scripts/validate_commit_message.py `at least five absolute workspace dataflow paths`);
- three specific references must appear — the originating conversation
  (src: scripts/validate_commit_message.py `must reference the original GCR conversation source`), the
  materialization route (src: scripts/validate_commit_message.py `ROUTES.md#plan-package-materialization`),
  and the exchange-format SSOT (src: scripts/validate_commit_message.py `modules/exchange-formats.md`).

`workspace_root()` resolves those canonical prefixes by walking upward for a
plan-truth directory and finally falling back to a hard-coded path
(src: scripts/validate_commit_message.py `return Path("<host-repo>")`). (inferred) That
fallback is what lets the selftest pass inside a vendored checkout, and it is
also the reason this validator is not portable to a different host layout
without editing.

The selftest is a genuine good/hollow pair: a complete message must validate and
a truncated one must not
(src: scripts/validate_commit_message.py `hollow commit message unexpectedly validated`), after which the
good fixture is written to a temp file and validated through the file path as
well (src: scripts/validate_commit_message.py `PASS: commit message traceability contract`).

It is wired to the hook (src: .githooks/commit-msg `python3 "$ROOT/scripts/validate_commit_message.py" "$1"`)
and pinned by the manifest
(src: plan-package.compat.yaml `commit_message_traceability_hook: .githooks/commit-msg`).

## Layer 2 — the lineage ledger

`scripts/validate_molecular_commit_lineage.py` validates
`data/commit_lineage/gcr_molecular_commits.json`
(src: scripts/validate_molecular_commit_lineage.py `Validate the compensating lineage ledger for GCR molecular commits.`)
and supports **two ledger schemas**, dispatching on the version it finds.

**`molecular-commit-lineage@0.1.0`** — a fixed seven-entry ledger
(src: scripts/validate_molecular_commit_lineage.py `EXPECTED_COMMIT_COUNT = 7`). Every entry must
carry seventeen fields (src: scripts/validate_molecular_commit_lineage.py `REQUIRED_ENTRY_FIELDS = (`),
a 40-hex sha (src: scripts/validate_molecular_commit_lineage.py `commit_sha must be 40 lowercase hex chars`),
canonical route/plan/exchange paths, fixed statuses
(src: scripts/validate_molecular_commit_lineage.py `message_status must be compensated-human-readable`), at
least three fixed-prompt context paths and at least eight dataflow hops
(src: scripts/validate_molecular_commit_lineage.py `dataflow_abs must contain source-to-verifier path`).
Every absolute path listed must exist on disk
(src: scripts/validate_molecular_commit_lineage.py `referenced path does not exist`). With
`--require-current-history` it additionally compares each recorded subject and
changed-file count against `git log`
(src: scripts/validate_molecular_commit_lineage.py `changed_file_count mismatch`).

**`molecular-commit-lineage@0.2.0`** — the three-surface protected-history audit
(src: scripts/validate_molecular_commit_lineage.py `THREE_SURFACE_SCHEMA_VERSION = "molecular-commit-lineage@0.2.0"`).
It enumerates history for the declared `protected_paths`
(src: scripts/validate_molecular_commit_lineage.py `["log", "--format=%H", "--", *protected_paths]`) and splits it at
`coverage_through`. Commits *after* coverage must carry strict lineage in the
message itself (src: scripts/validate_molecular_commit_lineage.py `post-coverage protected-surface commit lacks strict three-surface lineage`);
commits *at or before* it may instead be compensated by a ledger entry whose
subject, touched protected paths, three surface paths and message digest all
match (src: scripts/validate_molecular_commit_lineage.py `"message_sha256": hashlib.sha256(message.encode()).hexdigest(),`).
Uncovered commits (src: scripts/validate_molecular_commit_lineage.py `uncovered protected-surface commit`)
and ledger entries no longer present in history
(src: scripts/validate_molecular_commit_lineage.py `stale compensated commit not in protected history`) both fail.
A companion verification run must agree, down to the count of strictly-messaged
commits (src: scripts/validate_molecular_commit_lineage.py `three-surface verification strict_message_count mismatch`).

## Where it runs — and where it does not

The validator is **not** in `GATES`; see [git gate](git-gate.md) for the reason
(the no-argument path is a schema check that never walks history). The manifest
still names it (src: plan-package.compat.yaml `molecular_commit_lineage_validator: scripts/validate_molecular_commit_lineage.py`)
and `README.md` prescribes running it against the workspace that holds the
commits (src: README.md `--audit-protected-history`).

What CI actually proves is only the selftest
(src: tests/test_skill_asset_governance.py `assert "SELFTEST GREEN" in lineage.stdout`), and the test
says so in a comment: it "Asserts the selftest, not the ledger"
(src: tests/test_skill_asset_governance.py `Asserts the selftest, not the ledger.`). The selftest builds a
synthetic tree, proves a well-formed ledger passes, then flips one status and
proves it fails (src: scripts/validate_molecular_commit_lineage.py `hollow selftest ledger unexpectedly passed`).

## Validation

```sh
python3 scripts/validate_commit_message.py --selftest
python3 scripts/validate_molecular_commit_lineage.py --selftest
python3 scripts/validate_molecular_commit_lineage.py --repo-root <authoring-workspace> --audit-protected-history
```

Related: [validation matrix](../ci/validation-matrix.md),
[plan-package contract](../architecture/plan-package-contract.md).
