---
type: Quickstart
title: agent-skills-repo wiki quickstart
description: Entry point for the generated wiki — what the repository is, how its two planes fit together, a change-area routing table from intent to owning page, source entrypoint, focused test and narrowest validation command, and the deferrals this run recorded.
tags: [quickstart, navigation, task-routing]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [repo-map, task-routing, quickstart]
libraries: [python, bun, pytest]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Quickstart

## What this repository is

A **skill-asset governance seed** — a set of deterministic local defences around
agent skill assets, not an application
(src: PROJECT-SSOT.md `project_archetype: skill-asset-governance-repo`). Everything here exists to
decide whether a prompt asset and its behaviour corpus may be promoted, and to
make the current answer impossible to misread. Start with
[architecture/overview](architecture/overview.md).

Two planes share the tree and barely touch:

- a **Python governance and evaluation plane** whose single composition root is
  the [git gate](governance/git-gate.md)
  (src: scripts/git_gate.py `PASS: git gate defenses passed`);
- a **TypeScript terminal operator** vendored under `.agents/skills/`, whose
  contract is packet-in receipt-out
  (src: .agents/skills/repo-terminal-operator/repo-adapter.ts `output_contract: "small-loop-run-receipt@v1"`) and whose runtime home is
  the enclosing workspace, not this checkout — see
  [terminal-operator/overview](terminal-operator/overview.md).

Two rules explain almost every design decision you will meet:

1. **Nothing is promoted without a human.** External claims stay candidates
   (src: PROJECT-SSOT.md `External claims remain candidate until verified or human-admitted.`); several
   gates pass while reporting insufficiency. See
   [evidence and promotion policy](architecture/evidence-and-promotion-policy.md).
2. **What was not measured is named.** Missing axes, unsealed closures and
   degraded isolation are recorded rather than approximated — the clearest case
   is the [evidence-cost collector](terminal-operator/evidence-cost.md).

## Concept map

| Area | Pages |
|---|---|
| Architecture and contracts | [overview](architecture/overview.md) · [plan-package contract](architecture/plan-package-contract.md) · [promotion policy](architecture/evidence-and-promotion-policy.md) |
| Governance gates | [git gate](governance/git-gate.md) · [skill-asset validators](governance/skill-asset-validators.md) · [commit lineage](governance/commit-lineage.md) · [semantic arbitration](governance/semantic-arbitration.md) |
| Evaluation | [regex canary](evaluation/interactions-regex-canary.md) · [ablation and benchmarks](evaluation/ablation-and-benchmarks.md) · [real-driver ablation](evaluation/real-driver-ablation.md) · [autoresearch eval](evaluation/autoresearch-eval.md) · [lifecycle datasets](evaluation/lifecycle-datasets.md) · [prompt trace assets](evaluation/prompt-trace-assets.md) |
| Documentation as artifact | [openwiki contract](wiki/openwiki-contract.md) · [wiki graph sync](wiki/wiki-graph-sync.md) |
| The assets themselves | [gemini_interactions](skills/gemini-interactions.md) · [autoresearch_composer](skills/autoresearch-composer.md) |
| Terminal operator | [overview](terminal-operator/overview.md) · [preflight and small loop](terminal-operator/preflight-and-small-loop.md) · [task quality](terminal-operator/task-quality.md) · [writer publication](terminal-operator/writer-publication.md) · [async lifecycle and admission](terminal-operator/async-lifecycle-and-admission.md) · [worker and control plane](terminal-operator/async-worker-and-control-plane.md) · [evidence cost](terminal-operator/evidence-cost.md) · [forgejo handoff](terminal-operator/forgejo-handoff.md) · [production journeys](terminal-operator/production-journeys.md) |
| Operations | [workflows and hooks](ci/workflows-and-hooks.md) · [validation matrix](ci/validation-matrix.md) |
| Hand-written pages | [nonofficial index](nonofficial/README.md) — gate-pinned, see [openwiki contract](wiki/openwiki-contract.md) |

