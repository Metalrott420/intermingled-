#!/bin/bash
set -e
TOKEN="${1:-$GITHUB_PERSONAL_ACCESS_TOKEN}"
if [ -z "$TOKEN" ]; then
  echo "Usage: bash push-to-github.sh ghp_YOUR_TOKEN"
  exit 1
fi
git push "https://Metalrott420:${TOKEN}@github.com/Metalrott420/intermingled-.git" HEAD:main
echo "Done."
