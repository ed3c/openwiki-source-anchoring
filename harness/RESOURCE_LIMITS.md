# Auditor Resource and Input Limits

`audit_wiki.ts` is designed to fail closed on hostile or unexpectedly large repositories.

Default limits are frozen in `reproduction/protocol-v1.md` and can be overridden by CLI flags or `OPENWIKI_*` environment variables.

| CLI | Environment | Default |
|---|---|---:|
| `--max-files` | `OPENWIKI_MAX_FILES` | 50,000 traversed entries |
| `--max-file-bytes` | `OPENWIKI_MAX_FILE_BYTES` | 8 MiB |
| `--max-total-bytes` | `OPENWIKI_MAX_TOTAL_BYTES` | 256 MiB |
| `--max-page-bytes` | `OPENWIKI_MAX_PAGE_BYTES` | 2 MiB |
| `--max-anchors-per-page` | `OPENWIKI_MAX_ANCHORS_PER_PAGE` | 10,000 |
| `--max-claims-per-page` | `OPENWIKI_MAX_CLAIMS_PER_PAGE` | 10,000 |
| `--max-depth` | `OPENWIKI_MAX_DEPTH` | 64 |
| `--timeout-ms` | `OPENWIKI_TIMEOUT_MS` | 30,000 |

Exit `3` means the audit is incomplete. The JSON receipt always includes `complete: false`, `status: incomplete`, and either `limit_failure` or `input_failure`.

Directory entries are streamed and symlinks are not followed during walks. Explicit anchor paths are checked lexically and through `realpath`. UTF-8 decoding is fatal rather than replacement-based.

These checks are application-level bounds, not an operating-system sandbox. Use container CPU, memory, disk, process, and wall-clock limits for untrusted input.
