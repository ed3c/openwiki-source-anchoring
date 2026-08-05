# Optional Evaluation Tooling

Checked against upstream project pages on 2026-08-05. Re-check the exact version and transitive dependencies before adoption. This is engineering guidance, not legal advice.

The deterministic OpenWiki manifest and source/test oracles should remain usable without these packages.

| Project | License | Best fit here | Main limitation | Recommendation |
|---|---|---|---|---|
| [promptfoo](https://github.com/promptfoo/promptfoo) | MIT | Run a fixed question × wiki × model matrix, rotate providers, cache raw outputs, add CI assertions | Orchestration does not make a judge correct; model calls and data handling still need explicit configuration | **Recommended first adapter** for experiment orchestration |
| [DeepEval](https://github.com/confident-ai/deepeval) | Apache-2.0 | Custom G-Eval/DAG rubrics, hallucination and summarization checks, CI-style evaluation tests | Many metrics are LLM-judge dependent and may default to cloud integrations or environment loading | Use as a secondary judge and calibration target, never the only oracle |
| [Ragas](https://github.com/explodinggradients/ragas) | Apache-2.0 | Faithfulness, context relevance, answer relevance, and dataset-oriented RAG analysis | Designed around retrieved context; a full code repository and generated wiki are not a conventional RAG context | Adapt only after defining atomic claims and source evidence spans |
| [TruLens](https://github.com/truera/trulens) | MIT | Trace answerer/judge calls, compare groundedness, latency, tokens, and cost across runs | Adds observability infrastructure and judge-specific assumptions | Useful for repeated-run diagnostics, not required for the core benchmark |
| [Hugging Face Evaluate](https://github.com/huggingface/evaluate) | Apache-2.0 | Standard metric packaging, reproducible metric cards, bootstrap wrappers | Generic text metrics such as ROUGE do not measure code-documentation truth | Use for analysis utilities and metric packaging, not headline factuality |
| [OpenAI Evals](https://github.com/openai/evals) | MIT | JSON/YAML eval registry patterns and model-graded evaluation structure | Current examples are OpenAI-oriented and an API key is normally required | Borrow the data/registry design or add an optional adapter |
| [tree-sitter](https://github.com/tree-sitter/tree-sitter) | MIT | Extract symbols, entrypoints, call sites, configuration keys, and navigation ground truth across languages | Grammar quality and semantic resolution vary; syntax alone is not full program behavior | **Recommended deterministic oracle layer** |
| [SWE-bench](https://github.com/SWE-bench/SWE-bench) | MIT | Methodology for isolated repository snapshots, issue-derived tasks, containerized patch evaluation, and test-based success | Its public tasks do not directly evaluate generated documentation | Borrow the task/container methodology; build project-specific tasks |

## Excluded from the permissive core

[Arize Phoenix](https://github.com/Arize-ai/phoenix) is actively maintained and strong for tracing, datasets, experiments, and evaluation, but upstream currently uses Elastic License 2.0 rather than MIT, Apache-2.0, or BSD. It may be usable in some commercial settings, but it does not satisfy this project's strict “permissive open-source core” filter. OpenInference, the related tracing specification and instrumentation project, is Apache-2.0 and can be considered independently.

## Suggested stack

### Phase 1: no new runtime dependency

- keep the manifest validator and raw result schema in this repository;
- use source-derived JSON tasks;
- score navigation and implementation with deterministic oracles;
- preserve raw model I/O.

### Phase 2: orchestration

- add a pinned promptfoo adapter to run the question × wiki × model matrix;
- disable telemetry where available;
- use immutable configuration and provider/model identifiers;
- export raw results back into the repository's neutral JSON schema.

### Phase 3: judge triangulation

- run one custom DeepEval rubric and one independent judge implementation;
- use Ragas or TruLens only on metrics whose inputs match their definitions;
- calibrate both against a human-labeled subset;
- report disagreement rather than averaging it away.

### Phase 4: executable utility

- use tree-sitter and repository-native tests to create navigation and patch oracles;
- borrow SWE-bench's isolated snapshot and test-harness discipline;
- keep generated explanations separate from final executable success.

## Selection rule

Before adding a tool, record:

```text
version + commit/tag + license + telemetry setting + model/provider dependency + exported raw format + removal path
```

A tool is replaceable. The frozen task bank, source snapshot, raw answer, judge mapping, and executable result are the durable evidence.
