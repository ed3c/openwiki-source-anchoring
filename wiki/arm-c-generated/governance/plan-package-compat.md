---
type: Governance
title: Plan-package compatibility
description: The manifest and lock files that pin this repository to its generating plan package, the 77 paths and 21 exact values check_plan_package_compat.py asserts, and the coverage boundary that list leaves open.
tags: [governance, manifest, compatibility]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [plan-package-compat, manifest-pinning, coverage-boundary]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Plan-package compatibility

This repository was generated from a plan package, and `scripts/check_plan_package_compat.py` is the
guard that says so out loud: it asserts that the required files still exist, that the manifest still
declares the same 21 facts, and that six gates still produce their exact PASS lines
(src: scripts/check_plan_package_compat.py `"""Check final repo compatibility with the generated plan package."""`).

## Two manifests

| File | Role |
|---|---|
| `plan-package.compat.yaml` | the assertable facts, read as `key: value` pairs (src: scripts/check_plan_package_compat.py `def parse_manifest(path: Path) -> dict[str, str]:`) |
| `.plan-package.lock.yaml` | the provenance lock — route version, template version, source conversation, frozen source hash |

The two agree on the frozen source
(src: .plan-package.lock.yaml `frozen_source_sha256: 8fe152eb94179a56b6bd1b43a40c50690741ddf2ebc3a95c6b7b5e05776372a4`),
and only the compat file is machine-asserted; the lock file is read by no script here.

(inferred) That asymmetry is worth noticing before trusting the lock: it is a record for a human or an
upstream tool, and nothing in this repository would notice if a field in it drifted.

## What the guard asserts

**Existence** — 77 repository-relative paths must be regular files
(src: scripts/check_plan_package_compat.py `missing = [path for path in required if not (ROOT / path).is_file()]`),
covering the hooks, the four workflows, all thirteen `openwiki/nonofficial/` pages, 25 scripts, the
`data/` tree, both skill assets and two test modules.

**Absence** — the three forbidden path names must not exist
(src: scripts/check_plan_package_compat.py `forbidden = ["small-loop", "packets", "templates/skill-defense-governance"]`).

**Content** — the Gemini skill card must still carry its four route signals and its Layer-3 pointer
(src: scripts/check_plan_package_compat.py `required_terms = ["WHY:", "HOW:", "WHEN:", "WHEN NOT:", "references/deploy_guide.md"]`).

**Manifest values** — 21 keys must equal exact strings, including the archetype, the counts
(src: scripts/check_plan_package_compat.py `or manifest.get("lineage_edge_count") != "92"`), the input
registry policy, the eval status, and every self-limiting label described in
[Synthetic corpus](../validation/synthetic-corpus.md) and
[Semantic arbitration](../validation/semantic-arbitration.md).

**Live gate output** — six gates plus the commit-message selftest and the lineage validator are run as
subprocesses and their stdout must contain the expected PASS line
(src: scripts/check_plan_package_compat.py `or "PASS: autoresearch lifecycle optimization gate" not in autoresearch.stdout`).

Observed at `5d3c42f`, before this wiki existed:

```text
$ python3 scripts/check_plan_package_compat.py ; echo exit=$?
FAIL: openwiki perception failed: FAIL: openwiki validation failed
missing file: openwiki/quickstart.md
exit=2
```

`scripts/test_plan_package_compat.sh` is a two-line passthrough that forwards its arguments
(src: scripts/test_plan_package_compat.sh `python3 "$ROOT/scripts/check_plan_package_compat.py" "$@"`).

## The coverage boundary

The required list is what makes this guard useful and also what bounds it. It contains **no path under
`.agents/`** — the entire 9.7k-line terminal operator can be deleted without turning this gate red —
and omits three files that other pages here treat as evidence:
`tests/test_real_driver_ablation.py`, `skills/gemini_interactions/status.json`, and
`data/verification_runs/gemini_interactions_real_driver_2026-07-27.json`. The sibling verification run
*is* required (src: scripts/check_plan_package_compat.py `"data/verification_runs/gcr_molecular_commit_traceability_2026-07-23.json",`),
so the omission is selective rather than categorical.

(inferred) A hand-maintained required-path list drifts in exactly this direction: files added after the
list was written are load-bearing in prose long before anyone remembers to pin them. The honest reading
is that this gate protects the *generated* surface of the plan package, and that anything added since —
the real-driver test suite, the quarantine record, the vendored operator — is protected only by the
pytest module, or by nothing.

## The receipt fast path

`--gate-receipt` exists to avoid re-running six expensive gates by reading a `git-gate-receipt@0.1.0`
document instead. It performs real verification — private-file mode, input-state re-derivation, per-gate
stream re-hashing, and per-gate output literals
(src: scripts/check_plan_package_compat.py `raise ValueError(f"gate receipt output mismatch: {gate}")`).

It is currently **unusable**, because its `GIT_GATE_ORDER` has 23 entries while `git_gate.py` writes 22.
The mechanics are in [Defense gate chain](../architecture/defense-gate-chain.md#the-receipt-fast-path-is-currently-unusable).
Omit the flag and the slow subprocess path runs instead.

## Narrow validation

```sh
python3 scripts/check_plan_package_compat.py
sh scripts/test_plan_package_compat.sh
```

## Related

- [Molecular commit lineage](molecular-commit-lineage.md) — the three lineage keys this manifest names.
- [Repository architecture](../architecture/overview.md) — the final-repo/prototype split this guard enforces.
- [Entrypoint matrix](../operations/entrypoint-matrix.md) — what runs this guard, and what does not.
