# Contributing

Contributions are welcome when they improve correctness, reproducibility, reviewability, or the usefulness of the experiment to real maintainers.

## Before starting

For a non-trivial change, open an issue describing:

```text
User or reviewer affected:
Problem:
Current behavior:
Proposed change:
Falsifiable claim:
Verification command:
Negative control:
Acceptance criterion:
```

Small typo and link fixes may go directly to a pull request.

## Development setup

Requirements:

- POSIX shell
- Bun version from [`.bun-version`](.bun-version)

Run the baseline checks:

```sh
bun --version
sh harness/selftest.sh
```

The final self-test line should report PASS.

## Change categories

### Harness behavior

A behavior change must include:

- a deterministic positive or negative fixture;
- an assertion on the failure reason, not only the exit code;
- backward-compatibility notes for JSON receipt fields;
- documentation of any denominator or threshold change.

Never improve a metric by silently deleting difficult claims, pages, fixtures, or failures.

### Experiment or result claims

State separately:

- observed result;
- supported inference;
- hypothesis;
- causal claim, if any.

Provide raw per-item data when possible. A single equal aggregate count is not an equivalence test. A process metric is not automatically a reader outcome.

### Documentation

Documentation changes must point to executable evidence when describing behavior. Keep English and Traditional Chinese entrypoints aligned when changing headline conclusions.

### Community and portfolio files

Changes to authorship or portfolio evidence must not infer private history. Mark unknown or incomplete provenance explicitly.

## Pull request checklist

A pull request should include:

- [ ] problem and intended user;
- [ ] files and behavior changed;
- [ ] verification commands and observed output;
- [ ] negative control for important gate behavior;
- [ ] evidence-bound wording;
- [ ] security impact for untrusted repositories;
- [ ] compatibility or migration notes;
- [ ] linked issue when applicable.

Keep pull requests focused enough that a reviewer can identify the claim being tested.

## Commit guidance

Use clear, scoped messages such as:

```text
fix: reject anchors that escape through symlinks
test: add malformed-anchor negative control
docs: bound marker-removal conclusion to one run
```

Do not use commit count or generated-file volume as evidence of quality.

## Review standard

Reviewers may request changes when:

- the README command cannot be run;
- the test can pass for the wrong reason;
- a metric can be gamed by deleting inputs;
- the result cannot be traced to raw data;
- the conclusion exceeds the design;
- human and agent ownership are materially ambiguous;
- default execution crosses an undocumented security boundary.

## Reporting reproduction results

Use the template in [`REPRODUCE.md`](REPRODUCE.md). A failed reproduction is a useful contribution when it includes the exact commit, environment, command, exit code, and smallest failing case.
