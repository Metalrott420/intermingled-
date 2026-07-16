#!/usr/bin/env bash
# test-build-url-fallback.sh
#
# Verifies that extract-build-url.sh correctly resolves the EAS build URL in all
# scenarios, including the critical fallback path where the EAS CLI exits before
# printing any expo.dev link (auth failure, network timeout, queue rejection, etc.).
#
# Run from any directory:
#   bash .github/scripts/test-build-url-fallback.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTRACT="$SCRIPT_DIR/extract-build-url.sh"

PASS=0
FAIL=0
FALLBACK="https://github.com/org/repo/actions/runs/999"

run_test() {
  local name="$1"
  local eas_output="$2"
  local expected="$3"

  local tmp
  tmp=$(mktemp /tmp/eas-test-XXXXXX.txt)
  printf '%s' "$eas_output" > "$tmp"

  local result
  result=$(EAS_OUTPUT_FILE="$tmp" FALLBACK_URL="$FALLBACK" bash "$EXTRACT" 2>/dev/null)
  rm -f "$tmp"

  if [ "$result" = "$expected" ]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name"
    echo "  expected: $expected"
    echo "  got:      $result"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== EAS build URL fallback tests ==="
echo ""

# ------------------------------------------------------------------
# Scenario 1: Output file does not exist at all
# Happens when EAS CLI crashes immediately (e.g. binary not found).
# ------------------------------------------------------------------
NOFILE=$(mktemp /tmp/eas-test-XXXXXX.txt)
rm -f "$NOFILE"
result=$(EAS_OUTPUT_FILE="$NOFILE" FALLBACK_URL="$FALLBACK" bash "$EXTRACT" 2>/dev/null)
if [ "$result" = "$FALLBACK" ]; then
  echo "PASS: missing output file falls back to GitHub Actions URL"
  PASS=$((PASS + 1))
else
  echo "FAIL: missing output file falls back to GitHub Actions URL"
  echo "  expected: $FALLBACK"
  echo "  got:      $result"
  FAIL=$((FAIL + 1))
fi

# ------------------------------------------------------------------
# Scenario 2: File exists but contains no expo.dev URL
# Happens on auth failure, token expiry, or network timeout before
# the build is queued and a URL is printed.
# ------------------------------------------------------------------
run_test \
  "early exit (auth/network error, no URL) falls back to GitHub Actions URL" \
  "Error: EXPO_TOKEN is invalid or expired.
Authentication failed. Please run 'eas login' and try again.
Exiting with code 1." \
  "$FALLBACK"

# ------------------------------------------------------------------
# Scenario 3: File contains a bare expo.dev URL in plain text output
# Normal success/queued path.
# ------------------------------------------------------------------
run_test \
  "expo.dev URL in plain text output is extracted" \
  "Build queued: https://expo.dev/accounts/intermingled/projects/intermingled/builds/abc-123
Waiting for build worker..." \
  "https://expo.dev/accounts/intermingled/projects/intermingled/builds/abc-123"

# ------------------------------------------------------------------
# Scenario 4: File contains --json array output with a build id
# The CLI's --json flag produces a JSON array; we construct the URL
# from the id field.
# ------------------------------------------------------------------
run_test \
  "JSON array output with build id constructs expo.dev URL" \
  '[{"id":"deadbeef-0000-0000-0000-000000000000","platform":"ios","status":"in-progress"}]' \
  "https://expo.dev/accounts/intermingled/projects/intermingled/builds/deadbeef-0000-0000-0000-000000000000"

# ------------------------------------------------------------------
# Scenario 5: File has both JSON and a plain-text URL — plain URL wins
# (grep runs first and is faster; JSON fallback only activates when
# grep finds nothing).
# ------------------------------------------------------------------
run_test \
  "plain-text URL takes precedence over JSON id when both are present" \
  'Build page: https://expo.dev/accounts/intermingled/projects/intermingled/builds/url-wins
[{"id":"json-id-should-not-win","platform":"ios","status":"in-progress"}]' \
  "https://expo.dev/accounts/intermingled/projects/intermingled/builds/url-wins"

# ------------------------------------------------------------------
# Scenario 6: Empty file (EAS CLI produced no output at all)
# ------------------------------------------------------------------
run_test \
  "empty output file falls back to GitHub Actions URL" \
  "" \
  "$FALLBACK"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
