# Security Policy

## Supported version

Security fixes are applied to the default branch. Experimental branches may change without notice.

## Threat model

The deterministic auditor may be pointed at a repository that is not trusted. Relevant risks include:

- lexical path traversal and real-path escape through symlinks;
- directory-symlink cycles;
- aliases that redirect an apparently valid source path into generated wiki output;
- very large files, pages, trees, anchor lists, or claim lists;
- extremely deep directory structures;
- invalid UTF-8 or binary input presented as source text;
- filesystem races while a repository is being modified concurrently;
- external agent drivers that execute commands or mutate writable files.

The auditor runs without network access, streams directory entries, does not recurse through symlinks, checks both lexical and real paths, validates UTF-8 with fatal decoding, and returns an explicit incomplete receipt when a resource/input boundary prevents a complete audit.

## Resource boundaries

Default limits:

| Boundary | Default |
|---|---:|
| Traversed filesystem entries | 50,000 |
| Source file bytes | 8 MiB |
| Total bytes read | 256 MiB |
| Markdown page bytes | 2 MiB |
| `(src:` tokens per page | 10,000 |
| C1-shaped claim blocks per page | 10,000 |
| Repository depth | 64 |
| Audit timeout | 30 seconds |

Limits are configurable through the CLI flags documented in [`REPRODUCE.md`](REPRODUCE.md) or matching `OPENWIKI_*` environment variables.

When a limit or required input boundary is reached, the auditor returns exit `3` with:

```json
{
  "complete": false,
  "status": "incomplete"
}
```

Consumers must reject any receipt where `complete !== true`, regardless of other fields.

## Safe-use guidance

For an untrusted target:

1. Run in an isolated container, VM, or disposable runner.
2. Mount the target read-only.
3. Apply lower limits when the target size is not known.
4. Run `sh harness/selftest.sh` before relying on receipts.
5. Treat exit `3` as a hard stop requiring human review.
6. Do not run `harness/trigger.sh` with `claude`, `agy`, or `codex` unless the driver, prompts, and writable workspace are trusted.
7. Review `.unresolved.json`, claim-preservation receipts, and audit receipts before merge.
8. Do not expose secrets in source files, prompts, logs, or public reproduction reports.

The deterministic auditor and the agent-driven mutation loop have different trust levels. `trigger.sh` can invoke external tools with write access; it is not a sandbox.

## Remaining boundaries

- A synchronous filesystem call already in progress cannot be preempted by the internal deadline.
- Host-level CPU, memory, process, and disk quotas must still be supplied by a container/runner.
- A concurrent attacker can change files between metadata checks and reads; mount untrusted targets read-only and avoid concurrent mutation.
- Special files are skipped during walks, but filesystem and platform behavior can differ.
- The resource defaults are conservative engineering bounds, not a formal denial-of-service proof.
- Lexical quote presence does not establish semantic support.
- CI covers the published fixtures on Ubuntu, not every filesystem or operating system.

## Reporting a vulnerability

Do not publish exploit details in a normal issue before the maintainer has had a chance to respond.

Use GitHub's private security advisory flow when available. Otherwise contact the maintainer through the GitHub profile and provide:

- affected commit;
- minimal reproduction;
- impact and boundary crossed;
- whether untrusted input is required;
- relevant limit configuration;
- suggested mitigation, when known.

A public issue may be opened after a fix is available or when the maintainer confirms disclosure is appropriate.
