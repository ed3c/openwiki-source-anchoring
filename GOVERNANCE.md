# Governance

This repository is currently maintained by `ed3c` under a single-maintainer model.

## Decision authority

The maintainer has final responsibility for:

- accepting and merging changes;
- publishing releases;
- changing experiment claims or thresholds;
- handling conduct and security reports;
- deciding when the project is ready for broader benchmark or portfolio use.

Agent-generated proposals do not have decision authority.

## Decision principles

Changes are evaluated in this order:

1. **Trust:** Does the implementation behave as claimed?
2. **Reproducibility:** Can an external reviewer run the verification path?
3. **Evidence:** Does the conclusion stay inside what the design supports?
4. **Security:** Is the default path safe enough for its documented inputs?
5. **User value:** Does the change help a maintainer or reviewer make a decision?
6. **Complexity:** Is there a smaller 90/10 solution?

A high aggregate score does not override a failed hard gate.

## Hard gates

A change is not release-ready when any of the following applies:

- the documented smoke test fails;
- a core result cannot be traced to raw data;
- a hidden input is required for the primary claim and is not disclosed;
- a headline materially exceeds the experiment design;
- authorship or agent assistance is misrepresented;
- default execution has an unresolved critical security issue;
- licensing is unclear.

## Material changes

The following require an issue and explicit review notes:

- claim-denominator or parser changes;
- threshold changes;
- result-table changes;
- model or judge changes;
- removal of raw data or fixtures;
- receipt schema changes;
- security-boundary changes;
- license or governance changes.

The issue should record the previous behavior, proposed behavior, migration impact, and verification command.

## Releases

A release should include:

- reviewed commit SHA;
- clean CI result;
- changelog entry;
- reproduction commands;
- known limitations;
- receipt schema and compatibility notes;
- links to unresolved research blockers.

Research claims may be released as directional findings, but the release notes must state that classification.

## Adding maintainers

Additional maintainers should demonstrate sustained contributions in at least two of these areas:

- harness correctness and tests;
- reproducibility and artifact packaging;
- experiment design and statistics;
- security review;
- contributor support and documentation.

Maintainer access should follow a public nomination and review period when the project has an active contributor community.

## Amendments

Governance changes are made through pull requests and should explain why the current process is insufficient. Historical decisions should remain discoverable through issues, pull requests, and the changelog.
