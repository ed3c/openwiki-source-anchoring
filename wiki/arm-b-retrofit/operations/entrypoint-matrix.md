---
type: Reference
title: Entrypoint Matrix
description: Every hook and workflow with its exact argv, path filter, environment-variable format and side effects — plus the scripts nothing triggers automatically.
tags: [operations, ci, triggers]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [trigger-matrix, ci-coverage, opt-in-variables]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Entrypoint Matrix

What actually runs, when, with which arguments. Read this before assuming a script is covered.

## Local hooks

Both require `git config core.hooksPath .githooks`. They are per-clone and not enforced server-side.

| Hook | Runs | Argv | Side effects |
|---|---|---|---|
| `.githooks/commit-msg` | `scripts/validate_commit_message.py` | `<message-file>`, forwarded unchanged as `"$1"` (src: .githooks/commit-msg `python3 "$ROOT/scripts/validate_commit_message.py" "$1"`) | none |
| `.githooks/pre-push` | `scripts/git_gate.py` | none — the hook passes no arguments (src: .githooks/pre-push `python3 "$ROOT/scripts/git_gate.py"`) | none; exits 125 if any gate mutated the tree (src: scripts/git_gate.py `exit_code = 125`), printing (src: scripts/git_gate.py `FAIL: git gate changed receipt-bound repo inputs`) |

## Workflows

| Workflow | Trigger | Path filter | Commands | Side effects |
|---|---|---|---|---|
| `skill_ci.yml` | pull_request | `skills/**`, `scripts/**` (src: .github/workflows/skill_ci.yml `- 'scripts/**'`) | `python scripts/git_gate.py` (src: .github/workflows/skill_ci.yml `- run: python scripts/git_gate.py`) | none |
| `wiki_graph_sync.yml` | push, pull_request, workflow_dispatch (src: .github/workflows/wiki_graph_sync.yml `workflow_dispatch:`) | `openwiki/**/*.md`, `data/wiki_graph/schema.json`, `scripts/sync_wiki_to_graph.py`, `scripts/check_wiki_graph_sync.py` (src: .github/workflows/wiki_graph_sync.yml `- 'openwiki/**/*.md'`) | `sync_wiki_to_graph.py --wiki-root openwiki --schema … --event-log … --graph-out … --commit-sha "$GITHUB_SHA"` (src: .github/workflows/wiki_graph_sync.yml `--commit-sha "$GITHUB_SHA"`), then `check_wiki_graph_sync.py` (src: .github/workflows/wiki_graph_sync.yml `run: python scripts/check_wiki_graph_sync.py`) | **uploads** `wiki-graph-local-projection` as an artifact (src: .github/workflows/wiki_graph_sync.yml `name: wiki-graph-local-projection`); does **not** commit the regenerated files — the job is granted read access only (src: .github/workflows/wiki_graph_sync.yml `contents: read`) |
| `autoresearch_eval.yml` | pull_request, workflow_dispatch (src: .github/workflows/autoresearch_eval.yml `workflow_dispatch:`) | `skills/autoresearch_composer/**`, `data/autoresearch_golden/**`, `data/autoresearch_traces/**`, `scripts/eval_autoresearch_composer.py`, `scripts/sample_autoresearch_traces.py`, `tests/test_autoresearch_eval_suite.py` (src: .github/workflows/autoresearch_eval.yml `- 'skills/autoresearch_composer/**'`) | `eval_autoresearch_composer.py --dataset data/autoresearch_golden/pr_golden_set.json` (src: .github/workflows/autoresearch_eval.yml `--dataset data/autoresearch_golden/pr_golden_set.json`), `sample_autoresearch_traces.py` (src: .github/workflows/autoresearch_eval.yml `- run: python scripts/sample_autoresearch_traces.py`), `pytest -q -m evals` (src: .github/workflows/autoresearch_eval.yml `- run: python -m pytest -q -m evals`) | none |
| `weekly_audit.yml` | cron `0 3 * * 1`, workflow_dispatch (src: .github/workflows/weekly_audit.yml `cron: '0 3 * * 1'`) | — | `python scripts/ablation_engine.py` (src: .github/workflows/weekly_audit.yml `- run: python scripts/ablation_engine.py`) | none |

