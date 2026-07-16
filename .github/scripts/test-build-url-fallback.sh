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

# ------------------------------------------------------------------
# Scenario 7: Output has brace/bracket characters but no valid JSON
# e.g. "Error: request failed { connection: refused }" — the regex
# matches the brace fragment, JSON.parse throws, BUILD_ID stays empty,
# and the fallback URL must fire.
# ------------------------------------------------------------------
run_test \
  "brace-like text with no valid JSON falls back to GitHub Actions URL" \
  "Error: EAS build request failed { connection: refused }
Check your network connection and try again." \
  "$FALLBACK"

# ------------------------------------------------------------------
# iOS parity: Scenarios 8–10 mirror the "Capture build URL and error
# on failure" step in ios-build.yml specifically.  These confirm that
# the fallback fires for iOS with the same guarantees as Android when
# the EAS CLI exits before printing any expo.dev link.
#
# The step runs:
#   EAS_OUTPUT_FILE=/tmp/eas-build-output.txt \
#   FALLBACK_URL="<github-actions-run-url>" \
#   bash "$GITHUB_WORKSPACE/.github/scripts/extract-build-url.sh"
#
# …from the artifacts/flirtfest-mobile working-directory.  The three
# cases below cover the failure modes most likely to produce an empty
# or URL-free /tmp/eas-build-output.txt on iOS builds:
#   8. EAS CLI crashes before printing anything (binary/signal fault)
#   9. EAS token validation fails before the build is queued
#  10. iOS-platform JSON with a build id but no plain-text URL
# ------------------------------------------------------------------

# Scenario 8: File is completely empty — EAS CLI crashed immediately
# (e.g. SIGKILL, OOM, or binary not found).
run_test \
  "iOS: empty output file (EAS CLI crash) falls back to GitHub Actions URL" \
  "" \
  "$FALLBACK"

# Scenario 9: Token/auth failure specific to iOS credentials — no URL
# is ever printed because the build was never queued.
run_test \
  "iOS: EXPO_TOKEN invalid before iOS build is queued falls back to GitHub Actions URL" \
  "Error: EXPO_TOKEN is invalid or expired.
Unable to authenticate with Expo servers. Re-run 'eas login'.
Build platform: ios
Exiting with code 1." \
  "$FALLBACK"

# Scenario 10: EAS --json output for an iOS build carries an id but no
# plain-text expo.dev URL — the script must construct the URL from the id.
run_test \
  "iOS: JSON output with ios platform id constructs expo.dev URL" \
  '[{"id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","platform":"ios","status":"in-progress"}]' \
  "https://expo.dev/accounts/intermingled/projects/intermingled/builds/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
