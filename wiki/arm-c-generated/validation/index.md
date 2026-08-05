# Files

- [Ablation and benchmark](ablation-and-benchmark.md) - The three A/B surfaces — a simulated ablation engine with a per-asset agent branch, a fully synthetic benchmark matrix, and real_driver_ablation.py, the only script here that executes a live agent.
- [Behavioral eval and judge](behavioral-eval-and-judge.md) - The four runners that evaluate skill behaviour against cases — a simulated planner with deterministic guardrails, a local heuristic judge, a strictly disabled cloud judge, and two zero-LLM regex runners.
- [Semantic arbitration](semantic-arbitration.md) - How data/semantic_arbitration_claims.json grades claims, why an adversarial actor that did not run is surfaced as a pending gate rather than inferred as success, and what the absorbed agy execution profile pins.
- [Static validators](static-validators.md) - The eight scripts that read skill files without executing anything — what each rejects, the environment variable that relocates its root, and which ones run selftest-only inside git_gate.
- [Synthetic corpus](synthetic-corpus.md) - The deterministic 117-case P11 matrix, the zero-LLM runner that scores it, and the quality report that deliberately keeps the corpus classified insufficient.
