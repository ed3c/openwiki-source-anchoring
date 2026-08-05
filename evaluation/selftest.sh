#!/bin/sh
# Positive and negative controls for the multi-OpenWiki evaluation manifest.
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
VALIDATOR="$ROOT/src/validate_manifest.mjs"
TMP=$(mktemp -d)
OUTSIDE=$(mktemp -d)
trap 'rm -rf "$TMP" "$OUTSIDE"' EXIT HUP INT TERM
fail=0

mkdir -p \
  "$TMP/snapshots/source" \
  "$TMP/wiki/a" \
  "$TMP/wiki/b" \
  "$TMP/qa" \
  "$TMP/tasks" \
  "$TMP/results" \
  "$TMP/reviews"

printf '%s\n' '# source fixture' > "$TMP/snapshots/source/README.md"
printf '%s\n' '# wiki a' > "$TMP/wiki/a/index.md"
printf '%s\n' '# wiki b' > "$TMP/wiki/b/index.md"
for file in development public holdout; do printf '[]\n' > "$TMP/qa/$file.json"; done
for file in repository-qa navigation change-impact implementation; do printf '[]\n' > "$TMP/tasks/$file.json"; done

HASH=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
SHA=1111111111111111111111111111111111111111

cat > "$TMP/valid.json" <<JSON
{
  "schema_version": "openwiki-evaluation/v1",
  "study_id": "fixture-study",
  "experimental_unit": "repository_generation_run",
  "primary_outcomes": ["source_grounded_task_success", "atomic_claim_support_rate"],
  "repositories": [
    {
      "id": "fixture-repo",
      "source": {
        "repository": "example/fixture",
        "commit": "$SHA",
        "path": "snapshots/source"
      },
      "openwiki_outputs": [
        {
          "id": "fixture-a",
          "method": "baseline",
          "path": "wiki/a",
          "run_id": "run-a-001",
          "generation": {
            "provenance": "complete",
            "model": {"id": "model-snapshot-a", "provider": "fixture", "immutable": true},
            "prompt_sha256": "$HASH",
            "config_sha256": "$HASH"
          }
        },
        {
          "id": "fixture-b",
          "method": "source-anchored",
          "path": "wiki/b",
          "run_id": "run-b-001",
          "generation": {
            "provenance": "complete",
            "model": {"id": "model-snapshot-a", "provider": "fixture", "immutable": true},
            "prompt_sha256": "$HASH",
            "config_sha256": "$HASH"
          }
        }
      ],
      "evaluation": {
        "splits": {
          "development": {"path": "qa/development.json", "spent": true},
          "public": {"path": "qa/public.json", "spent": false},
          "holdout": {"path": "qa/holdout.json", "spent": false}
        },
        "tasks": {
          "repository_qa": "tasks/repository-qa.json",
          "navigation": "tasks/navigation.json",
          "change_impact": "tasks/change-impact.json",
          "implementation": "tasks/implementation.json"
        },
        "isolation": {
          "source_only_task_author": ["wiki/a", "wiki/b", "results"],
          "wiki_only_answerer": ["snapshots/source", "qa/holdout.json", "reviews"],
          "blind_judge": ["snapshots/source", "results", "reviews"]
        }
      }
    }
  ]
}
JSON

node "$VALIDATOR" "$TMP/valid.json" --root "$TMP" --check-paths > "$TMP/valid.out" 2>&1
rc=$?
[ "$rc" -eq 0 ] || { echo "selftest: valid manifest should exit 0" >&2; cat "$TMP/valid.out" >&2; fail=1; }
grep -q '"status": "passed"' "$TMP/valid.out" || { echo "selftest: valid manifest did not report passed" >&2; fail=1; }

cat > "$TMP/invalid.json" <<JSON
{
  "schema_version": "openwiki-evaluation/v1",
  "study_id": "invalid-study",
  "experimental_unit": "repository_generation_run",
  "primary_outcomes": ["source_grounded_task_success"],
  "repositories": [
    {
      "id": "fixture-repo",
      "source": {"repository": "example/fixture", "commit": "not-a-sha", "path": "snapshots/source"},
      "openwiki_outputs": [
        {
          "id": "duplicate",
          "method": "baseline",
          "path": "wiki/a",
          "run_id": "run-a",
          "generation": {
            "provenance": "partial",
            "model": {"id": null, "provider": null, "immutable": false},
            "prompt_sha256": null,
            "config_sha256": null
          }
        },
        {
          "id": "duplicate",
          "method": "candidate",
          "path": "wiki/a/nested",
          "run_id": "run-b",
          "generation": {
            "provenance": "partial",
            "model": {"id": null, "provider": null, "immutable": false},
            "prompt_sha256": null,
            "config_sha256": null
          }
        }
      ],
      "evaluation": {
        "splits": {
          "development": {"path": "qa/public.json", "spent": true},
          "public": {"path": "qa/public.json", "spent": false},
          "holdout": {"path": "qa/holdout.json", "spent": false}
        },
        "tasks": {
          "repository_qa": "tasks/repository-qa.json",
          "navigation": "tasks/navigation.json",
          "change_impact": "tasks/change-impact.json",
          "implementation": "tasks/implementation.json"
        },
        "isolation": {
          "source_only_task_author": ["wiki/a"],
          "wiki_only_answerer": ["snapshots/source"],
          "blind_judge": ["results"]
        }
      }
    }
  ]
}
JSON

node "$VALIDATOR" "$TMP/invalid.json" > "$TMP/invalid.out" 2>&1
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: invalid manifest should exit 2" >&2; cat "$TMP/invalid.out" >&2; fail=1; }
for reason in \
  "source.commit must be a 40-character hexadecimal SHA" \
  "duplicate openwiki output id" \
  "openwiki output paths overlap" \
  "evaluation split paths must be distinct"; do
  grep -q "$reason" "$TMP/invalid.out" || { echo "selftest: invalid control missed reason: $reason" >&2; fail=1; }
done

printf '%s\n' '# outside source' > "$OUTSIDE/README.md"
ln -s "$OUTSIDE" "$TMP/snapshots/source-link"
sed 's#snapshots/source"#snapshots/source-link"#' "$TMP/valid.json" > "$TMP/symlink.json"
node "$VALIDATOR" "$TMP/symlink.json" --root "$TMP" --check-paths > "$TMP/symlink.out" 2>&1
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: symlink escape should exit 2" >&2; cat "$TMP/symlink.out" >&2; fail=1; }
grep -q "resolves outside root through a symlink" "$TMP/symlink.out" || {
  echo "selftest: symlink escape failed for the wrong reason" >&2
  cat "$TMP/symlink.out" >&2
  fail=1
}

[ "$fail" -eq 0 ] && echo "evaluation selftest: PASS"
exit "$fail"
