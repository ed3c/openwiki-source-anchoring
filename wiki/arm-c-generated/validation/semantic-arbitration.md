---
type: Workflow
title: Semantic arbitration
description: How data/semantic_arbitration_claims.json grades claims, why an adversarial actor that did not run is surfaced as a pending gate rather than inferred as success, and what the absorbed agy execution profile pins.
tags: [arbitration, evidence-grading, adversarial-review]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [semantic-arbitration, adversarial-review, evidence-grading]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Semantic arbitration

`scripts/semantic_arbitration_report.py` is the repository's answer to a specific failure mode:
a claim that sounds verified because several reviewers *could* have checked it. It validates two data
files and refuses to let an unrun actor read as agreement
(src: scripts/semantic_arbitration_report.py `"""Check semantic arbitration evidence without promoting unrun actors."""`).

## The claim schema

`data/semantic_arbitration_claims.json` holds three claims, each requiring eight keys
(src: scripts/semantic_arbitration_report.py `"adversarial_reviews",`). Every claim must carry all
three skill cross-checks
(src: scripts/semantic_arbitration_report.py `REQUIRED_SKILLS = {"judge-loop-chooser", "external-verify", "repo-agent-native"}`)
and both adversaries
(src: scripts/semantic_arbitration_report.py `REQUIRED_ADVERSARIES = {"codex", "agy"}`), and must name
non-empty terminal code and data artifacts
(src: scripts/semantic_arbitration_report.py `errors.append(f"{claim_id}: {field} is empty")`).

Artifact paths are checked to exist, but only when a marker file is present
(src: scripts/semantic_arbitration_report.py `STRICT_TERMINAL_ARTIFACTS = (ROOT / "plan-package.compat.yaml").is_file()`),
and an explicit not-applicable escape is allowed
(src: scripts/semantic_arbitration_report.py `if raw.startswith("N/A-"):`).

Each claim carries a grounding label and a promotion status — for example the plan-package claim is
graded `technical_equivalent` yet still held back
(src: data/semantic_arbitration_claims.json `"promotion_status": "not-promoted-findings-only",`), and
the P11 claim is only `candidate`
(src: data/semantic_arbitration_claims.json `"grounding": "candidate",`).

## The rule that makes absence visible

A claim may only be marked promoted if its agy review actually executed
(src: scripts/semantic_arbitration_report.py `errors.append(f"{claim_id}: promoted claim lacks executed agy findings")`),
and the check is on the recorded status string rather than on the actor's presence
(src: scripts/semantic_arbitration_report.py `if not agy_reviews or agy_reviews[0].get("status") != "executed-findings-only":`).
Reviews that were required but not run say so
(src: data/semantic_arbitration_claims.json `"status": "packet-required-not-executed",`).

The summary line therefore reports both halves rather than a single score.
Observed at `5d3c42f`:

```text
PASS: semantic arbitration perceived semantic_arbitration_status=candidate_until_human_admit
      claim_count=3 agy_execution_lessons=10 agy_model=gemini-3.6-flash-high
      agy_reasoning=high agy_thinking=extended agy_canary=passed-strip-equals
      terminal_code_artifacts=10 terminal_data_artifacts=12
      executed_adversarial_reviews=3 pending_adversarial_reviews=3
```

Three reviews executed, three pending — and the gate is green. The compatibility guard requires both
that shape and the pending count
(src: scripts/check_plan_package_compat.py `"pending_adversarial_reviews=3",`), plus the policy label
(src: plan-package.compat.yaml `adversarial_review_policy: codex-executed-agy-required-before-promotion`).

(inferred) Exiting zero with three pending reviews looks lax and is the opposite. The alternative
designs are worse in both directions: failing the gate would make the honest record of a missing review
the thing that blocks work, so the record would be deleted; hiding the count would make "reviewed" and
"not yet reviewed" indistinguishable. Printing `pending_adversarial_reviews=3` next to
`executed_adversarial_reviews=3` keeps the gap in the same sentence as the progress, where the next
reader cannot miss it.

## The absorbed agy execution profile

`data/agy_execution_experience.json` exists because the adversary is an external CLI whose behaviour
had to be pinned before its findings could ever count. The script validates it as strictly as the
claims (src: scripts/semantic_arbitration_report.py `raise ValueError("agy experience profile has invalid schema_version")`):

- an exact model id, present in the observed inventory
  (src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_MODEL_ID = "gemini-3.6-flash-high"`), with the
  inventory command itself recorded
  (src: scripts/semantic_arbitration_report.py `errors.append("agy model_profile must record model_inventory_command=agy models")`);
- reasoning effort and thinking mode pinned
  (src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_THINKING_MODE = "extended"`);
- a **file-output canary**, not just an exit code — stdout must have said one thing and a written file
  must have contained another
  (src: scripts/semantic_arbitration_report.py `errors.append("agy execution_canary stdout_observed must be CANARY_DONE")`)
  (src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_CANARY_TEXT = "CANARY_OK"`);
- ten lessons, each with a source reference and a portable enforcement rule
  (src: scripts/semantic_arbitration_report.py `errors.append(f"{item.get('lesson_id', 'unknown')}: missing portable_enforcement")`),
  whose refs must point back at the origin repository with a line anchor
  (src: scripts/semantic_arbitration_report.py `if not ref.startswith("<home>/antigravity/") or ":" not in ref:`);
- five phrases that must survive any rewrite of the file
  (src: scripts/semantic_arbitration_report.py `required_phrases = ("silent no-op", "exact model ids", "stdout", "findings-only", REQUIRED_AGY_MODEL_ID)`).

The lessons themselves are the interesting content — `AGY-002` records that exit code and stdout are
not enough to detect a silent no-op
(src: data/agy_execution_experience.json `"Exit code and stdout are not enough for silent no-op"`), and
`AGY-007` fixes the actor's role
(src: data/agy_execution_experience.json `"Agy is Gemini findings, not judge or admit"`).

(inferred) The canary is the whole profile in miniature. A CLI that prints a plausible summary and
writes nothing passes every exit-code check ever written; requiring a file whose stripped contents equal
a known token is the cheapest test that distinguishes "ran" from "appeared to run". The five required
phrases exist for the same reason one layer up — they make it impossible to soften the file into
something that still validates.

## Related

- [Synthetic corpus](synthetic-corpus.md) — the claim `P11-QUALITY-001` grades.
- [Plan-package compatibility](../governance/plan-package-compat.md) — the manifest values this feeds.
- [Repository architecture](../architecture/overview.md) — evidence grading as a repository-wide concept.
- [Production bottlenecks](../nonofficial/production-bottlenecks.md) — pending review stated as a limit.
