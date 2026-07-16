#!/usr/bin/env bash
# extract-build-url.sh
#
# Extracts the EAS build URL from tee'd CLI output. Falls back to a caller-supplied
# URL (typically the GitHub Actions run URL) when the EAS CLI exits before printing
# any expo.dev link — e.g. on auth failure, network timeout, or queue rejection.
#
# Environment variables:
#   EAS_OUTPUT_FILE   — path to the tee'd EAS CLI output (default: /tmp/eas-build-output.txt)
#   FALLBACK_URL      — URL to emit when no expo.dev link is found (required)
#   EXPO_ACCOUNT      — expo.dev account slug used to construct URLs from bare build IDs
#                       (default: intermingled)
#   EXPO_PROJECT      — expo.dev project slug (default: intermingled)
#
# Writes the resolved URL to stdout.
# When GITHUB_OUTPUT is set (i.e. inside a GitHub Actions step), also appends
# "build_url=<url>" to that file so downstream steps can reference it as an output.

set -euo pipefail

EAS_OUTPUT_FILE="${EAS_OUTPUT_FILE:-/tmp/eas-build-output.txt}"
FALLBACK_URL="${FALLBACK_URL:?FALLBACK_URL must be set}"
EXPO_ACCOUNT="${EXPO_ACCOUNT:-intermingled}"
EXPO_PROJECT="${EXPO_PROJECT:-intermingled}"

BUILD_URL=""

if [ -f "$EAS_OUTPUT_FILE" ]; then
  BUILD_URL=$(grep -oE 'https://expo\.dev/accounts/[^[:space:]"]+' "$EAS_OUTPUT_FILE" | head -1 || true)

  if [ -z "$BUILD_URL" ]; then
    BUILD_ID=$(node -e "
      const fs = require('fs');
      try {
        const raw = fs.readFileSync(process.argv[1], 'utf8');
        const jsonMatch = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const builds = Array.isArray(parsed) ? parsed : [parsed];
          process.stdout.write(builds[0]?.id ?? '');
        }
      } catch {}
    " "$EAS_OUTPUT_FILE" 2>/dev/null || true)

    if [ -n "$BUILD_ID" ]; then
      BUILD_URL="https://expo.dev/accounts/${EXPO_ACCOUNT}/projects/${EXPO_PROJECT}/builds/${BUILD_ID}"
    fi
  fi
fi

if [ -z "$BUILD_URL" ]; then
  BUILD_URL="$FALLBACK_URL"
fi

echo "$BUILD_URL"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "build_url=$BUILD_URL" >> "$GITHUB_OUTPUT"
fi
