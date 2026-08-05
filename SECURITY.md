# Security Policy

## Supported version

Security fixes are applied to the default branch. Experimental branches may change without notice.

## Threat model

The auditor may be pointed at a repository that is not trusted. Relevant risks include:

- path traversal and filesystem boundary escape;
- symlinks that resolve outside the target root;
- directory-symlink cycles during recursive walks;
- unexpectedly large files or repository trees;
- non-text files passed to UTF-8 readers;
- generated anchors that reference the wiki's own output as circular evidence;
- external agent drivers that can execute commands or modify files.

The auditor is designed to run without network access and now avoids following symlinks during repository walks. Explicit anchor paths are checked both lexically and through `realpath` before a file is read.

## Safe-use guidance

For an untrusted target:

1. Run the auditor and self-test in an isolated container or disposable runner.
2. Mount the target read-only when possible.
3. Run `sh harness/selftest.sh` before trusting a receipt.
4. Do not run `harness/trigger.sh` with `claude`, `agy`, or `codex` drivers unless you trust the driver, prompt inputs, and writable workspace.
5. Review generated `.unresolved.json` and receipts before merging changes.
6. Do not expose secrets in target files, logs, prompts, or reproduction issues.

The deterministic auditor is materially safer than the agent-driven retry loop. They should not be assigned the same trust level.

## Known limitations

- The auditor is not a complete sandbox.
- Resource-exhaustion limits for file count, file size, and total bytes are not yet enforced.
- UTF-8 decoding is attempted on referenced files; unusual encodings may be rejected or misread.
- The harness proves lexical quote presence, not semantic support.
- CI covers the included fixtures, not every operating system or filesystem.

## Reporting a vulnerability

Do not publish exploit details in a normal issue before the maintainer has had a chance to respond.

Use GitHub's private security advisory flow when it is available for this repository. Otherwise, contact the maintainer through the GitHub profile and provide:

- affected commit;
- minimal reproduction;
- impact and boundary crossed;
- whether untrusted input is required;
- suggested mitigation, if known.

A public issue may be opened after a fix is available or when the maintainer confirms that disclosure is appropriate.
