# External Reviewer Sprint

Issue #10 needs evidence from people who did not author or harden this repository. The sprint has two independent tracks.

## Track A — 15-minute clean-room reproduction

1. Start from a fresh clone at an exact commit SHA.
2. Run:

   ```sh
   bun --version
   sh harness/selftest.sh
   sh reproduction/recompute.sh
   ```

3. Record operating system, architecture, shell, Bun version, commands, exit codes, and complete output.
4. Open a reproduction issue, including failed attempts and the first confusing step.

A failed reproduction with a small test case is as useful as a successful one.

## Track B — 60-minute maintainer evidence review

1. Read the README for no more than 60 seconds.
2. State the strongest claim you think the project makes before running anything.
3. Complete Track A.
4. Explain in your own words:
   - path validity;
   - lexical validity;
   - semantic support;
   - why one equal aggregate count is not an equivalence result.
5. Trace one item in `PROJECT_EVIDENCE.yaml` to its command and observed artifact.
6. State whether this changes a real decision about reviewing AI-generated documentation.
7. Identify one claim, command, term, or onboarding step that should change.

Use the `External maintainer review` issue template. Do not expose private repositories, prompts, keys, employer information, or proprietary model transcripts.

## Recognition

With permission, completed reports are recorded in [`reproduction/REPRODUCERS.md`](../reproduction/REPRODUCERS.md) with:

- reviewer-selected display name;
- reviewed commit;
- environment;
- success or failure classification;
- issue or pull-request link;
- the project change caused by the report.

Anonymous reports are welcome and are recorded without identity.

## Counting rules

The project counts a participant only when a non-author submits enough evidence for another person to inspect the attempt. Repository-owner reruns, agents acting as the owner, synthetic smoke tests, and copied CI logs do not count as external reproduction.

Issue #10 closes only after its participant, reproduction, contribution, and onboarding-response criteria are met.
