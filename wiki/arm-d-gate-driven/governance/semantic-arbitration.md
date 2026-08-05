---
type: Component
title: Semantic arbitration and the agy execution profile
description: How claim-level evidence is graded — required skill cross-checks, required adversarial reviewers, terminal artifact existence, and the pinned agy model and canary profile that must hold before any claim may be promoted.
tags: [evidence, arbitration, promotion, gate]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [semantic-arbitration, adversarial-review, agy-execution-profile]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Semantic arbitration and the agy execution profile

## Purpose

`PROJECT-SSOT.md` makes semantic promotion conditional on claim-level terminal
evidence plus findings from a named set of reviewers
(src: PROJECT-SSOT.md `Semantic promotion requires claim-level terminal code/data evidence`).
`scripts/semantic_arbitration_report.py` is the check that keeps that condition
honest without ever promoting anything itself
(src: scripts/semantic_arbitration_report.py `Check semantic arbitration evidence without promoting unrun actors.`).

## Per-claim contract

Claims live in `data/semantic_arbitration_claims.json`, loaded as an object with
a non-empty `claims` list (src: scripts/semantic_arbitration_report.py `claims must be a non-empty list`).
Each claim must carry eight keys including `grounding`, `promotion_status` and
both artifact lists (src: scripts/semantic_arbitration_report.py `"terminal_code_artifacts",`), and each
must be cross-checked by three named skills
(src: scripts/semantic_arbitration_report.py `REQUIRED_SKILLS = {"judge-loop-chooser", "external-verify", "repo-agent-native"}`)
and reviewed by two adversaries
(src: scripts/semantic_arbitration_report.py `REQUIRED_ADVERSARIES = {"codex", "agy"}`). Missing entries are
reported by name (src: scripts/semantic_arbitration_report.py `missing adversarial reviews`).

Artifact lists may not be empty, and paths are checked for existence whenever the
compat manifest is present — a condition evaluated at import time
(src: scripts/semantic_arbitration_report.py `STRICT_TERMINAL_ARTIFACTS = (ROOT / "plan-package.compat.yaml").is_file()`).
A path may opt out only by declaring itself inapplicable
(src: scripts/semantic_arbitration_report.py `if raw.startswith("N/A-"):`).

The promotion rule is a single branch: a claim marked `promoted` must have an agy
review whose status is executed findings
(src: scripts/semantic_arbitration_report.py `promoted claim lacks executed agy findings`). (inferred) This is
the mechanical form of the SSOT clause that absent findings are a gate rather
than success — the check cannot make the review happen, but it can make its
absence fatal at exactly the moment someone tries to call a claim promoted.

## The agy execution profile

`data/agy_execution_experience.json` must declare schema version
(src: scripts/semantic_arbitration_report.py `agy-execution-experience@0.1.0`) and is validated field by
field. The model identity is pinned three ways — the selected id
(src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_MODEL_ID = "gemini-3.6-flash-high"`), its presence in
the observed inventory (src: scripts/semantic_arbitration_report.py `agy observed_model_ids must include`),
and the command that produced that inventory
(src: scripts/semantic_arbitration_report.py `agy model_profile must record model_inventory_command=agy models`).
Reasoning effort and thinking mode are equally pinned
(src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_THINKING_MODE = "extended"`).

The execution canary proves the runner actually produced a file, not just a
plausible transcript: stdout must match
(src: scripts/semantic_arbitration_report.py `agy execution_canary stdout_observed must be CANARY_DONE`), the artifact
stripped of whitespace must equal a token
(src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_CANARY_TEXT = "CANARY_OK"`), and the verification
status must record how it was checked
(src: scripts/semantic_arbitration_report.py `agy execution_canary verification_status must be passed-strip-equals`).

Ten numbered lessons must all be present
(src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_LESSONS = {`), each with a source reference
under the originating repository and a line marker
(src: scripts/semantic_arbitration_report.py `if not ref.startswith("<home>/antigravity/") or ":" not in ref:`) and a portable
enforcement note (src: scripts/semantic_arbitration_report.py `missing portable_enforcement`). Five phrases
must survive anywhere in the document, including the failure mode the lessons
exist to prevent (src: scripts/semantic_arbitration_report.py `required_phrases = ("silent no-op", "exact model ids", "stdout", "findings-only", REQUIRED_AGY_MODEL_ID)`).
The source repository itself is pinned
(src: scripts/semantic_arbitration_report.py `agy experience source_repo must remain <home>/antigravity`), matching the SSOT
clause that these rules were absorbed from that repository
(src: PROJECT-SSOT.md `Agy execution rules are absorbed from <home>/antigravity`).

## Output

On success the gate prints one line carrying the counted state, not a verdict:
claim count, lesson count, the model and canary fields, artifact counts, and both
review tallies (src: scripts/semantic_arbitration_report.py `f"executed_adversarial_reviews={executed} "`).
The compat gate re-asserts three of those literals, including
(src: scripts/check_plan_package_compat.py `"pending_adversarial_reviews=3",`), so the number of
outstanding reviews is itself pinned. See
[evidence and promotion policy](../architecture/evidence-and-promotion-policy.md).

## Validation

```sh
python3 scripts/semantic_arbitration_report.py
# PASS: semantic arbitration perceived semantic_arbitration_status=candidate_until_human_admit ...
```
