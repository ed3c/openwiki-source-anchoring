# Denominator and Confounding Remeasurement

This note records the part of PR #22 that remains valid after rebasing onto the current `main` branch. It supersedes any sentence in the older narrative that attributes the C-to-D difference to the gate alone or treats the arm-B marker stripping as a clean marker-only intervention.

The current repository now vendors the matching desensitized target under [`repo-snapshot/`](../repo-snapshot/) and fully re-audits every arm with [`harness/src/audit_arms.ts`](../harness/src/audit_arms.ts). An earlier version of PR #22 said the published arms could not fully re-audit and reported invalid counts of 1/7/5. That statement was made before commits `d337774` and `df2f360` added the matching target and corrected the publication transformation. It is no longer current and was deliberately excluded from the merge.

## 1. The 41.3% to 100% jump moves both numerator and denominator

The legacy anchor rate is:

```text
anchored claim blocks / all metric-shaped claim blocks
```

For the two fresh-authoring arms:

| Arm | Anchored | Claim blocks | Anchor rate | Claim blocks / 1,000 words |
|---|---:|---:|---:|---:|
| C — fresh, no gate | 64 | 155 | 41.3% | 5.93 |
| D — fresh, gate | 119 | 119 | 100.0% | 4.35 |

Holding arm C's denominator fixed, arm D's 119 anchored blocks become:

```text
119 / 155 = 76.8%
```

Of the 58.7 percentage-point headline gap:

- about **35.5 points** come from more blocks being anchored;
- about **23.2 points**, roughly **40% of the gap**, come from fewer blocks being counted as claims.

This is not evidence that arm D became narrower. In the measured set, arm D contains more words than arm C, `27,357` versus `26,159`, names more distinct source files, `114` versus `107`, and retains `32/32` entrypoint coverage. What changed is granularity: fewer headings and table rows were counted as independent claim blocks.

Run:

```sh
bun run harness/src/check_published_arms.ts
```

The command prints numerator, denominator, rate, and claim density together so denominator movement cannot hide inside a percentage.

## 2. C and D are not a clean gate contrast

Arm D is not arm C with one switch changed.

- The measured sets contain 35 and 37 pages but share only **10 page paths**.
- Arm D created `ci/`, `evaluation/`, `skills/`, and `wiki/` sections that arm C did not create.
- Arm C created other sections arm D did not create.
- They are independent cold-start authoring sessions.
- Their target copies differed in two source files, although auditing each arm against its own copy does not change the published counts.

Gate pressure, session-level writing variation, page selection, and the treatment's ability to move its own denominator therefore co-vary. No pair in the current data isolates the gate.

The separating design is already frozen in [`experiments/factorial-v1/PROTOCOL.md`](../experiments/factorial-v1/PROTOCOL.md): R0/R1 and G0/G1 on one pinned target, with repeated independent runs and blinded evaluation. That study remains unexecuted.

## 3. The legacy denominator is gameable without deleting words

A block becomes a metric-shaped claim when it contains a backticked code-file reference. Removing only the backticks from every unanchored filename in arm C leaves the text and word count otherwise unchanged, adds no anchors, and moves the legacy rate from **41.3% to 100%** because those blocks disappear from the denominator.

The word-floor control does not catch this: no words were deleted.

This makes anchor rate useful as a process diagnostic only when its numerator and denominator are reported together and the claim inventory is frozen outside the text being scored.

## 4. An alternative second reading

[`harness/src/audit_anchor_invariant.ts`](../harness/src/audit_anchor_invariant.ts) reports a second metric whose unit is the pair:

```text
(page, source file named anywhere on that page)
```

Because the unit does not depend on Markdown block boundaries, table pipes, headings, or backticks, de-ticking a filename and merging paragraphs do not remove the unit.

Pinned results:

| Arm | Covered pairs | Named pairs | Rate |
|---|---:|---:|---:|
| C | 90 | 211 | 42.7% |
| D | 125 | 209 | 59.8% |

The denominators differ by about 1%, rather than the legacy metric's 23%.

This is a **second reading, not a true score**. It still has open gaming channels, including weak evidence that merely mentions a file and page merging. CI pins both its legacy-parity block and its current C/D output so future changes must explain any movement.

## 5. B versus Bs is not marker-only

B and Bs have the same aggregate PASS count, `12/30`, in one run. That does not establish equivalence.

Removing `(src: path `quote`)` removes the quote content as well as the visible marker. In the measured set the stripped arm loses about 1,814 words, changes the claim-block denominator from 152 to 154, and reduces entrypoint coverage from `32/32` to `31/32`. PASS+PARTIAL also changes from 20/30 to 17/30, while the unanswerable count changes from 6 to 5.

The clean marker experiment would preserve the quote as ordinary prose while removing only the citation presentation, then repeat answer generation under a predeclared equivalence margin.

## 6. Cost attribution is not identified

The published `2.88M`, `563K`, and `590K` token figures do not share one documented accounting basis, and the repository does not contain complete cost receipts for all three. The 27K difference between C and D is a difference between two sessions, not an identified gate cost.

A cost claim requires one accounting definition, complete receipts, and a design that varies gate use while holding authoring mode, target, model, page plan, and execution structure fixed.

## 7. Supported wording

Supported:

- Arm C reached `64/155`; arm D reached `119/119`.
- Arm D anchored more blocks and wrote fewer metric-shaped claim blocks.
- C and D are separate generations and do not identify a gate effect.
- B and Bs matched on aggregate PASS once, while other outcomes and the stripped content differed.
- Anchor rate is a process metric whose denominator can move with authoring style.

Not supported:

- “The gate accounts for the difference between 41% and 100%.”
- “The gate costs 27K tokens.”
- “The markers contribute nothing.”
- “Anchor rate is positively or negatively correlated with reader quality” from four single-run arms.
- “100% means semantic correctness.”

## Verification

```sh
sh harness/selftest.sh
bun run harness/src/audit_arms.ts
bun run harness/src/check_published_arms.ts
bun run harness/src/audit_anchor_invariant.ts \
  wiki/arm-c-generated repo-snapshot --exclude nonofficial
bun run harness/src/audit_anchor_invariant.ts \
  wiki/arm-d-gate-driven repo-snapshot --exclude nonofficial
sh reproduction/recompute.sh
```