## Task routing

| I want to… | Page | Source entrypoint | Focused test | Narrowest validation |
|---|---|---|---|---|
| add or edit a skill's behaviour cases | [skill-asset validators](governance/skill-asset-validators.md) | `scripts/validator.py:validate_cases` | `tests/test_skill_asset_governance.py::test_static_defense_scripts_pass` | `python3 scripts/validator.py` |
| edit a skill's prompt text | [skill-asset validators](governance/skill-asset-validators.md) | `scripts/skill_description_linter.py:main` | same | `python3 scripts/validate_progressive_disclosure.py` |
| add a gate to the push hook | [git gate](governance/git-gate.md) | `scripts/git_gate.py:GATES` | `test_static_defense_scripts_pass` | `python3 scripts/git_gate.py` |
| change a commit-message trailer | [commit lineage](governance/commit-lineage.md) | `scripts/validate_commit_message.py:REQUIRED_FIELDS` | `test_static_defense_scripts_pass` | `python3 scripts/validate_commit_message.py --selftest` |
| audit protected Git history | [commit lineage](governance/commit-lineage.md) | `scripts/validate_molecular_commit_lineage.py:validate_three_surface_ledger` | `test_molecular_commit_lineage_selftest_passes` | `python3 scripts/validate_molecular_commit_lineage.py --selftest` |
| change the P11 case corpus | [regex canary](evaluation/interactions-regex-canary.md) | `scripts/synthetic_case_generator.py:generate_cases` | `test_p11_synthetic_and_zero_llm_telemetry` | `python3 scripts/interactions_patch_assert_runner.py` |
| change the A/B threshold | [ablation and benchmarks](evaluation/ablation-and-benchmarks.md) | `scripts/ablation_engine.py:TARGET_DELTA` | `test_static_defense_scripts_pass` | `python3 scripts/ablation_engine.py` |
| run a real agent A/B (src: scripts/real_driver_ablation.py `DEFAULT_THRESHOLD = 0.20`) | [real-driver ablation](evaluation/real-driver-ablation.md) | `scripts/real_driver_ablation.py:main` | `tests/test_real_driver_ablation.py` | `python3 -m unittest tests.test_real_driver_ablation` |
| add a golden eval case (src: scripts/eval_autoresearch_composer.py `REQUIRED_CASE_FIELDS = {`) | [autoresearch eval](evaluation/autoresearch-eval.md) | `scripts/eval_autoresearch_composer.py:validate_case_schema` | `tests/test_autoresearch_eval_suite.py` | `python3 -m pytest -q -m evals` |
| register a newly optimized skill | [lifecycle datasets](evaluation/lifecycle-datasets.md) | `scripts/render_lifecycle_openwiki.py:render` | `test_autoresearch_eval_and_trace_gates_pass` | `python3 scripts/check_lifecycle_datasets.py` |
| touch prompt-trace data | [prompt trace assets](evaluation/prompt-trace-assets.md) | `scripts/check_prompt_trace_assets.py:main` | none | `python3 scripts/check_prompt_trace_assets.py` |
| edit any hand-written wiki page | [openwiki contract](wiki/openwiki-contract.md) | `scripts/check_openwiki.py:REQUIRED_LITERALS` | `test_skill_asset_structure` | `python3 scripts/check_openwiki.py` |
| change the graph schema or projection | [wiki graph sync](wiki/wiki-graph-sync.md) | `scripts/sync_wiki_to_graph.py:project_graph` | `test_wiki_graph_sync_gate_passes` | `python3 scripts/check_wiki_graph_sync.py` |
| change what the repo must contain | [plan-package contract](architecture/plan-package-contract.md) | `scripts/check_plan_package_compat.py:main` | none | `python3 scripts/check_plan_package_compat.py` |
| change packet preflight or the small loop | [preflight and small loop](terminal-operator/preflight-and-small-loop.md) | `.agents/skills/repo-terminal-operator/small-loop-runner.ts:runSmallLoop` | workspace-only | `bun run .agents/skills/repo-terminal-operator/repo-adapter.ts --selftest` |
| change the static quality stages | [task quality](terminal-operator/task-quality.md) | `task-quality-contract.ts:TASK_QUALITY_STAGE_DEFINITIONS` | workspace-only | workspace-only |
| touch anything that writes a durable file | [writer publication](terminal-operator/writer-publication.md) | `writer-publication.ts:publishWriterArtifact` | workspace-only | workspace-only |
| change background run state or admission | [async lifecycle](terminal-operator/async-lifecycle-and-admission.md) | `async-job-lifecycle.ts:sealAsyncProductionRun` | workspace-only | workspace-only |
| change worker isolation or the projection | [worker and control plane](terminal-operator/async-worker-and-control-plane.md) | `async-worker-carrier.ts:isolationCapability` | workspace-only | workspace-only |
| change cost measurement | [evidence cost](terminal-operator/evidence-cost.md) | `evidence-cost-collector.ts:collectEvidenceCost` | workspace-only | workspace-only |
| publish Git state | [forgejo handoff](terminal-operator/forgejo-handoff.md) | `forgejo-git-handoff.ts:executeForgejoGitHandoff` | workspace-only | workspace-only |
| understand a receipt in `artifacts/` | [production journeys](terminal-operator/production-journeys.md) | `writer-production-race-scenario.ts:writerRaceScenario` | workspace-only | workspace-only |
| know whether something is actually tested | [validation matrix](ci/validation-matrix.md) | — | — | — |

