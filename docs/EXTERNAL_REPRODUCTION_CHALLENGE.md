# External Maintainer and Reproduction Challenge

This challenge operationalizes issue #10. It is ready to run, but the repository does not claim external validation until non-authors submit evidence.

## Participants sought

- maintainers who review AI-generated technical documentation;
- independent reproducibility reviewers;
- contributors unfamiliar with the repository.

## 60-minute task

1. Read the README for no more than 60 seconds and state the strongest claim you think the repository makes.
2. Run:

   ```sh
   sh harness/selftest.sh
   sh reproduction/recompute.sh
   ```

3. Explain the difference between lexical validity and semantic support.
4. Trace one claim through `PROJECT_EVIDENCE.yaml`.
5. Open an issue using the reproduction template or propose one focused pull request.

## Measures

Record:

- time to first successful command;
- setup failure and exact error;
- incorrect interpretation of the experiment;
- confidence before and after executing evidence;
- first confusing term or missing artifact;
- whether the artifact changes a real documentation-review decision;
- whether the participant can identify human versus agent ownership.

## Continue / pivot / stop criteria

Continue toward a portfolio benchmark only when:

- at least two non-authors submit complete reproduction reports;
- at least one external issue or pull request reaches completion;
- most participants correctly distinguish lexical validation from semantic support;
- setup failures are reproducible and addressed publicly.

Pivot the project toward a smaller harness/library when maintainers value the deterministic checks but do not use the experiment or portfolio layer.

Stop claiming benchmark readiness when external reviewers cannot reproduce the evidence chain or repeatedly misread the central conclusion after the onboarding path is improved.

## Publication rules

- Obtain permission before naming participants.
- Anonymize interview notes by default.
- Publish failed attempts and onboarding confusion, not only successful reports.
- Never ask participants to expose private repositories, prompts, credentials, or proprietary model transcripts.

Use [`reproduction/reports/TEMPLATE.md`](../reproduction/reports/TEMPLATE.md) for each report.
