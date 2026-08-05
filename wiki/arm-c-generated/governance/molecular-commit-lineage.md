---
type: Governance
title: Molecular commit lineage
description: The commit-message traceability contract, the two ledger schemas one validator supports, the protected-path history audit, and the stale expectation that still names 157 where the evidence says 235.
tags: [governance, commits, lineage, audit]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [commit-lineage, commit-message-contract, protected-history-audit]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Molecular commit lineage

Two mechanisms, one goal: every commit that touched a protected surface must be traceable to an intent
slice, a route, a plan package and a terminal artifact
(src: PROJECT-SSOT.md `Every production file must trace to an intent slice, route, draft template, validator, and molecular commit.`).
Commits made *before* the strict gate existed are not rewritten; they are compensated by a ledger
(src: PROJECT-SSOT.md `Existing human-readable molecular commits before the strict gate are not rewritten; their machine traceability is compensated by data/commit_lineage/gcr_molecular_commits.json plus data/verification_runs/gcr_three_surface_commit_traceability_2026-07-27.json.`).

## Going forward: the commit-message contract

`.githooks/commit-msg` runs `scripts/validate_commit_message.py` on the message file. Eleven fields are
required (src: scripts/validate_commit_message.py `"Emergent-Prompt-Context:",`), three of which must
equal exact absolute paths derived from a workspace root
(src: scripts/validate_commit_message.py `failures.append("Plan-Package must reference the canonical GCR plan package")`),
the intent slice must match a fixed pattern
(src: scripts/validate_commit_message.py `failures.append("Intent-Slice must be GCR-SLICE-XX")`), and the
message must contain at least five absolute dataflow paths
(src: scripts/validate_commit_message.py `failures.append("commit message must include at least five absolute workspace dataflow paths")`)
plus references to the source conversation, the route and the exchange-format SSOT
(src: scripts/validate_commit_message.py `failures.append("commit message must reference the exchange format SSOT")`).

The workspace root is discovered, with a literal fallback
(src: scripts/validate_commit_message.py `return Path("<host-repo>")`).

With no arguments the script runs a good/bad fixture pair instead of validating anything
(src: scripts/validate_commit_message.py `if not argv or argv == ["--selftest"]:`) — which is how
`git_gate.py` invokes it. See [Static validators](../validation/static-validators.md).

(inferred) Three prompt-context fields (`Fixed-`, `Iteration-Auto-`, `Emergent-`) in a commit message is
unusual and deliberate: it records *which prompt surface produced the change* alongside the diff, so a
later reader can tell an author-written change from one a loop generated. The same three slots are
modelled as data in [Prompt trace assets](../nonofficial/prompt-trace-assets.md).

## Looking backward: two ledger schemas

`scripts/validate_molecular_commit_lineage.py` supports two formats and dispatches on the version
(src: scripts/validate_molecular_commit_lineage.py `if payload.get("schema_version") == THREE_SURFACE_SCHEMA_VERSION:`).

### `molecular-commit-lineage@0.1.0` — seven detailed commits

Exactly seven entries (src: scripts/validate_molecular_commit_lineage.py `EXPECTED_COMMIT_COUNT = 7`),
each with seventeen required fields
(src: scripts/validate_molecular_commit_lineage.py `REQUIRED_ENTRY_FIELDS = (`), a 40-hex sha
(src: scripts/validate_molecular_commit_lineage.py `failures.append(f"{sha}: commit_sha must be 40 lowercase hex chars")`),
at least three fixed-prompt contexts and an eight-hop dataflow
(src: scripts/validate_molecular_commit_lineage.py `failures.append(f"{sha}: dataflow_abs must contain source-to-verifier path")`).
Every absolute path referenced must exist on disk
(src: scripts/validate_molecular_commit_lineage.py `failures.append(f"{sha}: referenced path does not exist: {value}")`),
and with `--require-current-history` the subject and changed-file count are re-read from git
(src: scripts/validate_molecular_commit_lineage.py `f"{sha}: changed_file_count mismatch: ledger={entry['changed_file_count']} git={len(changed_files)}"`).

### `molecular-commit-lineage@0.2.0` — the three-surface compensating ledger

The version actually present here
(src: data/commit_lineage/gcr_molecular_commits.json `"schema_version": "molecular-commit-lineage@0.2.0",`).
It names three surfaces — plan package, small loop, final repo — a list of protected path prefixes, a
`coverage_through` commit, and 235 compensated entries carrying subject, touched protected paths, a
compensation slice and the SHA-256 of the original message
(src: data/commit_lineage/gcr_molecular_commits.json `"reason": "legacy molecular message predates explicit three-surface pointers"`).

With `--audit-protected-history` the validator walks real git history for those paths and splits it at
`coverage_through`:

- **After** the coverage point, every commit must carry strict three-surface lineage in its message
  (src: scripts/validate_molecular_commit_lineage.py `"post-coverage protected-surface commit lacks strict three-surface lineage: "`).
- **At or before** it, a commit either has strict lineage — counted
  (src: scripts/validate_molecular_commit_lineage.py `strict_message_count += 1`) — or must appear in the
  ledger, or the audit fails
  (src: scripts/validate_molecular_commit_lineage.py `failures.append(f"uncovered protected-surface commit: {sha} {subject}")`).
- Ledger rows that no longer correspond to history are also errors
  (src: scripts/validate_molecular_commit_lineage.py `failures.extend(f"stale compensated commit not in protected history: {sha}" for sha in stale)`).

