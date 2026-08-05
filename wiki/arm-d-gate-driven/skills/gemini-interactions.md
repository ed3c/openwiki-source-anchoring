---
type: Asset
title: gemini_interactions — the quarantined skill asset
description: The Gemini Interactions prompt asset, its ten behaviour cases and deployment reference, every gate and eval that reads it, and the 2026-07-27 quarantine decision that makes it non-routable in production.
tags: [skill-asset, quarantine, cases]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [gemini-interactions-asset, quarantine-decision, behavior-cases]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# `gemini_interactions`

## The asset

Three layers, in the shape every validator expects. The root prompt is four
labelled lines: the purpose
(src: skills/gemini_interactions/skills.md `WHY: Generate or audit Gemini Interactions API code when the task asks for that API.`),
the method, which routes deeper only when needed
(src: skills/gemini_interactions/skills.md `load references/deploy_guide.md only for deployment details`), the trigger
condition, and an explicit non-trigger list
(src: skills/gemini_interactions/skills.md `WHEN NOT: Angular UI components, Vue components, static data extraction, or unrelated cloud deployment.`).
`references/deploy_guide.md` is the deeper layer that
[progressive disclosure](../governance/skill-asset-validators.md) requires, and
`cases.json` is the behaviour corpus.

`README.md` names the asset as something this repository owns
(src: README.md `skills/gemini_interactions/skills.md`), and the compat gate requires the
prompt to retain its four markers plus the reference route
(src: scripts/check_plan_package_compat.py `required_terms = ["WHY:", "HOW:", "WHEN:", "WHEN NOT:", "references/deploy_guide.md"]`).

## Who reads it

| Reader | What it does with the asset |
|---|---|
| `scripts/validator.py` | corpus shape (src: scripts/validator.py `expected 10-20 cases, got`) |
| `scripts/local_regex_runner.py` | 5 trials per case (src: scripts/local_regex_runner.py `ROOT / "skills/gemini_interactions/cases.json"`) |
| `scripts/ablation_engine.py` | default A/B corpus (src: scripts/ablation_engine.py `ROOT / "skills" / "gemini_interactions" / "cases.json"`) |
| `scripts/no_ops_purger.py` | default prune target (src: scripts/no_ops_purger.py `ROOT / "skills/gemini_interactions/skills.md"`) |
| `scripts/real_driver_ablation.py` | default real-agent corpus and skill text (src: scripts/real_driver_ablation.py `DEFAULT_SKILL = ROOT / "skills" / "gemini_interactions" / "skills.md"`) |
| `tests/test_real_driver_ablation.py` | supplies the same skill file to the mock driver (src: tests/test_real_driver_ablation.py `str(ROOT / "skills" / "gemini_interactions" / "skills.md"),`) |

The behaviour it is meant to produce is fixed by regex, not prose: current-API
imports and calls, with legacy chat names forbidden — the rule table lives in
`interactions_patch_assert_runner.py`
(src: scripts/interactions_patch_assert_runner.py `r"\.interactions\.create\("`) with negatives such as
(src: scripts/interactions_patch_assert_runner.py `r"\.start_chat\("`). See the
[regex canary](../evaluation/interactions-regex-canary.md).

## The quarantine

`skills/gemini_interactions/status.json` is a promotion-status record
(src: skills/gemini_interactions/status.json `"schema_version": "skill-promotion-status@0.1.0",`) that declares the
asset (src: skills/gemini_interactions/status.json `"status": "quarantined",`) and
(src: skills/gemini_interactions/status.json `"production_routable": false,`) as of
(src: skills/gemini_interactions/status.json `"decision_date": "2026-07-27",`), bound to its evidence
(src: skills/gemini_interactions/status.json `"verification_receipt": "data/verification_runs/gemini_interactions_real_driver_2026-07-27.json"`).

Four reasons are recorded, and they are of two different kinds. Two are about the
*result*: the delta missed the bar
(src: skills/gemini_interactions/status.json `below the preregistered 0.20 threshold`) and four of sixty runs timed
out (src: skills/gemini_interactions/status.json `so runtime metadata was incomplete`). Two are about the
*measurement itself*: the negative cases "forbid their own requested domain
words, confounding correct skill non-activation with refusal to perform the user
task" (src: skills/gemini_interactions/status.json `confounding correct skill non-activation with refusal to perform the user`),
and the run shared one working directory so "agent-created files were visible to
later cases" (src: skills/gemini_interactions/status.json `agent-created files were visible to later cases`).

(inferred) The second pair is the more damaging finding, and it is why the
decision is a quarantine rather than a rejection: a confounded corpus and a
contaminated run mean the asset was never actually measured. The recorded
`next_action` says exactly that — repair the corpus in a new bounded plan, use
the driver's ephemeral per-invocation cwd, and preregister a fresh ablation
(src: skills/gemini_interactions/status.json `use the driver's ephemeral per-invocation cwd with codex --skip-git-repo-check`)
— and it closes the current attempt
(src: skills/gemini_interactions/status.json `do not rerun this plan a fourth time.`). The harness has since been
fixed on the point that mattered: each invocation now gets its own temp cwd
(src: scripts/real_driver_ablation.py `with tempfile.TemporaryDirectory(prefix="real-driver-agent-") as isolated_cwd:`).

**The quarantine is a human decision, not a mechanical one.** No gate reads
`status.json`: it is absent from the 22-entry gate list, absent from the 77
required paths in `check_plan_package_compat.py`, and absent from
`tests/test_skill_asset_governance.py`'s required-file inventory
(src: tests/test_skill_asset_governance.py `"skills/gemini_interactions/references/deploy_guide.md",`), which lists the
asset's other two files and stops there. Every gate above still runs happily
against the quarantined asset. (inferred) A change that wanted the quarantine
enforced would have to add a reader; documenting the gap is the honest
alternative to implying one exists.

## Validation

```sh
python3 scripts/validator.py
python3 scripts/local_regex_runner.py
python3 scripts/ablation_engine.py          # default corpus is this asset
```

Related: [real-driver ablation](../evaluation/real-driver-ablation.md) for the
receipt, [promotion policy](../architecture/evidence-and-promotion-policy.md) for
the rule the quarantine follows.
