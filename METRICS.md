# Metric Definitions

This project separates mechanical process checks from reader-facing correctness. Do not collapse these levels into one metric.

## Path validity

A referenced path is path-valid when:

1. its lexical resolution stays inside the supplied target root;
2. the path exists;
3. its `realpath` stays inside the target root, including after symlink resolution;
4. the resolved object is a regular file.

Path validity protects a filesystem boundary. It does not establish that the file is relevant evidence.

## Lexical validity

A parsed anchor is lexically valid when its quoted substring occurs verbatim in its path-valid referenced file.

Formula for parsed anchors:

```text
lexical_validity = (parsed anchors - invalid parsed anchors) / parsed anchors
```

Malformed source-looking tokens are reported separately and also fail the gate. The JSON field `anchor.correctness` remains temporarily as a deprecated compatibility alias for `anchor.lexical_validity`.

Lexical validity establishes quote presence only.

## Anchor rate

A measured C1-shaped claim is counted as anchored when its Markdown block contains at least one well-formed anchor.

```text
anchor_rate = anchored measured claim blocks / measured claim blocks
```

This is a process metric. One valid anchor can coexist with other unsupported statements in the same block, so anchor rate is not semantic correctness.

## Verifiable share

Blocks marked `(inferred)` are excluded from the anchor-rate denominator but tracked separately.

```text
verifiable_share = measured claim blocks / (measured claim blocks + inferred blocks)
```

This guard reduces the incentive to classify every difficult claim as inference.

## Entrypoint coverage

Entrypoint coverage measures whether detected executable entrypoints are named somewhere in the measured wiki pages.

```text
entrypoint_coverage = covered detected entrypoints / detected entrypoints
```

Coverage and anchor metrics can share evidence. They are not statistically independent outcomes.

## Semantic support

Semantic support asks whether the cited evidence actually supports the surrounding claim. The current harness does not compute this metric.

A credible implementation would require:

- explicit claim segmentation;
- claim-to-anchor mapping;
- entailment or contradiction review;
- calibrated human or independent-model adjudication;
- disagreement and abstention reporting.

## Reader-facing QA

QA PASS/PARTIAL/FAIL is an outcome measure produced by the published answer-and-judge layer. It is separate from harness metrics and inherits the limitations of the question bank, model configuration, blinding, and single-run design.

## Human adjudication

Human adjudication should report:

- reviewer instructions;
- randomization and blinding procedure;
- abstentions;
- per-item judgments;
- agreement statistic when more than one reviewer is used;
- conflicts of interest.

## Terminology to avoid

Do not write:

- `anchor correctness = 100%` when the harness measured lexical validity;
- `markers have no effect` from one equal aggregate count;
- `the gate caused the improvement` when compared arms differ on other factors;
- `reproduced` when only aggregate totals were recomputed.

Use the narrowest term supported by the verification path.
