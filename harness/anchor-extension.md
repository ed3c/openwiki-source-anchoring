# Appendix — source anchors and inference marking (skill-bettor addition, NOT upstream text)

The official gates catch a wiki that *cannot answer* a question. They do not catch a
wiki that answers with an invented number, because nothing in the run ever compares a
sentence against the file it describes. Measured on the 44-page baseline of
`agent-skills-repo`: 298 claims name a source file, **zero** carry anything a script can
check. No path in that wiki turned out to be fabricated — the defect is that no reader,
human or agent, can tell.

This appendix closes that gap with one required form. It adds a convention; it does not
change any official instruction, and no official file is edited.

## The anchor

```
(src: <repo-relative path> `<verbatim substring of that file>`)
```

Example:

```md
The commit gate refuses an amend whose index equals HEAD
(src: scripts/git_gate.py `lineage manifest must be staged`).
```

Rules:

- The path is repo-relative, from the repository root, and must resolve.
- The quote is **copied, never retyped**. It is checked with a literal substring match
  against the file's bytes, so a paraphrase, a reflowed line, or a "close enough" symbol
  name fails.
- Pick the shortest quote that is unique enough to be evidence — usually a signature, a
  literal string, a constant, or an error message.
- The anchor goes **inside the sentence that makes the claim**, not in a footnote or a
  trailing source list. An anchor detached from its claim proves nothing about it.

**No line numbers.** The official prompt directs you to *"prefer stable paths and symbol
names over line numbers"*, and it is right: a line number is stale after the next commit,
while the quote is the evidence itself. The anchor form above satisfies both that
instruction and mechanical verification.

## What must carry an anchor

Anchor any sentence asserting something a reader could check by opening the file:

| Claim | Anchor |
|---|---|
| a file, function, flag, or schema field exists, or has a given shape | required |
| a component calls, imports, or is registered by another | required |
| a command, gate, or script produces a specific exit code, output, or error | required |
| a count, threshold, timeout, or version number | required |

For an exit code or observed output, run the command and quote what it printed; do not
infer it from reading the code.

## What must NOT be anchored

Design rationale — why something is built this way, what a decision traded off, what the
architecture is defending against — usually has no verbatim source. Do not manufacture an
anchor for it, and do not delete the sentence either. Mark it:

```md
(inferred) The two directories are kept separate so a drift in one cannot be
mistaken for agreement in the other.
```

This is the most valuable material in the wiki and it is deliberately exempt. A wiki where
every sentence is anchored has become an API reference: mechanically perfect, and no longer
worth reading. Anchoring is a floor on checkability, never a ceiling on explanation.

Where git history supports the rationale, cite the commit instead:

```md
(inferred, see 0367e28) The gate learned to verify an amend against HEAD^ ...
```

**Every paragraph explaining *why* must carry either an anchor or `(inferred)`.** Silence is
not an option there: an unmarked rationale paragraph is indistinguishable from an anchored
fact to anyone reading later, which is precisely the confusion this appendix removes.

## Breadth is not the budget you may cut

A measured A/B on this pipeline (`kb-ingest/engine-baseline.md`, 2026-07-05, same repo and
pin, single variable) found that adding an anchoring requirement drove fabrication to zero
and **halved round-1 coverage, 6 pages to 3**. The bottleneck moved from dirty to narrow;
the total score gained 4 points and authoring cost 40% more time.

The mechanism is not laziness. Anchoring raises the per-claim cost, so a bounded author
absorbs it by narrowing scope rather than by working longer. Expect that pull and refuse it
explicitly:

- Coverage is scored separately and gated. Dropping a component to afford anchors elsewhere
  fails the run even when every remaining anchor is perfect.
- If a claim resists anchoring, mark it `(inferred)` and keep it. Deleting the sentence, or
  the page, is the failure this section exists to prevent.
- When both cannot fit, breadth wins and the thin spots get marked, because a known gap is
  recoverable on the next update and a silently dropped component is not.

The official instruction already agrees: *"Never defer an area merely because of time,
token, page-count, or navigation convenience."* Anchoring cost is one more instance of that.

## Per-page receipt

After writing each page — **before** any finalize pass — append one line to
`/openwiki/.receipts.jsonl`:

```json
{"page":"architecture/data-authority.md","seq":7,"words":674,"anchors":11,"inferred":4}
```

`finalize` rewrites every file, so the filesystem keeps no record of the order pages were
written in. Without these receipts a later run cannot tell whether quality decays as the
context fills, which is the one measurement that decides whether page generation needs to
be split across isolated agents. Write the line when the page is done, not in a batch at
the end.

## Verification

`loop_wiki/evolve-repo-wiki-converge-anchor/verify.sh <wiki-dir> [target]` scores anchor
rate, anchor correctness, and entrypoint coverage, and exits non-zero below the frozen
thresholds. Its `selftest.sh` proves the checker is not a shell: a *hollow* anchor — real
path, quote that is not in that file — must fail, and must fail for that reason.
