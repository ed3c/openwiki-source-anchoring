---
type: Asset
title: autoresearch_composer — the managed skill asset
description: The state-graph prompt asset, its twelve-case corpus with six negatives, the Layer-3 state graph reference with its conditional edges and actor-routing table, and the lifecycle gate that pins all of it.
tags: [skill-asset, state-graph, lifecycle]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [autoresearch-composer-asset, state-graph, actor-routing]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# `autoresearch_composer`

## The asset

The root prompt states the failure it exists to prevent — planning bounded
metric-driven loops "without collapsing match, generate, and validate into one
prompt" (src: skills/autoresearch_composer/skills.md `without collapsing match, generate, and validate into one prompt`)
— and names the mechanism that would otherwise fail
(src: skills/autoresearch_composer/skills.md `prevents compressed context from becoming an ambiguous route decision`). Its
method routes actors rather than leaving a choice open
(src: skills/autoresearch_composer/skills.md `Opus/Codex/agy are assigned one evidence role each, never left as an unresolved choice`),
and it lists the promotion requirements including the honest limit on the cloud
judge (src: skills/autoresearch_composer/skills.md `cloud/API judge hooks are present but disabled by default`). Its
non-trigger list keeps it out of neighbouring skills' territory
(src: skills/autoresearch_composer/skills.md `WHEN NOT: General SDLC planning, TDD fixes, security reviews, bug diagnosis, design grilling, or family eval case authoring.`).

## The Layer-3 reference

`references/state_graph.md` declares its own layer and load condition
(src: skills/autoresearch_composer/references/state_graph.md `Load it when a task is a bounded metric-driven optimization loop.`). It
defines six nodes from intake to recovery — the first preserving low-compression
context (src: skills/autoresearch_composer/references/state_graph.md `S0 intake | preserve low-compression user context`) and the fourth
validating cases, delta, metric, guard and terms
(src: skills/autoresearch_composer/references/state_graph.md `S4 validate`).

Six conditional edges say what happens when a precondition fails, including the
two promotion blocks — no corpus
(src: skills/autoresearch_composer/references/state_graph.md `fail promotion until 10-20 behavior cases exist`) and no positive delta
(src: skills/autoresearch_composer/references/state_graph.md `fail promotion until A/B delta passes`) — and the two context repairs
(src: skills/autoresearch_composer/references/state_graph.md `restore low-compression semantic truth before generation`).

The actor-routing table is the reference's core. It bans the unresolved choice
outright (src: skills/autoresearch_composer/references/state_graph.md `Do not write `) and then assigns each semantic
question one actor, one output and one forbidden shortcut: faithfulness goes to a
fresh judge with (src: skills/autoresearch_composer/references/state_graph.md `no automatic admit`), physical
behaviour goes to an engineering audit with
(src: skills/autoresearch_composer/references/state_graph.md `no name-only technical_equivalent claim`), external runtime facts go to
findings or verification with
(src: skills/autoresearch_composer/references/state_graph.md `no guessed external-runtime fact`), and terminology goes to a glossary
admit with (src: skills/autoresearch_composer/references/state_graph.md `no candidate/unknown term in hard-gate conclusion`). Absent
evidence has a declared state
(src: skills/autoresearch_composer/references/state_graph.md `If evidence is missing, the state is candidate or `).

(inferred) That table is the reason this asset is the repository's *managed*
skill while the other is quarantined: it encodes the same evidence discipline the
repository applies to itself, so validating the asset and validating the
governance model are nearly the same act.

## The corpus and its gate

`cases.json` holds twelve cases, half of them negative — the shape is asserted
rather than described, by the ablation conditions in
`check_autoresearch_lifecycle.py`
(src: scripts/check_autoresearch_lifecycle.py `or telemetry.get("negative_case_count") != 6`) plus a perfect negative
rate (src: scripts/check_autoresearch_lifecycle.py `!= 1.0`). The same gate pins ten literals in the
reference (src: scripts/check_autoresearch_lifecycle.py `"conditional_edge.S4.ablation_not_positive",`) and five in the
prompt (src: scripts/check_autoresearch_lifecycle.py `"pytest eval markers",`), and, when the authoring
workspace is present, requires the two corpora to be byte-identical
(src: scripts/check_autoresearch_lifecycle.py `source cases and production repo cases differ`).

Its lifecycle state is registered as a candidate, not a promotion
(src: scripts/check_lifecycle_datasets.py `registry must contain autoresearch_composer as a managed skill`) with status
(src: scripts/check_lifecycle_datasets.py `autoresearch_composer status must be production-seed-candidate`). Full detail on
[lifecycle datasets](../evaluation/lifecycle-datasets.md) and
[autoresearch eval](../evaluation/autoresearch-eval.md).

## Scope boundary

Every number attached to this asset comes from simulation. The eval harness
routes with a hard-coded function
(src: scripts/eval_autoresearch_composer.py `def simulate_autoresearch_plan(prompt: str) -> dict[str, object]:`) and the
ablation scores a hard-coded agent
(src: scripts/ablation_engine.py `if skill_slug == "autoresearch_composer":`). No real-driver run exists for
it — the only recorded one targeted the other asset and failed; see
[real-driver ablation](../evaluation/real-driver-ablation.md).

## Validation

```sh
python3 scripts/ablation_engine.py --cases skills/autoresearch_composer/cases.json --json
python3 scripts/check_autoresearch_lifecycle.py
```
