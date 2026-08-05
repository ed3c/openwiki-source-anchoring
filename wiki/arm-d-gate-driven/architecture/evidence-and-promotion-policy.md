---
type: Policy
title: Evidence and promotion policy
description: The repository-wide rule that nothing is promoted without a human admit, and the concrete fields, status words and exit codes that encode it across gates, datasets and receipts.
tags: [policy, promotion, evidence]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [promotion-policy, human-admit, evidence-grading]
libraries: [python, bun]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Evidence and promotion policy

## The rule

`PROJECT-SSOT.md` states it twice, once for external facts —
(src: PROJECT-SSOT.md `External claims remain candidate until verified or human-admitted.`)
— and once for semantic promotion, which additionally requires claim-level
terminal evidence plus multiple reviewers, and adds the sharpest clause in the
file: "absent agy findings are surfaced as a gate, not inferred as success"
(src: PROJECT-SSOT.md `not inferred as success`).

(inferred) The design consequence is unusual and worth stating plainly, because
it explains behaviour that otherwise looks like a bug: several gates in this
repository **pass while reporting that the thing they measure is not good
enough**. A gate that failed on insufficiency would create pressure to weaken the
measurement; a gate that passes while printing `insufficient` keeps the honest
number visible in CI without blocking unrelated work. The judgement is left to a
human, and the machine's job is to make the current state impossible to
misread.

## Where the rule is physically encoded

| Signal | Owner | Meaning |
|---|---|---|
| `quality_status=insufficient` | [synthetic case quality](../evaluation/interactions-regex-canary.md) | corpus is not admissible evidence yet |
| `semantic_arbitration_status=candidate_until_human_admit` | [semantic arbitration](../governance/semantic-arbitration.md) | claims are candidates |
| `promotion_status: candidate_until_human_admit` | [lifecycle datasets](../evaluation/lifecycle-datasets.md) | skill not promoted |
| `cloud_judge_enabled=false` | [autoresearch eval](../evaluation/autoresearch-eval.md) | no external judge ran |
| `admissionEligible: false` | [async lifecycle](../terminal-operator/async-lifecycle-and-admission.md) | background result cannot self-admit |
| `status=quarantined` | [gemini-interactions](../skills/gemini-interactions.md) | asset is not production-routable |

Each is a literal in source. The quality report picks its word from a list of
reasons and prints (src: scripts/synthetic_case_quality_report.py `quality_status={stats['quality_status']}`)
while still returning zero. The arbitration report prints
(src: scripts/semantic_arbitration_report.py `semantic_arbitration_status=candidate_until_human_admit`)
together with a count of reviews that have *not* executed
(src: scripts/semantic_arbitration_report.py `pending_adversarial_reviews={pending}`). The
lifecycle gate refuses a promotion record that claims anything else
(src: scripts/check_lifecycle_datasets.py `promotion record must remain candidate_until_human_admit`)
and additionally requires the human gate to be declared
(src: scripts/check_lifecycle_datasets.py `promotion record must require human admit`).

The operator plane encodes the same rule in types rather than strings. Its
lifecycle view fixes admission eligibility to a literal `false`
(src: .agents/skills/repo-terminal-operator/async-job-lifecycle.ts `admissionEligible: false;`),
so no amount of successful background work can flip it; only the separate
foreground `admit` action publishes an admission, and it refuses degraded
isolation outright (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `degraded-worker-not-admissible`).

## What counts as evidence

The strongest form the repository recognises is a *terminal artifact* — a file
that exists and can be reopened. Claims must list them, and empty lists are an
error (src: scripts/semantic_arbitration_report.py `{field} is empty`); when the compat
manifest is present, every listed path must resolve
(src: scripts/semantic_arbitration_report.py `missing {field} path {raw}`). Receipts follow
the same principle: the git gate hashes its own stdout and stderr
(src: scripts/git_gate.py `"stdout_sha256"`), and the writer re-opens what it published
and compares bytes before reporting success
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=publication-mismatch`).

The weakest form the repository explicitly refuses to launder into strength is a
simulation. The autoresearch harness answers from a hard-coded routing function
(src: scripts/eval_autoresearch_composer.py `def simulate_autoresearch_plan(prompt: str)`),
and the ablation engine scores a hard-coded agent
(src: scripts/ablation_engine.py `def simulate_agent(case: dict[str, object], has_skill: bool)`).
The one harness that runs a real agent produced a failing verdict, and that
verdict is stored rather than discarded
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"decision": "A2_FAIL_DO_NOT_PROMOTE"`).

## Scope boundary

This page states the policy and points at its encodings; it does not restate the
mechanics of any single gate. (inferred, see the Contract section of
`PROJECT-SSOT.md`) The P11 scoping clause is the clearest example of the policy
applied to the repository's own headline number, and its detail lives on the
[regex canary](../evaluation/interactions-regex-canary.md) page.
