# Changelog

## Unreleased

### Added

- Deterministic reproduction bundle with frozen protocol, content hashes, expected receipts, and one-command recomputation.
- Configurable file-count, byte, depth, anchor-count, claim-count, and timeout boundaries for hostile repositories.
- Explicit incomplete-audit receipt and exit code `3`.
- Stable claim-ID inventory and preservation guard with explicit reasoned withdrawal.
- Deterministic final-retry success, final-retry invalid-anchor, and same-word-count claim-deletion controls.
- Prospective 2×2 factorial replication protocol, analysis plan, provenance template, and run-manifest schema.
- External reproduction challenge, report template, and GitHub issue template.

### Changed

- Directory walks now stream entries rather than materializing each directory at once.
- UTF-8 decoding is strict and fails closed.
- `trigger.sh` rejects incomplete audit receipts and validates page/packet boundaries.
- `verify.sh` documents and preserves the incomplete-audit exit code.
- Reproducibility CI now checks all executable shell paths and recomputes frozen receipts.

### Fixed

- Final-retry behavior is now covered by deterministic mutation fixtures rather than implementation inspection alone.
- Equal-or-higher word count can no longer hide removal of claims that carry stable IDs.

### Still open

- Execute the repeated factorial experiment with immutable model provenance.
- Obtain independent maintainer and reproduction reports.
