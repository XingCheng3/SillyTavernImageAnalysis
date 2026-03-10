#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/post-commit

echo "[setup-git-hooks] 已启用仓库本地 Git hooks: $PROJECT_ROOT/.githooks"
