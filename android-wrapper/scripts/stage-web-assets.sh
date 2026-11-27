#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Stages the built React PWA (repo-root dist/) into the Android WebView asset root.
# CI performs the same copy inline; this script gives local and agent builds one
# supported path so the APK never ships an empty shell.
#
# Usage: ./scripts/stage-web-assets.sh   (from android-wrapper/, or any directory)
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$WRAPPER_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
WWW_DIR="$WRAPPER_DIR/app/src/main/assets/www"

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "ERROR: $DIST_DIR/index.html is missing." >&2
  echo "Build the PWA first: cd \"$ROOT_DIR\" && npm run build -- --base=/" >&2
  exit 1
fi

mkdir -p "$WWW_DIR"
# Clear previously staged files but keep the tracked .gitkeep marker.
find "$WWW_DIR" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +

cp -R "$DIST_DIR/." "$WWW_DIR/"

if [ ! -f "$WWW_DIR/index.html" ]; then
  echo "ERROR: staging failed, $WWW_DIR/index.html was not created." >&2
  exit 1
fi

STAGED=$(find "$WWW_DIR" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')
echo "Staged $STAGED file(s) from dist/ into android-wrapper/app/src/main/assets/www/"
