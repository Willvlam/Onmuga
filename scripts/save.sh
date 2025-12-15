#!/usr/bin/env bash
set -euo pipefail

echo "Staging all changes..."
git add -A

MSG="Add multiplayer games, server, frontend, and Replit config"
if [ "${1-}" ]; then
  MSG="$1"
fi

echo "Committing with message: $MSG"
git commit -m "$MSG" || {
  echo "Nothing to commit or commit failed.";
  exit 0;
}

echo "Pushing to origin/main..."
git push origin main

echo "Done."
