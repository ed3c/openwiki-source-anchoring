---
type: Reference
title: Molecular Commit Lineage
description: The eleven-field commit message contract, the compensating lineage ledger, and the difference between the default structural validation and a real history audit.
tags: [governance, traceability, git]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [commit-traceability, lineage-ledger, history-audit-modes]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Molecular Commit Lineage

Every commit that touches a protected path must be traceable back to the intent slice that motivated
it. Two mechanisms carry that: a message contract enforced at commit time, and a compensating ledger
for history written before the contract existed.

## The commit message contract

`.githooks/commit-msg` → `scripts/validate_commit_message.py <message-file>`. All eleven
`REQUIRED_FIELDS` must be present:

```text
Intent-Slice:  Route:  Plan-Package:  Small-Loop:  Final-Repo:
Exchange-Format:  Exchange-Packet:
Fixed-Prompt-Context:  Iteration-Auto-Context:  Emergent-Prompt-Context:
Dataflow:
```

The last three mirror the three prompt slots in
[Prompt trace assets](../nonofficial/prompt-trace-assets.md) — the same three-way split, enforced at commit time as
well as in the dataset.

Beyond presence, four values are checked:

- `Intent-Slice:` must match `GCR-SLICE-\d{2}`.
- `Plan-Package:`, `Small-Loop:` and `Final-Repo:` must equal exact absolute paths derived from
  `workspace_root()`, which walks up looking for `loop_wiki/evolve-unknown-discovery-plan-truth` and
  falls back to a literal `<host-repo>`.

That fallback is a real portability limit — see the root-local-runtime section of
[Production bottlenecks](../nonofficial/production-bottlenecks.md). It also means the check is machine-specific:
the same message can pass on one workstation and fail on another.

`PROJECT-SSOT.md` explains why the fields are so specific: *"Molecular commit messages must preserve
fixed_prompt_context, iteration_auto_context, emergent_prompt_context, and absolute-path dataflow
evidence."*

## The compensating ledger

Commits written before the strict gate are **not rewritten** — `PROJECT-SSOT.md` says so explicitly, and
their machine traceability is compensated instead by two artifacts:

| Artifact | Contents |
|---|---|
| `data/commit_lineage/gcr_molecular_commits.json` | `schema_version: molecular-commit-lineage@0.2.0`; 235 `compensated_commits`, a count the validator pins to the receipt's `commit_count`; 7 `legacy_detailed_commits` and 13 `protected_paths` — those two numbers are list lengths, not literals in the file, so count the array rather than trusting this row; the source-conversation, materialization-route, plan-package, small-loop and final-repo absolute paths, all of them pointing outside this directory; `history_rewrite_policy`; `coverage_through`; `verification_run_abs` |
| `data/verification_runs/gcr_three_surface_commit_traceability_2026-07-27.json` | `schema_version: molecular-commit-verification-run@0.2.0`; `status: pass`; `commit_count=235`, `compensated_commit_count=235`; `failed_commit_count=0`; `strict_message_count=20`; 235 `commit_shas`; 2 `proof_commands`, and both of them invoke the TypeScript adapter in the authoring workspace, not the Python validator that lives here |

So the authoritative counts are **protected_history=235 compensated=235 failed=0 schema=v0.2**.
`scripts/check_openwiki.py:73` still expects an older pair of counts; that discrepancy is documented on
[Code call lifecycle](../nonofficial/code-call-lifecycle.md) and tracked in the Backlog of
[Quickstart](../quickstart.md).

Note the ratio: 20 commits carry a strict message, 235 are compensated. The ledger is doing most of the
work, which is exactly what "compensating" means.

## Two validation modes, very different strength

`scripts/validate_molecular_commit_lineage.py` takes an optional ledger argument that defaults to a path
derived from the script's own location,
plus four flags declared on the same `argparse` parser.
Those flags select modes of very different strength:

| Invocation | What it actually checks |
|---|---|
| default — **not** run by `git_gate.py`, which deliberately keeps it out of `GATES` | ledger and verification-receipt **structure**, SHA lists and counts; the walk over protected history is skipped outright unless a history flag is passed. No Git history is read — `git_gate.py` records the measured gap itself. |
| `--audit-protected-history` | reads Git history for the protected paths |
| `--require-current-history` | additionally requires current history to satisfy strict three-surface lineage |
| `--selftest` | self-check only |

A normal push does **not** run any of these. The hook shells straight out to the gate runner
, and that runner's gate list omits this
validator, so the default mode is only reached when someone invokes the script by hand. It proves the
ledger is internally consistent — not that the commits it names exist in any repository. Even that pass
is not fully self-contained: it dereferences the ledger's absolute external `verification_run_abs`
 and
fails if that external file is absent.

**The history modes need a Git root this directory does not have.** `repo/agent-skills-repo/` is not its
own repository. Running `--require-current-history` here walks up to the enclosing repository and audits
*that* repository's commits; in a detached copy it fails with
`--audit-protected-history requires --repo-root or a discoverable Git root`. Any history result must
name which repository was audited, or it is not interpretable.

Recovering the intent chain from history, when a Git root is available:

```sh
git log --all --format='%H%x09%s%x09%b' --grep='Intent-Slice: GCR-SLICE-'
```

## Validation

```sh
python3 scripts/validate_molecular_commit_lineage.py                      # structural, default
python3 scripts/validate_molecular_commit_lineage.py --repo-root /abs/repo --require-current-history
python3 scripts/validate_commit_message.py <message-file>
```

Focused test: `tests/test_skill_asset_governance.py::test_molecular_commit_lineage_selftest_passes`
.
It asserts the `--selftest` path only, deliberately not the shipped ledger, because a checkout of this
repository does not contain the commits the ledger describes;
the green signal it looks for is the selftest banner.