The weekly job has exactly one run step, `scripts/ablation_engine.py`
(src: .github/workflows/weekly_audit.yml `- run: python scripts/ablation_engine.py`), which is the
deterministic simulated engine, so the weekly audit is deterministic and simulated.

(inferred) Note what `weekly_audit.yml` does **not** run: `scripts/real_driver_ablation.py`. Grepping
`real_driver_ablation` across `.github/`, `.githooks/` and `scripts/` — including the `GATES` list of
`scripts/git_gate.py` — returns no match, so nothing schedules a real-agent measurement.

## Opt-in variables and their exact formats

This is where two mismatches live. Formats are not interchangeable.

| Variable | Read by | Accepted value | Set by |
|---|---|---|---|
| `ENABLE_GRAPH_DB_WRITE` | `sync_wiki_to_graph.py::write_external_graph_if_enabled()` (src: scripts/sync_wiki_to_graph.py `def write_external_graph_if_enabled(graph: dict[str, object]) -> None:`) | the string `"true"`, compared with `!=` so anything else returns early (src: scripts/sync_wiki_to_graph.py `if os.environ.get("ENABLE_GRAPH_DB_WRITE") != "true":`) | `vars.ENABLE_GRAPH_DB_WRITE` in `wiki_graph_sync.yml` — **matches** (src: .github/workflows/wiki_graph_sync.yml `ENABLE_GRAPH_DB_WRITE: ${{ vars.ENABLE_GRAPH_DB_WRITE }}`) |
| `--write-external-graph` | CLI flag on the same script | present/absent | passed only by the opt-in job |
| `GRAPH_DB_KIND` | same | `generic-http-json` or `neo4j-http`; anything else raises | `vars.GRAPH_DB_KIND`, defaulting to `generic-http-json` |
| `GRAPH_DB_URI` / `GRAPH_DB_USER` / `GRAPH_DB_PASSWORD` | same | required together; a missing one raises naming which | repository secrets |
| `ENABLE_LLM_JUDGE` | `eval_autoresearch_composer.py::cloud_judge()` (src: scripts/eval_autoresearch_composer.py `def cloud_judge(case: dict[str, object], result: dict[str, object]) -> dict[str, object]:`) | the string `"1"`, anything else returns a `SKIP` verdict (src: scripts/eval_autoresearch_composer.py `if os.environ.get("ENABLE_LLM_JUDGE") != "1":`) | `autoresearch_eval.yml` passes `vars.ENABLE_CLOUD_EVALS` (src: .github/workflows/autoresearch_eval.yml `ENABLE_LLM_JUDGE: ${{ vars.ENABLE_CLOUD_EVALS }}`), i.e. `"true"` because the job condition compares it to `'true'` (src: .github/workflows/autoresearch_eval.yml `if: ${{ vars.ENABLE_CLOUD_EVALS == 'true' }}`) — **mismatch, the branch never activates** |
| `OPENAI_API_KEY` | same | required only when `ENABLE_LLM_JUDGE == "1"` | repository secret |
| `GIT_GATE_FIXED_ELAPSED_MS` | `git_gate.py::elapsed_ms()` | integer string; overrides all timings | tests, for reproducible receipts |
| `REPO_EVIDENCE_COLLECTOR_PRODUCTION` | the TypeScript evidence-cost collector | `1` | manual only |

The external graph write needs **both** `--write-external-graph` and `ENABLE_GRAPH_DB_WRITE=true`;
either alone is a no-op. The cloud judge is unreachable from CI even when enabled, and would return a
placeholder `SKIP` if it were reached — see
[Behavioral eval and judge](../validation/behavioral-eval-and-judge.md).

## The gates `git_gate.py` covers (src: scripts/git_gate.py `GATES = [`)

Listed in order on [Defense gate chain](../architecture/defense-gate-chain.md).

The literal holds **22** executable entries, not 23: `validate_molecular_commit_lineage.py` sits
inside the list as a comment rather than an entry (src: scripts/git_gate.py `is deliberately NOT gated here`),
so counting script names in the file text gives one more than the chain actually runs. Anything
counting `len(GATES)` — the receipt's `expected_gate_count` included — reports 22
(src: scripts/git_gate.py `"expected_gate_count": len(GATES),`).

## Scripts nothing triggers automatically

