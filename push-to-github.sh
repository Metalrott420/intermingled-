#!/bin/bash
set -e
if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set in this shell."
  exit 1
fi
git remote set-url origin "https://Metalrott420:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/Metalrott420/intermingled-.git"
git push -u origin main
git remote set-url origin "https://github.com/Metalrott420/intermingled-.git"
echo "Done — token removed from remote URL."
