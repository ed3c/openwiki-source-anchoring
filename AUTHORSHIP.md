# Authorship and Agent Assistance

This repository contains both original experimental work and later agent-assisted hardening. The goal of this file is to make ownership reviewable rather than to claim that every line was written manually.

## Human-owned decisions

The maintainer owns and is accountable for:

- selecting the problem and target use case;
- deciding to compare baseline, retrofit, stripped-marker, fresh-authoring, and gate-driven arms;
- choosing the published thresholds and evaluation questions;
- deciding which conclusions to keep, weaken, or withdraw;
- reviewing and merging changes;
- deciding whether the repository is suitable as portfolio evidence.

## Agent-assisted work

Agents have been used for parts of:

- wiki generation and source-anchoring passes;
- question generation, answer generation, and model adjudication;
- code and documentation review;
- drafting issues, community-health files, reviewer guidance, and portfolio manifests;
- implementing the `agent-portfolio-hardening` branch, including CI, path-boundary hardening, and negative controls.

Agent output is treated as a proposal, not as evidence by itself.

## Verification responsibility

A change is accepted only when it has a verification path independent of the prose that describes it. Depending on the claim, that path may include:

- `sh harness/selftest.sh`;
- a deterministic fixture;
- a raw JSON result or audit receipt;
- an independent blind adjudication;
- a code review against the implementation;
- a clean GitHub Actions run.

The maintainer remains responsible for any merged result even when an agent drafted or implemented it.

## Known provenance limits

- The exact authoring model and complete sampling configuration were not pinned for every original arm.
- Family labels such as `sonnet` and `opus` are not immutable model identifiers.
- Not every original prompt, answer, judge transcript, and rejected candidate is available publicly.
- The original target and host repository are not fully public.

These limits reduce the strength of authorship and reproduction claims. They are not filled in by inference.

## Evidence rule

Every important portfolio claim should map to:

```text
claim → repository evidence → verification command → observed result → limitation
```

Commit count, generated text volume, and agent activity are not substitutes for this chain.

## Review questions for AI-heavy contributions

A reviewer should ask:

1. Which decision required human judgment?
2. What did the agent generate or modify?
3. How was the result tested independently?
4. Which agent outputs were rejected or corrected?
5. What remains unverified?

The answers should be visible in the pull request, issue, test, or evidence manifest rather than reconstructed from private conversation history.