(inferred) These are **not** in `GATES` and not in any workflow — each name below was grepped across
`scripts/git_gate.py` and `.github/workflows/` and appears in neither. Someone must run them.

| Script | Run it when | Documented on |
|---|---|---|
| `check_plan_package_compat.py` | `PROJECT-SSOT.md` / `plan-package.compat.yaml` / `.plan-package.lock.yaml` changed — it parses the manifest and requires those paths (src: scripts/check_plan_package_compat.py `parse_manifest(ROOT / "plan-package.compat.yaml")`) | [Plan package compatibility](../governance/plan-package-compatibility.md) |
| `test_plan_package_compat.sh` | same — it is a one-line shell wrapper forwarding its argv (src: scripts/test_plan_package_compat.sh `python3 "$ROOT/scripts/check_plan_package_compat.py" "$@"`) | same |
| `check_prompt_trace_assets.py` | `data/prompt_trace/**` changed — that is the tree it reads (src: scripts/check_prompt_trace_assets.py `read_json("data/prompt_trace/prompt_trace_dataset.json")`) | [Prompt trace assets](../nonofficial/prompt-trace-assets.md) |
| `sync_wiki_to_graph.py` | a wiki page changed and you want the local projection refreshed; run with no flags it defaults to the in-repo wiki root (src: scripts/sync_wiki_to_graph.py `parser.add_argument("--wiki-root", type=Path, default=ROOT / "openwiki")`) | [Wiki graph sync](../nonofficial/wiki-graph-sync-architecture.md) |
| `real_driver_ablation.py` | you are about to claim a real behavioral delta — it spawns a real agent command (src: scripts/real_driver_ablation.py `agent_input.add_argument("--agent-cmd")`) and emits a versioned report (src: scripts/real_driver_ablation.py `real-driver-ablation@0.2.0`) | [Ablation and benchmark](../validation/ablation-and-benchmark.md) |
| `render_lifecycle_openwiki.py --write` | `data/lifecycle/**` changed (the gate runs the compare mode, not the write mode) | [Data authority](../architecture/data-authority.md) |

`check_prompt_trace_assets.py` is covered indirectly by
`tests/test_skill_asset_governance.py::test_static_defense_scripts_pass`
(src: tests/test_skill_asset_governance.py `def test_static_defense_scripts_pass() -> None:`), which
lists it explicitly (src: tests/test_skill_asset_governance.py `"scripts/check_prompt_trace_assets.py",`)
and runs every static gate independently rather than stopping at the first failure
(src: tests/test_skill_asset_governance.py `assert result.returncode == 0, result.stderr + result.stdout`)
— so `pytest` catches things a `git push` does not.

## Gates that run argument-less and prove only a selftest

`validate_commit_message.py` treats an empty argv as a selftest request
(src: scripts/validate_commit_message.py `if not argv or argv == ["--selftest"]:`) and
`validate_goal_constraints.py` does the same when no paths are given
(src: scripts/validate_goal_constraints.py `if not args.paths:`) — and `GATES` invokes every gate with
no arguments (src: scripts/git_gate.py `[sys.executable, str(root / gate)],`), so inside the chain
these two assert only their own fixtures. See
[Static skill validators](../validation/static-skill-validators.md).

## Opt-in jobs: activation conditions and permissions

Both conditional jobs are gated on a **repository variable**, not a secret, so enabling them is a
visible configuration change:

| Job | Condition | Permissions | Secrets read |
|---|---|---|---|
| `wiki_graph_sync.yml` → `local-first-wiki-graph-sync` (src: .github/workflows/wiki_graph_sync.yml `local-first-wiki-graph-sync:`) | always, on the path filter — the job carries no `if:` | `contents: read`, `actions: read` (src: .github/workflows/wiki_graph_sync.yml `actions: read`) | none |
| `wiki_graph_sync.yml` → `external-graph-write-disabled-by-default` (src: .github/workflows/wiki_graph_sync.yml `external-graph-write-disabled-by-default:`) | `${{ vars.ENABLE_GRAPH_DB_WRITE == 'true' }}` (src: .github/workflows/wiki_graph_sync.yml `if: ${{ vars.ENABLE_GRAPH_DB_WRITE == 'true' }}`) | `contents: read` | `GRAPH_DB_URI`, `GRAPH_DB_USER`, `GRAPH_DB_PASSWORD` (src: .github/workflows/wiki_graph_sync.yml `GRAPH_DB_PASSWORD: ${{ secrets.GRAPH_DB_PASSWORD }}`) |
| `autoresearch_eval.yml` → `local-first-eval` (src: .github/workflows/autoresearch_eval.yml `local-first-eval:`) | always, on the path filter — the job carries no `if:` | default | none |
| `autoresearch_eval.yml` → `cloud-judge-disabled-by-default` (src: .github/workflows/autoresearch_eval.yml `cloud-judge-disabled-by-default:`) | `${{ vars.ENABLE_CLOUD_EVALS == 'true' }}` (src: .github/workflows/autoresearch_eval.yml `if: ${{ vars.ENABLE_CLOUD_EVALS == 'true' }}`) | default | `OPENAI_API_KEY` (src: .github/workflows/autoresearch_eval.yml `OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}`) |

