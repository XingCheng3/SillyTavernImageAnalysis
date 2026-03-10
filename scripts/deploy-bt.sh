#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
TARGET_DIR="/www/wwwroot/Web/TextCreateImage"

if [ ! -d "$DIST_DIR" ]; then
  echo "[deploy-bt] dist 目录不存在：$DIST_DIR" >&2
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "[deploy-bt] 目标目录不存在：$TARGET_DIR" >&2
  exit 1
fi

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='.user.ini' "$DIST_DIR/" "$TARGET_DIR/"
else
  find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name '.user.ini' -exec rm -rf {} +
  cp -R "$DIST_DIR/." "$TARGET_DIR/"
fi

echo "[deploy-bt] 已同步 dist -> $TARGET_DIR"
