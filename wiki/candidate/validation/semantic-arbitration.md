---
type: Reference
title: Semantic Arbitration
description: How semantic claims stay candidate until human admit, why a review that did not run is surfaced as a gate rather than inferred as success, and what the agy execution profile is for.
tags: [arbitration, claims, adversarial-review]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [candidate-claims, adversarial-review, actor-evidence]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Semantic Arbitration

A "semantic" claim here is one that cannot be settled by running a script — whether two components are
really equivalent, whether a design actually holds. This repository's rule for such claims is that they
stay **candidate** until a human admits them, and that a missing review is reported, never assumed
benign.

## Current state

`python3 scripts/semantic_arbitration_report.py` reports:

```text
semantic_arbitration_status=candidate_until_human_admit
claim_count=3
executed_adversarial_reviews=3
pending_adversarial_reviews=3
terminal_code_artifacts=10  terminal_data_artifacts=12
agy_execution_lessons=10
agy_model=gemini-3.6-flash-high  agy_reasoning=high  agy_thinking=extended
agy_canary=passed-strip-equals
```

Three claims, three executed reviews, **three still pending**. The gate exits 0 and prints those numbers
rather than failing — the same reporting-not-blocking stance as
[synthetic corpus quality](synthetic-corpus-quality.md). What it will not do is let a pending review
read as an absent objection.

## The rule, stated by the project

`PROJECT-SSOT.md`:

> Semantic promotion requires claim-level terminal code/data evidence plus judge-loop, external-verify,
> repo-agent-native, Codex, and agy findings; **absent agy findings are surfaced as a gate, not inferred
> as success.**

That last clause is the whole design. The failure mode it blocks is the quiet inference "no adversary
objected, therefore the claim holds", when in fact no adversary ran.

`plan-package.compat.yaml` carries the operational form of both — the review policy
(src: plan-package.compat.yaml `adversarial_review_policy: codex-executed-agy-required-before-promotion`)
and the status field
(src: plan-package.compat.yaml `semantic_arbitration_status: candidate_until_human_admit`).

## What a claim must carry

`data/semantic_arbitration_claims.json` is a **mutable registry**, not a receipt — every entry carries a
promotion status the reporter re-reads and branches on
(src: scripts/semantic_arbitration_report.py `if claim.get("promotion_status") == "promoted":`), and all
three entries currently sit below promotion
(src: data/semantic_arbitration_claims.json `"promotion_status": "not-promoted-findings-only"`).
See [Data authority](../architecture/data-authority.md). Promotion of a claim
requires:

- claim-level **terminal** code and data artifacts (currently 10 and 12) — the actual files an assertion
  rests on, not a summary of them;
- findings from both adversary classes, Codex and agy, executed rather than assumed;
- the supporting actor roles from `judge-loop-chooser`, `external-verify` and `repo-agent-native`;
- a human admit.

## The agy execution profile

`data/agy_execution_experience.json` records how agy must be run before its findings count — ten lessons,
whose ids AGY-001 through AGY-010 the reporter all requires
(src: scripts/semantic_arbitration_report.py `"AGY-010",`), with the model, reasoning and thinking levels
pinned as required constants — `gemini-3.6-flash-high`, `high`, `extended`
(src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_MODEL_ID = "gemini-3.6-flash-high"`)
(src: scripts/semantic_arbitration_report.py `REQUIRED_AGY_THINKING_MODE = "extended"`) — and a
canary (src: data/agy_execution_experience.json `"verification_status": "passed-strip-equals"`) that
proves the run really executed rather than silently no-opping. `PROJECT-SSOT.md` requires these rules be
*"applied before any future agy findings packet is promoted"*
(src: PROJECT-SSOT.md `must be applied before any future agy findings packet is promoted`).

The canary exists because a misconfigured agy invocation can print a success-shaped answer without doing
any work. A findings packet without a passing canary is not evidence.

## Evidence origin

| Claim | Tier |
|---|---|
| the counts above | **verifiable in this checkout** — `python3 scripts/semantic_arbitration_report.py` |
| that the three executed reviews found what they say | **receipt / data claim only** |
| the agy execution lessons | **receipt / data claim only** — imported from an external workspace |
| any claim needing current Git history | **requires explicit external input** — this directory has no `.git` of its own |

## Validation

```sh
python3 scripts/semantic_arbitration_report.py
```