The external-write job is the only one granted access to graph secrets, and it holds `contents: read`
only — it cannot push the projection back.

## What does NOT trigger CI

Path filters are narrow, and several substantial areas fall outside every one of them. Changing any of
these produces **no** pull-request check:

| Path | Why it matters |
|---|---|
| `.agents/skills/repo-terminal-operator/**` | the entire ~9.7k-line vendored TypeScript operator |
| `.githooks/**` | the hooks themselves; a broken hook is not caught until someone pushes |
| `.github/workflows/**` | a workflow editing itself does not re-trigger on its own path filter |
| `data/wiki_graph/event_log.jsonl`, `data/wiki_graph/sample_graph.json` | the projection artifacts; only `schema.json` is in the filter (src: .github/workflows/wiki_graph_sync.yml `- 'data/wiki_graph/schema.json'`), even though the run rewrites both (src: .github/workflows/wiki_graph_sync.yml `--event-log data/wiki_graph/event_log.jsonl`) |
| `data/prompt_trace/**` | (inferred) `check_prompt_trace_assets.py` is in no filter and no `GATES` list — grepping `prompt_trace` across `.github/` and `scripts/git_gate.py` returns no match |
| `data/lifecycle/**` | reached only indirectly, when `scripts/**` changes trigger `skill_ci` |
| `data/commit_lineage/**`, `data/verification_runs/**` | lineage ledger and receipts |
| `PROJECT-SSOT.md`, `plan-package.compat.yaml`, `.plan-package.lock.yaml` | the project contract itself; the only thing that reads them is the manual `check_plan_package_compat.py` (src: scripts/check_plan_package_compat.py `".plan-package.lock.yaml",`), and (inferred) no workflow path filter names them — grepping `plan-package` and `PROJECT-SSOT` across `.github/` returns no match |
| `skills/*/status.json` | promotion decisions |
| `tests/**` except `tests/test_autoresearch_eval_suite.py` — the one test file any filter names (src: .github/workflows/autoresearch_eval.yml `- 'tests/test_autoresearch_eval_suite.py'`) | the governance suite |

`python3 -m pytest -q` covers most of these locally, which is why the runbook treats it as the
pre-release check rather than an optional extra. See [Usage](../nonofficial/usage.md).

## Coverage summary

| Surface | Covered by |
|---|---|
| every static gate, independently, reporting all failures | `pytest tests/test_skill_asset_governance.py` |
| the 22-gate chain, stopping at the first failure (src: scripts/git_gate.py `print(f"FAIL: gate failed: {gate}", file=sys.stderr)`) | `git_gate.py`, hook and `skill_ci.yml` (src: .github/workflows/skill_ci.yml `- run: python scripts/git_gate.py`) |
| golden-dataset and trace assets | `autoresearch_eval.yml`, `pytest -m evals` (src: .github/workflows/autoresearch_eval.yml `- run: python -m pytest -q -m evals`) |
| the wiki→graph projection | `wiki_graph_sync.yml` (src: .github/workflows/wiki_graph_sync.yml `--graph-out data/wiki_graph/sample_graph.json`) |
| a simulated weekly delta | `weekly_audit.yml` (src: .github/workflows/weekly_audit.yml `name: weekly-skill-audit`) |
| **a real agent's behavior** | (inferred) nothing automatic — `real_driver_ablation.py` appears in no workflow and in no `GATES` entry, so only a manual run measures it |
