---
type: Component
title: Hooks, workflows and pytest markers
description: The two git hooks, the four GitHub workflows and their trigger paths, the two opt-in jobs that are gated on repository variables, and the pytest markers that select the local-first eval suite.
tags: [ci, hooks, workflows, pytest]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [ci-workflows, git-hooks, pytest-markers]
libraries: [github-actions, pytest, python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Hooks, workflows and pytest markers

## Hooks

Both hooks are four-line shells that resolve the repository root and delegate.
Pre-push runs the whole gate
(src: .githooks/pre-push `python3 "$ROOT/scripts/git_gate.py"`); commit-msg validates the message file
it is handed (src: .githooks/commit-msg `python3 "$ROOT/scripts/validate_commit_message.py" "$1"`). They are inert
until a developer opts in
(src: README.md `git config core.hooksPath .githooks`), and both are pinned by the manifest
(src: plan-package.compat.yaml `commit_message_traceability_hook: .githooks/commit-msg`).

## Workflows

| Workflow | Trigger | Runs |
|---|---|---|
| `skill_ci.yml` | PRs touching skills or scripts (src: .github/workflows/skill_ci.yml `- 'skills/**'`) | the git gate (src: .github/workflows/skill_ci.yml `run: python scripts/git_gate.py`) |
| `autoresearch_eval.yml` | PRs touching the composer asset, datasets or its scripts (src: .github/workflows/autoresearch_eval.yml `- 'data/autoresearch_golden/**'`) | eval, trace sampler, `-m evals` (src: .github/workflows/autoresearch_eval.yml `run: python -m pytest -q -m evals`) |
| `wiki_graph_sync.yml` | push or PR touching wiki or graph inputs (src: .github/workflows/wiki_graph_sync.yml `- 'openwiki/**/*.md'`) | projection, gate, artifact upload (src: .github/workflows/wiki_graph_sync.yml `uses: actions/upload-artifact@v4`) |
| `weekly_audit.yml` | Monday cron plus manual (src: .github/workflows/weekly_audit.yml `- cron: '0 3 * * 1'`) | the ablation engine (src: .github/workflows/weekly_audit.yml `run: python scripts/ablation_engine.py`) |

All four pin the interpreter
(src: .github/workflows/skill_ci.yml `python-version: '3.11'`), matching `pyproject.toml`. Only the
autoresearch workflow installs anything
(src: .github/workflows/autoresearch_eval.yml `run: python -m pip install pytest`), which is consistent with a repository
whose gates are stdlib-only.

(inferred) Note what the trigger paths imply: a change confined to `data/`,
`tests/` or `.agents/` matches no `paths` filter at all, so nothing runs in CI.
The git gate is reached only through `skills/**` or `scripts/**`, and the local
pre-push hook is the only thing that runs it unconditionally.

## The two opt-in jobs

Both are second jobs guarded on a repository variable and both are described
honestly by their own job names. The cloud eval job
(src: .github/workflows/autoresearch_eval.yml `cloud-judge-disabled-by-default:`) forwards the variable into an
environment that expects a different value — see
[autoresearch eval](../evaluation/autoresearch-eval.md) for the three reasons it
cannot produce a real judgement. The external graph job
(src: .github/workflows/wiki_graph_sync.yml `external-graph-write-disabled-by-default:`) passes three secrets and a
backend selector with defaults
(src: .github/workflows/wiki_graph_sync.yml `GRAPH_DB_KIND: ${{ vars.GRAPH_DB_KIND || 'generic-http-json' }}`); that path *is*
implemented, and it fails fast when the secrets are absent — see
[wiki graph sync](../wiki/wiki-graph-sync.md).

The wiki workflow also restricts its own permissions
(src: .github/workflows/wiki_graph_sync.yml `contents: read`) and fetches two commits
(src: .github/workflows/wiki_graph_sync.yml `fetch-depth: 2`).

## Pytest markers

Three markers are declared
(src: pyproject.toml `markers = [`): the eval marker
(src: pyproject.toml `"evals: local-first Golden Dataset and deterministic judge tests",`), a cloud-judge
marker described as disabled by default
(src: pyproject.toml `"llm_judge: LLM-as-a-Judge integration tests; cloud path disabled by default",`), and a trace
marker (src: pyproject.toml `"trace: local trace sampling and guardrail tests",`). Test discovery is
confined to one directory
(src: pyproject.toml `testpaths = ["tests"]`), and lint settings are pinned alongside
(src: pyproject.toml `line-length = 100`).

Only `evals` is actually applied — by
`tests/test_autoresearch_eval_suite.py`
(src: tests/test_autoresearch_eval_suite.py `pytestmark = pytest.mark.evals`). The other two markers are declared
but unused. The consequences per test file are on the
[validation matrix](validation-matrix.md).

## Running the narrowest check

```sh
python3 scripts/git_gate.py                 # everything the hook runs
python3 -m pytest -q -m evals               # what the eval workflow runs
python3 -m pytest -q                        # both marked and unmarked pytest tests
python3 -m unittest tests.test_real_driver_ablation   # not collected by any workflow
```
