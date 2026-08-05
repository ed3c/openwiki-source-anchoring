---
type: Operations
title: Entrypoint matrix
description: Every hook, workflow and shell entry in this repository with its exact argv and environment, which workflow jobs are gated behind repository variables, and the scripts that nothing triggers at all.
tags: [operations, ci, hooks]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [entrypoints, ci-workflows, git-hooks]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Entrypoint matrix

Seven things can start work in this repository: two git hooks, four GitHub workflows, and one shell
wrapper. Everything else is called by one of them, by pytest, or by hand.

## Local hooks

Hooks are not installed by default; the README's first line enables them
(src: README.md `git config core.hooksPath .githooks`).

| Hook | argv | Calls |
|---|---|---|
| `.githooks/pre-push` | `python3 "$ROOT/scripts/git_gate.py"` | the 22-gate chain, no arguments |
| `.githooks/commit-msg` | `python3 "$ROOT/scripts/validate_commit_message.py" "$1"` | the real message path, with the message file |

Both resolve the root from their own location
(src: .githooks/pre-push `ROOT=$(cd "$(dirname "$0")/.." && pwd)`).

(inferred) `commit-msg` is the only place in the repository where `validate_commit_message.py` runs with
a real argument. Inside `git_gate.py` it gets none and runs its selftest — so the traceability contract
is enforced at commit time and merely proven to still discriminate at push time. See
[Static validators](../validation/static-validators.md).

## Workflows

| Workflow | Trigger | Job | Runs |
|---|---|---|---|
| `skill_ci.yml` | PR touching `skills/**` or `scripts/**` | `skill-ci` | `python scripts/git_gate.py` |
| `autoresearch_eval.yml` | PR touching seven paths, or dispatch | `local-first-eval` | PR golden eval, trace sampler, `pytest -q -m evals` |
| `autoresearch_eval.yml` | same | `cloud-judge-disabled-by-default` | nightly dataset in cloud mode — only if a variable is set |
| `wiki_graph_sync.yml` | push/PR touching `openwiki/**/*.md` or three files, or dispatch | `local-first-wiki-graph-sync` | sync, validate, upload artifact |
| `wiki_graph_sync.yml` | same | `external-graph-write-disabled-by-default` | external graph write — only if a variable is set |
| `weekly_audit.yml` | cron `0 3 * * 1`, or dispatch | `ablation-audit` | `python scripts/ablation_engine.py` |

All four pin Python 3.11 (src: .github/workflows/skill_ci.yml `python-version: '3.11'`).

### The two opt-in jobs

Both risky jobs are fenced by a repository variable in the job condition, so they do not even schedule
by default — the cloud judge
(src: .github/workflows/autoresearch_eval.yml `if: ${{ vars.ENABLE_CLOUD_EVALS == 'true' }}`) and the
external graph write
(src: .github/workflows/wiki_graph_sync.yml `if: ${{ vars.ENABLE_GRAPH_DB_WRITE == 'true' }}`).

Secrets are only referenced inside those jobs
(src: .github/workflows/wiki_graph_sync.yml `GRAPH_DB_PASSWORD: ${{ secrets.GRAPH_DB_PASSWORD }}`), and the
script fails fast if the switch is on without them
(src: scripts/sync_wiki_to_graph.py `raise RuntimeError("external graph write requested but missing secrets: " + ", ".join(missing))`)
— a behaviour the gate proves by running it with the variable set and the secrets stripped
(src: scripts/check_wiki_graph_sync.py `failures.append("external graph write must fail fast when enabled without secrets")`).

(inferred) Two independent switches — a job condition *and* an in-script env check — is not redundancy.
The workflow condition stops the job from existing in CI; the script check stops a developer running the
same command locally with `ENABLE_GRAPH_DB_WRITE=true` from silently doing nothing. Each covers the
other's blind spot.

The sync job also uploads its projection
(src: .github/workflows/wiki_graph_sync.yml `name: wiki-graph-local-projection`) and requests a two-commit
checkout (src: .github/workflows/wiki_graph_sync.yml `fetch-depth: 2`).

### Shell wrapper

`scripts/test_plan_package_compat.sh` forwards to the compatibility guard
(src: scripts/test_plan_package_compat.sh `python3 "$ROOT/scripts/check_plan_package_compat.py" "$@"`).
Nothing calls it automatically.

## What nothing triggers

| Script | Reached by |
|---|---|
| `scripts/check_plan_package_compat.py` | hand, or the `.sh` wrapper — **not** in `GATES`, not in any workflow |
| `scripts/check_prompt_trace_assets.py` | hand and `tests/test_skill_asset_governance.py` — not in `GATES` |
| `scripts/validate_molecular_commit_lineage.py` | hand and the pytest selftest — deliberately excluded from `GATES` |
| `scripts/sync_wiki_to_graph.py` | `wiki_graph_sync.yml`, `check_wiki_graph_sync.py`, pytest — never `GATES` |
| `scripts/real_driver_ablation.py` | hand and `tests/test_real_driver_ablation.py` — no gate, no workflow |
| `scripts/test_plan_package_compat.sh` | hand |
| `.agents/skills/repo-terminal-operator/**` | nothing in this repository |

(inferred) The gap that matters most is `check_plan_package_compat.py`: it is the strictest guard here
and no automated path runs it. A repository can therefore satisfy every hook and every workflow while
its manifest silently drifts from the plan package it claims to implement.

## Coverage summary

| Surface | Automated |
|---|---|
| 22 gates in `git_gate.py` | pre-push hook, `skill_ci.yml` |
| commit message contract | `commit-msg` hook |
| golden datasets + traces + `evals` marker | `autoresearch_eval.yml` |
| wiki→graph projection | `wiki_graph_sync.yml` |
| simulated ablation | `weekly_audit.yml` |
| plan-package manifest | **nothing** |
| real-agent ablation | **nothing** |
| terminal operator | **nothing** |

## Related

- [Defense gate chain](../architecture/defense-gate-chain.md) · [Plan-package compatibility](../governance/plan-package-compat.md)
- [Wiki graph sync architecture](../nonofficial/wiki-graph-sync-architecture.md) — the sync job's design.
- [Test map](../testing/test-map.md) — what pytest covers that CI does not.
- [Code call lifecycle](../nonofficial/code-call-lifecycle.md) — the same call graph with measured values.