"workspace-only" means the command resolves to files above this repository root
and cannot run from a standalone clone
(src: .agents/skills/repo-terminal-operator/production-use.profile.json `"../../skills/repo-neural-perception/scripts/writer-contained-production-profile.ts"`); the
[validation matrix](ci/validation-matrix.md) lists each case.

## Two facts worth knowing before you change anything

- **`openwiki/nonofficial/structured-lifecycle-data.md` must never be edited by
  hand.** A gate requires it to be byte-identical to generated output
  (src: scripts/check_lifecycle_datasets.py `structured lifecycle openwiki must equal renderer output`); regenerate it
  with `render_lifecycle_openwiki.py --write`.
- **The `gemini_interactions` asset is quarantined.**
  (src: skills/gemini_interactions/status.json `"production_routable": false,`) — and no gate enforces that, so read
  [its page](skills/gemini-interactions.md) before treating a green gate as
  permission.

## Backlog — what this run did not cover

- **Per-file documentation of `artifacts/repo-terminal-operator/`.** The 129
  files are covered collectively with an accurate schema and status breakdown on
  [production journeys](terminal-operator/production-journeys.md); individual
  receipts are generated output and are not documented one by one.
- **The hand-written `nonofficial/` pages.** They are treated as *gate inputs*
  and documented as such on the
  [openwiki contract](wiki/openwiki-contract.md) page rather than re-described.
  They are also the reason the source-anchor audit still reports unanchored
  claims for this wiki — those pages predate the anchoring convention and were
  preserved unchanged (src: scripts/check_openwiki.py `REQUIRED_LITERALS`).
- **`skills/gemini_interactions/references/deploy_guide.md`.** Six lines of
  routing guidance with no mechanism behind them
  (src: skills/gemini_interactions/references/deploy_guide.md `This reference is Layer 3.`); its only load-bearing property — that it
  exists and is referenced — is covered on
  [skill-asset validators](governance/skill-asset-validators.md).
- **Behaviour of the operator's workspace-side dependencies.** Everything under
  `skills/repo-neural-perception/`, `runtime/contracts/` and `tests/skills/` is
  named by this repository but absent from it
  (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"../../../../runtime/contracts/validate-packet.ts",`); it is documented as
  a boundary, not as a component.