Each compensation is **recomputed from git and compared field by field**, never accepted as written.
For every protected-surface commit at or before the coverage point that lacks strict lineage, the
validator reads the subject, the full message and the changed-file list from git
(src: scripts/validate_molecular_commit_lineage.py `changed_files = [`), derives the touched protected
paths from that file list
(src: scripts/validate_molecular_commit_lineage.py `def touched_protected_paths(changed_files: list[str], protected_paths: list[str]) -> list[str]:`),
and then requires seven values to match exactly — subject, touched protected paths, the three surface
paths, the compensation slice, and the SHA-256 of the message it just read
(src: scripts/validate_molecular_commit_lineage.py `"message_sha256": hashlib.sha256(message.encode()).hexdigest(),`)
(src: scripts/validate_molecular_commit_lineage.py `failures.append(f"{sha}: compensation {field} mismatch")`).
A non-empty free-text reason is also mandatory
(src: scripts/validate_molecular_commit_lineage.py `failures.append(f"{sha}: compensation reason is required")`).

(inferred) Hashing the original message is what separates this from an annotation file. A ledger keyed
only on sha could keep asserting a description of a commit whose message was later amended; binding the
message bytes means the compensation expires the moment the thing it compensates for changes.

The paired verification run must agree on every count
(src: data/verification_runs/gcr_three_surface_commit_traceability_2026-07-27.json `"strict_message_count": 20,`),
and the validator re-derives that number rather than trusting it
(src: scripts/validate_molecular_commit_lineage.py `failures.append("three-surface verification strict_message_count mismatch")`).

## Where it runs, and where it does not

It is deliberately excluded from `git_gate.py` — see
[Defense gate chain](../architecture/defense-gate-chain.md). `tests/test_skill_asset_governance.py`
asserts only the selftest (src: tests/test_skill_asset_governance.py `assert "SELFTEST GREEN" in lineage.stdout`),
whose hollow fixture must fail
(src: scripts/validate_molecular_commit_lineage.py `print("FAIL: hollow selftest ledger unexpectedly passed", file=sys.stderr)`).

The real audit runs from the workspace that holds the commits:

```sh
python3 scripts/validate_molecular_commit_lineage.py --selftest
python3 scripts/validate_molecular_commit_lineage.py --repo-root <workspace> --audit-protected-history
```

Without a discoverable git root the audit refuses rather than degrading
(src: scripts/validate_molecular_commit_lineage.py `"--audit-protected-history requires --repo-root or a discoverable Git root"`).

## The prompt-trace side, and its two explicit roots

`scripts/check_prompt_trace_assets.py` validates the same intent→commit→terminal mapping from the data
side, and its strength depends entirely on whether it is handed roots. With no arguments it checks
structure only. With `--workspace-root` — which must be an absolute, existing plan-truth workspace
(src: scripts/check_prompt_trace_assets.py `raise ValueError("--workspace-root must be an existing absolute plan-truth workspace")`)
— it additionally:

- **re-hashes the frozen primary input** and compares it with the recorded digest
  (src: scripts/check_prompt_trace_assets.py `failures.append("input trace sha256 does not match frozen small-loop content")`);
- **regenerates the current loop auto-prompt** into a temporary file and requires every recorded
  measured signal to still appear in it
  (src: scripts/check_prompt_trace_assets.py `failures.append(f"current loop auto-prompt missing measured signal: {marker}")`) —
  the four signals being `packet_state`, `next_route_node`, `next_conditional_edge` and
  `missing_production_file_count`
  (src: scripts/check_prompt_trace_assets.py `"next_conditional_edge": "production-equivalence-improved -> human-admit-surface",`);
- **checks every mapped terminal artifact exists on disk**
  (src: scripts/check_prompt_trace_assets.py `failures.append(f"intent mapping terminal artifact missing: {item.get('intent_slice')}")`).

With `--commit-repo` (or a workspace whose name matches) it also re-reads each commit's subject from
git and compares it
(src: scripts/check_prompt_trace_assets.py `f"intent mapping Git subject mismatch: {item.get('intent_slice')} in {repo_name}"`).
Without either root, all seven `GCR-SLICE-01..07` mappings are validated for shape — 40-hex sha, a
non-empty repo name, non-empty terminal artifacts — and nothing is cross-checked against reality.

(inferred) Both validators therefore have the same two-speed design: a structural mode that is safe in
any checkout, and an evidential mode that only runs when a caller supplies the tree the evidence is
about. The failure to distinguish them is what made the lineage gate worth removing from `GATES` — see
[Defense gate chain](../architecture/defense-gate-chain.md). The page-level rule for a reader is: a
green run of either script says nothing about history unless a root was passed.

## A stale expectation

`scripts/check_openwiki.py` still requires the code-call page to contain a literal recording 157
compensated commits (src: scripts/check_openwiki.py `"gcr_molecular_commits.json: protected_history=157 compensated=157 failed=0 schema=v0.2",`),
while both the ledger and its verification run say 235
(src: data/verification_runs/gcr_three_surface_commit_traceability_2026-07-27.json `"compensated_commit_count": 235,`).
The wiki page satisfies the gate by quoting the stale expectation and stating the true counts beside it
— see [Code call lifecycle](../nonofficial/code-call-lifecycle.md).

(inferred) That is the correct move for a documentation run, which may not edit source: silently
writing 157 would launder a stale number into evidence, and writing 235 alone would turn a
documentation change into a red gate. The one-value correction belongs in `check_openwiki.py`.

## Related

- [Plan-package compatibility](plan-package-compat.md) — the manifest that names ledger, validator and verification run.
- [Prompt trace assets](../nonofficial/prompt-trace-assets.md) — the intent→commit→terminal mapping and its git cross-check.
- [Structured lifecycle datasets](../lifecycle/structured-datasets.md) — where `molecular_commit` is bound to a promotion.
