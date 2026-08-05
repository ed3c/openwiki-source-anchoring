# Next Experiment

Issue #8 now has an executable prospective 2×2 study package under [`experiments/factorial-v1/`](../experiments/factorial-v1/).

## Design

| Cell | Authoring mode | Mechanical gate |
|---|---|---|
| R0 | Retrofit | No |
| R1 | Retrofit | Yes |
| G0 | Fresh authoring | No |
| G1 | Fresh authoring | Yes |

Keep A as the zero-verification reference arm.

## Before production execution

- Pin exact immutable authoring, answerer, and judge model IDs.
- Freeze target and protocol commits, prompt/question hashes, sampling parameters, budget, and randomization.
- Replace the engineering repeat minimum with a documented pilot or assumption-driven planning decision.
- Commit the study config, freeze record, and randomized schedule before generating outcomes.

## Commands

```sh
bun run experiments/factorial-v1/smoke-test.mjs
```

This command validates infrastructure only. It creates no research result.

Production execution follows [`experiments/factorial-v1/EXECUTION.md`](../experiments/factorial-v1/EXECUTION.md), preserves raw prompts, wikis, answers, judgments, costs, failures, audit receipts, and hash-addressed manifests, then reports run-level uncertainty and the prespecified confirmatory analysis.

Issue #8 remains open until real repeated runs exist for every cell and G1 receives reader-facing QA.
