# External Reproduction Report

## Reviewer

- Name or anonymous ID:
- Date:
- Prior familiarity with this repository: none / limited / substantial
- Role or relevant experience:

## Environment

- Repository commit:
- Operating system:
- Architecture:
- Bun version:
- Shell:
- Container or VM, when used:

## Commands

```sh
sh harness/selftest.sh
sh reproduction/recompute.sh
```

For each command record:

- exit code;
- complete stdout/stderr or attached log;
- start-to-finish time;
- expected result;
- observed result;
- smallest failing case, when different.

## Understanding check

In your own words:

1. What does lexical validity prove?
2. What does it not prove?
3. What is the strongest experiment conclusion you believe is supported?
4. Which missing artifact most limits confidence?

## Evidence-chain review

Claim selected from `PROJECT_EVIDENCE.yaml`:

```text
claim → evidence → command → observed result → limitation
```

- Was every link discoverable?
- Did the command verify the claim?
- Could the test pass for the wrong reason?

## Onboarding feedback

- Time to first successful command:
- First confusing term:
- First missing dependency or artifact:
- One high-leverage improvement:
- Would this change a real review or hiring decision? Why?

## Disclosure

- [ ] No private source, secret, credential, or proprietary prompt is included.
- [ ] Failed attempts are reported alongside successful ones.
- [ ] Permission was obtained before naming any participant.
