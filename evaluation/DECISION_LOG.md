# Evaluation Framework Decision Log

## 2026-08-05 — Keep the deterministic trust root dependency-free

Decision: validate study identity, source SHAs, output boundaries, split paths, and provenance with a small local script and adversarial controls.

Reason: orchestration and LLM-judge frameworks are useful, but adopting one must not make its scoring semantics or hosted service the only evidence that a study is valid.

## 2026-08-05 — Use repository × generation run as the top-level experimental unit

Decision: pages, claims, questions, answer samples, and judge labels remain nested observations.

Reason: outputs from one source snapshot and generation run share prompts, model state, repository structure, and errors. Counting them as independent replications would overstate certainty.

## 2026-08-05 — Make downstream task success a primary outcome

Decision: pair source-grounded QA with navigation, change-impact, and executable implementation tasks.

Reason: polished factual answers do not by themselves demonstrate that documentation helps an Agent work correctly in the repository.

## 2026-08-05 — Separate permissive-core tools from other commercial-use options

Decision: prefer MIT, Apache-2.0, and BSD components in the optional core, while recording non-permissive or source-available tools separately.

Reason: “commercially usable” and “permissive open source” are not equivalent license categories.
