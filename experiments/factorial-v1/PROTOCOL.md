# Factorial Replication Protocol v1

Status: **pre-execution protocol; no results yet**

## Objective

Separate two factors that were confounded in the original comparison:

1. **Authoring mode** — retrofit an existing wiki versus verify during fresh authoring.
2. **Mechanical gate** — convention only versus convention plus an executable gate loop.

## Cells

| Cell | Authoring mode | Mechanical gate |
|---|---|---|
| R0 | Retrofit | No |
| R1 | Retrofit | Yes |
| G0 | Fresh generation | No |
| G1 | Fresh generation | Yes |

Keep a zero-verification baseline A outside the factorial as a reference arm. The highest-priority missing result is G1 with reader-facing QA.

## Unit of analysis

The primary unit is one independently generated wiki run against one frozen target commit. Reader-facing QA is evaluated per question and aggregated within run before cross-run analysis.

## Minimum repeats

- At least 5 independent wiki generations per factorial cell.
- At least 3 independent answer generations per wiki/question combination when estimating reader-facing answer quality.
- At least 2 independent judges or one judge plus a blinded human sample.

These are minimum engineering targets, not a power calculation. Before execution, replace them with a simulation- or pilot-based sample-size justification.

## Frozen inputs required before the first run

- public or releasable target repository and exact commit SHA;
- immutable prompt copies and SHA-256 hashes;
- exact provider and immutable model IDs;
- system prompt, temperature, top-p, seed where supported, max tokens, tool settings, and CLI/API version;
- question bank and split hashes;
- primary outcome and analysis code commit;
- equivalence margin for marker-on/off analysis;
- resource and monetary budget;
- stop conditions.

Mutable family aliases such as `sonnet`, `opus`, or `latest` are not sufficient identifiers.

## Primary outcome

Predeclare exactly one reader-facing primary outcome. Recommended default:

```text
mean per-run QA PASS rate on the untouched holdout set
```

The holdout set must not be inspected while changing prompts, thresholds, parsing, or analysis.

## Secondary outcomes

- PASS+PARTIAL rate;
- "wiki does not say" count;
- lexical validity;
- anchor rate as a process metric;
- entrypoint coverage;
- completeness and word count;
- latency, token usage, and cost;
- number and type of gate interventions;
- human/judge agreement;
- safety/resource-limit failures.

## Randomization and blinding

- Randomize run order across cells.
- Rotate anonymous arm labels for answer judging.
- Keep judges blind to cell, model, cost, anchor rate, and expected direction.
- Preserve the randomization seed and generated assignment file.
- Do not allow the same context/session state to carry across cells.

## Contamination controls

- Each run starts from a clean checkout of the same target commit.
- Generated wikis, review transcripts, and prior run outputs are unavailable to later authoring agents.
- Public, validation, and holdout questions remain separate.
- Any post-hoc arm, metric, or exclusion is labeled exploratory.

## Hard stop conditions

Stop and invalidate the affected batch when:

- the target commit differs across cells;
- a model ID or prompt hash is missing;
- holdout content was inspected during design changes;
- a receipt is incomplete (`complete !== true`);
- a run silently omits raw answers or judge records;
- a parser or threshold changes after outcome inspection without restarting all affected cells.

## Required raw artifacts

Every run must publish or securely archive:

- run manifest conforming to `run-manifest.schema.json`;
- complete prompts and prompt hashes;
- raw generated wiki;
- auditor receipt;
- raw answers;
- raw judge outputs and anonymization map;
- resource/cost logs;
- errors, retries, exclusions, and rejected outputs;
- derived summary produced only by versioned analysis code.

## Interpretation boundary

The factorial identifies the main effects and interaction of authoring mode and gate use only when all cells, repeats, and controls are present. Equal aggregate counts in one run do not establish equivalence. Anchor rate remains a process measure, not the primary reader outcome.
