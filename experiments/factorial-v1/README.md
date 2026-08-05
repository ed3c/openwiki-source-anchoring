# Factorial Replication v1

This directory freezes the next stochastic experiment before execution. It addresses issue #8 by specifying the missing 2×2 design, immutable run records, repeated evaluation, and equivalence analysis.

No result is stored here yet. Empty result fields are intentional; populating them requires new model runs against an approved public or releasable target.

Files:

- `PROTOCOL.md` — hypotheses, cells, outcomes, stopping and contamination rules
- `analysis-plan.md` — uncertainty, contrasts, equivalence, and reporting
- `run-manifest.schema.json` — machine-checkable record required for every run
- `provenance-template.json` — template for exact provider/model/prompt/runtime provenance
