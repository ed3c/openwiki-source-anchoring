# OpenWiki Source-Anchoring Reproduction Protocol v1

Status: **public protocol for deterministic harness reproduction and future replications**

This file does not retroactively preregister the original model experiment. The original run predates this public bundle and still lacks some immutable model and private-target artifacts. Protocol v1 freezes the public deterministic reproduction path and the analysis boundaries for future work.

## 1. Questions

1. Does the auditor accept a page whose repository-relative path and verbatim quote are valid?
2. Does it reject a real path whose quote is absent from the referenced file?
3. Do resource or input limits produce an explicit incomplete receipt rather than PASS?
4. Does the retry loop re-audit the final mutation and preserve tracked claim IDs?

## 2. Public inputs

- Auditor: `harness/src/audit_wiki.ts`
- Claim guard: `harness/src/claim_guard.ts`
- Positive wiki: `reproduction/wiki-fixture/`
- Hollow-anchor wiki: `reproduction/wiki-hollow/`
- Target fixture: `reproduction/target-fixture/`
- Runtime: Bun `1.3.13`

All paths are relative to the repository root. No network access or model call is required.

## 3. Frozen thresholds

The public harness uses these thresholds:

- anchored C1-shaped claim blocks: at least 85%;
- anchor lexical validity: exactly 100%;
- entrypoint coverage: at least `30/32` (93.75%);
- verifiable share: at least 40% when claim or inferred blocks exist.

The deterministic fixture is expected to exceed every threshold. The hollow-anchor fixture is expected to fail lexical validity.

## 4. Frozen resource defaults

- maximum traversed filesystem entries: 50,000;
- maximum source-file bytes: 8,388,608;
- maximum total bytes read: 268,435,456;
- maximum Markdown page bytes: 2,097,152;
- maximum `(src:` tokens per page: 10,000;
- maximum C1-shaped claim blocks per page: 10,000;
- maximum repository depth: 64;
- audit timeout: 30,000 ms.

A boundary hit returns exit `3`, `complete: false`, and `status: incomplete`. An incomplete receipt is never a PASS.

## 5. Commands and expected outcomes

Run:

```sh
sh reproduction/recompute.sh
```

Expected final line:

```text
reproduction: PASS (protocol, fixtures, and receipts match)
```

Direct positive control:

```sh
bun run harness/src/audit_wiki.ts \
  reproduction/wiki-fixture \
  reproduction/target-fixture
```

Expected exit: `0`.

Direct hollow-anchor control:

```sh
bun run harness/src/audit_wiki.ts \
  reproduction/wiki-hollow \
  reproduction/target-fixture
```

Expected exit: `2`, with `quote not found in that file`.

## 6. Receipt comparison

`recompute.sh` compares complete JSON receipts byte-for-byte with files in `expected-receipts/`, then verifies their SHA-256 manifest. Receipt fields are deterministic: no timestamp, absolute path, hostname, or elapsed duration appears in a complete receipt.

## 7. Claim-preservation policy

A mutation-sensitive claim may carry:

```html
<!-- claim-id: stable-id -->
```

The retry loop inventories those IDs before mutation. The same ID must remain after a correction. Removal is allowed only when the packet includes a `claim_dispositions` entry with `disposition: withdrawn` and a non-empty reason. Word count remains a fallback for pages without explicit IDs; it is not treated as claim-preservation proof.

## 8. Interpretation boundary

A successful run supports only these statements:

- the public deterministic harness behaves as specified on the published fixtures;
- the receipts match the frozen expected outputs;
- tested resource boundaries fail closed;
- tracked claim IDs cannot silently disappear in the tested retry path.

It does not reproduce the original stochastic generation or QA experiment and does not establish semantic entailment between a quote and its surrounding claim.
