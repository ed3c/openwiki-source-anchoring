# Analysis Plan

## Primary contrasts

Estimate, with uncertainty:

1. Gate main effect: average of `(R1 - R0)` and `(G1 - G0)`.
2. Authoring-mode main effect: average of `(G0 - R0)` and `(G1 - R1)`.
3. Interaction: `(G1 - G0) - (R1 - R0)`.
4. G1 versus zero-verification baseline A as a separately labeled reference contrast.

Use run-level estimates to avoid treating repeated questions from the same wiki as independent experimental units.

## Recommended model

Use a hierarchical model or cluster-aware frequentist model with:

- fixed effects for authoring mode, gate, and their interaction;
- random effects for wiki run and question;
- judge effect when multiple judges are used;
- reported absolute percentage-point effects and compatible intervals.

Publish the model code and a simpler descriptive analysis that can be recomputed without specialized software.

## Dependency-free descriptive analysis

`analyze.mjs` provides the simpler analysis required above. It:

- validates each run against the frozen config and schedule hashes;
- aggregates judgments within wiki run;
- reports cell-level run means and operational failures;
- bootstraps run-level factorial contrasts with a frozen seed;
- labels synthetic smoke output as infrastructure evidence only.

It is not the confirmatory hierarchical model. A production report must publish both the dependency-free output and the prespecified cluster-aware analysis.

## Marker equivalence

For marker-on versus marker-stripped output:

1. Predeclare an equivalence margin before viewing results.
2. Run repeated answer generations.
3. Apply TOST or a documented Bayesian equivalence model.
4. Report individual question transitions and cost/latency effects.
5. Do not infer equivalence from matching aggregate PASS counts.

## Missing data and failures

- Preserve failed runs and classify their failure reason.
- Do not replace a failed run silently.
- A replacement run receives a new run ID and remains linked to the failed run.
- Incomplete auditor receipts are excluded from quality estimates only under a predeclared rule and remain reported as operational failures.

## Multiplicity

The primary outcome and three factorial contrasts are confirmatory. All other metrics are secondary or exploratory. Report unadjusted estimates alongside the chosen family-wise or false-discovery control; do not hide outcomes that lose significance after adjustment.

## Human/judge agreement

Report raw agreement and a chance-corrected statistic suitable for the label structure. Include the full confusion matrix and adjudication protocol. A clean sweep with no abstentions should trigger instrument review rather than automatic confidence.

## Reporting

For every cell report:

- number of planned, completed, failed, and excluded runs;
- point estimates and uncertainty intervals;
- raw denominators;
- cost and latency distributions;
- prompt/model provenance completeness;
- deviations from protocol.
