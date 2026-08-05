# Files

- [Validation matrix — what is proven, by what, and what is not](validation-matrix.md) - One row per gate and test suite, giving its trigger, what it actually proves, and the claim it does not support; plus the checks that are manual-only and the TypeScript suites that cannot run from this checkout at all.
- [Hooks, workflows and pytest markers](workflows-and-hooks.md) - The two git hooks, the four GitHub workflows and their trigger paths, the two opt-in jobs that are gated on repository variables, and the pytest markers that select the local-first eval suite.
