#!/bin/sh
# Deterministic mutation driver used only by harness/selftest.sh.
set -u

TARGET="${1:?fake_driver.sh requires target page}"
STATE="${HARNESS_FIXTURE_STATE:?HARNESS_FIXTURE_STATE is required}"
REPLACEMENT="${HARNESS_FIXTURE_REPLACEMENT:?HARNESS_FIXTURE_REPLACEMENT is required}"
MUTATE_ON="${HARNESS_FIXTURE_MUTATE_ON:-1}"

case "$MUTATE_ON" in
  ''|*[!0-9]*)
    echo "fake_driver: HARNESS_FIXTURE_MUTATE_ON must be a positive integer" >&2
    exit 64
    ;;
esac

count=0
if [ -f "$STATE" ]; then
  count=$(cat "$STATE")
fi
case "$count" in
  ''|*[!0-9]*)
    echo "fake_driver: state file is not an integer: $STATE" >&2
    exit 64
    ;;
esac

count=$((count + 1))
printf '%s\n' "$count" > "$STATE"

if [ "$count" -eq "$MUTATE_ON" ]; then
  cp "$REPLACEMENT" "$TARGET"
fi
